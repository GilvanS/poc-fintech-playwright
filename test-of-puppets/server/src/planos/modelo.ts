export const STATUS = ['agendado', 'em_andamento', 'refinamento', 'concluido'] as const;
export type Status = (typeof STATUS)[number];
export type Resultado = 'passou' | 'falhou';
export type Prioridade = 'P1' | 'P2' | 'P3';

/** Um teste dentro de um plano. Status e resultado são marcados à mão: a ferramenta não executa nada. */
export interface ItemPlano {
  idCenario: string;
  status: Status;
  /** Só existe com status "concluido". */
  resultado?: Resultado;
  prioridade?: Prioridade;
  responsavel?: string;
  estimativaMin?: number;
  tempoRealMin?: number;
  /** aaaa-mm-dd */
  dataPlanejada?: string;
  /** aaaa-mm-dd */
  dataExecucao?: string;
  observacoes?: string;
  /** Decimal: ao soltar entre dois itens vale a média dos vizinhos. */
  posicao: number;
  versao: number;
  atualizadoEm?: string;
}

export const DECISOES = ['go', 'no_go', 'go_excecao'] as const;
export type TipoDecisao = (typeof DECISOES)[number];
/** Os 7 critérios do Release (V4), numerados de 1 a 7. */
export const TOTAL_CRITERIOS = 7;

/** Decisão go/no-go do Release. Só se acrescenta: nunca é editada nem apagada. */
export interface Decisao {
  id: string;
  decisao: TipoDecisao;
  justificativa: string;
  /** Id da pessoa que decidiu. */
  por: string;
  /** Instante ISO em que foi registrada (o servidor é quem carimba). */
  em: string;
  /** Critérios (1 a 7) que não estavam cumpridos na hora da decisão. */
  criterios: number[];
}

export interface Plano {
  id: string;
  nome: string;
  criadoEm: string;
  /** aaaa-mm-dd */
  previsao?: string;
  versao: number;
  itens: ItemPlano[];
  /** Histórico do Release, da mais antiga para a mais nova. Não mexe na `versao` do plano. */
  decisoes?: Decisao[];
}

export interface NovaDecisao {
  decisao: TipoDecisao;
  justificativa: string;
  por: string;
  criterios: number[];
}

/** Campos alteráveis de um item; `null` limpa o campo. */
export interface CamposItem {
  status?: Status;
  resultado?: Resultado | null;
  prioridade?: Prioridade | null;
  responsavel?: string | null;
  estimativaMin?: number | null;
  tempoRealMin?: number | null;
  dataPlanejada?: string | null;
  dataExecucao?: string | null;
  observacoes?: string | null;
  posicao?: number;
}

export interface CamposPlano {
  nome?: string;
  previsao?: string | null;
}

export interface ResumoPlano {
  total: number;
  concluidos: number;
  pendentes: number;
  percentual: number;
  porStatus: Record<Status, number>;
  passou: number;
  falhou: number;
  /** Plano com testes e todos concluídos: vai para a aba "Executados". */
  executado: boolean;
}

export type Validacao<T> = { ok: true; valor: T } | { ok: false; mensagens: string[] };

const FORMATO_ID = /^CT\d{2}\.\d{1,2}$/;
const MSG_OBJETO = 'Corpo da requisição deve ser um objeto JSON.';
const MSG_DATA = (rotulo: string) => `${rotulo} deve ser uma data válida (aaaa-mm-dd).`;
const MSG_VERSAO = (alvo: string) => `Versão deve ser um número inteiro (a que você viu ao abrir o ${alvo}).`;

export function dataValida(valor: unknown): valor is string {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const d = new Date(`${valor}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(valor);
}

function ehObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

const presente = (corpo: Record<string, unknown>, campo: string) => corpo[campo] !== undefined;
const vazio = (valor: unknown) => valor === null || (typeof valor === 'string' && valor.trim() === '');

function versaoValida(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isInteger(valor) && valor >= 1;
}

function nomePlano(valor: unknown, mensagens: string[]): string | undefined {
  const nome = typeof valor === 'string' ? valor.trim() : '';
  if (!nome) mensagens.push('Nome do plano é obrigatório.');
  else if (nome.length > 60) mensagens.push('Nome do plano deve ter no máximo 60 caracteres.');
  else return nome;
  return undefined;
}

/** Lista de IDs sem repetir, mantendo a ordem. Acumula mensagens e devolve undefined se algo estiver errado. */
function listaDeIds(valor: unknown, mensagens: string[]): string[] | undefined {
  if (!Array.isArray(valor)) {
    mensagens.push('idCenarios deve ser uma lista.');
    return undefined;
  }
  const ids: string[] = [];
  let ok = true;
  for (const bruto of valor) {
    if (typeof bruto !== 'string' || !FORMATO_ID.test(bruto.trim())) {
      mensagens.push(`ID de cenário inválido: ${String(bruto)}.`);
      ok = false;
    } else if (!ids.includes(bruto.trim())) ids.push(bruto.trim());
  }
  return ok ? ids : undefined;
}

export function validarNovoPlano(entrada: unknown): Validacao<{ nome: string; previsao?: string; idCenarios: string[] }> {
  if (!ehObjeto(entrada)) return { ok: false, mensagens: [MSG_OBJETO] };
  const mensagens: string[] = [];
  const nome = nomePlano(entrada.nome, mensagens);

  let previsao: string | undefined;
  if (!vazio(entrada.previsao) && entrada.previsao !== undefined) {
    if (dataValida(entrada.previsao)) previsao = entrada.previsao;
    else mensagens.push(MSG_DATA('Previsão'));
  }

  let idCenarios: string[] = [];
  if (entrada.idCenarios !== undefined && entrada.idCenarios !== null) idCenarios = listaDeIds(entrada.idCenarios, mensagens) ?? [];

  if (mensagens.length > 0 || nome === undefined) return { ok: false, mensagens };
  return { ok: true, valor: { nome, ...(previsao ? { previsao } : {}), idCenarios } };
}

export function validarEdicaoPlano(entrada: unknown): Validacao<{ versao: number; campos: CamposPlano }> {
  if (!ehObjeto(entrada)) return { ok: false, mensagens: [MSG_OBJETO] };
  const mensagens: string[] = [];
  if (!versaoValida(entrada.versao)) mensagens.push(MSG_VERSAO('plano'));

  const campos: CamposPlano = {};
  if (presente(entrada, 'nome')) {
    const nome = nomePlano(entrada.nome, mensagens);
    if (nome !== undefined) campos.nome = nome;
  }
  if (presente(entrada, 'previsao')) {
    if (vazio(entrada.previsao)) campos.previsao = null;
    else if (dataValida(entrada.previsao)) campos.previsao = entrada.previsao;
    else mensagens.push(MSG_DATA('Previsão'));
  }
  if (!presente(entrada, 'nome') && !presente(entrada, 'previsao')) mensagens.push('Informe ao menos um campo para alterar (nome ou previsao).');

  if (mensagens.length > 0 || !versaoValida(entrada.versao)) return { ok: false, mensagens };
  return { ok: true, valor: { versao: entrada.versao, campos } };
}

export function validarIdCenarios(entrada: unknown): Validacao<{ idCenarios: string[]; dataPlanejada?: string }> {
  if (!ehObjeto(entrada)) return { ok: false, mensagens: [MSG_OBJETO] };
  const mensagens: string[] = [];
  const idCenarios = listaDeIds(entrada.idCenarios, mensagens);
  if (idCenarios && idCenarios.length === 0 && mensagens.length === 0) mensagens.push('Informe ao menos um cenário.');

  let dataPlanejada: string | undefined;
  if (!vazio(entrada.dataPlanejada) && entrada.dataPlanejada !== undefined) {
    if (dataValida(entrada.dataPlanejada)) dataPlanejada = entrada.dataPlanejada;
    else mensagens.push(MSG_DATA('Data planejada'));
  }

  if (mensagens.length > 0 || !idCenarios) return { ok: false, mensagens };
  return { ok: true, valor: { idCenarios, ...(dataPlanejada ? { dataPlanejada } : {}) } };
}

/** Alteração em lote da V0: atribuir responsável e/ou prioridade a vários testes do plano de uma vez. */
export function validarLote(entrada: unknown): Validacao<{ idCenarios: string[]; campos: Pick<CamposItem, 'responsavel' | 'prioridade'> }> {
  if (!ehObjeto(entrada)) return { ok: false, mensagens: [MSG_OBJETO] };
  const mensagens: string[] = [];
  const idCenarios = listaDeIds(entrada.idCenarios, mensagens);
  if (idCenarios && idCenarios.length === 0 && mensagens.length === 0) mensagens.push('Informe ao menos um cenário.');

  const campos: Pick<CamposItem, 'responsavel' | 'prioridade'> = {};
  if (presente(entrada, 'responsavel')) {
    const r = entrada.responsavel;
    if (vazio(r)) campos.responsavel = null;
    else if (typeof r !== 'string') mensagens.push('Responsável deve ser texto.');
    else if (r.trim().length > 40) mensagens.push('Responsável deve ter no máximo 40 caracteres.');
    else campos.responsavel = r.trim();
  }
  if (presente(entrada, 'prioridade')) {
    const p = entrada.prioridade;
    if (p === null) campos.prioridade = null;
    else if (p === 'P1' || p === 'P2' || p === 'P3') campos.prioridade = p;
    else mensagens.push('Prioridade deve ser P1, P2 ou P3.');
  }
  if (!presente(entrada, 'responsavel') && !presente(entrada, 'prioridade')) {
    mensagens.push('Informe ao menos um campo para alterar (responsavel ou prioridade).');
  }

  if (mensagens.length > 0 || !idCenarios) return { ok: false, mensagens };
  return { ok: true, valor: { idCenarios, campos } };
}

/** Ordem completa dos testes do plano. Repetidos e faltantes quem confere é o servidor (ordem_desatualizada). */
export function validarOrdem(entrada: unknown): Validacao<{ ordem: string[] }> {
  if (!ehObjeto(entrada)) return { ok: false, mensagens: [MSG_OBJETO] };
  if (!Array.isArray(entrada.ordem)) return { ok: false, mensagens: ['ordem deve ser uma lista de IDs de cenário.'] };
  const mensagens: string[] = [];
  for (const id of entrada.ordem) {
    if (typeof id !== 'string' || !FORMATO_ID.test(id)) mensagens.push(`ID de cenário inválido: ${String(id)}.`);
  }
  if (mensagens.length > 0) return { ok: false, mensagens };
  return { ok: true, valor: { ordem: entrada.ordem as string[] } };
}

/**
 * Decisão do Release. A regra "GO só com 7 de 7" aparece aqui como coerência do pedido:
 * GO não pode trazer critério pendente; GO com exceção precisa trazer; NO-GO aceita qualquer lista.
 */
export function validarDecisao(entrada: unknown): Validacao<NovaDecisao> {
  if (!ehObjeto(entrada)) return { ok: false, mensagens: [MSG_OBJETO] };
  const mensagens: string[] = [];

  const decisao = (DECISOES as readonly string[]).includes(entrada.decisao as string) ? (entrada.decisao as TipoDecisao) : undefined;
  if (!decisao) mensagens.push(`Decisão deve ser uma destas: ${DECISOES.join(', ')}.`);

  const justificativa = typeof entrada.justificativa === 'string' ? entrada.justificativa.trim() : '';
  if (!justificativa) mensagens.push('Justificativa é obrigatória.');
  else if (justificativa.length > 1000) mensagens.push('Justificativa deve ter no máximo 1000 caracteres.');

  const por = typeof entrada.por === 'string' ? entrada.por.trim() : '';
  if (!por) mensagens.push('Informe quem decidiu (por).');
  else if (por.length > 40) mensagens.push('Quem decidiu deve ter no máximo 40 caracteres.');

  let criterios: number[] = [];
  if (!Array.isArray(entrada.criterios)) mensagens.push('criterios deve ser uma lista de números de 1 a 7.');
  else if (!entrada.criterios.every((n) => typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= TOTAL_CRITERIOS)) {
    mensagens.push('criterios deve conter só números inteiros de 1 a 7.');
  } else criterios = [...new Set(entrada.criterios as number[])].sort((a, b) => a - b);

  if (decisao === 'go' && criterios.length > 0) mensagens.push('GO só vale com os 7 critérios cumpridos; use GO com exceção.');
  if (decisao === 'go_excecao' && criterios.length === 0 && Array.isArray(entrada.criterios)) {
    mensagens.push('GO com exceção só faz sentido com critério não cumprido; use GO.');
  }

  if (mensagens.length > 0 || !decisao) return { ok: false, mensagens };
  return { ok: true, valor: { decisao, justificativa, por, criterios } };
}

export function validarPatchItem(entrada: unknown): Validacao<{ versao: number; campos: CamposItem }> {
  if (!ehObjeto(entrada)) return { ok: false, mensagens: [MSG_OBJETO] };
  const mensagens: string[] = [];
  const campos: CamposItem = {};
  let tocou = false;

  if (!versaoValida(entrada.versao)) mensagens.push(MSG_VERSAO('teste'));

  if (presente(entrada, 'status')) {
    tocou = true;
    if (typeof entrada.status === 'string' && (STATUS as readonly string[]).includes(entrada.status)) campos.status = entrada.status as Status;
    else mensagens.push(`Status deve ser um destes: ${STATUS.join(', ')}.`);
  }
  if (presente(entrada, 'resultado')) {
    tocou = true;
    if (entrada.resultado === null) campos.resultado = null;
    else if (entrada.resultado === 'passou' || entrada.resultado === 'falhou') campos.resultado = entrada.resultado;
    else mensagens.push('Resultado deve ser passou ou falhou.');
  }
  if (presente(entrada, 'prioridade')) {
    tocou = true;
    if (entrada.prioridade === null) campos.prioridade = null;
    else if (entrada.prioridade === 'P1' || entrada.prioridade === 'P2' || entrada.prioridade === 'P3') campos.prioridade = entrada.prioridade;
    else mensagens.push('Prioridade deve ser P1, P2 ou P3.');
  }

  const texto = (campo: 'responsavel' | 'observacoes', rotulo: string, maximo: number) => {
    if (!presente(entrada, campo)) return;
    tocou = true;
    const valor = entrada[campo];
    if (vazio(valor)) campos[campo] = null;
    else if (typeof valor !== 'string') mensagens.push(`${rotulo} deve ser texto.`);
    else if (valor.trim().length > maximo) mensagens.push(`${rotulo} deve ter no máximo ${maximo} caracteres.`);
    else campos[campo] = valor.trim();
  };
  texto('responsavel', 'Responsável', 40);
  texto('observacoes', 'Observações', 1000);

  const minutos = (campo: 'estimativaMin' | 'tempoRealMin') => {
    if (!presente(entrada, campo)) return;
    tocou = true;
    const valor = entrada[campo];
    if (valor === null) campos[campo] = null;
    else if (typeof valor === 'number' && Number.isInteger(valor) && valor >= 0 && valor <= 100000) campos[campo] = valor;
    else mensagens.push(`${campo} deve ser um inteiro de 0 a 100000.`);
  };
  minutos('estimativaMin');
  minutos('tempoRealMin');

  const data = (campo: 'dataPlanejada' | 'dataExecucao', rotulo: string) => {
    if (!presente(entrada, campo)) return;
    tocou = true;
    const valor = entrada[campo];
    if (vazio(valor)) campos[campo] = null;
    else if (dataValida(valor)) campos[campo] = valor;
    else mensagens.push(MSG_DATA(rotulo));
  };
  data('dataPlanejada', 'Data planejada');
  data('dataExecucao', 'Data de execução');

  if (presente(entrada, 'posicao')) {
    tocou = true;
    if (typeof entrada.posicao === 'number' && Number.isFinite(entrada.posicao)) campos.posicao = entrada.posicao;
    else mensagens.push('posicao deve ser um número.');
  }

  if (!tocou) mensagens.push('Informe ao menos um campo para alterar.');
  if (mensagens.length > 0 || !versaoValida(entrada.versao)) return { ok: false, mensagens };
  return { ok: true, valor: { versao: entrada.versao, campos } };
}

export function resumir(plano: Plano): ResumoPlano {
  const porStatus: Record<Status, number> = { agendado: 0, em_andamento: 0, refinamento: 0, concluido: 0 };
  let passou = 0;
  let falhou = 0;
  for (const item of plano.itens) {
    porStatus[item.status] += 1;
    if (item.resultado === 'passou') passou += 1;
    if (item.resultado === 'falhou') falhou += 1;
  }
  const total = plano.itens.length;
  const concluidos = porStatus.concluido;
  return {
    total,
    concluidos,
    pendentes: total - concluidos,
    percentual: total === 0 ? 0 : Math.round((concluidos / total) * 100),
    porStatus,
    passou,
    falhou,
    executado: total > 0 && concluidos === total,
  };
}
