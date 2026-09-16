import fs from 'node:fs';

export function formatCsvField(valor: unknown): string {
  if (valor === null || valor === undefined) return '=""';
  return `="${String(valor).replace(/"/g, '""')}"`;
}

export function limparValorCsv(valor: string | null): string | null {
  if (valor === null) return null;
  if (valor.startsWith('="') && valor.endsWith('"')) {
    return valor.slice(2, -1).replace(/""/g, '"');
  }
  return valor;
}

export interface ContagensExistentes {
  categorias: Map<string, number>;
  artigos: Map<string, number>;
}

/**
 * Numeral romano canônico no fim do texto, que é o formato que `linhaMassa`
 * acrescenta a partir da segunda ocorrência (`Nome II`). Exige romano bem
 * formado — "DVD" não é — e recusa "I" sozinho, que nunca chega a ser gerado.
 */
const SUFIXO_ROMANO = /\s+(?!I$)(?=[MDCLXVI])M{0,3}(?:C[MD]|D?C{0,3})(?:X[CL]|L?X{0,3})(?:I[XV]|V?I{0,3})$/;

/**
 * Descobre o nome sem o sufixo de deduplicação.
 *
 * Só a regex não basta: "Livros em CD" e "Colecao MIX" terminam em romanos
 * válidos sem serem duplicatas de nada. O desempate é o próprio arquivo — o
 * sufixo só existe se a base aparecer sozinha em alguma linha, já que a
 * primeira ocorrência é sempre gravada sem sufixo.
 */
function nomeBase(nomeCompleto: string, nomesSemSufixo: Set<string>): string {
  const candidato = nomeCompleto.replace(SUFIXO_ROMANO, '').trim();
  if (candidato === nomeCompleto) return nomeCompleto;
  return nomesSemSufixo.has(candidato) ? candidato : nomeCompleto;
}

function contar(valores: string[]): Map<string, number> {
  // Primeira passada: o que aparece sem qualquer sufixo romano é base legítima.
  const nomesSemSufixo = new Set(valores.filter((v) => !SUFIXO_ROMANO.test(v)));

  const contagens = new Map<string, number>();
  for (const valor of valores) {
    const base = nomeBase(valor, nomesSemSufixo);
    contagens.set(base, (contagens.get(base) ?? 0) + 1);
  }
  return contagens;
}

export function carregarContagensDeArquivoExistente(caminho: string): ContagensExistentes {
  const vazio = (): ContagensExistentes => ({ categorias: new Map(), artigos: new Map() });

  if (!fs.existsSync(caminho) || fs.statSync(caminho).size === 0) return vazio();

  const conteudo = fs.readFileSync(caminho, 'utf-8');
  const linhas = conteudo.split(/\r?\n/).filter((l) => l.length > 0);
  const [headerLine, ...dataLines] = linhas;
  if (!headerLine) return vazio();

  const headers = headerLine.split(';');
  const indiceCategoria = headers.indexOf('NomeCategoria');
  const indiceArtigo = headers.indexOf('TituloArtigo');
  if (indiceCategoria === -1 || indiceArtigo === -1) return vazio();

  const nomesCategoria: string[] = [];
  const titulosArtigo: string[] = [];

  for (const linha of dataLines) {
    const colunas = linha.split(';');
    if (colunas.length <= Math.max(indiceCategoria, indiceArtigo)) continue;

    nomesCategoria.push((limparValorCsv(colunas[indiceCategoria]) ?? '').trim());
    titulosArtigo.push((limparValorCsv(colunas[indiceArtigo]) ?? '').trim());
  }

  return { categorias: contar(nomesCategoria), artigos: contar(titulosArtigo) };
}
