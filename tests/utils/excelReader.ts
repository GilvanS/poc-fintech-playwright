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

export interface UserData {
    SEQ?: string | number;
    ID_MASSA: string;
    NOME_COMPLETO: string;
    CPF: string;
    SENHA: string;
    [key: string]: any;
}

/**
 * Lê todos os registros de uma aba da planilha de massa de dados.
 * @param sheetName Nome da aba na planilha (padrão: 'TBL_CENARIOS')
 * @param fileName Nome do arquivo na pasta data (padrão: 'MassaDadosCMS.xlsx')
 */
export function readExcelSheet<T = any>(
    sheetName: string = 'TBL_CENARIOS',
    fileName: string = 'MassaDadosCMS.xlsx'
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
        throw new Error(`Cenário '${idCenario}' não encontrado em TBL_CENARIOS na planilha MassaDadosCMS.xlsx`);
    }

    return {
        ...cenario,
        CPF: cenario.CPF !== undefined && cenario.CPF !== null ? String(cenario.CPF) : '',
        SENHA: cenario.SENHA !== undefined && cenario.SENHA !== null ? String(cenario.SENHA) : ''
    };
}

/**
 * Obtém a massa de cadastro de usuário pelo ID_MASSA (ex: '0001').
 */
export function getMassaCadastroById(idMassa: string): UserData | undefined {
    const cadastros = readExcelSheet<any>('TBL_CADASTRO');
    const user = cadastros.find((item) => item.ID_MASSA && String(item.ID_MASSA).padStart(4, '0') === idMassa.padStart(4, '0'));
    if (!user) return undefined;

    return {
        ...user,
        CPF: user.CPF !== undefined && user.CPF !== null ? String(user.CPF) : '',
        SENHA: user.SENHA !== undefined && user.SENHA !== null ? String(user.SENHA) : ''
    };
}
