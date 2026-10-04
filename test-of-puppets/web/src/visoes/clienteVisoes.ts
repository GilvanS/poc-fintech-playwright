import { pedir } from '../pages/cenarios/clienteApi.ts';
import { SEM_FILTROS, type Filtros } from '../pages/planos/filtros.ts';

/** Tipos de visão que já têm tela; os outros modelos da galeria chegam nas tarefas T13.4 em diante. */
export type TipoVisao = 'lista' | 'kanban';

export interface FiltrosVisao {
  funcionalidade: string;
  responsavel: string;
  prioridade: string;
}

/** Visão salva (menu "Minhas visões"): tipo + filtros, pessoal ou compartilhada com a Equipe. */
export interface Visao {
  id: string;
  nome: string;
  tipo: TipoVisao;
  dono: string | null;
  compartilhada: boolean;
  filtros: FiltrosVisao;
  versao: number;
  criadoEm: string;
}

export interface NovaVisao {
  nome: string;
  tipo: TipoVisao;
  dono: string | null;
  compartilhada: boolean;
  filtros: FiltrosVisao;
}

const consulta = (voce: string | null) => (voce ? `?voce=${encodeURIComponent(voce)}` : '');

/** As compartilhadas e as de `voce`. */
export const listarVisoes = async (voce: string | null) =>
  (await pedir<{ visoes?: Visao[] }>('GET', `/api/visoes${consulta(voce)}`)).visoes ?? [];
export const criarVisao = (entrada: NovaVisao) => pedir<Visao>('POST', '/api/visoes', entrada);
export const excluirVisao = (id: string, voce: string | null) =>
  pedir<void>('DELETE', `/api/visoes/${encodeURIComponent(id)}${consulta(voce)}`);

/** Os filtros da visão como a tela do plano os entende (o resto fica sem filtro). */
export function filtrosDaVisao(f: FiltrosVisao): Filtros {
  return { ...SEM_FILTROS, funcionalidade: f.funcionalidade, responsavel: f.responsavel, prioridade: f.prioridade as Filtros['prioridade'] };
}
