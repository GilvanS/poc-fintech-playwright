import { pedir } from '../pages/cenarios/clienteApi.ts';

export const CORES = ['azul', 'verde', 'roxo', 'laranja', 'rosa', 'ciano'] as const;
export type Cor = (typeof CORES)[number];

/** Cor de cada pessoa como classe do Tailwind (bolinha ao lado do nome). */
export const CLASSE_COR: Record<Cor, string> = {
  azul: 'bg-sky-400',
  verde: 'bg-volt-green',
  roxo: 'bg-violet-400',
  laranja: 'bg-orange-400',
  rosa: 'bg-pink-400',
  ciano: 'bg-cyan-300',
};

export interface Pessoa {
  id: string;
  nome: string;
  capacidadeMinSemana: number;
  cor: Cor;
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

export const listarPessoas = () => pedir<{ pessoas?: Pessoa[] }>('GET', '/api/pessoas').then((r) => r.pessoas ?? []);
export const criarPessoa = (campos: CamposPessoa) => pedir<Pessoa>('POST', '/api/pessoas', campos);
export const atualizarPessoa = (id: string, campos: CamposPessoa, versao: number) =>
  pedir<Pessoa>('PUT', `/api/pessoas/${encodeURIComponent(id)}`, { ...campos, versao });
export const excluirPessoa = (id: string) => pedir<void>('DELETE', `/api/pessoas/${encodeURIComponent(id)}`);
