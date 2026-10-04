import { pedir } from '../pages/cenarios/clienteApi.ts';
import type { Status } from '../pages/planos/clientePlanos.ts';

/** Limite de WIP por coluna do Kanban; `null` = sem limite. É "macio": só avisa, nunca impede. */
export type Wip = Record<Status, number | null>;

export const SEM_LIMITES: Wip = { agendado: null, em_andamento: null, refinamento: null, concluido: null };

/** Valem para todos os planos; ficam em `dados/config.json`. */
export interface Config {
  wip: Wip;
}

export const obterConfig = () => pedir<Config>('GET', '/api/config');
export const salvarWip = (wip: Partial<Wip>) => pedir<Config>('PUT', '/api/config', { wip });
