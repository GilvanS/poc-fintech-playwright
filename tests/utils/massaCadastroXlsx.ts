import * as XLSX from 'xlsx';
import * as path from 'path';
import { CadastroModel } from '../massa-types/CadastroModel';
import { logger } from './logger';
import { appendRowsPreservingFormat } from './excelTableAppender';

/**
 * Massa de cadastro vem do ID_MASSA fixo configurado em TBL_CENARIOS (linha
 * ID_CENARIO='cadastrar') — igual às outras linhas de cenário (CT01.x etc.), onde quem
 * escolhe a massa é quem edita a planilha, não o código. Os dados completos (nome,
 * email, senha, cpf) vêm de TBL_CADASTRO pelo ID_MASSA; TBL_MASSA_CADASTRADA é só o
 * registro de quem já foi efetivamente cadastrado. Se o ID_MASSA configurado já estiver
 * lá, FALHA com instrução pra trocar — nunca escolhe outra massa sozinho.
 */
const ARQUIVO = path.resolve(process.cwd(), 'data', 'MassaDados.xlsx');
const ABA_POOL = 'TBL_CADASTRO';
const ABA_JA_CADASTRADAS = 'TBL_MASSA_CADASTRADA';
const ABA_CENARIOS = 'TBL_CENARIOS';
const ID_CENARIO_CADASTRO = 'cadastrar';

function normalizarIdMassa(valor: unknown): string {
    return String(valor ?? '').trim();
}

/** Só dígitos — dedup por CPF é a fonte real de verdade (é o que a API rejeita), imune a
 *  diferença de formatação/prefixo entre TBL_CADASTRO e TBL_MASSA_CADASTRADA. */
function normalizarCpf(valor: unknown): string {
    return String(valor ?? '').replace(/\D/g, '');
}

/** Remove o prefixo 'C_' (marca de "candidato no pool de cadastro") — depois de cadastrada
 *  de verdade a massa vira uma massa normal, com ID puro, igual às demais linhas de
 *  TBL_CENARIOS. O prefixo só faz sentido dentro de TBL_CADASTRO. */
function removerPrefixoPool(idMassa: string): string {
    return idMassa.replace(/^C_/i, '');
}

/**
 * Lê o ID_MASSA fixo de TBL_CENARIOS/cadastrar e busca os dados em TBL_CADASTRO.
 * @param exigirNaoUsada Default `true` — falha se a massa já estiver em TBL_MASSA_CADASTRADA.
 *   Os cenários de campo obrigatório (CT00.1-CT00.5) nunca completam o cadastro (o browser
 *   bloqueia antes do submit), então não faz sentido exigir massa "ainda não usada" pra eles
 *   — só o cenário que registra de verdade (@cadastrar/@CT00) precisa dessa garantia.
 *   Sem isso, os dois tipos de cenário competiam pelo mesmo ponteiro e qualquer execução
 *   completa (`npm run bdd:cadastro`) quebrava os 5 de validação assim que o CT00 registrava.
 */
export function obterMassaCadastroDoCenario(exigirNaoUsada = true): CadastroModel {
    const workbook = XLSX.readFile(ARQUIVO);

    const cenarios = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[ABA_CENARIOS]);
    const linhaCenario = cenarios.find((r) => r.ID_CENARIO === ID_CENARIO_CADASTRO);
    if (!linhaCenario) {
        const msg = `Linha '${ID_CENARIO_CADASTRO}' não encontrada em '${ABA_CENARIOS}'.`;
        logger.error(`❌ ${msg}`);
        throw new Error(msg);
    }
    const idMassa = normalizarIdMassa(linhaCenario.ID_MASSA);

    const pool = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[ABA_POOL]);
    const linhaPool = pool.find((r) => normalizarIdMassa(r.ID_MASSA) === idMassa);
    if (!linhaPool) {
        const msg = `ID_MASSA '${idMassa}' (configurado em '${ABA_CENARIOS}'/'${ID_CENARIO_CADASTRO}') não existe em '${ABA_POOL}'.`;
        logger.error(`❌ ${msg}`);
        throw new Error(msg);
    }

    const jaCadastradas = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[ABA_JA_CADASTRADAS]);
    const cpfsUsados = new Set(jaCadastradas.map((r) => normalizarCpf(r.CPF)));
    const jaUsada = cpfsUsados.has(normalizarCpf(linhaPool.CPF));
    if (jaUsada && exigirNaoUsada) {
        const livre = pool.find((r) => !cpfsUsados.has(normalizarCpf(r.CPF)));
        const sugestao = livre
            ? ` Sugestão de massa livre: '${normalizarIdMassa(livre.ID_MASSA)}' (${livre.NOME_COMPLETO}).`
            : ' Nenhuma massa livre restante em TBL_CADASTRO — adicione mais linhas (npm run massa:cadastro).';
        const msg =
            `ID_MASSA '${idMassa}' já está em '${ABA_JA_CADASTRADAS}' (já foi cadastrada antes). ` +
            `Troque o ID_MASSA na linha '${ID_CENARIO_CADASTRO}' de '${ABA_CENARIOS}' para uma massa ainda não usada.${sugestao}`;
        logger.error(`❌ ${msg}`);
        throw new Error(msg);
    }

    return {
        seq: linhaPool.SEQ as string | number | undefined,
        idMassa,
        nomeCompleto: String(linhaPool.NOME_COMPLETO ?? ''),
        nomeUsuario: linhaPool.NOME_USUARIO ? String(linhaPool.NOME_USUARIO) : undefined,
        email: String(linhaPool.EMAIL ?? ''),
        senha: String(linhaPool.SENHA ?? ''),
        cpf: String(linhaPool.CPF ?? ''),
        telefone: linhaPool.TELEFONE ? String(linhaPool.TELEFONE) : undefined,
        cep: linhaPool.CEP ? String(linhaPool.CEP) : undefined,
        rua: linhaPool.RUA ? String(linhaPool.RUA) : undefined,
        numero: linhaPool.NUMERO ? String(linhaPool.NUMERO) : undefined,
        bairro: linhaPool.BAIRRO ? String(linhaPool.BAIRRO) : undefined,
        cidade: linhaPool.CIDADE ? String(linhaPool.CIDADE) : undefined,
        estado: linhaPool.ESTADO ? String(linhaPool.ESTADO) : undefined,
        pais: linhaPool.PAIS ? String(linhaPool.PAIS) : undefined,
        dataNascimento: linhaPool.DATA_NASCIMENTO ? String(linhaPool.DATA_NASCIMENTO) : undefined,
        bandeiraCartao: linhaPool.BANDEIRA_CARTAO ? String(linhaPool.BANDEIRA_CARTAO) : undefined,
        tierCartao: linhaPool.TIER_CARTAO ? String(linhaPool.TIER_CARTAO) : undefined,
        diaVencimento: linhaPool.DIA_VENCIMENTO ? String(linhaPool.DIA_VENCIMENTO) : undefined,
        nomeImpresso: linhaPool.NOME_IMPRESSO ? String(linhaPool.NOME_IMPRESSO) : undefined,
        planoConta: linhaPool.PLANO_CONTA ? String(linhaPool.PLANO_CONTA) : undefined,
        chavePix: linhaPool.CHAVE_PIX ? String(linhaPool.CHAVE_PIX) : undefined,
        nomeTutor: linhaPool.NOME_TUTOR ? String(linhaPool.NOME_TUTOR) : undefined,
        cpfTutor: linhaPool.CPF_TUTOR ? String(linhaPool.CPF_TUTOR) : undefined,
    };
}

/** Registra a massa como já cadastrada — só chamar depois do modal de sucesso confirmar.
 *  Escreve por cima do .xlsx (append-only, preserva Tabela do Excel) em vez de reescrever
 *  o workbook inteiro via XLSX.writeFile — ver excelTableAppender.ts. */
export function registrarMassaCadastrada(dados: CadastroModel): void {
    appendRowsPreservingFormat(ARQUIVO, ABA_JA_CADASTRADAS, [
        {
            ID_MASSA: removerPrefixoPool(dados.idMassa ?? ''),
            NOME_COMPLETO: dados.nomeCompleto,
            NOME_USUARIO: dados.nomeUsuario ?? '',
            EMAIL: dados.email,
            SENHA: dados.senha,
            CPF: dados.cpf,
            TELEFONE: dados.telefone ?? '',
            CEP: dados.cep ?? '',
            RUA: dados.rua ?? '',
            NUMERO: dados.numero ?? '',
            BAIRRO: dados.bairro ?? '',
            CIDADE: dados.cidade ?? '',
            ESTADO: dados.estado ?? '',
            PAIS: dados.pais ?? '',
            DATA_NASCIMENTO: dados.dataNascimento ?? '',
            BANDEIRA_CARTAO: dados.bandeiraCartao ?? '',
            TIER_CARTAO: dados.tierCartao ?? '',
            DIA_VENCIMENTO: dados.diaVencimento != null ? String(dados.diaVencimento) : '',
            NOME_IMPRESSO: dados.nomeImpresso ?? '',
            PLANO_CONTA: dados.planoConta ?? '',
            CHAVE_PIX: dados.chavePix ?? '',
            NOME_TUTOR: dados.nomeTutor ?? '',
            CPF_TUTOR: dados.cpfTutor ?? '',
        },
    ]);
}
