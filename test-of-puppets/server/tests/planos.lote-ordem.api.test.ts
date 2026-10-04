import { test } from 'node:test';
import assert from 'node:assert/strict';
import { iniciar, cadastrarCenarios, planoCom, type Json } from './planos.apoio.ts';

// ---------- alteração em lote ----------

test('PATCH /:id/testes aplica responsável e prioridade só nos testes escolhidos, soma 1 na versão deles', async () => {
  const s = await iniciar();
  try {
    await cadastrarCenarios(s);
    const { plano } = await planoCom(s, ['CT03.1', 'CT03.2', 'CT04.1']);
    const r = await s.json('PATCH', `/api/planos/${plano.id}/testes`, { idCenarios: ['CT03.1', 'CT04.1'], responsavel: 'ana', prioridade: 'P1' });
    assert.equal(r.status, 200);
    assert.deepEqual(r.corpo.itens.map((i: Json) => [i.idCenario, i.responsavel, i.prioridade, i.versao]), [
      ['CT03.1', 'ana', 'P1', 2],
      ['CT03.2', undefined, undefined, 1],
      ['CT04.1', 'ana', 'P1', 2],
    ]);
  } finally {
    await s.fechar();
  }
});

test('lote com null limpa o campo; só um dos campos mexe só nele', async () => {
  const s = await iniciar();
  try {
    await cadastrarCenarios(s);
    const { plano } = await planoCom(s, ['CT03.1', 'CT03.2']);
    await s.json('PATCH', `/api/planos/${plano.id}/testes`, { idCenarios: ['CT03.1', 'CT03.2'], responsavel: 'ana', prioridade: 'P2' });
    const r = await s.json('PATCH', `/api/planos/${plano.id}/testes`, { idCenarios: ['CT03.1'], responsavel: null });
    assert.deepEqual(r.corpo.itens.map((i: Json) => [i.idCenario, i.responsavel, i.prioridade]), [
      ['CT03.1', undefined, 'P2'],
      ['CT03.2', 'ana', 'P2'],
    ]);
  } finally {
    await s.fechar();
  }
});

test('lote com teste que não está no plano é 404 e não altera nenhum', async () => {
  const s = await iniciar();
  try {
    await cadastrarCenarios(s);
    const { plano } = await planoCom(s, ['CT03.1', 'CT03.2']);
    const r = await s.json('PATCH', `/api/planos/${plano.id}/testes`, { idCenarios: ['CT03.1', 'CT04.1'], prioridade: 'P1' });
    assert.equal(r.status, 404);
    assert.match(r.corpo.mensagem, /CT04\.1/);
    const depois = (await s.json('GET', `/api/planos/${plano.id}`)).corpo;
    assert.ok(depois.itens.every((i: Json) => i.prioridade === undefined && i.versao === 1));
    assert.equal((await s.json('PATCH', '/api/planos/pl_00000000/testes', { idCenarios: ['CT03.1'], prioridade: 'P1' })).status, 404);
  } finally {
    await s.fechar();
  }
});

test('lote inválido (sem campo, prioridade ruim) é 400', async () => {
  const s = await iniciar();
  try {
    await cadastrarCenarios(s);
    const { plano } = await planoCom(s, ['CT03.1']);
    assert.equal((await s.json('PATCH', `/api/planos/${plano.id}/testes`, { idCenarios: ['CT03.1'] })).status, 400);
    assert.equal((await s.json('PATCH', `/api/planos/${plano.id}/testes`, { idCenarios: ['CT03.1'], prioridade: 'P9' })).status, 400);
  } finally {
    await s.fechar();
  }
});

// ---------- ordem de execução (modal "Ordem de execução") ----------

test('PUT /:id/ordem grava a nova ordem (posição 1..n), sem mexer na versão dos testes', async () => {
  const s = await iniciar();
  try {
    await cadastrarCenarios(s);
    const { plano } = await planoCom(s, ['CT03.1', 'CT03.2', 'CT04.1', 'CT03.7']);
    const r = await s.json('PUT', `/api/planos/${plano.id}/ordem`, { ordem: ['CT04.1', 'CT03.1', 'CT03.2', 'CT03.7'] });
    assert.equal(r.status, 200);
    assert.deepEqual(r.corpo.itens.map((i: Json) => [i.idCenario, i.posicao, i.versao]), [
      ['CT04.1', 1, 1],
      ['CT03.1', 2, 1],
      ['CT03.2', 3, 1],
      ['CT03.7', 4, 1],
    ]);
    const depois = (await s.json('GET', `/api/planos/${plano.id}`)).corpo.itens as Json[];
    assert.deepEqual(depois.map((i) => i.idCenario), ['CT04.1', 'CT03.1', 'CT03.2', 'CT03.7']);
  } finally {
    await s.fechar();
  }
});

test('PUT /:id/ordem recusa o dependente antes da dependência (409 ordem_invalida) e não altera nada', async () => {
  const s = await iniciar();
  try {
    await cadastrarCenarios(s);
    const { plano } = await planoCom(s, ['CT03.2', 'CT03.7']);
    const r = await s.json('PUT', `/api/planos/${plano.id}/ordem`, { ordem: ['CT03.7', 'CT03.2'] });
    assert.equal(r.status, 409);
    assert.equal(r.corpo.erro, 'ordem_invalida');
    assert.match(r.corpo.mensagem, /CT03\.2 precisa ficar antes de CT03\.7/);
    assert.deepEqual((await s.json('GET', `/api/planos/${plano.id}`)).corpo.itens.map((i: Json) => i.idCenario), ['CT03.2', 'CT03.7']);
  } finally {
    await s.fechar();
  }
});

test('PUT /:id/ordem: dependência que não está no plano não pesa na ordem', async () => {
  const s = await iniciar();
  try {
    await cadastrarCenarios(s);
    const { plano } = await planoCom(s, ['CT03.7', 'CT04.1']);
    const r = await s.json('PUT', `/api/planos/${plano.id}/ordem`, { ordem: ['CT04.1', 'CT03.7'] });
    assert.equal(r.status, 200);
  } finally {
    await s.fechar();
  }
});

test('PUT /:id/ordem exige exatamente os testes do plano (faltando, sobrando ou repetido = 409 ordem_desatualizada)', async () => {
  const s = await iniciar();
  try {
    await cadastrarCenarios(s);
    const { plano } = await planoCom(s, ['CT03.1', 'CT04.1']);
    for (const ordem of [['CT03.1'], ['CT03.1', 'CT04.1', 'CT03.2'], ['CT03.1', 'CT03.1']]) {
      const r = await s.json('PUT', `/api/planos/${plano.id}/ordem`, { ordem });
      assert.equal(r.status, 409, JSON.stringify(ordem));
      assert.equal(r.corpo.erro, 'ordem_desatualizada');
    }
  } finally {
    await s.fechar();
  }
});

test('PUT /:id/ordem: corpo ruim é 400 e plano inexistente é 404', async () => {
  const s = await iniciar();
  try {
    const { plano } = await planoCom(s, []);
    assert.equal((await s.json('PUT', `/api/planos/${plano.id}/ordem`, { ordem: 'CT03.1' })).status, 400);
    assert.equal((await s.json('PUT', `/api/planos/${plano.id}/ordem`, { ordem: ['x'] })).status, 400);
    assert.equal((await s.json('PUT', '/api/planos/pl_00000000/ordem', { ordem: [] })).status, 404);
  } finally {
    await s.fechar();
  }
});
