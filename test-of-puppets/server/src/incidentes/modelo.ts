export const STATUS_INC = ['novo', 'em_analise', 'resolvido'] as const;
export type StatusInc = (typeof STATUS_INC)[number];

export const SEVERIDADES = ['alta', 'media', 'baixa'] as const;
export type Severidade = (typeof SEVERIDADES)[number];

export interface Comentario {
  id: string;
  /** Id da pessoa ("Você") que escreveu; null se ninguém estava escolhido. */
  autor: string | null;
  texto: string;
  em: string;
}

/** O que mudou no INC. O texto ("mudou status: Novo → Em análise") é montado na tela, com os nomes das pessoas. */
export type TipoHistorico = 'registro' | 'status' | 'severidade' | 'responsavel' | 'vinculo' | 'desvinculo' | 'titulo' | 'descricao';

export interface EntradaHistorico {
  em: string;
  autor: string | null;
  tipo: TipoHistorico;
  /** Valor antes e depois (status, severidade, responsável) ou o ID do cenário (vínculo). */
  de?: string | null;
  para?: string | null;
}

/** Incidente (INC) registrado fora da ferramenta e acompanhado aqui. Global: liga-se a cenários, não a um plano. */
export interface Incidente {
  numero: string;
  titulo: string;
  descricao: string;
  status: StatusInc;
  severidade: Severidade;
  responsavel: string | null;
  /** IDs de cenário (CT03.1); vale para todo plano que tiver esse teste. */
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
  status?: StatusInc;
  severidade?: Severidade;
  responsavel?: string | null;
  testesAfetados?: string[];
  autor?: string | null;
  /** Só a semente usa: a API não aceita. */
  abertoEm?: string;
  resolvidoEm?: string;
}

export interface EdicaoIncidente {
  titulo?: string;
  descricao?: string;
  status?: StatusInc;
  severidade?: Severidade;
  responsavel?: string | null;
  testesAfetados?: string[];
}

export type Validacao<T> = { ok: true; valor: T } | { ok: false; mensagens: string[] };

export const ROTULO_STATUS_INC: Record<StatusInc, string> = { novo: 'Novo', em_analise: 'Em análise', resolvido: 'Resolvido' };
export const ROTULO_SEVERIDADE: Record<Severidade, string> = { alta: 'Alta', media: 'Média', baixa: 'Baixa' };

const FORMATO_NUMERO = /^[A-Z0-9][A-Z0-9._-]{2,29}$/;
const MSG_OBJETO = 'Corpo da requisição deve ser um objeto JSON.';

const ehObjeto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const presente = (o: Record<string, unknown>, k: string) => k in o && o[k] !== undefined;

/** "inc0715802225 " -> "INC0715802225". */
export const normalizarNumero = (valor: string): string => valor.trim().toUpperCase();

function titulo(v: unknown, mensagens: string[]): string | undefined {
  const t = typeof v === 'string' ? v.trim() : '';
  if (!t) mensagens.push('Título é obrigatório.');
  else if (t.length > 120) mensagens.push('Título deve ter no máximo 120 caracteres.');
  else return t;
  return undefined;
}

function descricao(v: unknown, mensagens: string[]): string | undefined {
  if (typeof v !== 'string') {
    mensagens.push('Descrição deve ser texto.');
    return undefined;
  }
  if (v.length > 2000) {
    mensagens.push('Descrição deve ter no máximo 2000 caracteres.');
    return undefined;
  }
  return v.trim();
}

function enumerado<T extends string>(v: unknown, validos: readonly T[], rotulo: string, mensagens: string[]): T | undefined {
  if (typeof v === 'string' && (validos as readonly string[]).includes(v)) return v as T;
  mensagens.push(`${rotulo} deve ser um destes: ${validos.join(', ')}.`);
  return undefined;
}

function pessoa(v: unknown, mensagens: string[]): string | null | undefined {
  if (v === null || v === '') return null;
  if (typeof v === 'string' && v.trim().length > 0 && v.length <= 40) return v.trim();
  mensagens.push('Responsável deve ser o id de uma pessoa (ou vazio).');
  return undefined;
}

function cenarios(v: unknown, mensagens: string[]): string[] | undefined {
  if (!Array.isArray(v) || v.some((x) => typeof x !== 'string' || !x.trim() || x.length > 20)) {
    mensagens.push('Testes afetados deve ser uma lista de IDs de cenário.');
    return undefined;
  }
  return [...new Set(v.map((x: string) => x.trim()))];
}

/** Quem fez a alteração: opcional, é o "Você" da tela. */
export function autorDe(entrada: unknown): string | null {
  if (!ehObjeto(entrada)) return null;
  const a = entrada.autor;
  return typeof a === 'string' && a.trim() && a.length <= 40 ? a.trim() : null;
}

export function validarNovoIncidente(entrada: unknown): Validacao<NovoIncidente> {
  if (!ehObjeto(entrada)) return { ok: false, mensagens: [MSG_OBJETO] };
  const mensagens: string[] = [];
  const numero = typeof entrada.numero === 'string' ? normalizarNumero(entrada.numero) : '';
  if (!numero) mensagens.push('Número do INC é obrigatório.');
  else if (!FORMATO_NUMERO.test(numero)) mensagens.push('Número do INC deve ter de 3 a 30 caracteres: letras, números, ponto, hífen ou sublinhado.');

  const valor: NovoIncidente = { numero, titulo: titulo(entrada.titulo, mensagens) ?? '', autor: autorDe(entrada) };
  if (presente(entrada, 'descricao')) valor.descricao = descricao(entrada.descricao, mensagens);
  if (presente(entrada, 'status')) valor.status = enumerado(entrada.status, STATUS_INC, 'Status', mensagens);
  if (presente(entrada, 'severidade')) valor.severidade = enumerado(entrada.severidade, SEVERIDADES, 'Severidade', mensagens);
  if (presente(entrada, 'responsavel')) valor.responsavel = pessoa(entrada.responsavel, mensagens);
  if (presente(entrada, 'testesAfetados')) valor.testesAfetados = cenarios(entrada.testesAfetados, mensagens);

  return mensagens.length > 0 ? { ok: false, mensagens } : { ok: true, valor };
}

export function validarEdicaoIncidente(entrada: unknown): Validacao<{ versao: number; campos: EdicaoIncidente; autor: string | null }> {
  if (!ehObjeto(entrada)) return { ok: false, mensagens: [MSG_OBJETO] };
  const mensagens: string[] = [];
  const versaoOk = typeof entrada.versao === 'number' && Number.isInteger(entrada.versao) && entrada.versao >= 1;
  if (!versaoOk) mensagens.push('Versão deve ser um número inteiro (a que você viu ao abrir o INC).');

  const campos: EdicaoIncidente = {};
  if (presente(entrada, 'titulo')) campos.titulo = titulo(entrada.titulo, mensagens);
  if (presente(entrada, 'descricao')) campos.descricao = descricao(entrada.descricao, mensagens);
  if (presente(entrada, 'status')) campos.status = enumerado(entrada.status, STATUS_INC, 'Status', mensagens);
  if (presente(entrada, 'severidade')) campos.severidade = enumerado(entrada.severidade, SEVERIDADES, 'Severidade', mensagens);
  if (presente(entrada, 'responsavel')) campos.responsavel = pessoa(entrada.responsavel, mensagens);
  if (presente(entrada, 'testesAfetados')) campos.testesAfetados = cenarios(entrada.testesAfetados, mensagens);
  if (Object.keys(campos).length === 0 && mensagens.length === 0) mensagens.push('Informe ao menos um campo para alterar.');

  if (mensagens.length > 0 || !versaoOk) return { ok: false, mensagens };
  return { ok: true, valor: { versao: entrada.versao as number, campos, autor: autorDe(entrada) } };
}

export function validarVinculo(entrada: unknown): Validacao<{ idCenarios: string[]; autor: string | null }> {
  if (!ehObjeto(entrada)) return { ok: false, mensagens: [MSG_OBJETO] };
  const mensagens: string[] = [];
  const idCenarios = cenarios(entrada.idCenarios, mensagens);
  if (idCenarios && idCenarios.length === 0) mensagens.push('Informe ao menos um teste.');
  if (mensagens.length > 0 || !idCenarios) return { ok: false, mensagens };
  return { ok: true, valor: { idCenarios, autor: autorDe(entrada) } };
}

export function validarComentario(entrada: unknown): Validacao<{ texto: string; autor: string | null }> {
  if (!ehObjeto(entrada)) return { ok: false, mensagens: [MSG_OBJETO] };
  const texto = typeof entrada.texto === 'string' ? entrada.texto.trim() : '';
  if (!texto) return { ok: false, mensagens: ['Escreva o comentário.'] };
  if (texto.length > 1000) return { ok: false, mensagens: ['Comentário deve ter no máximo 1000 caracteres.'] };
  return { ok: true, valor: { texto, autor: autorDe(entrada) } };
}
