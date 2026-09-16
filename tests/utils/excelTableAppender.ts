import fs from 'node:fs';
import path from 'node:path';
import PizZip from 'pizzip';

/**
 * Acrescenta linhas no FIM de uma aba de .xlsx sem reescrever o workbook inteiro —
 * `XLSX.writeFile()` (SheetJS) reconstrói o arquivo do zero e não sabe re-emitir Tabelas
 * do Excel ("Formatar como Tabela"), então qualquer aba formatada assim perde a
 * formatação a cada escrita, mesmo abas que o script nem tocou. Isso já aconteceu com
 * MassaDados.xlsx nesta sessão (0 partes 'tables/' restando no zip).
 *
 * Mesma técnica do `aquisicaoMassa.ts` do CMS (poc-fintech-playwright's sibling project):
 * abre o .xlsx como zip (pizzip) e edita só a entrada do worksheet — todo o resto do
 * arquivo (Tabelas, outras abas, sharedStrings.xml) sai byte a byte igual ao que entrou.
 * Diferença: aqui é append-only (linhas novas no fim, nunca reescreve linhas
 * existentes), então dá pra também ESTENDER o `ref` da Tabela do Excel (se houver) pra
 * cobrir as linhas novas — no CMS a aba é recriada do zero e a Tabela vira autoFilter.
 */
export function appendRowsPreservingFormat(
    caminhoExcel: string,
    nomeAba: string,
    novasLinhas: Array<Record<string, string>>,
): void {
    if (novasLinhas.length === 0) return;
    if (!fs.existsSync(caminhoExcel)) {
        throw new Error(`Planilha não encontrada no caminho: ${caminhoExcel}`);
    }

    const zip = new PizZip(fs.readFileSync(caminhoExcel));
    const aba = localizarAba(zip, nomeAba);
    let sheetXml = textoDoZip(zip, aba.caminhoWorksheet);
    const textosCompartilhados = lerSharedStrings(zip);

    // Cabeçalho (linha 1) dá a ordem real das colunas na aba — os dados de entrada são
    // objetos por NOME de campo, não por letra de coluna, então não importa se um script
    // gera as chaves em ordem diferente da planilha.
    const cabecalho = lerCelulasDaLinha(sheetXml, textosCompartilhados, 1);
    const colunas = Object.keys(cabecalho);
    if (colunas.length === 0) {
        throw new Error(`Aba '${nomeAba}' não tem cabeçalho na linha 1 — não dá pra saber a ordem das colunas.`);
    }
    const nomesColunas = colunas.map((c) => cabecalho[c]);

    const primeiraLinhaNova = ultimaLinha(sheetXml) + 1;
    const ultimaLinhaNova = primeiraLinhaNova + novasLinhas.length - 1;
    const linhasXml = novasLinhas
        .map((linha, i) => construirLinhaXml(primeiraLinhaNova + i, colunas, nomesColunas, linha))
        .join('');

    sheetXml = sheetXml.replace('</sheetData>', `${linhasXml}</sheetData>`);
    sheetXml = atualizarDimension(sheetXml, colunas[colunas.length - 1], ultimaLinhaNova);
    sheetXml = estenderAutoFilterDireto(sheetXml, colunas[colunas.length - 1], ultimaLinhaNova);

    extenderTabelaSeExistir(zip, sheetXml, aba, colunas[colunas.length - 1], ultimaLinhaNova);

    zip.file(aba.caminhoWorksheet, sheetXml);
    descartarCalcChain(zip);
    forcarRecalculoNaAbertura(zip);

    const buffer = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }) as Buffer;
    escreverComSeguranca(buffer, caminhoExcel);
}

export interface AbaLocalizada {
    caminhoWorksheet: string;
    caminhoRels: string;
}

/** Acha o arquivo físico da aba pelo NOME, seguindo workbook.xml → r:id → rels → target. */
export function localizarAba(zip: PizZip, nomeAba: string): AbaLocalizada {
    const workbookXml = textoDoZip(zip, 'xl/workbook.xml');
    const regexSheet = new RegExp(`<sheet\\b[^>]*name="${escaparRegex(nomeAba)}"[^>]*/>`);
    const tagSheet = workbookXml.match(regexSheet)?.[0];
    if (!tagSheet) {
        throw new Error(`Aba '${nomeAba}' não encontrada em xl/workbook.xml.`);
    }
    const rId = tagSheet.match(/r:id="([^"]+)"/)?.[1];
    if (!rId) {
        throw new Error(`Aba '${nomeAba}' não tem r:id em xl/workbook.xml: ${tagSheet}`);
    }

    const relsXml = textoDoZip(zip, 'xl/_rels/workbook.xml.rels');
    const regexRel = new RegExp(`<Relationship\\b[^>]*Id="${escaparRegex(rId)}"[^>]*/>`);
    const tagRel = relsXml.match(regexRel)?.[0];
    const target = tagRel?.match(/Target="([^"]+)"/)?.[1];
    if (!target) {
        throw new Error(`Relação '${rId}' da aba '${nomeAba}' não encontrada em xl/_rels/workbook.xml.rels.`);
    }

    const caminhoWorksheet = `xl/${target}`;
    const nomeArquivo = target.split('/').pop();
    return {
        caminhoWorksheet,
        caminhoRels: `xl/worksheets/_rels/${nomeArquivo}.rels`,
    };
}

/** Se a aba tem Tabela do Excel (tableParts), estende o `ref` dela pra cobrir a linha nova. */
function extenderTabelaSeExistir(
    zip: PizZip,
    sheetXml: string,
    aba: AbaLocalizada,
    ultimaColuna: string,
    ultimaLinhaNova: number,
): void {
    const tablePartMatch = sheetXml.match(/<tablePart r:id="([^"]+)"\s*\/>/);
    if (!tablePartMatch) return;

    const relsArquivo = zip.file(aba.caminhoRels);
    if (!relsArquivo) return;
    const relsXml = relsArquivo.asText();
    const rId = tablePartMatch[1];
    const relMatch = relsXml.match(new RegExp(`<Relationship\\b[^>]*Id="${escaparRegex(rId)}"[^>]*/>`));
    const target = relMatch?.[0]?.match(/Target="([^"]+)"/)?.[1];
    if (!target) return;

    const caminhoTabela = path.posix.normalize(path.posix.join(path.posix.dirname(aba.caminhoRels), '..', target));
    const tabelaArquivo = zip.file(caminhoTabela);
    if (!tabelaArquivo) return;

    // <table ref="A1:F19" ...> e o <autoFilter ref="A1:F19"/> interno da tabela usam o
    // mesmo padrão de atributo — extender os dois pro mesmo range novo.
    const tabelaXmlAtualizada = tabelaArquivo
        .asText()
        .replace(/ref="([A-Z]+)(\d+):[A-Z]+\d+"/g, (_match, colIni, linhaIni) => `ref="${colIni}${linhaIni}:${ultimaColuna}${ultimaLinhaNova}"`);
    zip.file(caminhoTabela, tabelaXmlAtualizada);
}

/** AutoFilter direto na aba (sem Tabela) — extende junto, mesmo padrão. */
function estenderAutoFilterDireto(sheetXml: string, ultimaColuna: string, ultimaLinhaNova: number): string {
    return sheetXml.replace(
        /<autoFilter ref="([A-Z]+)(\d+):[A-Z]+\d+"\s*\/>/,
        (_match, colIni, linhaIni) => `<autoFilter ref="${colIni}${linhaIni}:${ultimaColuna}${ultimaLinhaNova}"/>`,
    );
}

function construirLinhaXml(
    numeroLinha: number,
    colunas: string[],
    nomesColunas: string[],
    dados: Record<string, string>,
): string {
    const celulas = colunas
        .map((coluna, i) => {
            const valor = dados[nomesColunas[i]] ?? '';
            const ref = `${coluna}${numeroLinha}`;
            if (valor === '') return `<c r="${ref}"/>`;
            return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escaparXml(sanitizarTexto(valor))}</t></is></c>`;
        })
        .join('');
    return `<row r="${numeroLinha}">${celulas}</row>`;
}

function atualizarDimension(sheetXml: string, ultimaColuna: string, ultimaLinhaNova: number): string {
    if (!/<dimension ref="[^"]*"\s*\/>/.test(sheetXml)) return sheetXml;
    return sheetXml.replace(/<dimension ref="[^"]*"\s*\/>/, `<dimension ref="A1:${ultimaColuna}${ultimaLinhaNova}"/>`);
}

export function lerSharedStrings(zip: PizZip): string[] {
    const arquivo = zip.file('xl/sharedStrings.xml');
    if (!arquivo) return [];
    return [...arquivo.asText().matchAll(/<si>(.*?)<\/si>/gs)].map((item) =>
        [...item[1].matchAll(/<t[^>]*>(.*?)<\/t>/gs)].map((t) => t[1]).join(''),
    );
}

/** Lê uma linha como { COLUNA: valor }, na ordem em que as células aparecem no XML. */
export function lerCelulasDaLinha(sheetXml: string, textosCompartilhados: string[], numeroLinha: number): Record<string, string> {
    const linha = sheetXml.match(new RegExp(`<row r="${numeroLinha}"[^>]*>(.*?)</row>`, 's'));
    if (!linha) return {};

    const celulas: Record<string, string> = {};
    const padrao = /<c r="([A-Z]+)\d+"([^>]*)>(?:(.*?))?<\/c>|<c r="([A-Z]+)\d+"([^>]*)\/>/gs;
    for (const encontrada of linha[1].matchAll(padrao)) {
        const coluna = encontrada[1] ?? encontrada[4];
        const atributos = encontrada[2] ?? encontrada[5] ?? '';
        const conteudo = encontrada[3] ?? '';
        const tipo = atributos.match(/t="([^"]+)"/)?.[1];

        const inline = conteudo.match(/<is><t[^>]*>(.*?)<\/t><\/is>/s)?.[1];
        if (inline !== undefined) {
            celulas[coluna] = desescaparXml(inline);
            continue;
        }
        const valor = conteudo.match(/<v>(.*?)<\/v>/s)?.[1];
        if (valor === undefined) {
            celulas[coluna] = '';
            continue;
        }
        celulas[coluna] = tipo === 's' ? (textosCompartilhados[Number(valor)] ?? '') : desescaparXml(valor);
    }
    return celulas;
}

export function ultimaLinha(sheetXml: string): number {
    const linhas = [...sheetXml.matchAll(/<row r="(\d+)"/g)].map((m) => Number(m[1]));
    return linhas.length ? Math.max(...linhas) : 1;
}

export function textoDoZip(zip: PizZip, caminho: string): string {
    const arquivo = zip.file(caminho);
    if (!arquivo) throw new Error(`Parte não encontrada dentro do .xlsx: ${caminho}`);
    return arquivo.asText();
}

/** O calcChain.xml passa a apontar pra estado desatualizado a cada linha nova — o Excel
 *  reconstrói sozinho ao abrir, então removê-lo evita um índice mentiroso no pacote. */
export function descartarCalcChain(zip: PizZip): void {
    if (!zip.file('xl/calcChain.xml')) return;
    zip.remove('xl/calcChain.xml');
    zip.file('[Content_Types].xml', textoDoZip(zip, '[Content_Types].xml').replace(/<Override\b[^>]*calcChain[^>]*\/>/, ''));
    zip.file(
        'xl/_rels/workbook.xml.rels',
        textoDoZip(zip, 'xl/_rels/workbook.xml.rels').replace(/<Relationship\b[^>]*calcChain[^>]*\/>/, ''),
    );
}

/** Marca o arquivo pro Excel recalcular tudo ao abrir, em vez de confiar em cache velho. */
export function forcarRecalculoNaAbertura(zip: PizZip): void {
    let workbookXml = textoDoZip(zip, 'xl/workbook.xml');
    if (/<calcPr\b[^>]*fullCalcOnLoad/.test(workbookXml)) return;
    workbookXml = workbookXml.includes('<calcPr')
        ? workbookXml.replace(/<calcPr\b[^>]*?\/>/, (tag) => tag.replace('/>', ' fullCalcOnLoad="1"/>'))
        : workbookXml.replace('</workbook>', '<calcPr fullCalcOnLoad="1"/></workbook>');
    zip.file('xl/workbook.xml', workbookXml);
}

function desescaparXml(texto: string): string {
    return texto
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#13;/g, '\r')
        .replace(/&#10;/g, '\n')
        .replace(/&amp;/g, '&');
}

function escaparXml(texto: string): string {
    return texto
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\r/g, '&#13;')
        .replace(/\n/g, '&#10;');
}

/** Remove caracteres que o XML 1.0 não aceita em texto (fora tab/LF/CR). */
function sanitizarTexto(texto: string): string {
    // eslint-disable-next-line no-control-regex
    return texto.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '');
}

function escaparRegex(texto: string): string {
    return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Grava em arquivo temporário e troca pelo definitivo via rename atômico — nunca deixa
 *  o caminho final num estado parcial se a escrita for interrompida no meio. */
export function escreverComSeguranca(conteudo: Buffer, caminhoFinal: string): void {
    const temporario = `${caminhoFinal}.tmp-${process.pid}-${Date.now()}`;
    fs.writeFileSync(temporario, conteudo);

    if (fs.statSync(temporario).size === 0) {
        fs.unlinkSync(temporario);
        throw new Error(`Escrita da planilha resultou em arquivo vazio: ${temporario}`);
    }

    fs.renameSync(temporario, caminhoFinal);
}
