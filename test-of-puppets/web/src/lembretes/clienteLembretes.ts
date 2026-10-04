import { pedir } from '../pages/cenarios/clienteApi.ts';

export type TipoLembrete = 'teste_hoje' | 'plano_vencido' | 'inc_aberto' | 'acao_retro';

/** Um lembrete do sino; o servidor calcula a partir dos dados e só guarda quais já foram lidos (por pessoa). */
export interface Lembrete {
  chave: string;
  tipo: TipoLembrete;
  titulo: string;
  detalhe: string;
  planoId?: string;
  idCenario?: string;
  numero?: string;
  lida: boolean;
}

export interface RespostaLembretes {
  lembretes: Lembrete[];
  naoLidas: number;
}

/** Os lembretes de quem é `voce` (id da pessoa; null = sem "Você" escolhido). */
export const listarLembretes = (voce: string | null) =>
  pedir<RespostaLembretes>('GET', `/api/lembretes${voce ? `?voce=${encodeURIComponent(voce)}` : ''}`);

/** Marca (ou desmarca, com `lida: false`) lembretes como lidos para a pessoa e devolve a lista nova. */
export const marcarLembretes = (voce: string | null, chaves: string[], lida = true) =>
  pedir<RespostaLembretes>('POST', '/api/lembretes/lidas', { voce, chaves, lida });
