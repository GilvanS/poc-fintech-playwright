import { createHash } from 'node:crypto';
import { readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import PizZip from 'pizzip';
import { ABA_MASSA, COLUNA_CPF, formatarNumero, lerNumero, type Escrita } from './modelo.ts';

/**
 * Leitura e troca de células da aba `tbl_de_massas` editando o XML do .xlsx direto (mesma técnica do
 * `tests/utils/excelTableAppender.ts` do projeto de testes): o resto do arquivo — Tabelas, outras abas, estilos —
 * sai byte a byte igual. NUNCA reescrever o workbook inteiro com a biblioteca SheetJS: isso apaga a formatação de Tabela.
 */

export interface LinhaMassa {
  /** Número da linha na aba (1 = cabeçalho). */
  numero: number;
  /** Texto de cada célula como a pessoa vê (número vira "1234,56"), por nome de coluna. */
  valores: Record<string, string>;
  /** Texto cru de cada célula (o que está no arquivo), para conferir que nada além do combinado mudou. */
  brutos: Record<string, string>;
}

export const hashDoArquivo = (caminho: string): string => createHash('sha256').update(readFileSync(caminho)).digest('hex');

const escaparRegex = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const desescapar = (t: string) => t.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#13;/g, '\r').replace(/&#10;/g, '\n').replace(/&amp;/g, '&');
const escapar = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\r/g, '&#13;').replace(/\n/g, '&#10;');
// eslint-disable-next-line no-control-regex
const semControle = (t: string) => t.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '');

function texto(zip: PizZip, caminho: string): string {
  const arquivo = zip.file(caminho);
  if (!arquivo) throw new Error(`Parte não encontrada dentro do .xlsx: ${caminho}`);
  return arquivo.asText();
}

function caminhoDaAba(zip: PizZip, nomeAba: string): string {
  const tag = texto(zip, 'xl/workbook.xml').match(new RegExp(`<sheet\\b[^>]*name="${escaparRegex(nomeAba)}"[^>]*/>`))?.[0];
  const rId = tag?.match(/r:id="([^"]+)"/)?.[1];
  if (!tag || !rId) throw new Error(`Aba '${nomeAba}' não encontrada na planilha.`);
  const rels = texto(zip, 'xl/_rels/workbook.xml.rels');
  const alvo = rels.match(new RegExp(`<Relationship\\b[^>]*Id="${escaparRegex(rId)}"[^>]*/>`))?.[0]?.match(/Target="([^"]+)"/)?.[1];
  if (!alvo) throw new Error(`Relação ${rId} da aba '${nomeAba}' não encontrada.`);
  return `xl/${alvo}`;
}

function textosCompartilhados(zip: PizZip): string[] {
  const arquivo = zip.file('xl/sharedStrings.xml');
  if (!arquivo) return [];
  return [...arquivo.asText().matchAll(/<si>(.*?)<\/si>/gs)].map((si) => [...si[1].matchAll(/<t[^>]*>(.*?)<\/t>/gs)].map((t) => desescapar(t[1])).join(''));
}

const indiceDaColuna = (letras: string) => [...letras].reduce((soma, c) => soma * 26 + (c.charCodeAt(0) - 64), 0);

interface CelulaXml {
  coluna: string;
  tipo?: string;
  cru: string;
}

const REGEX_CELULA = /<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>(.*?)<\/c>)/gs;

function celulasDaLinha(xmlLinha: string, compartilhados: string[]): CelulaXml[] {
  return [...xmlLinha.matchAll(REGEX_CELULA)].map((m) => {
    const tipo = m[2].match(/\bt="([^"]+)"/)?.[1];
    const conteudo = m[3] ?? '';
    const inline = conteudo.match(/<is>(.*?)<\/is>/s);
    if (inline) return { coluna: m[1], tipo, cru: [...inline[1].matchAll(/<t[^>]*>(.*?)<\/t>/gs)].map((t) => desescapar(t[1])).join('') };
    const v = conteudo.match(/<v>(.*?)<\/v>/s)?.[1];
    if (v === undefined) return { coluna: m[1], tipo, cru: '' };
    return { coluna: m[1], tipo, cru: tipo === 's' ? (compartilhados[Number(v)] ?? '') : desescapar(v) };
  });
}

/** Todas as linhas `<row>` da aba (número + XML do miolo). */
const linhasDaAba = (sheetXml: string) => [...sheetXml.matchAll(/<row r="(\d+)"[^>]*?(?:\/>|>(.*?)<\/row>)/gs)].map((m) => ({ numero: Number(m[1]), xml: m[2] ?? '' }));

function cabecalhos(sheetXml: string, compartilhados: string[]): Map<string, string> {
  const primeira = linhasDaAba(sheetXml).find((l) => l.numero === 1);
  if (!primeira) throw new Error(`A aba '${ABA_MASSA}' não tem cabeçalho na linha 1.`);
  // Cabeçalhos podem ter espaço acidental (" fatura_fechada "): casa por nome sem espaços.
  return new Map(celulasDaLinha(primeira.xml, compartilhados).map((c) => [c.cru.trim(), c.coluna]));
}

const soDigitos = (t: string) => t.replace(/\D/g, '');

function acharLinha(caminho: string, cpf: string) {
  const zip = new PizZip(readFileSync(caminho));
  const aba = caminhoDaAba(zip, ABA_MASSA);
  const sheetXml = texto(zip, aba);
  const compartilhados = textosCompartilhados(zip);
  const colunas = cabecalhos(sheetXml, compartilhados);
  const letraCpf = colunas.get(COLUNA_CPF);
  if (!letraCpf) throw new Error(`A aba '${ABA_MASSA}' não tem a coluna '${COLUNA_CPF}'.`);

  for (const linha of linhasDaAba(sheetXml)) {
    if (linha.numero === 1) continue;
    const celulas = celulasDaLinha(linha.xml, compartilhados);
    if (soDigitos(celulas.find((c) => c.coluna === letraCpf)?.cru ?? '') === cpf) return { zip, aba, sheetXml, colunas, linha, celulas };
  }
  return null;
}

/** A linha da massa com este CPF (11 dígitos), ou null. Somente leitura. */
export function lerLinhaPorCpf(caminho: string, cpf: string): LinhaMassa | null {
  const achada = acharLinha(caminho, cpf);
  if (!achada) return null;
  const valores: Record<string, string> = {};
  const brutos: Record<string, string> = {};
  for (const [nome, letra] of achada.colunas) {
    const celula = achada.celulas.find((c) => c.coluna === letra);
    const cru = celula?.cru ?? '';
    brutos[nome] = cru;
    const numerica = celula !== undefined && (celula.tipo === undefined || celula.tipo === 'n') && cru !== '';
    valores[nome] = numerica && lerNumero(cru) !== null ? formatarNumero(lerNumero(cru)!) : cru;
  }
  return { numero: achada.linha.numero, valores, brutos };
}

function celulaNova(ref: string, estilo: string, tipoColuna: 'valor' | 'status', valor: string): string {
  if (tipoColuna === 'status') return `<c r="${ref}"${estilo} t="inlineStr"><is><t xml:space="preserve">${escapar(semControle(valor))}</t></is></c>`;
  const n = lerNumero(valor);
  if (n === null) throw new Error(`Valor numérico inválido para ${ref}: ${valor}`);
  return `<c r="${ref}"${estilo}><v>${Number(n.toFixed(2))}</v></c>`;
}

/**
 * Troca o valor das células pedidas na linha do CPF. Só toca nelas: o estilo da célula é mantido e o resto do arquivo
 * sai igual. Grava num temporário e troca por rename (nunca deixa o arquivo pela metade).
 */
export function gravarCelulas(caminho: string, cpf: string, escritas: Escrita[], tipos: Record<string, 'valor' | 'status'>): void {
  const achada = acharLinha(caminho, cpf);
  if (!achada) throw new Error(`CPF ${cpf} não está na aba '${ABA_MASSA}'.`);
  const { zip, aba, sheetXml, colunas, linha } = achada;
  let xmlLinha = linha.xml;

  for (const { coluna, valor } of escritas) {
    const letra = colunas.get(coluna);
    if (!letra) throw new Error(`A aba '${ABA_MASSA}' não tem a coluna '${coluna}'.`);
    const ref = `${letra}${linha.numero}`;
    const existente = xmlLinha.match(new RegExp(`<c r="${ref}"([^>]*?)(?:/>|>.*?</c>)`, 's'));
    const estilo = existente?.[1].match(/\bs="\d+"/)?.[0];
    const nova = celulaNova(ref, estilo ? ` ${estilo}` : '', tipos[coluna], valor);
    if (existente) {
      xmlLinha = xmlLinha.replace(existente[0], () => nova); // função: o texto novo nunca é lido como padrão ($&)
      continue;
    }
    // Célula ausente (linha esparsa): entra na posição certa, antes da primeira célula de coluna maior.
    const depois = [...xmlLinha.matchAll(/<c r="([A-Z]+)\d+"/g)].find((m) => indiceDaColuna(m[1]) > indiceDaColuna(letra));
    xmlLinha = depois ? xmlLinha.replace(depois[0], () => `${nova}${depois[0]}`) : `${xmlLinha}${nova}`;
  }

  const abertura = sheetXml.match(new RegExp(`<row r="${linha.numero}"[^>]*?>`))![0];
  const novoSheet = sheetXml.replace(`${abertura}${linha.xml}</row>`, () => `${abertura}${xmlLinha}</row>`);
  if (novoSheet === sheetXml) throw new Error('Nada foi trocado na linha da massa.');
  zip.file(aba, novoSheet);
  descartarCalcChain(zip);
  forcarRecalculoNaAbertura(zip);

  const buffer = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }) as Buffer;
  const temporario = `${caminho}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(temporario, buffer);
  if (statSync(temporario).size === 0) {
    unlinkSync(temporario);
    throw new Error(`A escrita da planilha resultou em arquivo vazio: ${temporario}`);
  }
  renameSync(temporario, caminho);
}

/** O calcChain.xml fica desatualizado ao trocar valores; o Excel o refaz sozinho ao abrir. */
function descartarCalcChain(zip: PizZip): void {
  if (!zip.file('xl/calcChain.xml')) return;
  zip.remove('xl/calcChain.xml');
  zip.file('[Content_Types].xml', texto(zip, '[Content_Types].xml').replace(/<Override\b[^>]*calcChain[^>]*\/>/, ''));
  zip.file('xl/_rels/workbook.xml.rels', texto(zip, 'xl/_rels/workbook.xml.rels').replace(/<Relationship\b[^>]*calcChain[^>]*\/>/, ''));
}

/** Pede ao Excel para recalcular tudo ao abrir. */
function forcarRecalculoNaAbertura(zip: PizZip): void {
  let workbook = texto(zip, 'xl/workbook.xml');
  if (/<calcPr\b[^>]*fullCalcOnLoad/.test(workbook)) return;
  workbook = workbook.includes('<calcPr')
    ? workbook.replace(/<calcPr\b[^>]*?\/>/, (tag) => tag.replace('/>', ' fullCalcOnLoad="1"/>'))
    : workbook.replace('</workbook>', '<calcPr fullCalcOnLoad="1"/></workbook>');
  zip.file('xl/workbook.xml', workbook);
}
