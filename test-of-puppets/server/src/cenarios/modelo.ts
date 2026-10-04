/** Campos que a pessoa digita no modal M16. Senha e PIN não existem aqui de propósito. */
export interface CenarioEntrada {
  idCenario: string;
  nome: string;
  funcionalidade: string;
  idMassa?: string;
  /** Só os 11 dígitos; a tela mostra mascarado. */
  cpf?: string;
  passos?: string;
  resultadoEsperado?: string;
}

export interface Cenario extends CenarioEntrada {
  versao: number;
  criadoEm: string;
  atualizadoEm: string;
}

/** O que a API devolve: o cenário guardado mais o que se calcula sozinho a partir da massa. */
export interface CenarioVisao extends Cenario {
  /** Cenários de mesma massa com numeração menor: este só pode andar depois deles. */
  dependeDe: string[];
  /** Todos os outros cenários que usam a mesma massa (marca neutra "massa compartilhada"). */
  massaCompartilhadaCom: string[];
}

export type ResultadoValidacao = { ok: true; valor: CenarioEntrada } | { ok: false; mensagens: string[] };

const FORMATO_ID = /^CT\d{2}\.\d{1,2}$/;
const FORMATO_MASSA = /^[A-Za-z0-9_-]{1,20}$/;

function aparar(valor: unknown): string | undefined {
  if (typeof valor !== 'string') return undefined;
  const texto = valor.trim();
  return texto === '' ? undefined : texto;
}

function ehObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

/**
 * Valida e normaliza o corpo de POST/PUT. Só os campos conhecidos passam (o resto é descartado,
 * inclusive `senha`, `pin` e `versao`). Devolve todas as mensagens de uma vez, em português.
 */
export function validarEntrada(entrada: unknown): ResultadoValidacao {
  if (!ehObjeto(entrada)) return { ok: false, mensagens: ['Corpo da requisição deve ser um objeto JSON.'] };

  const mensagens: string[] = [];
  const idCenario = aparar(entrada.idCenario);
  const nome = aparar(entrada.nome);
  const funcionalidade = aparar(entrada.funcionalidade);

  if (!idCenario || !FORMATO_ID.test(idCenario)) mensagens.push('ID do cenário deve seguir o formato CTnn.n (ex.: CT03.2).');
  if (!nome) mensagens.push('Nome é obrigatório.');
  else if (nome.length > 120) mensagens.push('Nome deve ter no máximo 120 caracteres.');
  if (!funcionalidade) mensagens.push('Funcionalidade é obrigatória.');
  else if (funcionalidade.length > 60) mensagens.push('Funcionalidade deve ter no máximo 60 caracteres.');

  const opcional = (campo: string, rotulo: string, maximo: number): string | undefined => {
    const bruto = entrada[campo];
    if (bruto === undefined || bruto === null) return undefined;
    if (typeof bruto !== 'string') {
      mensagens.push(`${rotulo} deve ser texto.`);
      return undefined;
    }
    const texto = aparar(bruto);
    if (texto && texto.length > maximo) mensagens.push(`${rotulo} deve ter no máximo ${maximo} caracteres.`);
    return texto;
  };

  const passos = opcional('passos', 'Passos', 300);
  const resultadoEsperado = opcional('resultadoEsperado', 'Resultado esperado', 300);

  const idMassa = opcional('idMassa', 'ID da massa', 20);
  if (idMassa && !FORMATO_MASSA.test(idMassa) && idMassa.length <= 20) {
    mensagens.push('ID da massa deve ter só letras, números, "-" ou "_" (até 20).');
  }

  let cpf = opcional('cpf', 'CPF', 30);
  if (cpf) {
    cpf = cpf.replace(/\D/g, '');
    if (cpf.length !== 11) mensagens.push('CPF deve ter 11 dígitos.');
  }

  if (mensagens.length > 0 || !idCenario || !nome || !funcionalidade) return { ok: false, mensagens };

  return {
    ok: true,
    valor: {
      idCenario,
      nome,
      funcionalidade,
      ...(idMassa ? { idMassa } : {}),
      ...(cpf ? { cpf } : {}),
      ...(passos ? { passos } : {}),
      ...(resultadoEsperado ? { resultadoEsperado } : {}),
    },
  };
}

/** Compara por número: CT03.10 vem depois de CT03.2. ID fora do formato vai para o fim. */
export function chaveOrdem(idCenario: string): [number, number] {
  const m = /^CT(\d+)\.(\d+)$/.exec(idCenario);
  return m ? [Number(m[1]), Number(m[2])] : [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER];
}

export function compararIds(a: string, b: string): number {
  const [a1, a2] = chaveOrdem(a);
  const [b1, b2] = chaveOrdem(b);
  return a1 - b1 || a2 - b2 || a.localeCompare(b);
}

/**
 * Detecta sozinha a massa repetida (mesmo `idMassa`). Repetir é proposital, nunca erro: o cenário de
 * numeração maior continua de onde o menor parou, então depende dele. Devolve ordenado pelo ID.
 */
export function derivarMassa(cenarios: Cenario[]): CenarioVisao[] {
  const ordenados = [...cenarios].sort((a, b) => compararIds(a.idCenario, b.idCenario));
  const porMassa = new Map<string, string[]>();
  for (const c of ordenados) {
    if (!c.idMassa) continue;
    porMassa.set(c.idMassa, [...(porMassa.get(c.idMassa) ?? []), c.idCenario]);
  }
  return ordenados.map((c) => {
    const grupo = c.idMassa ? (porMassa.get(c.idMassa) ?? []) : [];
    const posicao = grupo.indexOf(c.idCenario);
    return {
      ...c,
      dependeDe: grupo.slice(0, Math.max(posicao, 0)),
      massaCompartilhadaCom: grupo.filter((id) => id !== c.idCenario),
    };
  });
}
