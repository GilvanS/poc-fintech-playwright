import { pedir } from '../pages/cenarios/clienteApi.ts';

export type StatusInc = 'novo' | 'em_analise' | 'resolvido';
export type Severidade = 'alta' | 'media' | 'baixa';

export const STATUS_INC: StatusInc[] = ['novo', 'em_analise', 'resolvido'];
export const SEVERIDADES: Severidade[] = ['alta', 'media', 'baixa'];
export const ROTULO_STATUS_INC: Record<StatusInc, string> = { novo: 'Novo', em_analise: 'Em análise', resolvido: 'Resolvido' };
export const ROTULO_SEVERIDADE: Record<Severidade, string> = { alta: 'Alta', media: 'Média', baixa: 'Baixa' };

export interface Comentario {
  id: string;
  autor: string | null;
  texto: string;
  em: string;
}

export type TipoHistorico = 'registro' | 'status' | 'severidade' | 'responsavel' | 'vinculo' | 'desvinculo' | 'titulo' | 'descricao';

export interface EntradaHistorico {
  em: string;
  autor: string | null;
  tipo: TipoHistorico;
  de?: string | null;
  para?: string | null;
}

/** Incidente (INC) acompanhado aqui: global, ligado a cenários (vale para todo plano que tiver o teste). */
export interface Incidente {
  numero: string;
  titulo: string;
  descricao: string;
  status: StatusInc;
  severidade: Severidade;
  responsavel: string | null;
  testesAfetados: string[];
  comentarios: Comentario[];
  historico: EntradaHistorico[];
  abertoEm: string;
  resolvidoEm: string | null;
  atualizadoEm: string;
  versao: number;
}

export interface NovoIncidente {
  numero: string;
  titulo: string;
  descricao?: string;
  severidade?: Severidade;
  responsavel?: string | null;
  testesAfetados?: string[];
  /** Id da pessoa "Você", para o histórico. */
  autor?: string | null;
}

export interface EdicaoIncidente {
  versao: number;
  titulo?: string;
  descricao?: string;
  status?: StatusInc;
  severidade?: Severidade;
  responsavel?: string | null;
  testesAfetados?: string[];
  autor?: string | null;
}

const base = (numero: string) => `/api/incidentes/${encodeURIComponent(numero)}`;

export const listarIncidentes = () => pedir<{ incidentes?: Incidente[] }>('GET', '/api/incidentes').then((r) => r.incidentes ?? []);
export const criarIncidente = (entrada: NovoIncidente) => pedir<Incidente>('POST', '/api/incidentes', entrada);
export const editarIncidente = (numero: string, edicao: EdicaoIncidente) => pedir<Incidente>('PUT', base(numero), edicao);
export const excluirIncidente = (numero: string) => pedir<void>('DELETE', base(numero));
export const vincularIncidente = (numero: string, idCenarios: string[], autor: string | null) =>
  pedir<Incidente>('POST', `${base(numero)}/vincular`, { idCenarios, autor });
export const desvincularIncidente = (numero: string, idCenario: string, autor: string | null) =>
  pedir<Incidente>('DELETE', `${base(numero)}/vinculo/${encodeURIComponent(idCenario)}${autor ? `?autor=${encodeURIComponent(autor)}` : ''}`);
export const comentarIncidente = (numero: string, texto: string, autor: string | null) =>
  pedir<Incidente>('POST', `${base(numero)}/comentarios`, { texto, autor });

/** INC que ainda travam o teste (os resolvidos não contam). */
export const estaAberto = (inc: Pick<Incidente, 'status'>): boolean => inc.status !== 'resolvido';
