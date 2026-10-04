/** Tipos de visão que já têm tela. Os outros modelos da galeria (M11) entram nas tarefas T13.4 em diante. */
export const TIPOS_VISAO = ['lista', 'kanban'] as const;
export type TipoVisao = (typeof TIPOS_VISAO)[number];

/** Filtros guardados na visão. Vazio = sem filtro; `__sem` = "sem responsável"/"sem prioridade" (igual à tela do plano). */
export interface FiltrosVisao {
  funcionalidade: string;
  responsavel: string;
  prioridade: string;
}

export const SEM_FILTROS_VISAO: FiltrosVisao = { funcionalidade: '', responsavel: '', prioridade: '' };

const PRIORIDADES_VALIDAS = ['', 'P1', 'P2', 'P3', '__sem'];

/** Uma visão salva: tipo + filtros. Pessoal (só o `dono` vê) ou compartilhada com toda a Equipe. */
export interface Visao {
  id: string;
  nome: string;
  tipo: TipoVisao;
  /** Id da pessoa que criou; `null` quando ninguém estava escolhido em "Você" (aí a visão é sempre compartilhada). */
  dono: string | null;
  compartilhada: boolean;
  filtros: FiltrosVisao;
  versao: number;
  criadoEm: string;
}

export interface CamposVisao {
  nome: string;
  tipo: TipoVisao;
  dono: string | null;
  compartilhada: boolean;
  filtros: FiltrosVisao;
}

export type ResultadoVisao = { ok: true; valor: CamposVisao } | { ok: false; mensagens: string[] };

/** Valida o corpo de POST. Visão sem dono não pode ser pessoal (ninguém a veria depois). */
export function validarVisao(entrada: unknown): ResultadoVisao {
  if (typeof entrada !== 'object' || entrada === null || Array.isArray(entrada)) {
    return { ok: false, mensagens: ['Corpo da requisição deve ser um objeto JSON.'] };
  }
  const corpo = entrada as Record<string, unknown>;
  const mensagens: string[] = [];

  const nome = typeof corpo.nome === 'string' ? corpo.nome.trim() : '';
  if (!nome) mensagens.push('Nome é obrigatório.');
  else if (nome.length > 40) mensagens.push('Nome deve ter no máximo 40 caracteres.');

  const tipo = corpo.tipo;
  if (typeof tipo !== 'string' || !(TIPOS_VISAO as readonly string[]).includes(tipo)) {
    mensagens.push(`Tipo deve ser um destes: ${TIPOS_VISAO.join(', ')}.`);
  }

  let dono: string | null = null;
  if (corpo.dono !== undefined && corpo.dono !== null) {
    if (typeof corpo.dono === 'string' && corpo.dono.trim()) dono = corpo.dono.trim();
    else mensagens.push('Dono deve ser o id de uma pessoa.');
  }

  let compartilhada = dono === null;
  if (corpo.compartilhada !== undefined) {
    if (typeof corpo.compartilhada === 'boolean') compartilhada = corpo.compartilhada;
    else mensagens.push('Compartilhada deve ser verdadeiro ou falso.');
  }
  if (dono === null) compartilhada = true;

  const filtros: FiltrosVisao = { ...SEM_FILTROS_VISAO };
  if (corpo.filtros !== undefined) {
    const f = corpo.filtros;
    if (typeof f !== 'object' || f === null || Array.isArray(f)) {
      mensagens.push('Filtros deve ser um objeto.');
    } else {
      const bruto = f as Record<string, unknown>;
      for (const campo of ['funcionalidade', 'responsavel', 'prioridade'] as const) {
        const v = bruto[campo];
        if (v === undefined) continue;
        if (typeof v !== 'string') mensagens.push(`Filtro ${campo} deve ser texto.`);
        else filtros[campo] = v.trim();
      }
      if (!PRIORIDADES_VALIDAS.includes(filtros.prioridade)) mensagens.push('Filtro prioridade deve ser P1, P2, P3 ou vazio.');
    }
  }

  if (mensagens.length > 0) return { ok: false, mensagens };
  return { ok: true, valor: { nome, tipo: tipo as TipoVisao, dono, compartilhada, filtros } };
}

/** "Só Faturas P1" -> "so-faturas-p1"; se já existir, "so-faturas-p1-2" etc. */
export function gerarIdVisao(nome: string, existentes: string[]): string {
  const base =
    nome
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'visao';
  if (!existentes.includes(base)) return base;
  let n = 2;
  while (existentes.includes(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

/** O que `voce` enxerga: as compartilhadas e as próprias. Sem `voce`, só as compartilhadas. */
export function visiveisPara(visoes: Visao[], voce: string | null): Visao[] {
  return visoes.filter((v) => v.compartilhada || (voce !== null && v.dono === voce));
}
