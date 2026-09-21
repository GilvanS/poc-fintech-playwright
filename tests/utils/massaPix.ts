import * as XLSX from 'xlsx';
import path from 'path';
import { logger } from './logger';

/**
 * Massa do cenário de Pix — nada mockado, tudo da planilha (MassaDados.xlsx):
 *
 *  TBL_CENARIOS (linha ID_CENARIO = CTxx.x)
 *      └─ CPF (remetente), SENHA e coluna "Valor PIX"
 *  TBL_USUARIOS_SECUNDARIOS (linha ID_CENARIO = CTxx.x)
 *      └─ CPF/ID_MASSA de quem RECEBE o Pix
 *  TBL_USUARIOS (join por CPF — mesma aba usada pro remetente)
 *      └─ Nome Completo do destinatário (validado na tela de revisão)
 *
 * Destinatário e remetente vêm da MESMA aba (TBL_USUARIOS) de propósito: é a massa
 * de usuários que existem de verdade no banco, então o CPF colocado em
 * TBL_USUARIOS_SECUNDARIOS tem que ser de uma linha já presente em TBL_USUARIOS —
 * TBL_CADASTRO é de outro domínio (fluxo de cadastro) e não deve ser usada aqui.
 * Quem decide qual massa cada cenário usa é quem edita a planilha, não o código —
 * a correlação é pelo ID_CENARIO.
 */
const ARQUIVO = path.resolve(process.cwd(), 'data', 'MassaDados.xlsx');
const ABA_CENARIOS = 'TBL_CENARIOS';
const ABA_SECUNDARIOS = 'TBL_USUARIOS_SECUNDARIOS';
const ABA_USUARIOS = 'TBL_USUARIOS';

export type PixMassa = {
    /** ID do cenário (ex: 'CT02.1') — chave da correlação entre as TBLs. */
    idCenario: string;
    /** CPF do remetente (quem loga e envia) — de TBL_CENARIOS. */
    cpfRemetente: string;
    /** Nome completo do remetente — TBL_USUARIOS, correlação por CPF (+ ID_MASSA). */
    nomeRemetente: string;
    /** Valor do Pix (ex: 15.99) — de TBL_CENARIOS, coluna "Valor PIX". */
    valorPix: number;
    /** CPF de quem recebe o Pix — de TBL_USUARIOS_SECUNDARIOS. */
    cpfDestinatario: string;
    /** Nome completo do destinatário — join TBL_MASSA_CADASTRADA/TBL_CADASTRO por CPF. */
    nomeDestinatario: string;
    /** ID_MASSA do destinatário em TBL_USUARIOS_SECUNDARIOS (ex: '0010'). */
    idMassaDestinatario: string;
    /** Mensagem do Pix — TBL_CENARIOS coluna MENSAGEM (fallback 'teste' enquanto vazia). */
    mensagem: string;
    /** PIN do cartão — TBL_CENARIOS coluna PIN (fallback '9898' enquanto vazia). */
    pin: string;
    /** Resultado esperado: 'CONCLUIR' (positivo, default) ou 'BLOQUEAR' (negativo —
     *  coluna RESULTADO = BLOQUEAR em TBL_CENARIOS: valor do Pix maior que o saldo). */
    resultadoEsperado: 'CONCLUIR' | 'BLOQUEAR';
};

function normalizarCpf(valor: unknown): string {
    return String(valor ?? '').replace(/\D/g, '');
}

/** Normaliza chave de aba: sheet_to_json usa o header cru como propriedade ("VALOR "
 *  com espaço viraria chave "VALOR "), então trim em tudo. */
function normalizarChave(r: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(r)) out[k.trim().toUpperCase()] = v;
    return out;
}

/**
 * Lê a massa completa do cenário de Pix pelo ID_CENARIO (ex: 'CT02.1').
 * Lança erro explícito apontando a aba/coluna exata quando algo falta —
 * nunca assume default: se a planilha não tem o dado, o teste falha na hora.
 */
export function obterMassaPixDoCenario(idCenario: string): PixMassa {
    const workbook = XLSX.readFile(ARQUIVO);
    const id = String(idCenario ?? '').trim();

    // 1) Remetente + Valor PIX — TBL_CENARIOS
    const cenarios = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[ABA_CENARIOS]).map(normalizarChave);
    const linhaCenario = cenarios.find((r) => String(r['ID_CENARIO'] ?? '').trim() === id);
    if (!linhaCenario) {
        const msg = `Linha '${id}' não encontrada em '${ABA_CENARIOS}' (${ARQUIVO}).`;
        logger.error(`❌ ${msg}`);
        throw new Error(msg);
    }
    const cpfRemetente = normalizarCpf(linhaCenario['CPF']);
    const valorBruto = linhaCenario['VALOR PIX'] ?? linhaCenario['VALOR_PIX'];
    if (valorBruto === undefined || valorBruto === null || String(valorBruto).trim() === '') {
        const msg = `Coluna 'Valor PIX' vazia ou ausente na linha '${id}' de '${ABA_CENARIOS}'. Preencha o valor do Pix na planilha.`;
        logger.error(`❌ ${msg}`);
        throw new Error(msg);
    }
    const valorPix = Number(valorBruto);

    // 2) Destinatário — TBL_USUARIOS_SECUNDARIOS (correlação por ID_CENARIO)
    if (!workbook.Sheets[ABA_SECUNDARIOS]) {
        const msg = `Aba '${ABA_SECUNDARIOS}' não encontrada em ${ARQUIVO}. Crie a aba com as colunas ID_CENARIO/CPF.`;
        logger.error(`❌ ${msg}`);
        throw new Error(msg);
    }
    const secundarios = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[ABA_SECUNDARIOS]).map(normalizarChave);
    const linhaSec = secundarios.find((r) => String(r['ID_CENARIO'] ?? '').trim() === id);
    if (!linhaSec) {
        const msg = `Linha '${id}' não encontrada em '${ABA_SECUNDARIOS}' — sem destinatário do Pix. Adicione a linha na planilha.`;
        logger.error(`❌ ${msg}`);
        throw new Error(msg);
    }
    const cpfDestinatario = normalizarCpf(linhaSec['CPF']);
    const idMassaDestinatario = String(linhaSec['ID_MASSA'] ?? '').trim();
    if (!cpfDestinatario) {
        const msg = `CPF do destinatário vazio na linha '${id}' de '${ABA_SECUNDARIOS}'.`;
        logger.error(`❌ ${msg}`);
        throw new Error(msg);
    }

    // 3) Nome do destinatário — join por CPF em TBL_USUARIOS, a MESMA aba usada no
    // passo 4 abaixo pra validar o remetente. TBL_USUARIOS é a massa de usuários
    // reais no banco (login funciona pra qualquer linha dela); TBL_CADASTRO é de
    // outro domínio (fluxo de cadastro) e não deveria ser fonte de destinatário de
    // Pix — o teste do app consulta a chave Pix no backend de verdade e mostra o
    // nome do titular (PixPage.ts:210), então o CPF aqui tem que ser de alguém que
    // exista no banco com aquele nome, o que TBL_USUARIOS já garante.
    const nome = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[ABA_USUARIOS] ?? {})
        .map(normalizarChave)
        .filter((r) => normalizarCpf(r['CPF']) === cpfDestinatario)
        .map((r) => String(r['NOME COMPLETO'] ?? '').trim())
        .find((n) => n !== '');
    if (!nome) {
        const msg = `Nome do destinatário não encontrado: CPF '${cpfDestinatario}' da linha '${id}' de '${ABA_SECUNDARIOS}' não existe em '${ABA_USUARIOS}'. Troque o CPF/ID_MASSA da linha do destinatário para um usuário já cadastrado em '${ABA_USUARIOS}'.`;
        logger.error(`❌ ${msg}`);
        throw new Error(msg);
    }

    // 4) Nome do remetente — TBL_USUARIOS (correlação por CPF; ID_MASSA confirma o vínculo)
    if (!workbook.Sheets[ABA_USUARIOS]) {
        const msg = `Aba '${ABA_USUARIOS}' não encontrada em ${ARQUIVO}. Crie a aba com as colunas ID_MASSA/CPF/Nome Completo pra validar o nome do cliente logado.`;
        logger.error(`❌ ${msg}`);
        throw new Error(msg);
    }
    const linhaUsuario = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[ABA_USUARIOS])
        .map(normalizarChave)
        .filter((r) => normalizarCpf(r['CPF']) === cpfRemetente)
        .find((r) => String(r['NOME COMPLETO'] ?? '').trim() !== '');
    if (!linhaUsuario) {
        const msg = `CPF do remetente '${cpfRemetente}' (linha '${id}') não encontrado em '${ABA_USUARIOS}' (colunas ID_MASSA/CPF/Nome Completo). Adicione o usuário na planilha.`;
        logger.error(`❌ ${msg}`);
        throw new Error(msg);
    }
    const nomeRemetente = String(linhaUsuario['NOME COMPLETO']).trim();

    // 5) Mensagem e PIN do Pix — TBL_CENARIOS (colunas MENSAGEM e PIN). Fallback fixo
    //    enquanto a coluna não existir ou estiver vazia na planilha: sem coluna não é
    //    erro (migração gradual), mas o valor da planilha SEMPRE vence quando presente.
    const MENSAGEM_FALLBACK = 'teste';
    const PIN_FALLBACK = '9898';
    const mensagem = String(linhaCenario['MENSAGEM'] ?? '').trim() || MENSAGEM_FALLBACK;
    const pin = String(linhaCenario['PIN'] ?? '').trim() || PIN_FALLBACK;

    // RESULTADO = BLOQUEAR marca o cenário NEGATIVO (saldo insuficiente): o step de saldo
    // não aborta — segue pra validar que a UI bloqueia o envio. Qualquer outro valor (ou
    // coluna ausente) = cenário positivo CONCLUIR.
    const resultadoEsperado = String(linhaCenario['RESULTADO'] ?? '').trim().toUpperCase() === 'BLOQUEAR' ? 'BLOQUEAR' : 'CONCLUIR';

    return { idCenario: id, cpfRemetente, nomeRemetente, valorPix, cpfDestinatario, nomeDestinatario: nome, idMassaDestinatario, mensagem, pin, resultadoEsperado };
}

/**
 * Formata o valor do Pix para o padrão exibido na UI (pt-BR, 2 casas).
 * Ex: 15.99 → 'R$ 15,99'. O campo monetário da UI funciona por dígitos (centavos
 * implícitos), então 'R$ 15,99' digitado aparece como 'R$ 15,99' na revisão —
 * o mesmo valor formatado serve de entrada e de validação do comprovante.
 */
export function formatarValorPix(valor: number): string {
    return valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
