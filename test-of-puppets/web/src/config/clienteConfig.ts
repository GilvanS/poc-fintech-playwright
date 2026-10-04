import { pedir } from '../pages/cenarios/clienteApi.ts';
import type { Status } from '../pages/planos/clientePlanos.ts';

/** Limite de WIP por coluna do Kanban; `null` = sem limite. É "macio": só avisa, nunca impede. */
export type Wip = Record<Status, number | null>;

export const SEM_LIMITES: Wip = { agendado: null, em_andamento: null, refinamento: null, concluido: null };

/** Quais tipos de lembrete aparecem no sino. */
export type TipoLembrete = 'teste_hoje' | 'plano_vencido' | 'inc_aberto' | 'acao_retro';
export type Lembretes = Record<TipoLembrete, boolean>;

export const TIPOS_LEMBRETE: TipoLembrete[] = ['teste_hoje', 'plano_vencido', 'inc_aberto', 'acao_retro'];
export const TODOS_LIGADOS: Lembretes = { teste_hoje: true, plano_vencido: true, inc_aberto: true, acao_retro: true };

/** Valem para todos os planos e pessoas; ficam em `dados/config.json`. */
export interface Config {
  wip: Wip;
  /** Servidor antigo (ou falso) pode não mandar: nesse caso valem todos ligados. */
  lembretes?: Lembretes;
}

export const obterConfig = () => pedir<Config>('GET', '/api/config');
export const salvarConfig = (parcial: { wip?: Partial<Wip>; lembretes?: Partial<Lembretes> }) => pedir<Config>('PUT', '/api/config', parcial);
export const salvarWip = (wip: Partial<Wip>) => salvarConfig({ wip });
