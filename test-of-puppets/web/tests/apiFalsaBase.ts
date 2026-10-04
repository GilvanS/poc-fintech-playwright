import type { CenarioVisao } from '../src/pages/cenarios/clienteApi';
import type { DetalhePlano, ItemPlano, ResumoPlano } from '../src/pages/planos/clientePlanos';
import type { Pessoa } from '../src/pessoas/clientePessoas';

// Base do servidor falso: dados de exemplo (fixtures) e o que as rotas em modulos separados compartilham.

export const CRIADO = '2026-09-24T12:00:00.000Z';

export function item(idCenario: string, extra: Partial<ItemPlano> = {}): ItemPlano {
  return {
    idCenario,
    nome: `Nome de ${idCenario}`,
    funcionalidade: 'Faturas',
    status: 'agendado',
    posicao: 1,
    versao: 1,
    dependeDe: [],
    massaCompartilhadaCom: [],
    bloqueadoPor: [],
    ...extra,
  };
}

export function cenario(idCenario: string, extra: Partial<CenarioVisao> = {}): CenarioVisao {
  return {
    idCenario,
    nome: `Nome de ${idCenario}`,
    funcionalidade: 'Faturas',
    versao: 1,
    criadoEm: CRIADO,
    atualizadoEm: CRIADO,
    dependeDe: [],
    massaCompartilhadaCom: [],
    ...extra,
  };
}

export function pessoa(id: string, extra: Partial<Pessoa> = {}): Pessoa {
  return {
    id,
    nome: id.charAt(0).toUpperCase() + id.slice(1),
    capacidadeMinSemana: 0,
    cor: 'azul',
    ativa: true,
    versao: 1,
    criadoEm: CRIADO,
    atualizadoEm: CRIADO,
    ...extra,
  };
}

export function resumir(itens: ItemPlano[]): ResumoPlano {
  const porStatus = { agendado: 0, em_andamento: 0, refinamento: 0, concluido: 0 };
  for (const i of itens) porStatus[i.status] += 1;
  const total = itens.length;
  return {
    total,
    concluidos: porStatus.concluido,
    pendentes: total - porStatus.concluido,
    percentual: total ? Math.round((porStatus.concluido / total) * 100) : 0,
    porStatus,
    passou: itens.filter((i) => i.resultado === 'passou').length,
    falhou: itens.filter((i) => i.resultado === 'falhou').length,
    executado: total > 0 && porStatus.concluido === total,
  };
}

/** Monta um plano completo; as posições seguem a ordem em que os itens foram passados. */
export function plano(id: string, nome: string, itens: ItemPlano[] = [], extra: Partial<DetalhePlano['plano']> = {}): DetalhePlano {
  const comPosicao = itens.map((i, p) => ({ ...i, posicao: p + 1 }));
  return { plano: { id, nome, criadoEm: CRIADO, versao: 1, ...extra }, itens: comPosicao, resumo: resumir(comPosicao) };
}

export interface Chamada {
  metodo: string;
  caminho: string;
  corpo?: Record<string, unknown>;
}

/** O pedido que o servidor falso recebeu, já separado em partes (api, planos, :id, ...). */
export interface Rota {
  partes: string[];
  metodo: string;
  corpo?: Record<string, unknown>;
  url: URL;
}

export function json(status: number, corpo: unknown) {
  return new Response(status === 204 ? null : JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json' } });
}
