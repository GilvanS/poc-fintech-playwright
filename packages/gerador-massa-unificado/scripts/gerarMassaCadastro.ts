import fs from 'node:fs';
import path from 'node:path';
import * as XLSX from 'xlsx';
import { gerarDados, gerarUsuario } from 'gerador-massa-unificado';
import { appendRowsPreservingFormat } from '../../../tests/utils/excelTableAppender';

/**
 * Runner de massa "Cadastro" — gera só os campos que o form real de aquisição (SignUp.tsx do
 * FintechBankApp) e o CadastroModel/TBL_CADASTRO deste projeto esperam: nome completo, email,
 * cpf, senha. Sem produto/artigo (conceito do CMS, não existe no domínio Fintech) e sem os
 * dados ricos do Massas 3.0 (endereço/cartão/saldo/atraso — isso é gerado só dentro do
 * FintechBankApp/WEB, feature separada).
 *
 * Grava as MESMAS linhas em dois lugares — CSV (histórico/inspeção) e TBL_CADASTRO do xlsx
 * (fonte real que o teste de cadastro consome) — igual ao CMS, que mantém o CSV do Runner 1
 * e a aba da planilha sincronizados a partir da mesma geração.
 *
 *   npm run massa:cadastro -- 5
 *   npm run massa:cadastro -- 5 data/massaCadastro.csv
 */
const CAMINHO_PADRAO = 'data/massaCadastro.csv';
const CAMINHO_XLSX = 'data/MassaDados.xlsx';
const ABA_XLSX = 'TBL_CADASTRO';
const HEADER = 'ID_MASSA;NOME_COMPLETO;NOME_USUARIO;EMAIL;SENHA;CPF;TELEFONE;CEP;RUA;NUMERO;BAIRRO;CIDADE;ESTADO;PAIS;DATA_NASCIMENTO;BANDEIRA_CARTAO;TIER_CARTAO;DIA_VENCIMENTO;NOME_IMPRESSO;PLANO_CONTA;CHAVE_PIX;NOME_TUTOR;CPF_TUTOR';
/** Senha fixa enquanto o projeto está em fase de testes — mesma regra do Massas 3.0. */
const SENHA_PADRAO_TESTES = 'admin999';
/** Prefixo do ID_MASSA deste pool — diferencia de TBL_CENARIOS (numeração pura, sem
 *  prefixo, usada por login/dashboard/fatura) e evita duplicidade de ID entre os dois. */
const PREFIXO_ID_MASSA = 'C_';

function formatCsvField(valor: unknown): string {
    if (valor === null || valor === undefined) return '=""';
    return `="${String(valor).replace(/"/g, '""')}"`;
}

async function main(): Promise<void> {
    const quantidade = Number(process.argv[2] ?? '1');
    const caminho = process.argv[3] ?? CAMINHO_PADRAO;

    if (!Number.isInteger(quantidade) || quantidade < 1) {
        console.error(`❌ Quantidade inválida: '${process.argv[2]}'. Informe um inteiro maior que zero.`);
        process.exit(1);
    }

    // size > 0 não basta: um arquivo "apagado" na mão às vezes sobra com 1 quebra de
    // linha (size > 0, mas sem conteúdo real) — isso fazia o header nunca ser escrito.
    // Garantir que o CSV tenha o header atualizado com todas as colunas do Onboarding 360°
    if (fs.existsSync(caminho)) {
        const linhasExistentes = fs.readFileSync(caminho, 'utf-8').split(/\r?\n/).filter(l => l.trim().length > 0);
        if (linhasExistentes.length > 0 && linhasExistentes[0].trim() !== HEADER) {
            const totalCols = HEADER.split(';').length;
            const linhasCorrigidas = linhasExistentes.slice(1).map(line => {
                const cols = line.split(';');
                while (cols.length < totalCols) {
                    cols.push('=""');
                }
                return cols.slice(0, totalCols).join(';');
            });
            fs.writeFileSync(caminho, [HEADER, ...linhasCorrigidas].join('\n') + '\n', 'utf-8');
        }
    }

    const conteudoAtual = fs.existsSync(caminho) ? fs.readFileSync(caminho, 'utf-8') : '';
    const arquivoJaExiste = conteudoAtual.trim().length > 0;
    const linhasCsv: string[] = arquivoJaExiste ? [] : [HEADER];

    // Numeração baseada em TBL_CADASTRO (fonte real que o teste consome), não no CSV —
    // os dois precisam concordar, e a planilha é quem manda.
    const workbook = XLSX.readFile(CAMINHO_XLSX);
    const poolAtual = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[ABA_XLSX]);
    const maiorIdAtual = poolAtual.reduce((max, r) => {
        const numero = parseInt(String(r.ID_MASSA).replace(PREFIXO_ID_MASSA, ''), 10);
        return Math.max(max, Number.isNaN(numero) ? 0 : numero);
    }, 0);
    const novasLinhasXlsx: Record<string, unknown>[] = [];

    console.log(`➕ Acrescentando ${quantidade} novos registros em '${caminho}' e em '${ABA_XLSX}' (${CAMINHO_XLSX})...`);

    for (let i = 1; i <= quantidade; i++) {
        const dadosApi = await gerarDados();
        const usuario = gerarUsuario(dadosApi);
        const idMassa = PREFIXO_ID_MASSA + String(maiorIdAtual + i).padStart(4, '0');

        linhasCsv.push(
            [
                idMassa, usuario.nomeCompleto, usuario.nomeUsuario, usuario.email, SENHA_PADRAO_TESTES, usuario.cpf,
                usuario.telefone, usuario.zipCode, usuario.addressLine, usuario.numeroEndereco, usuario.bairro,
                usuario.city, usuario.stateRegion, usuario.country, usuario.birthDate, usuario.cardBrand,
                usuario.cardTier, usuario.cardDueDay, usuario.cardPrintedName, usuario.plan, usuario.pixKey,
                usuario.tutorName, usuario.tutorCpf
            ]
                .map(formatCsvField)
                .join(';'),
        );
        novasLinhasXlsx.push({
            ID_MASSA: idMassa,
            NOME_COMPLETO: usuario.nomeCompleto,
            NOME_USUARIO: usuario.nomeUsuario,
            EMAIL: usuario.email,
            SENHA: SENHA_PADRAO_TESTES,
            CPF: usuario.cpf,
            TELEFONE: usuario.telefone,
            CEP: usuario.zipCode,
            RUA: usuario.addressLine,
            NUMERO: usuario.numeroEndereco,
            BAIRRO: usuario.bairro,
            CIDADE: usuario.city,
            ESTADO: usuario.stateRegion,
            PAIS: usuario.country,
            DATA_NASCIMENTO: usuario.birthDate,
            BANDEIRA_CARTAO: usuario.cardBrand,
            TIER_CARTAO: usuario.cardTier,
            DIA_VENCIMENTO: usuario.cardDueDay,
            NOME_IMPRESSO: usuario.cardPrintedName,
            PLANO_CONTA: usuario.plan,
            CHAVE_PIX: usuario.pixKey,
            NOME_TUTOR: usuario.tutorName,
            CPF_TUTOR: usuario.tutorCpf,
        });

        console.log(`✅ Registro ${idMassa} — ${usuario.nomeCompleto} /${quantidade} acrescentado.`);
    }

    fs.mkdirSync(path.dirname(caminho), { recursive: true });
    fs.appendFileSync(caminho, linhasCsv.join('\n') + '\n', 'utf-8');

    // Append-only via XML cru — preserva a Tabela do Excel formatada em TBL_CADASTRO
    // (XLSX.writeFile reescreveria o workbook inteiro e a perderia). Ver excelTableAppender.ts.
    appendRowsPreservingFormat(
        CAMINHO_XLSX,
        ABA_XLSX,
        novasLinhasXlsx.map((linha) => Object.fromEntries(Object.entries(linha).map(([k, v]) => [k, String(v ?? '')]))),
    );

    console.log(`🎉 Operação concluída. ${quantidade} registro(s) gravado(s) em: ${caminho} e em '${ABA_XLSX}' (${CAMINHO_XLSX}).`);
}

main().catch((erro) => {
    console.error('❌ Falha ao gerar a massa de cadastro:', erro);
    process.exit(1);
});
