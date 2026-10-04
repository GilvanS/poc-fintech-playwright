import type { Pessoa } from '../../pessoas/clientePessoas.ts';
import type { ItemPlano } from '../planos/clientePlanos.ts';
import { diaDaSemana, somarDias } from '../roadmap/linhaDoTempo.ts';

/** Funções puras do Planejamento da equipe (V7): semana, linhas por pessoa, uso × capacidade e backlog. */

/** Um teste de algum plano, com o plano a que pertence (a tela mistura vários planos). */
export interface ItemDoPlano extends ItemPlano {
  planoId: string;
  planoNome: string;
}

/** Chave da linha "Sem dono". */
export const SEM_DONO = '__sem';

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const diaMes = (iso: string) => `${iso.slice(8)}/${iso.slice(5, 7)}`;

/** Os dias que a grade mostra: segunda a sexta, ou a semana inteira (segunda a domingo). */
export function diasDaSemana(inicio: string, comFimDeSemana: boolean): string[] {
  return Array.from({ length: comFimDeSemana ? 7 : 5 }, (_, i) => somarDias(inicio, i));
}

/** "05/10 – 09/10/2026". */
export function rotuloDaSemana(inicio: string, comFimDeSemana: boolean): string {
  const fim = somarDias(inicio, comFimDeSemana ? 6 : 4);
  return `${diaMes(inicio)} – ${diaMes(fim)}/${fim.slice(0, 4)}`;
}

/** "Seg 05/10". */
export const rotuloDoDia = (iso: string): string => `${DIAS[diaDaSemana(iso)]} ${diaMes(iso)}`;

export interface LinhaPessoa {
  chave: string;
  /** Id da pessoa; null = "Sem dono". */
  id: string | null;
  nome: string;
  /** Minutos por semana; 0 = não informada. */
  capacidade: number;
  itens: ItemDoPlano[];
}

/** Uma linha por pessoa ativa, mais quem ainda tem teste mas foi desativada, e "Sem dono" por último. */
export function linhasDaEquipe(pessoas: Pessoa[], itens: ItemDoPlano[], nome: (id?: string) => string): LinhaPessoa[] {
  const ids = pessoas.filter((p) => p.ativa).map((p) => p.id);
  for (const i of itens) if (i.responsavel && !ids.includes(i.responsavel)) ids.push(i.responsavel);
  const doDono = (id: string | null) => itens.filter((i) => (i.responsavel ?? null) === id);
  return [
    ...ids.map((id) => ({
      chave: id,
      id,
      nome: nome(id),
      capacidade: pessoas.find((p) => p.id === id)?.capacidadeMinSemana ?? 0,
      itens: doDono(id),
    })),
    { chave: SEM_DONO, id: null, nome: 'Sem dono', capacidade: 0, itens: doDono(null) },
  ];
}

/** Os testes planejados dentro da semana que começa em `inicio` (segunda a domingo). */
export function itensDaSemana<T extends Pick<ItemPlano, 'dataPlanejada'>>(itens: T[], inicio: string): T[] {
  const fim = somarDias(inicio, 6);
  return itens.filter((i) => i.dataPlanejada !== undefined && i.dataPlanejada >= inicio && i.dataPlanejada <= fim);
}

/** Minutos planejados na semana; teste sem estimativa conta 0. */
export function usoDaSemana(itens: Pick<ItemPlano, 'dataPlanejada' | 'estimativaMin'>[], inicio: string): number {
  return itensDaSemana(itens, inicio).reduce((soma, i) => soma + (i.estimativaMin ?? 0), 0);
}

/** Quanto passa da capacidade (0 se não passa ou se a capacidade não foi informada). */
export const excedente = (capacidade: number, uso: number): number => (capacidade > 0 ? Math.max(0, uso - capacidade) : 0);

/** Minutos livres; null quando a capacidade não foi informada. */
export const folga = (capacidade: number, uso: number): number | null => (capacidade > 0 ? capacidade - uso : null);

/** Como ficaria o uso da pessoa na semana se o teste fosse para ela (sem contar o teste duas vezes). */
export function usoDepoisDeColocar(linha: LinhaPessoa, item: ItemDoPlano, inicio: string): number {
  const outros = linha.itens.filter((i) => !(i.planoId === item.planoId && i.idCenario === item.idCenario));
  return usoDaSemana(outros, inicio) + (item.estimativaMin ?? 0);
}

const ORDEM_PRIORIDADE: Record<string, number> = { P1: 1, P2: 2, P3: 3 };

/** Testes ainda sem dia (e não concluídos), do mais prioritário para o menos. */
export function backlog(itens: ItemDoPlano[]): ItemDoPlano[] {
  return itens
    .filter((i) => i.dataPlanejada === undefined && i.status !== 'concluido')
    .sort((a, b) => (ORDEM_PRIORIDADE[a.prioridade ?? ''] ?? 9) - (ORDEM_PRIORIDADE[b.prioridade ?? ''] ?? 9) || a.idCenario.localeCompare(b.idCenario, 'pt-BR', { numeric: true }));
}
