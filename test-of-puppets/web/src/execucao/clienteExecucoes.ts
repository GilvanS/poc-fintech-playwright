import { pedir } from '../pages/cenarios/clienteApi.ts';

export type EstadoRun = 'na_fila' | 'rodando' | 'passou' | 'falhou' | 'interrompida' | 'cancelada';

/** Uma execução (Play) de um teste de um plano, como o servidor devolve. */
export interface Run {
  runId: string;
  planoId: string;
  idCenario: string;
  estado: EstadoRun;
  enfileiradoEm: string;
  iniciadoEm?: string;
  terminouEm?: string;
  duracaoMs?: number;
  /** .docx de evidência, relativo à raiz do projeto de testes. */
  evidencia?: string;
  anexos: string[];
  observacao?: string;
}

export interface ChecagemAmbiente {
  chave: string;
  titulo: string;
  ok: boolean;
  detalhe: string;
}

export const ROTULO_ESTADO: Record<EstadoRun, string> = {
  na_fila: 'Na fila',
  rodando: 'Rodando',
  passou: 'Passou',
  falhou: 'Falhou',
  interrompida: 'Interrompida',
  cancelada: 'Cancelada',
};

export const emAberto = (r: Run) => r.estado === 'na_fila' || r.estado === 'rodando';

export const listarExecucoes = () => pedir<{ execucoes: Run[] }>('GET', '/api/execucoes');
export const iniciarExecucao = (planoId: string, idCenario: string) => pedir<{ execucao: Run }>('POST', '/api/execucoes', { planoId, idCenario });
export const pararExecucao = (runId: string) => pedir<{ execucao: Run }>('POST', `/api/execucoes/${encodeURIComponent(runId)}/parar`);
export const reexecutarFalhos = (planoId: string, funcionalidade?: string) =>
  pedir<{ execucoes: Run[]; ignorados: { idCenario: string; motivo: string }[] }>('POST', '/api/execucoes/falhos', { planoId, funcionalidade });
export const verificarAmbiente = () => pedir<{ checagens: ChecagemAmbiente[]; ok: boolean }>('GET', '/api/execucoes/ambiente');

export const urlLog = (runId: string) => `/api/execucoes/${encodeURIComponent(runId)}/log`;
export const urlLogTexto = (runId: string) => `/api/execucoes/${encodeURIComponent(runId)}/log.txt`;
export const urlArquivo = (runId: string, caminho: string) => `/api/execucoes/${encodeURIComponent(runId)}/arquivo?caminho=${encodeURIComponent(caminho)}`;
