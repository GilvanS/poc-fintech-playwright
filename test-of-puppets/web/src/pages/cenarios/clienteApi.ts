/** Campos do modal M16 (mesmos nomes da API do servidor). */
export interface CenarioEntrada {
  idCenario: string;
  nome: string;
  funcionalidade: string;
  idMassa?: string;
  /** Só os 11 dígitos. */
  cpf?: string;
  passos?: string;
  resultadoEsperado?: string;
}

export interface CenarioVisao extends CenarioEntrada {
  versao: number;
  criadoEm: string;
  atualizadoEm: string;
  /** Calculado pelo servidor: cenários de mesma massa e numeração menor. */
  dependeDe: string[];
  /** Calculado pelo servidor: todos os outros que usam a mesma massa. */
  massaCompartilhadaCom: string[];
}

export interface ListaCenarios {
  cenarios: CenarioVisao[];
  funcionalidades: string[];
}

/** Erro de chamada à API com as mensagens já em português, prontas para mostrar. */
export class ErroApi extends Error {
  constructor(
    readonly status: number,
    readonly codigo: string,
    readonly mensagens: string[],
  ) {
    super(mensagens.join(' '));
  }
}

export async function pedir<T>(metodo: string, caminho: string, corpo?: unknown): Promise<T> {
  let resposta: Response;
  try {
    resposta = await fetch(caminho, {
      method: metodo,
      headers: corpo === undefined ? undefined : { 'content-type': 'application/json' },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
  } catch {
    throw new ErroApi(0, 'sem_conexao', ['Não foi possível falar com o servidor.']);
  }
  if (resposta.status === 204) return undefined as T;

  const json = (await resposta.json().catch(() => null)) as { erro?: string; mensagem?: string; mensagens?: string[] } | null;
  if (!resposta.ok) {
    const mensagens = json?.mensagens ?? (json?.mensagem ? [json.mensagem] : [`Erro inesperado (HTTP ${resposta.status}).`]);
    throw new ErroApi(resposta.status, json?.erro ?? 'erro', mensagens);
  }
  return json as T;
}

export const listarCenarios = () => pedir<ListaCenarios>('GET', '/api/cenarios');
export const criarCenario = (entrada: CenarioEntrada) => pedir<CenarioVisao>('POST', '/api/cenarios', entrada);
export const atualizarCenario = (id: string, entrada: CenarioEntrada, versao: number) =>
  pedir<CenarioVisao>('PUT', `/api/cenarios/${encodeURIComponent(id)}`, { ...entrada, versao });
export const excluirCenario = (id: string) => pedir<void>('DELETE', `/api/cenarios/${encodeURIComponent(id)}`);
