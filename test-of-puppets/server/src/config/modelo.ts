import { TIPOS_LEMBRETE, type TipoLembrete } from '../lembretes/modelo.ts';

export const COLUNAS = ['agendado', 'em_andamento', 'refinamento', 'concluido'] as const;
export type Coluna = (typeof COLUNAS)[number];

/** Limite de WIP por coluna do Kanban; `null` = sem limite. É "macio": só avisa, nunca impede. */
export type Wip = Record<Coluna, number | null>;

export const LIMITE_MAXIMO = 99;

/** Padrão do V1-kanban.md: Em andamento = 3, Refinamento = 3, as outras sem limite. */
export const WIP_PADRAO: Wip = { agendado: null, em_andamento: 3, refinamento: 3, concluido: null };

/** Quais tipos de lembrete aparecem no sino (vale para todo mundo). Todos ligados por padrão. */
export type Lembretes = Record<TipoLembrete, boolean>;
export const LEMBRETES_PADRAO: Lembretes = { teste_hoje: true, plano_vencido: true, inc_aberto: true, acao_retro: true };

export interface Config {
  wip: Wip;
  lembretes: Lembretes;
}

/** O que o PUT pode mudar: só o que veio no corpo. */
export interface ParcialConfig {
  wip?: Partial<Wip>;
  lembretes?: Partial<Lembretes>;
}

export type ResultadoConfig = { ok: true; valor: ParcialConfig } | { ok: false; mensagens: string[] };

export type ResultadoWip = { ok: true; valor: Partial<Wip> } | { ok: false; mensagens: string[] };

const ROTULO: Record<Coluna, string> = { agendado: 'Agendado', em_andamento: 'Em andamento', refinamento: 'Refinamento', concluido: 'Concluído' };

/** Valida o corpo de PUT: `{ wip: { em_andamento: 4, refinamento: null } }`. Coluna que não veio fica como está. */
export function validarWip(entrada: unknown): ResultadoWip {
  if (typeof entrada !== 'object' || entrada === null || Array.isArray(entrada)) {
    return { ok: false, mensagens: ['Corpo da requisição deve ser um objeto JSON.'] };
  }
  const wip = (entrada as Record<string, unknown>).wip;
  if (typeof wip !== 'object' || wip === null || Array.isArray(wip)) {
    return { ok: false, mensagens: ['Informe "wip" com o limite de cada coluna.'] };
  }
  const bruto = wip as Record<string, unknown>;
  const mensagens: string[] = [];
  const valor: Partial<Wip> = {};

  for (const chave of Object.keys(bruto)) {
    if (!(COLUNAS as readonly string[]).includes(chave)) mensagens.push(`Coluna desconhecida: ${chave}.`);
  }
  for (const coluna of COLUNAS) {
    if (!(coluna in bruto)) continue;
    const v = bruto[coluna];
    if (v === null) valor[coluna] = null;
    else if (typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= LIMITE_MAXIMO) valor[coluna] = v;
    else mensagens.push(`Limite de ${ROTULO[coluna]} deve ser um inteiro de 1 a ${LIMITE_MAXIMO}, ou vazio para não ter limite.`);
  }
  if (Object.keys(bruto).length === 0) mensagens.push('Informe ao menos uma coluna.');

  return mensagens.length > 0 ? { ok: false, mensagens } : { ok: true, valor };
}

const ROTULO_LEMBRETE: Record<TipoLembrete, string> = {
  teste_hoje: 'Teste de hoje',
  plano_vencido: 'Plano vencido',
  inc_aberto: 'INC aberto',
  acao_retro: 'Ação da retro',
};

/**
 * Valida o corpo de PUT /api/config: `{ wip?: {...}, lembretes?: { inc_aberto: false } }`. Precisa de pelo menos um dos dois;
 * o que não veio fica como está.
 */
export function validarConfig(entrada: unknown): ResultadoConfig {
  if (typeof entrada !== 'object' || entrada === null || Array.isArray(entrada)) {
    return { ok: false, mensagens: ['Corpo da requisição deve ser um objeto JSON.'] };
  }
  const corpo = entrada as Record<string, unknown>;
  const temWip = corpo.wip !== undefined;
  const temLembretes = corpo.lembretes !== undefined;
  if (!temWip && !temLembretes) return { ok: false, mensagens: ['Informe "wip" e/ou "lembretes".'] };

  const mensagens: string[] = [];
  const valor: ParcialConfig = {};

  if (temWip) {
    const wip = validarWip({ wip: corpo.wip });
    if (wip.ok) valor.wip = wip.valor;
    else mensagens.push(...wip.mensagens);
  }

  if (temLembretes) {
    const bruto = corpo.lembretes;
    if (typeof bruto !== 'object' || bruto === null || Array.isArray(bruto)) {
      mensagens.push('"lembretes" deve dizer, para cada tipo, se fica ligado ou desligado.');
    } else {
      const lembretes: Partial<Lembretes> = {};
      const chaves = Object.keys(bruto);
      for (const chave of chaves) {
        if (!(TIPOS_LEMBRETE as readonly string[]).includes(chave)) mensagens.push(`Tipo de lembrete desconhecido: ${chave}.`);
      }
      for (const tipo of TIPOS_LEMBRETE) {
        if (!(tipo in bruto)) continue;
        const v = (bruto as Record<string, unknown>)[tipo];
        if (typeof v === 'boolean') lembretes[tipo] = v;
        else mensagens.push(`${ROTULO_LEMBRETE[tipo]} deve ser ligado (true) ou desligado (false).`);
      }
      if (chaves.length === 0) mensagens.push('Informe ao menos um tipo de lembrete.');
      valor.lembretes = lembretes;
    }
  }

  return mensagens.length > 0 ? { ok: false, mensagens } : { ok: true, valor };
}
