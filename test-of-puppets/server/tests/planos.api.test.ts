import { test } from 'node:test';
import assert from 'node:assert/strict';
import { iniciar, cadastrarCenarios, planoCom, item, type Json } from './planos.apoio.ts';

// ---------- criar / listar / detalhar ----------

test('GET /api/planos começa vazio', async () => {
  const s = await iniciar();
  try {
    assert.deepEqual(await s.json('GET', '/api/planos'), { status: 200, corpo: { planos: [] } });
  } finally {
    await s.fechar();
  }
});

test('POST cria plano vazio: 201, id gerado, versão 1, sem itens e 0%', async () => {
  const s = await iniciar();
  try {
    const r = await s.json('POST', '/api/planos', { nome: '  05/10/26 ', previsao: '2026-10-13' });
    assert.equal(r.status, 201);
    assert.match(r.corpo.plano.id, /^pl_[0-9a-f]{8}$/);
    assert.equal(r.corpo.plano.nome, '05/10/26');
    assert.equal(r.corpo.plano.previsao, '2026-10-13');
    assert.equal(r.corpo.plano.versao, 1);
    assert.match(r.corpo.plano.criadoEm, /^\d{4}-\d{2}-\d{2}T/);
    assert.deepEqual(r.corpo.itens, []);
    assert.equal(r.corpo.resumo.total, 0);
    assert.equal(r.corpo.resumo.percentual, 0);
  } finally {
    await s.fechar();
  }
});

test('POST com cenários cadastrados já cria os itens como "agendado", em ordem de posição', async () => {
  const s = await iniciar();
  try {
    await cadastrarCenarios(s);
    const corpo = await planoCom(s, ['CT03.7', 'CT03.2']);
    assert.deepEqual(corpo.itens.map((i: Json) => [i.idCenario, i.status, i.versao]), [
      ['CT03.7', 'agendado', 1],
      ['CT03.2', 'agendado', 1],
    ]);
    assert.ok(item(corpo, 'CT03.7').posicao < item(corpo, 'CT03.2').posicao);
  } finally {
    await s.fechar();
  }
});

test('POST com cenário que não existe no cadastro devolve 400 e não cria nada', async () => {
  const s = await iniciar();
  try {
    await cadastrarCenarios(s);
    const r = await s.json('POST', '/api/planos', { nome: 'A', idCenarios: ['CT03.2', 'CT99.9'] });
    assert.equal(r.status, 400);
    assert.equal(r.corpo.erro, 'cenario_inexistente');
    assert.match(r.corpo.mensagem, /CT99\.9/);
    assert.deepEqual((await s.json('GET', '/api/planos')).corpo, { planos: [] });
  } finally {
    await s.fechar();
  }
});

test('POST inválido devolve 400 com mensagens; JSON quebrado também é 400', async () => {
  const s = await iniciar();
  try {
    const r = await s.json('POST', '/api/planos', { nome: '', previsao: 'amanha' });
    assert.equal(r.status, 400);
    assert.equal(r.corpo.erro, 'validacao');
    assert.deepEqual(r.corpo.mensagens, ['Nome do plano é obrigatório.', 'Previsão deve ser uma data válida (aaaa-mm-dd).']);
    const quebrado = await fetch(`${s.base}/api/planos`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{ x' });
    assert.equal(quebrado.status, 400);
  } finally {
    await s.fechar();
  }
});

test('nome repetido é permitido (a tela só avisa)', async () => {
  const s = await iniciar();
  try {
    await planoCom(s, []);
    const r = await s.json('POST', '/api/planos', { nome: '28/09/26' });
    assert.equal(r.status, 201);
    assert.equal((await s.json('GET', '/api/planos')).corpo.planos.length, 2);
  } finally {
    await s.fechar();
  }
});

test('GET lista planos com resumo; ?aba separa "em execução" de "executados"', async () => {
  const s = await iniciar();
  try {
    await cadastrarCenarios(s);
    const aberto = await planoCom(s, ['CT03.1', 'CT03.2'], { nome: 'Aberto' });
    const pronto = await planoCom(s, ['CT03.1'], { nome: 'Pronto' });
    const vazio = await planoCom(s, [], { nome: 'Vazio' });
    await s.json('PATCH', `/api/planos/${pronto.plano.id}/testes/CT03.1`, { versao: 1, status: 'concluido', resultado: 'passou' });
    await s.json('PATCH', `/api/planos/${aberto.plano.id}/testes/CT03.1`, { versao: 1, status: 'concluido', resultado: 'passou' });

    const todos = (await s.json('GET', '/api/planos')).corpo.planos as Json[];
    assert.deepEqual(todos.map((p) => p.nome), ['Aberto', 'Pronto', 'Vazio']); // pela criação
    assert.equal(todos[0].resumo.percentual, 50);
    assert.equal(todos[0].resumo.pendentes, 1);

    const emExecucao = (await s.json('GET', '/api/planos?aba=em_execucao')).corpo.planos as Json[];
    assert.deepEqual(emExecucao.map((p) => p.nome), ['Aberto', 'Vazio']);
    const executados = (await s.json('GET', '/api/planos?aba=executados')).corpo.planos as Json[];
    assert.deepEqual(executados.map((p) => p.nome), ['Pronto']);
    assert.equal(vazio.plano.nome, 'Vazio');

    const invertida = (await s.json('GET', '/api/planos?ordem=desc')).corpo.planos as Json[];
    assert.deepEqual(invertida.map((p) => p.nome), ['Vazio', 'Pronto', 'Aberto']);
    assert.equal((await s.json('GET', '/api/planos?aba=outra')).status, 400);
  } finally {
    await s.fechar();
  }
});

test('GET /:id traz cada item com os dados do cenário, a dependência por massa e o que o bloqueia', async () => {
  const s = await iniciar();
  try {
    await cadastrarCenarios(s);
    const { plano } = await planoCom(s, ['CT03.2', 'CT03.7', 'CT04.1']);
    const r = await s.json('GET', `/api/planos/${plano.id}`);
    assert.equal(r.status, 200);
    const ct37 = item(r.corpo, 'CT03.7');
    assert.equal(ct37.nome, 'Reenvio do pagamento mínimo');
    assert.equal(ct37.funcionalidade, 'Faturas');
    assert.equal(ct37.idMassa, '0483');
    assert.deepEqual(ct37.dependeDe, ['CT03.2']);
    assert.deepEqual(ct37.massaCompartilhadaCom, ['CT03.2']);
    assert.deepEqual(ct37.bloqueadoPor, ['CT03.2']);
    assert.deepEqual(item(r.corpo, 'CT03.2').bloqueadoPor, []);
    assert.deepEqual(item(r.corpo, 'CT04.1').dependeDe, []);
    assert.equal(r.corpo.resumo.total, 3);
  } finally {
    await s.fechar();
  }
});

test('GET /:id de plano inexistente é 404', async () => {
  const s = await iniciar();
  try {
    const r = await s.json('GET', '/api/planos/pl_00000000');
    assert.equal(r.status, 404);
    assert.equal(r.corpo.erro, 'nao_encontrado');
  } finally {
    await s.fechar();
  }
});

// ---------- editar / excluir plano ----------

test('PATCH /:id muda nome e previsão, soma 1 na versão; versão antiga é 409', async () => {
  const s = await iniciar();
  try {
    const { plano } = await planoCom(s, [], { previsao: '2026-10-13' });
    const ok = await s.json('PATCH', `/api/planos/${plano.id}`, { versao: 1, nome: 'Novo nome', previsao: null });
    assert.equal(ok.status, 200);
    assert.equal(ok.corpo.plano.nome, 'Novo nome');
    assert.equal('previsao' in ok.corpo.plano, false);
    assert.equal(ok.corpo.plano.versao, 2);

    const velho = await s.json('PATCH', `/api/planos/${plano.id}`, { versao: 1, nome: 'Outro' });
    assert.equal(velho.status, 409);
    assert.equal(velho.corpo.erro, 'versao_antiga');
    assert.equal((await s.json('GET', `/api/planos/${plano.id}`)).corpo.plano.nome, 'Novo nome');

    assert.equal((await s.json('PATCH', `/api/planos/${plano.id}`, { nome: 'sem versão' })).status, 400);
    assert.equal((await s.json('PATCH', '/api/planos/pl_00000000', { versao: 1, nome: 'x' })).status, 404);
  } finally {
    await s.fechar();
  }
});

test('DELETE /:id exclui o plano (204) e repetir é 404', async () => {
  const s = await iniciar();
  try {
    const { plano } = await planoCom(s, []);
    assert.equal((await s.json('DELETE', `/api/planos/${plano.id}`)).status, 204);
    assert.equal((await s.json('DELETE', `/api/planos/${plano.id}`)).status, 404);
    assert.deepEqual((await s.json('GET', '/api/planos')).corpo, { planos: [] });
  } finally {
    await s.fechar();
  }
});

// ---------- incluir / remover testes ----------

test('POST /:id/testes inclui cenários no fim, com data planejada; os já incluídos são pulados', async () => {
  const s = await iniciar();
  try {
    await cadastrarCenarios(s);
    const { plano } = await planoCom(s, ['CT03.1']);
    const r = await s.json('POST', `/api/planos/${plano.id}/testes`, { idCenarios: ['CT03.1', 'CT03.2', 'CT04.1'], dataPlanejada: '2026-10-05' });
    assert.equal(r.status, 200);
    assert.deepEqual(r.corpo.incluidos, ['CT03.2', 'CT04.1']);
    assert.deepEqual(r.corpo.itens.map((i: Json) => i.idCenario), ['CT03.1', 'CT03.2', 'CT04.1']);
    assert.equal(item(r.corpo, 'CT03.1').dataPlanejada, undefined);
    assert.equal(item(r.corpo, 'CT03.2').dataPlanejada, '2026-10-05');
    assert.ok(item(r.corpo, 'CT04.1').posicao > item(r.corpo, 'CT03.2').posicao);
  } finally {
    await s.fechar();
  }
});

test('POST /:id/testes recusa cenário desconhecido (400) e lista vazia (400); plano inexistente é 404', async () => {
  const s = await iniciar();
  try {
    await cadastrarCenarios(s);
    const { plano } = await planoCom(s, []);
    assert.equal((await s.json('POST', `/api/planos/${plano.id}/testes`, { idCenarios: ['CT99.9'] })).corpo.erro, 'cenario_inexistente');
    assert.equal((await s.json('POST', `/api/planos/${plano.id}/testes`, { idCenarios: [] })).status, 400);
    assert.equal((await s.json('POST', '/api/planos/pl_00000000/testes', { idCenarios: ['CT03.1'] })).status, 404);
    assert.equal((await s.json('GET', `/api/planos/${plano.id}`)).corpo.itens.length, 0);
  } finally {
    await s.fechar();
  }
});

test('DELETE /:id/testes/:cenario tira o teste do plano; repetir é 404', async () => {
  const s = await iniciar();
  try {
    await cadastrarCenarios(s);
    const { plano } = await planoCom(s, ['CT03.1', 'CT03.2']);
    assert.equal((await s.json('DELETE', `/api/planos/${plano.id}/testes/CT03.1`)).status, 204);
    assert.equal((await s.json('DELETE', `/api/planos/${plano.id}/testes/CT03.1`)).status, 404);
    assert.deepEqual((await s.json('GET', `/api/planos/${plano.id}`)).corpo.itens.map((i: Json) => i.idCenario), ['CT03.2']);
  } finally {
    await s.fechar();
  }
});
