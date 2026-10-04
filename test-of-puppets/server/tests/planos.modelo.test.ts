import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  resumir,
  validarEdicaoPlano,
  validarIdCenarios,
  validarLote,
  validarNovoPlano,
  validarOrdem,
  validarPatchItem,
  type ItemPlano,
  type Plano,
} from '../src/planos/modelo.ts';

function mensagens(r: { ok: boolean; mensagens?: string[] }): string[] {
  assert.equal(r.ok, false);
  return r.mensagens ?? [];
}

// ---------- novo plano ----------

test('novo plano: só o nome basta; sem testes por padrão', () => {
  const r = validarNovoPlano({ nome: '  28/09/26 ' });
  assert.deepEqual(r, { ok: true, valor: { nome: '28/09/26', idCenarios: [] } });
});

test('novo plano: aceita previsão e lista de cenários (sem repetir)', () => {
  const r = validarNovoPlano({ nome: 'Plano A', previsao: '2026-10-13', idCenarios: ['CT03.2', 'CT03.7', 'CT03.2'] });
  assert.deepEqual(r, { ok: true, valor: { nome: 'Plano A', previsao: '2026-10-13', idCenarios: ['CT03.2', 'CT03.7'] } });
});

test('novo plano: nome obrigatório e com até 60 caracteres', () => {
  assert.deepEqual(mensagens(validarNovoPlano({ nome: ' ' })), ['Nome do plano é obrigatório.']);
  assert.deepEqual(mensagens(validarNovoPlano({ nome: 'x'.repeat(61) })), ['Nome do plano deve ter no máximo 60 caracteres.']);
});

test('novo plano: previsão precisa ser uma data real (aaaa-mm-dd)', () => {
  for (const ruim of ['13/10/2026', '2026-13-01', '2026-02-30', 'amanha', 20261013]) {
    assert.deepEqual(mensagens(validarNovoPlano({ nome: 'A', previsao: ruim })), ['Previsão deve ser uma data válida (aaaa-mm-dd).'], String(ruim));
  }
});

test('novo plano: idCenarios precisa ser lista de IDs no formato CTnn.n', () => {
  assert.deepEqual(mensagens(validarNovoPlano({ nome: 'A', idCenarios: 'CT03.2' })), ['idCenarios deve ser uma lista.']);
  assert.deepEqual(mensagens(validarNovoPlano({ nome: 'A', idCenarios: ['CT03.2', 'x'] })), ['ID de cenário inválido: x.']);
});

test('novo plano: corpo que não é objeto é recusado', () => {
  assert.deepEqual(mensagens(validarNovoPlano(null)), ['Corpo da requisição deve ser um objeto JSON.']);
});

// ---------- editar plano ----------

test('editar plano: exige a versão e ao menos um campo; null limpa a previsão', () => {
  assert.deepEqual(validarEdicaoPlano({ versao: 2, previsao: null }), { ok: true, valor: { versao: 2, campos: { previsao: null } } });
  assert.deepEqual(validarEdicaoPlano({ versao: 1, nome: ' Novo ' }), { ok: true, valor: { versao: 1, campos: { nome: 'Novo' } } });
  assert.deepEqual(mensagens(validarEdicaoPlano({ nome: 'A' })), ['Versão deve ser um número inteiro (a que você viu ao abrir o plano).']);
  assert.deepEqual(mensagens(validarEdicaoPlano({ versao: 1 })), ['Informe ao menos um campo para alterar (nome ou previsao).']);
  assert.deepEqual(mensagens(validarEdicaoPlano({ versao: 1, nome: '' })), ['Nome do plano é obrigatório.']);
});

// ---------- incluir testes ----------

test('incluir testes: lista obrigatória e não vazia; data planejada opcional', () => {
  assert.deepEqual(validarIdCenarios({ idCenarios: ['CT03.2'], dataPlanejada: '2026-10-05' }), {
    ok: true,
    valor: { idCenarios: ['CT03.2'], dataPlanejada: '2026-10-05' },
  });
  assert.deepEqual(mensagens(validarIdCenarios({})), ['idCenarios deve ser uma lista.']);
  assert.deepEqual(mensagens(validarIdCenarios({ idCenarios: [] })), ['Informe ao menos um cenário.']);
  assert.deepEqual(mensagens(validarIdCenarios({ idCenarios: ['CT03.2'], dataPlanejada: 'ontem' })), [
    'Data planejada deve ser uma data válida (aaaa-mm-dd).',
  ]);
});

// ---------- alteração em lote (atribuir / prioridade) ----------

test('lote: lista de testes e ao menos responsável ou prioridade; null limpa', () => {
  assert.deepEqual(validarLote({ idCenarios: ['CT03.1', 'CT03.2', 'CT03.1'], responsavel: ' ana ', prioridade: 'P1' }), {
    ok: true,
    valor: { idCenarios: ['CT03.1', 'CT03.2'], campos: { responsavel: 'ana', prioridade: 'P1' } },
  });
  assert.deepEqual(validarLote({ idCenarios: ['CT03.1'], responsavel: null }), {
    ok: true,
    valor: { idCenarios: ['CT03.1'], campos: { responsavel: null } },
  });
  assert.deepEqual(validarLote({ idCenarios: ['CT03.1'], prioridade: null, responsavel: '' }), {
    ok: true,
    valor: { idCenarios: ['CT03.1'], campos: { prioridade: null, responsavel: null } },
  });
});

test('lote: recusa lista vazia, sem campo, prioridade inválida e responsável grande', () => {
  assert.deepEqual(mensagens(validarLote({ idCenarios: [], prioridade: 'P1' })), ['Informe ao menos um cenário.']);
  assert.deepEqual(mensagens(validarLote({ idCenarios: ['CT03.1'] })), ['Informe ao menos um campo para alterar (responsavel ou prioridade).']);
  assert.deepEqual(mensagens(validarLote({ idCenarios: ['CT03.1'], prioridade: 'P9' })), ['Prioridade deve ser P1, P2 ou P3.']);
  assert.deepEqual(mensagens(validarLote({ idCenarios: ['CT03.1'], responsavel: 'x'.repeat(41) })), ['Responsável deve ter no máximo 40 caracteres.']);
  assert.deepEqual(mensagens(validarLote({ prioridade: 'P1' })), ['idCenarios deve ser uma lista.']);
});

// ---------- ordem ----------

test('ordem: lista de IDs no formato CTnn.n, mantendo a sequência (repetido passa para o servidor recusar)', () => {
  assert.deepEqual(validarOrdem({ ordem: ['CT03.2', 'CT01.1'] }), { ok: true, valor: { ordem: ['CT03.2', 'CT01.1'] } });
  assert.deepEqual(validarOrdem({ ordem: ['CT03.2', 'CT03.2'] }), { ok: true, valor: { ordem: ['CT03.2', 'CT03.2'] } });
  assert.deepEqual(mensagens(validarOrdem({ ordem: 'CT03.2' })), ['ordem deve ser uma lista de IDs de cenário.']);
  assert.deepEqual(mensagens(validarOrdem({})), ['ordem deve ser uma lista de IDs de cenário.']);
  assert.deepEqual(mensagens(validarOrdem({ ordem: ['CT03.2', 'x'] })), ['ID de cenário inválido: x.']);
});

// ---------- alterar item ----------

test('item: aceita status, resultado, prioridade, responsável, estimativas, datas, observação e posição', () => {
  const r = validarPatchItem({
    versao: 1,
    status: 'concluido',
    resultado: 'passou',
    prioridade: 'P1',
    responsavel: 'ana',
    estimativaMin: 30,
    tempoRealMin: 25,
    dataPlanejada: '2026-10-05',
    dataExecucao: '2026-10-06',
    observacoes: 'ok',
    posicao: 2.5,
  });
  assert.deepEqual(r, {
    ok: true,
    valor: {
      versao: 1,
      campos: {
        status: 'concluido',
        resultado: 'passou',
        prioridade: 'P1',
        responsavel: 'ana',
        estimativaMin: 30,
        tempoRealMin: 25,
        dataPlanejada: '2026-10-05',
        dataExecucao: '2026-10-06',
        observacoes: 'ok',
        posicao: 2.5,
      },
    },
  });
});

test('item: null limpa campos opcionais; texto vazio também', () => {
  const r = validarPatchItem({ versao: 3, resultado: null, prioridade: null, responsavel: '  ', estimativaMin: null, dataPlanejada: null, observacoes: '' });
  assert.deepEqual(r, {
    ok: true,
    valor: { versao: 3, campos: { resultado: null, prioridade: null, responsavel: null, estimativaMin: null, dataPlanejada: null, observacoes: null } },
  });
});

test('item: valores fora da lista viram mensagens em português', () => {
  assert.deepEqual(mensagens(validarPatchItem({ versao: 1, status: 'rodando' })), [
    'Status deve ser um destes: agendado, em_andamento, refinamento, concluido.',
  ]);
  assert.deepEqual(mensagens(validarPatchItem({ versao: 1, resultado: 'talvez' })), ['Resultado deve ser passou ou falhou.']);
  assert.deepEqual(mensagens(validarPatchItem({ versao: 1, prioridade: 'P9' })), ['Prioridade deve ser P1, P2 ou P3.']);
  assert.deepEqual(mensagens(validarPatchItem({ versao: 1, estimativaMin: -1 })), ['estimativaMin deve ser um inteiro de 0 a 100000.']);
  assert.deepEqual(mensagens(validarPatchItem({ versao: 1, tempoRealMin: 1.5 })), ['tempoRealMin deve ser um inteiro de 0 a 100000.']);
  assert.deepEqual(mensagens(validarPatchItem({ versao: 1, dataExecucao: '31/12/2026' })), ['Data de execução deve ser uma data válida (aaaa-mm-dd).']);
  assert.deepEqual(mensagens(validarPatchItem({ versao: 1, observacoes: 'x'.repeat(1001) })), ['Observações deve ter no máximo 1000 caracteres.']);
  assert.deepEqual(mensagens(validarPatchItem({ versao: 1, posicao: 'primeiro' })), ['posicao deve ser um número.']);
});

test('item: exige versão e ao menos um campo; descarta campos desconhecidos', () => {
  assert.deepEqual(mensagens(validarPatchItem({ status: 'agendado' })), ['Versão deve ser um número inteiro (a que você viu ao abrir o teste).']);
  assert.deepEqual(mensagens(validarPatchItem({ versao: 1, idCenario: 'CT99.9', versaoItem: 7 })), [
    'Informe ao menos um campo para alterar.',
  ]);
});

// ---------- resumo ----------

function item(idCenario: string, status: ItemPlano['status'], resultado?: ItemPlano['resultado']): ItemPlano {
  return { idCenario, status, ...(resultado ? { resultado } : {}), posicao: 1, versao: 1 };
}

function plano(itens: ItemPlano[]): Plano {
  return { id: 'pl_1', nome: 'P', criadoEm: '2026-10-03T10:00:00.000Z', versao: 1, itens };
}

test('resumo: total, concluídos, pendentes e percentual arredondado', () => {
  const r = resumir(plano([item('CT01.1', 'concluido', 'passou'), item('CT01.2', 'concluido', 'falhou'), item('CT01.3', 'agendado'), item('CT01.4', 'em_andamento'), item('CT01.5', 'refinamento')]));
  assert.deepEqual(r, {
    total: 5,
    concluidos: 2,
    pendentes: 3,
    percentual: 40,
    porStatus: { agendado: 1, em_andamento: 1, refinamento: 1, concluido: 2 },
    passou: 1,
    falhou: 1,
    executado: false,
  });
});

test('resumo: plano vazio tem 0% e não conta como executado; todos concluídos = executado', () => {
  assert.equal(resumir(plano([])).percentual, 0);
  assert.equal(resumir(plano([])).executado, false);
  assert.equal(resumir(plano([item('CT01.1', 'concluido')])).executado, true);
  assert.equal(resumir(plano([item('CT01.1', 'concluido'), item('CT01.2', 'concluido'), item('CT01.3', 'agendado')])).percentual, 67);
});
