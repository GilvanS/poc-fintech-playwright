import type { Pessoa } from '../../pessoas/clientePessoas.ts';
import type { CenarioVisao } from '../cenarios/clienteApi.ts';
import type { DetalhePlano, ItemPlano } from '../planos/clientePlanos.ts';
import { diaDaSemana, somarDias } from '../roadmap/linhaDoTempo.ts';

/** Funções puras das Iterações (V6): cada plano é uma iteração; burndown, velocidade, capacidade e backlog. */

const GUARDA = 800;

const ehUtil = (iso: string) => diaDaSemana(iso) !== 0 && diaDaSemana(iso) !== 6;

/** Dias úteis (seg-sex) de `inicio` a `fim`, os dois inclusive. */
export function diasUteisEntre(inicio: string, fim: string): string[] {
  const dias: string[] = [];
  let atual = inicio;
  for (let g = 0; g < GUARDA && atual <= fim; g += 1) {
    if (ehUtil(atual)) dias.push(atual);
    atual = somarDias(atual, 1);
  }
  return dias;
}

/** O dia útil que vem `n` dias úteis depois de `depoisDe` (n >= 1). */
export function somarDiasUteis(depoisDe: string, n: number): string {
  let atual = depoisDe;
  let falta = n;
  for (let g = 0; g < GUARDA && falta > 0; g += 1) {
    atual = somarDias(atual, 1);
    if (ehUtil(atual)) falta -= 1;
  }
  return atual;
}

/** Início e fim da iteração: criação do plano até a previsão (sem previsão, só o dia da criação). */
export function periodoDoPlano(d: Pick<DetalhePlano, 'plano'>): { inicio: string; fim: string } {
  const inicio = d.plano.criadoEm.slice(0, 10);
  const fim = d.plano.previsao && d.plano.previsao >= inicio ? d.plano.previsao : inicio;
  return { inicio, fim };
}

export interface Classificacao {
  anterior: DetalhePlano | null;
  atual: DetalhePlano | null;
  proxima: DetalhePlano | null;
}

/** Ordena pela previsão (ou pela criação, sem previsão): o último concluído é o anterior, os dois primeiros abertos são atual e próxima. */
export function classificar(planos: DetalhePlano[]): Classificacao {
  const ordenados = [...planos].sort((a, b) => periodoDoPlano(a).fim.localeCompare(periodoDoPlano(b).fim) || a.plano.nome.localeCompare(b.plano.nome, 'pt-BR'));
  const encerrados = ordenados.filter((p) => p.resumo.executado);
  const abertos = ordenados.filter((p) => !p.resumo.executado);
  return { anterior: encerrados[encerrados.length - 1] ?? null, atual: abertos[0] ?? null, proxima: abertos[1] ?? null };
}

export const estimadoDe = (itens: Pick<ItemPlano, 'estimativaMin'>[]): number => itens.reduce((s, i) => s + (i.estimativaMin ?? 0), 0);
export const realDe = (itens: Pick<ItemPlano, 'tempoRealMin'>[]): number => itens.reduce((s, i) => s + (i.tempoRealMin ?? 0), 0);

/** Quanto o real passou (+) ou ficou abaixo (-) do estimado, em %; null sem estimativa. */
export const variacaoReal = (estimado: number, real: number): number | null => (estimado > 0 ? Math.round(((real - estimado) / estimado) * 100) : null);

/** "dia 5 de 12" em dias úteis; null se a iteração ainda não começou ou já passou. */
export function diaDaIteracao(inicio: string, fim: string, hoje: string): { dia: number; total: number } | null {
  const dias = diasUteisEntre(inicio, fim);
  if (dias.length === 0 || hoje < inicio || hoje > fim) return null;
  return { dia: dias.filter((d) => d <= hoje).length, total: dias.length };
}

export interface Burndown {
  dias: string[];
  /** Reta do total inicial até 0 na previsão. */
  ideal: number[];
  /** Testes ainda não concluídos no fim de cada dia; null nos dias que ainda não chegaram. */
  real: (number | null)[];
  total: number;
  /** Concluídos sem data de execução: contam só a partir de hoje. */
  semData: number;
}

export function burndown(itens: Pick<ItemPlano, 'status' | 'dataExecucao'>[], inicio: string, fim: string, hoje: string): Burndown {
  const dias = diasUteisEntre(inicio, fim);
  const total = itens.length;
  const concluidos = itens.filter((i) => i.status === 'concluido');
  const semData = concluidos.filter((i) => !i.dataExecucao).length;
  const ideal = dias.map((_, i) => (dias.length <= 1 ? 0 : Math.round(total * (1 - i / (dias.length - 1)) * 10) / 10));
  const real = dias.map((d) => {
    if (d > hoje) return null;
    const feitos = concluidos.filter((i) => (i.dataExecucao ? i.dataExecucao <= d : d >= hoje)).length;
    return total - feitos;
  });
  return { dias, ideal, real, total, semData };
}

export type Projecao =
  | { tipo: 'concluido' }
  | { tipo: 'sem_ritmo' }
  | { tipo: 'projecao'; ritmo: number; termino: string; atrasoDiasUteis: number };

/** No ritmo de testes concluídos por dia útil até hoje, quando o que resta termina e quanto isso passa do alvo. */
export function projetar(bd: Burndown, inicio: string, fim: string, hoje: string): Projecao {
  const restantes = bd.real.filter((r): r is number => r !== null).pop() ?? bd.total;
  if (bd.total > 0 && restantes === 0) return { tipo: 'concluido' };
  const decorridos = diasUteisEntre(inicio, hoje < fim ? hoje : fim).length;
  const feitos = bd.total - restantes;
  if (decorridos === 0 || feitos === 0) return { tipo: 'sem_ritmo' };
  const ritmo = feitos / decorridos;
  const termino = somarDiasUteis(hoje, Math.ceil(restantes / ritmo));
  const atraso = termino <= fim ? 0 : diasUteisEntre(somarDias(fim, 1), termino).length;
  return { tipo: 'projecao', ritmo: Math.round(ritmo * 10) / 10, termino, atrasoDiasUteis: atraso };
}

/** Média de testes concluídos nas últimas 3 iterações encerradas; null sem nenhuma. */
export function velocidadeMedia(planos: DetalhePlano[]): number | null {
  const encerrados = [...planos]
    .filter((p) => p.resumo.executado)
    .sort((a, b) => periodoDoPlano(a).fim.localeCompare(periodoDoPlano(b).fim))
    .slice(-3);
  if (encerrados.length === 0) return null;
  return Math.round((encerrados.reduce((s, p) => s + p.resumo.concluidos, 0) / encerrados.length) * 10) / 10;
}

/** Soma das capacidades da equipe ativa × semanas (dias úteis ÷ 5) do período. */
export function capacidadeDoPeriodo(pessoas: Pick<Pessoa, 'ativa' | 'capacidadeMinSemana'>[], inicio: string, fim: string): number {
  const porSemana = pessoas.filter((p) => p.ativa).reduce((s, p) => s + p.capacidadeMinSemana, 0);
  return Math.round(porSemana * (diasUteisEntre(inicio, fim).length / 5));
}

export interface ItemDoBacklog {
  idCenario: string;
  nome: string;
  funcionalidade: string;
  idMassa?: string;
  /** Do último plano em que o cenário apareceu (o catálogo não guarda prioridade nem estimativa). */
  prioridade?: string;
  estimativaMin?: number;
}

const ORDEM_PRIORIDADE: Record<string, number> = { P1: 1, P2: 2, P3: 3 };

/** Cenários do catálogo que não estão em plano aberto, do mais prioritário para o menos. */
export function backlogDoCatalogo(cenarios: CenarioVisao[], planos: DetalhePlano[]): ItemDoBacklog[] {
  const emAberto = new Set(planos.filter((p) => !p.resumo.executado).flatMap((p) => p.itens.map((i) => i.idCenario)));
  const recentes = [...planos].sort((a, b) => periodoDoPlano(b).fim.localeCompare(periodoDoPlano(a).fim));
  const ultimo = (id: string) => recentes.flatMap((p) => p.itens).find((i) => i.idCenario === id);
  return cenarios
    .filter((c) => !emAberto.has(c.idCenario))
    .map((c) => {
      const u = ultimo(c.idCenario);
      return { idCenario: c.idCenario, nome: c.nome, funcionalidade: c.funcionalidade, idMassa: c.idMassa, prioridade: u?.prioridade, estimativaMin: u?.estimativaMin };
    })
    .sort((a, b) => (ORDEM_PRIORIDADE[a.prioridade ?? ''] ?? 9) - (ORDEM_PRIORIDADE[b.prioridade ?? ''] ?? 9) || a.idCenario.localeCompare(b.idCenario, 'pt-BR', { numeric: true }));
}
