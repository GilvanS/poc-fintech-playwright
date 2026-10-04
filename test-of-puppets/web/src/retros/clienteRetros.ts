import { pedir } from '../pages/cenarios/clienteApi.ts';

export type ColunaNota = 'bem' | 'melhorar';
export type EstadoRetro = 'aberta' | 'fechada';

export const ROTULO_COLUNA: Record<ColunaNota, string> = { bem: 'Foi bem', melhorar: 'Pode melhorar' };

export interface Nota {
  id: string;
  coluna: ColunaNota;
  texto: string;
  /** Id da pessoa que escreveu (a tela esconde com "notas anônimas"). */
  autor: string;
  em: string;
  /** Ids de quem votou: um voto por pessoa. */
  votos: string[];
}

export interface Acao {
  id: string;
  texto: string;
  responsavel: string | null;
  /** aaaa-mm-dd */
  prazo: string | null;
  feito: boolean;
  feitoEm: string | null;
  feitoPor: string | null;
  /** Texto da nota que originou a ação. */
  origem: string | null;
  incId: string | null;
  criadaEm: string;
  criadaPor: string | null;
}

export interface Retro {
  planoId: string;
  status: EstadoRetro;
  anonimas: boolean;
  fechadaEm: string | null;
  fechadaPor: string | null;
  notas: Nota[];
  acoes: Acao[];
  atualizadoEm: string | null;
}

export interface NovaAcao {
  texto: string;
  responsavel?: string | null;
  prazo?: string | null;
  origem?: string | null;
  incId?: string | null;
  autor?: string | null;
}

export interface EdicaoAcao {
  texto?: string;
  responsavel?: string | null;
  prazo?: string | null;
  feito?: boolean;
  autor?: string | null;
}

const base = (planoId: string) => `/api/retros/${encodeURIComponent(planoId)}`;

export const listarRetros = () => pedir<{ retros?: Retro[] }>('GET', '/api/retros').then((r) => r.retros ?? []);
export const obterRetro = (planoId: string) => pedir<Retro>('GET', base(planoId));
export const adicionarNota = (planoId: string, nota: { coluna: ColunaNota; texto: string; autor: string }) => pedir<Retro>('POST', `${base(planoId)}/notas`, nota);
export const excluirNota = (planoId: string, notaId: string) => pedir<Retro>('DELETE', `${base(planoId)}/notas/${encodeURIComponent(notaId)}`);
/** Liga/desliga o voto da pessoa na nota. */
export const votarNota = (planoId: string, notaId: string, pessoa: string) =>
  pedir<Retro>('POST', `${base(planoId)}/notas/${encodeURIComponent(notaId)}/votos`, { pessoa });
export const mudarEstadoRetro = (planoId: string, mudanca: { status?: EstadoRetro; anonimas?: boolean; autor?: string | null }) =>
  pedir<Retro>('PUT', base(planoId), mudanca);
export const adicionarAcao = (planoId: string, acao: NovaAcao) => pedir<Retro>('POST', `${base(planoId)}/acoes`, acao);
export const editarAcao = (planoId: string, acaoId: string, campos: EdicaoAcao) =>
  pedir<Retro>('PATCH', `${base(planoId)}/acoes/${encodeURIComponent(acaoId)}`, campos);
export const excluirAcao = (planoId: string, acaoId: string) => pedir<Retro>('DELETE', `${base(planoId)}/acoes/${encodeURIComponent(acaoId)}`);
