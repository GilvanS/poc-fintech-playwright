import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

export type ResultadoTeste = 'passou' | 'falhou';

export interface ResultadoDoRun {
  resultado: ResultadoTeste;
  /** Status como o Allure gravou (passed, failed, broken). */
  statusAllure: string;
  duracaoMs: number;
  /** Caminho (relativo à raiz do projeto de testes) do .docx de evidência gerado nesta execução. */
  evidencia?: string;
  /** Anexos do Allure (screenshot, trace, log…), relativos à raiz. */
  anexos: string[];
}

interface ResultAllure {
  status?: string;
  start?: number;
  stop?: number;
  labels?: { name: string; value: string }[];
  attachments?: { source?: string }[];
}

/** Folga para diferença de relógio entre o processo do teste e o servidor (mesma máquina: poucos ms). */
const FOLGA_MS = 2_000;

export function statusParaResultado(status?: string): ResultadoTeste | null {
  if (status === 'passed') return 'passou';
  if (status === 'failed' || status === 'broken') return 'falhou';
  return null; // skipped/unknown: o teste não chegou a rodar
}

async function ultimaEvidencia(raiz: string, desdeMs: number): Promise<string | undefined> {
  let nomes: string[];
  try {
    nomes = await readdir(join(raiz, 'evidences'));
  } catch {
    return undefined;
  }
  let melhor: { nome: string; em: number } | undefined;
  for (const nome of nomes.filter((n) => n.toLowerCase().endsWith('.docx'))) {
    const em = (await stat(join(raiz, 'evidences', nome))).mtimeMs;
    if (em >= desdeMs - FOLGA_MS && (!melhor || em > melhor.em)) melhor = { nome, em };
  }
  return melhor ? `evidences/${melhor.nome}` : undefined;
}

/**
 * Lê o resultado do Allure do teste `idCenario` (etiqueta `CT03.2`) gravado depois de `desdeMs`. Resultados mais antigos
 * não valem (são de outra execução). Devolve null quando não há resultado de verdade (processo caiu, teste pulado).
 */
export async function lerResultado(raiz: string, idCenario: string, desdeMs: number): Promise<ResultadoDoRun | null> {
  const dir = join(raiz, 'output', 'allure-results');
  let nomes: string[];
  try {
    nomes = await readdir(dir);
  } catch {
    return null;
  }

  let melhor: ResultAllure | undefined;
  for (const nome of nomes.filter((n) => n.endsWith('-result.json'))) {
    let r: ResultAllure;
    try {
      r = JSON.parse(await readFile(join(dir, nome), 'utf8')) as ResultAllure;
    } catch {
      continue; // arquivo ainda sendo escrito ou quebrado
    }
    if ((r.stop ?? 0) < desdeMs - FOLGA_MS) continue;
    if (!r.labels?.some((l) => l.name === 'tag' && l.value === idCenario)) continue;
    if (!melhor || (r.stop ?? 0) > (melhor.stop ?? 0)) melhor = r;
  }
  if (!melhor) return null;

  const resultado = statusParaResultado(melhor.status);
  if (!resultado) return null;
  return {
    resultado,
    statusAllure: melhor.status ?? '',
    duracaoMs: Math.max(0, (melhor.stop ?? 0) - (melhor.start ?? 0)),
    evidencia: await ultimaEvidencia(raiz, desdeMs),
    anexos: (melhor.attachments ?? []).map((a) => a.source).filter((s): s is string => Boolean(s)).map((s) => `output/allure-results/${s}`),
  };
}
