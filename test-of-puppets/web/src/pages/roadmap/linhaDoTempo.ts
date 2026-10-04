import type { ItemPlano } from '../planos/clientePlanos.ts';

/** Funções puras do Roadmap: datas 'aaaa-mm-dd' (sem fuso), janela de colunas e estado de cada barra. */

export type Zoom = 'mensal' | 'trimestral';

const MS_DIA = 86_400_000;
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const LETRAS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

const paraMs = (iso: string): number => {
  const [a, m, d] = iso.split('-').map(Number);
  return Date.UTC(a, m - 1, d);
};
const deMs = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

export const somarDias = (iso: string, n: number): string => deMs(paraMs(iso) + n * MS_DIA);
export const diasEntre = (de: string, ate: string): number => Math.round((paraMs(ate) - paraMs(de)) / MS_DIA);
/** 0 = domingo ... 6 = sábado. */
export const diaDaSemana = (iso: string): number => new Date(paraMs(iso)).getUTCDay();
export const ehFimDeSemana = (iso: string): boolean => diaDaSemana(iso) === 0 || diaDaSemana(iso) === 6;
export const segundaDa = (iso: string): string => somarDias(iso, -((diaDaSemana(iso) + 6) % 7));

/** Número da semana pela regra ISO (segunda a domingo; a semana 1 tem a primeira quinta-feira do ano). */
export function semanaISO(iso: string): number {
  const quinta = new Date(paraMs(somarDias(segundaDa(iso), 3)));
  const primeiroDia = Date.UTC(quinta.getUTCFullYear(), 0, 1);
  return Math.floor((quinta.getTime() - primeiroDia) / MS_DIA / 7) + 1;
}

export interface Unidade {
  inicio: string;
  fim: string;
  rotulo: string;
  sub: string;
  fimDeSemana: boolean;
}

export interface Janela {
  zoom: Zoom;
  inicio: string;
  fim: string;
  unidades: Unidade[];
  /** Faixas de mês sobre as colunas (rótulo "set/26" e quantas colunas ocupam). */
  meses: { rotulo: string; colunas: number }[];
}

const DIAS_MENSAL = 28;
const SEMANAS_TRIMESTRAL = 13;

/** Início da janela que mostra "hoje" perto da esquerda: segunda-feira, uma (mensal) ou duas (trimestral) semanas antes. */
export function inicioPara(zoom: Zoom, hoje: string): string {
  return somarDias(segundaDa(hoje), zoom === 'mensal' ? -7 : -14);
}

/** Anda um passo: 1 semana no mensal, 4 semanas no trimestral. */
export function deslocar(zoom: Zoom, inicio: string, sentido: 1 | -1): string {
  return somarDias(inicio, sentido * (zoom === 'mensal' ? 7 : 28));
}

export function montarJanela(zoom: Zoom, inicio: string): Janela {
  const unidades: Unidade[] = [];
  if (zoom === 'mensal') {
    for (let i = 0; i < DIAS_MENSAL; i += 1) {
      const dia = somarDias(inicio, i);
      unidades.push({ inicio: dia, fim: dia, rotulo: dia.slice(8), sub: LETRAS[diaDaSemana(dia)], fimDeSemana: ehFimDeSemana(dia) });
    }
  } else {
    for (let i = 0; i < SEMANAS_TRIMESTRAL; i += 1) {
      const ini = somarDias(inicio, i * 7);
      unidades.push({ inicio: ini, fim: somarDias(ini, 6), rotulo: `S${semanaISO(ini)}`, sub: '', fimDeSemana: false });
    }
  }
  const meses: Janela['meses'] = [];
  for (const u of unidades) {
    const rotulo = `${MESES[Number(u.inicio.slice(5, 7)) - 1]}/${u.inicio.slice(2, 4)}`;
    const ultimo = meses[meses.length - 1];
    if (ultimo && ultimo.rotulo === rotulo) ultimo.colunas += 1;
    else meses.push({ rotulo, colunas: 1 });
  }
  return { zoom, inicio, fim: unidades[unidades.length - 1].fim, unidades, meses };
}

/** "set–out/2026" (ou "set/2026" quando a janela cabe num mês só). */
export function rotuloDoPeriodo(j: Janela): string {
  const m = (iso: string) => MESES[Number(iso.slice(5, 7)) - 1];
  const ano = j.fim.slice(0, 4);
  return m(j.inicio) === m(j.fim) ? `${m(j.inicio)}/${ano}` : `${m(j.inicio)}–${m(j.fim)}/${ano}`;
}

export const indiceDaData = (j: Janela, iso: string): number => j.unidades.findIndex((u) => iso >= u.inicio && iso <= u.fim);

export interface Faixa {
  /** Colunas (0-based, inclusivas) que a barra ocupa dentro da janela. */
  de: number;
  ate: number;
  cortadaNaEsquerda: boolean;
  cortadaNaDireita: boolean;
}

/** Onde a barra de `ini` a `fim` cai na janela; null se ela fica toda fora. */
export function faixaNaJanela(j: Janela, ini: string, fim: string): Faixa | null {
  const primeira = j.unidades[0].inicio;
  const ultima = j.fim;
  if (fim < primeira || ini > ultima) return null;
  const de = ini < primeira ? 0 : indiceDaData(j, ini);
  const ate = fim > ultima ? j.unidades.length - 1 : indiceDaData(j, fim);
  return { de, ate, cortadaNaEsquerda: ini < primeira, cortadaNaDireita: fim > ultima };
}

export type EstadoBarra = 'ok' | 'falhou' | 'concluido' | 'atrasado' | 'planejado' | 'sem_data';

export interface BarraTeste {
  estado: EstadoBarra;
  /** Dia em que a barra aparece (execução se já concluído, senão o planejado). */
  data?: string;
}

/**
 * Concluído mostra o dia da execução (ou o planejado, se não houver); atrasado = a data planejada já passou
 * e o teste não terminou; sem nenhuma data não tem barra.
 */
export function barraDoTeste(item: Pick<ItemPlano, 'status' | 'resultado' | 'dataPlanejada' | 'dataExecucao'>, hoje: string): BarraTeste {
  if (item.status === 'concluido') {
    const data = item.dataExecucao ?? item.dataPlanejada;
    if (!data) return { estado: 'sem_data' };
    return { estado: item.resultado === 'passou' ? 'ok' : item.resultado === 'falhou' ? 'falhou' : 'concluido', data };
  }
  if (!item.dataPlanejada) return { estado: 'sem_data' };
  return { estado: item.dataPlanejada < hoje ? 'atrasado' : 'planejado', data: item.dataPlanejada };
}

/** Minutos planejados em cada coluna da janela (testes com data planejada e estimativa; é a linha "Carga prevista"). */
export function cargaPorColuna(j: Janela, itens: Pick<ItemPlano, 'dataPlanejada' | 'estimativaMin'>[]): number[] {
  const carga = j.unidades.map(() => 0);
  for (const i of itens) {
    if (!i.dataPlanejada || !i.estimativaMin) continue;
    const idx = indiceDaData(j, i.dataPlanejada);
    if (idx >= 0) carga[idx] += i.estimativaMin;
  }
  return carga;
}
