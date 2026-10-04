import type { LucideIcon } from 'lucide-react';
import {
  Bookmark,
  Bug,
  CalendarDays,
  CalendarRange,
  ClipboardList,
  Columns3,
  FileText,
  LayoutGrid,
  List,
  MessagesSquare,
  Plus,
  Repeat,
  Rocket,
  Settings,
  Users,
} from 'lucide-react';

export type ChaveItem =
  | 'planos'
  | 'lista'
  | 'kanban'
  | 'roadmap'
  | 'iteracoes'
  | 'planejamento'
  | 'incidentes'
  | 'release'
  | 'lancamento'
  | 'retro'
  | 'nova-visao'
  | 'cenarios'
  | 'equipe'
  | 'configuracoes';

/** Uma visão salva aberta no menu: `visao:` + o id dela. */
export type ChaveVisao = `visao:${string}`;
/** Tudo o que pode estar ativo no menu: itens fixos e visões salvas. */
export type ChaveAtiva = ChaveItem | ChaveVisao;

export const chaveDaVisao = (id: string): ChaveVisao => `visao:${id}`;
export const idDaVisao = (chave: ChaveAtiva): string | null => (chave.startsWith('visao:') ? chave.slice('visao:'.length) : null);

export interface ItemMenu {
  chave: ChaveAtiva;
  rotulo: string;
  icone: LucideIcon;
  /** Tarefa do PLANO.md/VISOES.md que entrega a tela de verdade. */
  tarefa: string;
  /** Selo ao lado do nome (contador ou alerta). Por enquanto é dado de exemplo. */
  selo?: string;
}

export interface GrupoMenu {
  titulo: string;
  itens: ItemMenu[];
}

/** Mesmos 5 grupos do desenho em visoes/README.md. */
export const GRUPOS: GrupoMenu[] = [
  {
    titulo: 'Planos & Testes',
    itens: [
      { chave: 'planos', rotulo: 'Planos', icone: ClipboardList, tarefa: 'T4' },
      { chave: 'lista', rotulo: 'Lista', icone: List, tarefa: 'T5' },
      { chave: 'kanban', rotulo: 'Kanban', icone: Columns3, tarefa: 'T5' },
    ],
  },
  {
    titulo: 'Planejamento',
    itens: [
      { chave: 'roadmap', rotulo: 'Roadmap', icone: CalendarRange, tarefa: 'T13.6' },
      { chave: 'iteracoes', rotulo: 'Iterações', icone: Repeat, tarefa: 'T13.9' },
      { chave: 'planejamento', rotulo: 'Planejamento', icone: CalendarDays, tarefa: 'T13.10' },
    ],
  },
  {
    titulo: 'Qualidade',
    itens: [
      { chave: 'incidentes', rotulo: 'Incidentes', icone: Bug, tarefa: 'T13.5' },
      { chave: 'release', rotulo: 'Release', icone: Rocket, tarefa: 'T13.7' },
      { chave: 'lancamento', rotulo: 'Lançamento', icone: LayoutGrid, tarefa: 'T13.8' },
      { chave: 'retro', rotulo: 'Retro', icone: MessagesSquare, tarefa: 'T13.11' },
    ],
  },
  {
    titulo: 'Minhas visões',
    // As visões salvas entram antes de "Nova visão" (ver `gruposComVisoes`).
    itens: [{ chave: 'nova-visao', rotulo: 'Nova visão', icone: Plus, tarefa: 'T13.3' }],
  },
  {
    titulo: 'Massa & Sistema',
    itens: [
      { chave: 'cenarios', rotulo: 'Cenários e massa', icone: FileText, tarefa: 'T1' },
      { chave: 'equipe', rotulo: 'Equipe', icone: Users, tarefa: 'T13.1' },
      { chave: 'configuracoes', rotulo: 'Configurações', icone: Settings, tarefa: 'T13.4' },
    ],
  },
];

export const ITENS: ItemMenu[] = GRUPOS.flatMap((g) => g.itens);

/** O que o menu precisa saber de uma visão salva. */
export interface VisaoDoMenu {
  id: string;
  nome: string;
  compartilhada: boolean;
}

/** Os grupos do menu com as visões salvas dentro de "Minhas visões", antes de "Nova visão". */
export function gruposComVisoes(visoes: VisaoDoMenu[]): GrupoMenu[] {
  if (visoes.length === 0) return GRUPOS;
  const salvas: ItemMenu[] = visoes.map((v) => ({
    chave: chaveDaVisao(v.id),
    rotulo: v.nome,
    icone: v.compartilhada ? Users : Bookmark,
    tarefa: 'T13.3',
  }));
  return GRUPOS.map((g) => (g.titulo === 'Minhas visões' ? { ...g, itens: [...salvas, ...g.itens] } : g));
}

export function itemPorChave(chave: ChaveItem): ItemMenu {
  const item = ITENS.find((i) => i.chave === chave);
  if (!item) throw new Error(`Item de menu desconhecido: ${chave}`);
  return item;
}
