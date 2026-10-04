import { dataValida } from '../planos/modelo.ts';

export const COLUNAS = ['bem', 'melhorar'] as const;
export type Coluna = (typeof COLUNAS)[number];

export const ESTADOS = ['aberta', 'fechada'] as const;
export type EstadoRetro = (typeof ESTADOS)[number];

export interface Nota {
  id: string;
  coluna: Coluna;
  texto: string;
  /** Id da pessoa que escreveu. Com "notas anônimas" a tela esconde, mas o servidor guarda (projeto local). */
  autor: string;
  em: string;
  /** Ids das pessoas que votaram: um voto por pessoa por nota. */
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
  /** Texto da nota que originou a ação (a nota pode ser apagada depois). */
  origem: string | null;
  /** Número do INC criado junto com a ação (o INC em si mora em /api/incidentes). */
  incId: string | null;
  criadaEm: string;
  criadaPor: string | null;
}

/** Retrospectiva de um plano concluído. Um documento por plano; nasce no primeiro registro. */
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

export interface NovaNota {
  coluna: Coluna;
  texto: string;
  autor: string;
}

export interface MudancaEstado {
  status?: EstadoRetro;
  anonimas?: boolean;
  autor: string | null;
}

export interface NovaAcao {
  texto: string;
  responsavel: string | null;
  prazo: string | null;
  origem: string | null;
  incId: string | null;
  autor: string | null;
}

export interface EdicaoAcao {
  texto?: string;
  responsavel?: string | null;
  prazo?: string | null;
  feito?: boolean;
  autor: string | null;
}

export type Validacao<T> = { ok: true; valor: T } | { ok: false; mensagens: string[] };

const MSG_OBJETO = 'Corpo da requisição deve ser um objeto JSON.';
const ehObjeto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const presente = (o: Record<string, unknown>, k: string) => o[k] !== undefined;

/** Pessoa ("Você"): id de até 40 caracteres. */
function pessoaObrigatoria(v: unknown, mensagem: string, mensagens: string[]): string {
  if (typeof v === 'string' && v.trim() && v.trim().length <= 40) return v.trim();
  mensagens.push(mensagem);
  return '';
}

export function autorOpcional(entrada: unknown): string | null {
  if (!ehObjeto(entrada)) return null;
  const a = entrada.autor;
  return typeof a === 'string' && a.trim() && a.trim().length <= 40 ? a.trim() : null;
}

function textoDe(v: unknown, rotulo: string, maximo: number, mensagens: string[]): string {
  const t = typeof v === 'string' ? v.trim() : '';
  if (!t) mensagens.push(`${rotulo} é obrigatório.`);
  else if (t.length > maximo) mensagens.push(`${rotulo} deve ter no máximo ${maximo} caracteres.`);
  else return t;
  return '';
}

export function validarNota(entrada: unknown): Validacao<NovaNota> {
  if (!ehObjeto(entrada)) return { ok: false, mensagens: [MSG_OBJETO] };
  const mensagens: string[] = [];
  const coluna = (COLUNAS as readonly string[]).includes(entrada.coluna as string) ? (entrada.coluna as Coluna) : undefined;
  if (!coluna) mensagens.push(`Coluna deve ser uma destas: ${COLUNAS.join(', ')}.`);
  const texto = textoDe(entrada.texto, 'Texto da nota', 300, mensagens);
  const autor = pessoaObrigatoria(entrada.autor, 'Escolha quem você é para escrever uma nota.', mensagens);
  if (mensagens.length > 0 || !coluna) return { ok: false, mensagens };
  return { ok: true, valor: { coluna, texto, autor } };
}

export function validarVoto(entrada: unknown): Validacao<{ pessoa: string }> {
  if (!ehObjeto(entrada)) return { ok: false, mensagens: [MSG_OBJETO] };
  const mensagens: string[] = [];
  const pessoa = pessoaObrigatoria(entrada.pessoa, 'Escolha quem você é para votar.', mensagens);
  return mensagens.length > 0 ? { ok: false, mensagens } : { ok: true, valor: { pessoa } };
}

export function validarEstado(entrada: unknown): Validacao<MudancaEstado> {
  if (!ehObjeto(entrada)) return { ok: false, mensagens: [MSG_OBJETO] };
  const mensagens: string[] = [];
  const valor: MudancaEstado = { autor: autorOpcional(entrada) };
  if (presente(entrada, 'status')) {
    if ((ESTADOS as readonly string[]).includes(entrada.status as string)) valor.status = entrada.status as EstadoRetro;
    else mensagens.push(`Status deve ser um destes: ${ESTADOS.join(', ')}.`);
  }
  if (presente(entrada, 'anonimas')) {
    if (typeof entrada.anonimas === 'boolean') valor.anonimas = entrada.anonimas;
    else mensagens.push('anonimas deve ser verdadeiro ou falso.');
  }
  if (valor.status === undefined && valor.anonimas === undefined && mensagens.length === 0) mensagens.push('Informe status e/ou anonimas.');
  return mensagens.length > 0 ? { ok: false, mensagens } : { ok: true, valor };
}

function responsavelDe(v: unknown, mensagens: string[]): string | null | undefined {
  if (v === null || v === '') return null;
  if (typeof v === 'string' && v.trim() && v.trim().length <= 40) return v.trim();
  mensagens.push('Responsável deve ser o id de uma pessoa (ou vazio).');
  return undefined;
}

function prazoDe(v: unknown, mensagens: string[]): string | null | undefined {
  if (v === null || v === '') return null;
  if (dataValida(v)) return v;
  mensagens.push('Prazo deve ser uma data válida (aaaa-mm-dd).');
  return undefined;
}

export function validarNovaAcao(entrada: unknown): Validacao<NovaAcao> {
  if (!ehObjeto(entrada)) return { ok: false, mensagens: [MSG_OBJETO] };
  const mensagens: string[] = [];
  const texto = textoDe(entrada.texto, 'Ação', 200, mensagens);
  const responsavel = presente(entrada, 'responsavel') ? responsavelDe(entrada.responsavel, mensagens) : null;
  const prazo = presente(entrada, 'prazo') ? prazoDe(entrada.prazo, mensagens) : null;
  let origem: string | null = null;
  if (presente(entrada, 'origem') && entrada.origem !== null) {
    if (typeof entrada.origem === 'string' && entrada.origem.length <= 300) origem = entrada.origem.trim() || null;
    else mensagens.push('Origem deve ser um texto de até 300 caracteres.');
  }
  let incId: string | null = null;
  if (presente(entrada, 'incId') && entrada.incId !== null) {
    if (typeof entrada.incId === 'string' && entrada.incId.trim().length > 0 && entrada.incId.length <= 30) incId = entrada.incId.trim().toUpperCase();
    else mensagens.push('incId deve ser o número de um INC.');
  }
  if (mensagens.length > 0) return { ok: false, mensagens };
  return { ok: true, valor: { texto, responsavel: responsavel ?? null, prazo: prazo ?? null, origem, incId, autor: autorOpcional(entrada) } };
}

export function validarEdicaoAcao(entrada: unknown): Validacao<EdicaoAcao> {
  if (!ehObjeto(entrada)) return { ok: false, mensagens: [MSG_OBJETO] };
  const mensagens: string[] = [];
  const valor: EdicaoAcao = { autor: autorOpcional(entrada) };
  if (presente(entrada, 'texto')) valor.texto = textoDe(entrada.texto, 'Ação', 200, mensagens);
  if (presente(entrada, 'responsavel')) valor.responsavel = responsavelDe(entrada.responsavel, mensagens);
  if (presente(entrada, 'prazo')) valor.prazo = prazoDe(entrada.prazo, mensagens);
  if (presente(entrada, 'feito')) {
    if (typeof entrada.feito === 'boolean') valor.feito = entrada.feito;
    else mensagens.push('feito deve ser verdadeiro ou falso.');
  }
  const mudou = valor.texto !== undefined || valor.responsavel !== undefined || valor.prazo !== undefined || valor.feito !== undefined;
  if (!mudou && mensagens.length === 0) mensagens.push('Informe ao menos um campo para alterar.');
  return mensagens.length > 0 ? { ok: false, mensagens } : { ok: true, valor };
}
