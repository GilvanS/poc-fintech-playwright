import fs from 'node:fs';
import path from 'node:path';
import PizZip from 'pizzip';
import {
    localizarAba,
    lerSharedStrings,
    lerCelulasDaLinha,
    ultimaLinha,
    textoDoZip,
    descartarCalcChain,
    forcarRecalculoNaAbertura,
    escreverComSeguranca,
} from '../../../tests/utils/excelTableAppender';

/**
 * Formata abas de um .xlsx como Tabela do Excel (Ctrl+T) — dropdown de filtro em cada
 * coluna e listras alternadas. Idempotente: pula aba que já tem Tabela. Exportada pra
 * poder ser chamada por outros scripts (ex: corrigirTblCadastro.ts) logo depois de um
 * `XLSX.writeFile()` — esse método (SheetJS free) não sabe reescrever Tabela do Excel,
 * então qualquer script que reescreva o workbook inteiro apaga a formatação; chamar isso
 * na sequência restaura sem precisar rodar um script separado depois.
 */
export function formatarTabelas(
    caminho: string,
    abas: Array<{ nome: string; tableId: number; tableName: string }>,
    estilo = 'TableStyleMedium8',
): void {
    if (!fs.existsSync(caminho)) {
        throw new Error(`Planilha não encontrada: ${caminho}`);
    }

    const zip = new PizZip(fs.readFileSync(caminho));
    const textosCompartilhados = lerSharedStrings(zip);
    let contentTypesXml = textoDoZip(zip, '[Content_Types].xml');

    for (const { nome, tableId, tableName } of abas) {
        const aba = localizarAba(zip, nome);
        let sheetXml = textoDoZip(zip, aba.caminhoWorksheet);

        if (/<tableParts\b/.test(sheetXml)) {
            console.log(`ℹ️ Aba '${nome}' já tem Tabela — pulando.`);
            continue;
        }

        const cabecalho = lerCelulasDaLinha(sheetXml, textosCompartilhados, 1);
        const colunas = Object.keys(cabecalho);
        if (colunas.length === 0) {
            console.warn(`⚠️ Aba '${nome}' sem cabeçalho na linha 1 — pulando.`);
            continue;
        }
        const nomesColunas = colunas.map((c) => cabecalho[c]);
        const ultimaLinhaDados = ultimaLinha(sheetXml);
        const ultimaColuna = colunas[colunas.length - 1];
        const range = `A1:${ultimaColuna}${ultimaLinhaDados}`;

        const colunasXml = nomesColunas.map((nomeColuna, i) => `<tableColumn id="${i + 1}" name="${escaparXmlAtributo(nomeColuna)}"/>`).join('');

        const tabelaXml =
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            `<table xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" id="${tableId}" name="${tableName}" displayName="${tableName}" ref="${range}" totalsRowShown="0">` +
            `<autoFilter ref="${range}"/>` +
            `<tableColumns count="${colunas.length}">${colunasXml}</tableColumns>` +
            `<tableStyleInfo name="${estilo}" showFirstColumn="0" showLastColumn="0" showRowStripes="1" showColumnStripes="0"/>` +
            '</table>';
        zip.file(`xl/tables/table${tableId}.xml`, tabelaXml);

        // tableParts entra como último filho de <worksheet>, depois de pageMargins/etc —
        // ordem exigida pelo schema OOXML.
        sheetXml = sheetXml.replace(
            '</worksheet>',
            '<tableParts count="1"><tablePart r:id="rIdTabela"/></tableParts></worksheet>',
        );
        zip.file(aba.caminhoWorksheet, sheetXml);

        // Nenhuma dessas abas tinha .rels próprio (SheetJS não gera um se a aba não tem
        // hyperlink/imagem) — cria do zero, só com a relação pra tabela nova.
        const relsXml =
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
            `<Relationship Id="rIdTabela" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/table" Target="../tables/table${tableId}.xml"/>` +
            '</Relationships>';
        zip.file(aba.caminhoRels, relsXml);

        contentTypesXml = contentTypesXml.replace(
            '</Types>',
            `<Override PartName="/xl/tables/table${tableId}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml"/></Types>`,
        );

        console.log(`✅ Aba '${nome}' formatada como Tabela '${tableName}' (${range}, estilo ${estilo}).`);
    }

    zip.file('[Content_Types].xml', contentTypesXml);
    descartarCalcChain(zip);
    forcarRecalculoNaAbertura(zip);

    const buffer = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }) as Buffer;
    escreverComSeguranca(buffer, caminho);
}

function escaparXmlAtributo(texto: string): string {
    return texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Abas padrão de data/MassaDados.xlsx do poc-fintech-playwright. */
const ABAS_PADRAO: Array<{ nome: string; tableId: number; tableName: string }> = [
    { nome: 'TBL_CENARIOS', tableId: 1, tableName: 'TabelaCenarios' },
    { nome: 'TBL_CADASTRO', tableId: 2, tableName: 'TabelaCadastro' },
    { nome: 'TBL_MASSA_CADASTRADA', tableId: 3, tableName: 'TabelaMassaCadastrada' },
];

/** Rodar direto: `npm run massa:formatar-tabelas` — formata as 3 abas padrão. */
function main(): void {
    const caminho = path.resolve(process.cwd(), 'data', 'MassaDados.xlsx');
    const backup = `${caminho}.bak-formatartabelas-${Date.now()}`;
    fs.copyFileSync(caminho, backup);
    console.log(`ℹ️ Backup criado em: ${backup}`);

    formatarTabelas(caminho, ABAS_PADRAO);
    console.log('🎉 Planilha atualizada com as Tabelas do Excel.');
}

if (require.main === module) {
    main();
}
