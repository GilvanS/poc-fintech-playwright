import * as XLSX from 'xlsx';
import * as path from 'path';

export interface ScenarioData {
    SEQ?: number;
    ID_CENARIO: string;
    NOME: string;
    FEATURE?: string;
    ID_MASSA?: string;
    CPF: string;
    SENHA: string;
    NOME_CATEGORIA?: string;
    DESCRICAO_CATEGORIA?: string;
    NOME_ARTIGO?: string;
    DESCRICAO_ARTIGO?: string;
    [key: string]: any;
}

/**
 * Lê todos os registros de uma aba da planilha de massa de dados.
 * @param sheetName Nome da aba na planilha (padrão: 'TBL_CENARIOS')
 * @param fileName Nome do arquivo na pasta data (padrão: 'MassaDados.xlsx')
 */
export function readExcelSheet<T = any>(
    sheetName: string = 'TBL_CENARIOS',
    fileName: string = 'MassaDados.xlsx'
): T[] {
    const filePath = path.resolve(process.cwd(), 'data', fileName);
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
        throw new Error(`Aba '${sheetName}' não encontrada na planilha '${fileName}'`);
    }
    return XLSX.utils.sheet_to_json<T>(sheet);
}

/**
 * Obtém os dados de um cenário específico pelo seu ID_CENARIO (ex: 'CT01.2').
 * Retorna CPF e SENHA convertidos para string garantindo compatibilidade.
 */
export function getCenarioData(idCenario: string): ScenarioData {
    const cenarios = readExcelSheet<any>('TBL_CENARIOS');
    const cenario = cenarios.find((item) => item.ID_CENARIO && String(item.ID_CENARIO).trim() === idCenario.trim());

    if (!cenario) {
        throw new Error(`Cenário '${idCenario}' não encontrado em TBL_CENARIOS na planilha MassaDados.xlsx`);
    }

    const cpfFormatado = cenario.CPF !== undefined && cenario.CPF !== null ? String(cenario.CPF) : '';
    let dadosExtrasMassa = {};

    try {
        const bdMassas = readExcelSheet<any>('tbl_de_massas');
        const massaEncontrada = bdMassas.find((item) => item.cpf && String(item.cpf).trim() === cpfFormatado.trim());

        if (massaEncontrada) {
            // A aba 'tbl_de_massas' pode ter cabeçalhos com espaço acidental
            // (ex: " fatura_fechada " em vez de "fatura_fechada" — mesmo problema já
            // documentado em TBL_CENARIOS via API/utils/testPlanningXlsx.cjs). Acessar
            // a chave limpa direto retornava `undefined`, que sobrescrevia (spread
            // abaixo) o valor correto vindo de TBL_CENARIOS com 'undefined' — testData
            // acabava com fatura_fechada/fatura_aberta = 0 mesmo com a massa em dia.
            // Casa por nome (trim) contra as chaves que a linha JÁ tem, igual ao padrão
            // já usado em saveCenarioAssignment.
            const porChaveTrim = new Map(Object.keys(massaEncontrada).map((k) => [k.trim(), k]));
            const valor = (campo: string) => {
                const chaveReal = porChaveTrim.get(campo);
                return chaveReal ? massaEncontrada[chaveReal] : undefined;
            };
            dadosExtrasMassa = {
                saldo_conta: valor('saldo_conta'),
                limite_utilizado: valor('limite_utilizado'),
                limite_disponivel: valor('limite_disponivel'),
                fatura_fechada: valor('fatura_fechada'),
                fatura_aberta: valor('fatura_aberta'),
                dias_atraso: valor('dias_atraso')
            };
        }
    } catch (e) {
        // Fallback silencioso ignorando log de erro se a aba 'tbl_de_massas' não existir
    }

    return {
        ...cenario,
        ...dadosExtrasMassa,
        CPF: cpfFormatado,
        SENHA: cenario.SENHA !== undefined && cenario.SENHA !== null ? String(cenario.SENHA) : ''
    };
}
