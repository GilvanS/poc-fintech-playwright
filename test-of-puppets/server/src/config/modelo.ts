export const COLUNAS = ['agendado', 'em_andamento', 'refinamento', 'concluido'] as const;
export type Coluna = (typeof COLUNAS)[number];

/** Limite de WIP por coluna do Kanban; `null` = sem limite. É "macio": só avisa, nunca impede. */
export type Wip = Record<Coluna, number | null>;

export const LIMITE_MAXIMO = 99;

/** Padrão do V1-kanban.md: Em andamento = 3, Refinamento = 3, as outras sem limite. */
export const WIP_PADRAO: Wip = { agendado: null, em_andamento: 3, refinamento: 3, concluido: null };

export interface Config {
  wip: Wip;
}

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
