export const CORES = ['azul', 'verde', 'roxo', 'laranja', 'rosa', 'ciano'] as const;
export type Cor = (typeof CORES)[number];

/** Quem usa a ferramenta (cadastro da Equipe). `id` é o apelido que aparece em "responsável" nos testes. */
export interface Pessoa {
  id: string;
  nome: string;
  /** Minutos de teste que a pessoa consegue fazer por semana (0 = não informado). */
  capacidadeMinSemana: number;
  cor: Cor;
  /** Pessoa inativa sai do seletor "Você" e da atribuição, mas continua nos testes que já tem. */
  ativa: boolean;
  versao: number;
  criadoEm: string;
  atualizadoEm: string;
}

export interface CamposPessoa {
  nome: string;
  capacidadeMinSemana?: number;
  cor?: Cor;
  ativa?: boolean;
}

export type ResultadoPessoa = { ok: true; valor: CamposPessoa } | { ok: false; mensagens: string[] };

/** Valida o corpo de POST/PUT. Campo que não veio fica de fora (o repositório decide o padrão ou mantém o atual). */
export function validarPessoa(entrada: unknown): ResultadoPessoa {
  if (typeof entrada !== 'object' || entrada === null || Array.isArray(entrada)) {
    return { ok: false, mensagens: ['Corpo da requisição deve ser um objeto JSON.'] };
  }
  const corpo = entrada as Record<string, unknown>;
  const mensagens: string[] = [];

  const nome = typeof corpo.nome === 'string' ? corpo.nome.trim() : '';
  if (!nome) mensagens.push('Nome é obrigatório.');
  else if (nome.length > 40) mensagens.push('Nome deve ter no máximo 40 caracteres.');

  const valor: CamposPessoa = { nome };
  if (corpo.capacidadeMinSemana !== undefined) {
    const c = corpo.capacidadeMinSemana;
    if (typeof c === 'number' && Number.isInteger(c) && c >= 0 && c <= 6000) valor.capacidadeMinSemana = c;
    else mensagens.push('Capacidade deve ser um inteiro de 0 a 6000 (minutos por semana).');
  }
  if (corpo.cor !== undefined) {
    if (typeof corpo.cor === 'string' && (CORES as readonly string[]).includes(corpo.cor)) valor.cor = corpo.cor as Cor;
    else mensagens.push(`Cor deve ser uma destas: ${CORES.join(', ')}.`);
  }
  if (corpo.ativa !== undefined) {
    if (typeof corpo.ativa === 'boolean') valor.ativa = corpo.ativa;
    else mensagens.push('Ativa deve ser verdadeiro ou falso.');
  }

  return mensagens.length > 0 ? { ok: false, mensagens } : { ok: true, valor };
}

/** "José Álvaro" -> "jose-alvaro"; se já existir, "jose-alvaro-2" etc. */
export function gerarId(nome: string, existentes: string[]): string {
  const base =
    nome
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'pessoa';
  if (!existentes.includes(base)) return base;
  let n = 2;
  while (existentes.includes(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}
