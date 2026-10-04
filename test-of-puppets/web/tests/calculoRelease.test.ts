import { describe, expect, it } from 'vitest';
import type { Incidente } from '../src/incidentes/clienteIncidentes';
import type { Decisao } from '../src/pages/planos/clientePlanos';
import {
  calcularCriterios,
  cumpridos,
  estadoDaDecisao,
  listarCriterios,
  montarPendencias,
  naoAtendidos,
  prontidaoPorPessoa,
  prontidaoPorPrioridade,
  type EntradaCriterios,
} from '../src/pages/release/calculoRelease';
import { item } from './apiFalsa';

const HOJE = '2026-10-03';
const nome = (id?: string) => (id ? id[0].toUpperCase() + id.slice(1) : '-');

function inc(numero: string, extra: Partial<Incidente> = {}): Incidente {
  return {
    numero,
    titulo: `Titulo de ${numero}`,
    descricao: '',
    status: 'novo',
    severidade: 'media',
    responsavel: null,
    testesAfetados: [],
    comentarios: [],
    historico: [],
    abertoEm: '2026-10-01T14:10:00.000Z',
    resolvidoEm: null,
    atualizadoEm: '2026-10-01T14:10:00.000Z',
    versao: 1,
    ...extra,
  };
}

const itensMaster = () => [
  item('CT03.1', { status: 'concluido', resultado: 'passou', responsavel: 'ana', prioridade: 'P1', estimativaMin: 20 }),
  item('CT03.2', { status: 'em_andamento', responsavel: 'ana', prioridade: 'P1', estimativaMin: 30, idMassa: '0483' }),
  item('CT03.3', { responsavel: 'bia', prioridade: 'P2', estimativaMin: 25 }),
  item('CT03.7', { responsavel: 'bia', prioridade: 'P2', estimativaMin: 30, idMassa: '0483', dependeDe: ['CT03.2'], bloqueadoPor: ['CT03.2'] }),
  item('CT04.1', { responsavel: 'carlos', prioridade: 'P1', estimativaMin: 20, dataPlanejada: '2026-10-07' }),
  item('CT05.2', { status: 'concluido', resultado: 'falhou', responsavel: 'bia' }),
];

const incidentesMaster = () => [
  inc('INC0715802225', { severidade: 'alta', status: 'em_analise', responsavel: 'ana', testesAfetados: ['CT03.1', 'CT03.2'] }),
  inc('INC0715799001', { severidade: 'media', status: 'novo', responsavel: 'bia', testesAfetados: ['CT05.2'] }),
  inc('INC0715790010', { severidade: 'baixa', status: 'resolvido', testesAfetados: ['CT05.2'] }),
  inc('INC0000000001', { severidade: 'alta', testesAfetados: ['CT99.9'] }),
];

const entrada = (extra: Partial<EntradaCriterios> = {}): EntradaCriterios => ({
  itens: itensMaster(),
  incidentes: incidentesMaster(),
  previsao: '2026-10-13',
  hoje: HOJE,
  nome,
  ...extra,
});

describe('calcularCriterios', () => {
  it('plano de exemplo: 1 de 7 cumprido, com o "atual" de cada critério', () => {
    const c = calcularCriterios(entrada());
    expect(c.map((x) => x.numero)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(c.map((x) => x.atual)).toEqual([
      '2 de 6',
      '1 falha (CT05.2)',
      '2 abertos (Alta 1, Média 1)',
      '1 de 3 (CT03.2, CT04.1 pendem)',
      'CT03.7 espera o CT03.2 (mesma massa 0483)',
      '5 de 6',
      'alvo em 7 dias úteis',
    ]);
    expect(c.map((x) => x.ok)).toEqual([false, false, false, false, false, false, true]);
    expect(cumpridos(c)).toBe(1);
    expect(naoAtendidos(c)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('INC resolvido ou de teste que não está no plano não conta', () => {
    const c = calcularCriterios(entrada());
    expect(c[2].detalhes.map((d) => d.numeroInc)).toEqual(['INC0715802225', 'INC0715799001']);
    expect(c[2].detalhes[0].texto).toBe('INC0715802225 · Alta · Em análise · Ana · afeta CT03.1 CT03.2');
  });

  it('os detalhes dizem o que falta em cada critério', () => {
    const c = calcularCriterios(entrada());
    expect(c[0].detalhes.map((d) => d.idCenario)).toEqual(['CT03.2', 'CT03.3', 'CT03.7', 'CT04.1']);
    expect(c[5].detalhes).toEqual([{ texto: 'CT05.2 sem estimativa', idCenario: 'CT05.2' }]);
  });

  it('tudo em dia: 7 de 7', () => {
    const itens = [
      item('CT01.1', { status: 'concluido', resultado: 'passou', responsavel: 'ana', prioridade: 'P1', estimativaMin: 10, dataExecucao: '2026-10-02' }),
      item('CT01.2', { status: 'concluido', resultado: 'passou', responsavel: 'bia', estimativaMin: 10 }),
    ];
    const c = calcularCriterios(entrada({ itens, incidentes: [] }));
    expect(cumpridos(c)).toBe(7);
    expect(c[2].atual).toBe('nenhum aberto');
    expect(c[1].atual).toBe('nenhuma falha');
  });

  it('plano vazio nunca fica pronto', () => {
    const c = calcularCriterios(entrada({ itens: [], incidentes: [] }));
    expect(c[0]).toMatchObject({ atual: 'plano sem testes', ok: false });
    expect(c[5]).toMatchObject({ atual: 'plano sem testes', ok: false });
    expect(c[3]).toMatchObject({ atual: 'nenhum teste P1 no plano', ok: true });
  });

  it('prazo: sem previsão, hoje, vencido, e concluído dentro do prazo', () => {
    expect(calcularCriterios(entrada({ previsao: undefined }))[6]).toMatchObject({ ok: false, atual: 'sem previsão definida' });
    expect(calcularCriterios(entrada({ previsao: HOJE }))[6]).toMatchObject({ ok: true, atual: 'alvo é hoje' });
    expect(calcularCriterios(entrada({ previsao: '2026-10-01' }))[6]).toMatchObject({ ok: false, atual: 'venceu há 2 dias úteis' });
    const feitos = [item('CT01.1', { status: 'concluido', resultado: 'passou', dataExecucao: '2026-09-30' })];
    expect(calcularCriterios(entrada({ itens: feitos, incidentes: [], previsao: '2026-10-01' }))[6]).toMatchObject({ ok: true, atual: 'concluído dentro do prazo' });
    const atrasado = [item('CT01.1', { status: 'concluido', resultado: 'passou', dataExecucao: '2026-10-02' })];
    expect(calcularCriterios(entrada({ itens: atrasado, incidentes: [], previsao: '2026-10-01' }))[6].ok).toBe(false);
  });

  it('vários testes esperando outro viram uma contagem', () => {
    const itens = [item('CT01.1', { bloqueadoPor: ['CT01.0'] }), item('CT01.2', { bloqueadoPor: ['CT01.0'] })];
    expect(calcularCriterios(entrada({ itens, incidentes: [] }))[4].atual).toBe('2 testes esperando outro');
  });
});

describe('montarPendencias', () => {
  it('ordena por impacto: P1 e INC Alta primeiro, quem espera outro depois dos demais do mesmo peso', () => {
    const e = entrada();
    const lista = montarPendencias(e, calcularCriterios(e));
    expect(lista.map((p) => p.ref)).toEqual(['INC0715802225', 'CT03.2', 'CT04.1', 'INC0715799001', 'CT03.3', 'CT03.7', 'CT05.2']);
  });

  it('cada pendência diz quem e o que fazer', () => {
    const e = entrada();
    const por = Object.fromEntries(montarPendencias(e, calcularCriterios(e)).map((p) => [p.ref, p]));
    expect(por['INC0715802225']).toMatchObject({ etiqueta: '[Alta]', quem: 'Ana', acao: 'resolver o INC "Titulo de INC0715802225"' });
    expect(por['CT03.2']).toMatchObject({ etiqueta: '[P1]', quem: 'Ana', acao: 'concluir o teste (em andamento)' });
    expect(por['CT04.1'].acao).toBe('executar (planejado 07/10)');
    expect(por['CT03.7']).toMatchObject({ espera: true, acao: 'aguardar o CT03.2 passar (mesma massa 0483)' });
    expect(por['CT05.2'].acao).toBe('reexecutar após INC0715799001 · definir estimativa');
  });

  it('prazo estourado vira uma pendência do plano', () => {
    const e = entrada({ previsao: undefined });
    const lista = montarPendencias(e, calcularCriterios(e));
    expect(lista.find((p) => p.tipo === 'plano')?.acao).toBe('definir a previsão do plano');
  });

  it('falhou sem INC aberto: corrigir e reexecutar; tudo em dia: lista vazia', () => {
    const e = entrada({ incidentes: [] });
    expect(montarPendencias(e, calcularCriterios(e)).find((p) => p.ref === 'CT05.2')?.acao).toBe('corrigir e reexecutar · definir estimativa');
    const ok = entrada({ itens: [item('CT01.1', { status: 'concluido', resultado: 'passou', responsavel: 'ana', estimativaMin: 5 })], incidentes: [] });
    expect(montarPendencias(ok, calcularCriterios(ok))).toEqual([]);
  });
});

describe('estadoDaDecisao', () => {
  const decisao = (d: Partial<Decisao>): Decisao => ({ id: 'dc_1', decisao: 'go', justificativa: 'ok', por: 'ana', em: '2026-10-02T14:05:00.000Z', criterios: [], ...d });

  it('sem decisão ou com NO-GO: nem liberado nem a reavaliar', () => {
    expect(estadoDaDecisao(undefined, itensMaster())).toEqual({ liberado: false, reavaliar: false, mudaramDepois: [] });
    const no = decisao({ decisao: 'no_go' });
    expect(estadoDaDecisao([no], itensMaster())).toEqual({ ultima: no, liberado: false, reavaliar: false, mudaramDepois: [] });
  });

  it('GO continua valendo enquanto nenhum teste mudar depois', () => {
    const go = decisao({});
    const itens = [item('CT01.1', { atualizadoEm: '2026-10-02T14:00:00.000Z' }), item('CT01.2')];
    expect(estadoDaDecisao([go], itens)).toMatchObject({ liberado: true, reavaliar: false });
  });

  it('teste alterado depois do GO volta para "reavaliar" e diz qual', () => {
    const go = decisao({ decisao: 'go_excecao', criterios: [4] });
    const itens = [item('CT01.1', { atualizadoEm: '2026-10-02T14:06:00.000Z' }), item('CT01.2', { atualizadoEm: '2026-10-01T10:00:00.000Z' })];
    expect(estadoDaDecisao([go], itens)).toMatchObject({ liberado: false, reavaliar: true, mudaramDepois: ['CT01.1'] });
  });

  it('só a última decisão vale', () => {
    const lista = [decisao({}), decisao({ id: 'dc_2', decisao: 'no_go', em: '2026-10-03T10:00:00.000Z' })];
    expect(estadoDaDecisao(lista, itensMaster()).liberado).toBe(false);
  });
});

describe('prontidão', () => {
  it('por prioridade: só grupos com testes, "sem prioridade" por último', () => {
    const p = prontidaoPorPrioridade(itensMaster());
    expect(p.map((x) => [x.rotulo, x.passou, x.total])).toEqual([['P1', 1, 3], ['P2', 0, 2], ['Sem prioridade', 0, 1]]);
  });

  it('por pessoa: ordem alfabética, falhas contadas e "sem responsável" no fim', () => {
    const itens = [...itensMaster(), item('CT09.9')];
    const p = prontidaoPorPessoa(itens, nome);
    expect(p.map((x) => [x.rotulo, x.passou, x.falhou, x.total])).toEqual([
      ['Ana', 1, 0, 2],
      ['Bia', 0, 1, 3],
      ['Carlos', 0, 0, 1],
      ['Sem responsável', 0, 0, 1],
    ]);
  });
});

describe('listarCriterios', () => {
  it('junta com vírgula e "e"', () => {
    expect(listarCriterios([])).toBe('');
    expect(listarCriterios([4])).toBe('4');
    expect(listarCriterios([1, 2])).toBe('1 e 2');
    expect(listarCriterios([1, 2, 3, 4, 5, 6])).toBe('1, 2, 3, 4, 5 e 6');
  });
});
