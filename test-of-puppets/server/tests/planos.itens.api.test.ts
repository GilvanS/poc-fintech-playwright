import { test } from 'node:test';
import assert from 'node:assert/strict';
import { iniciar, cadastrarCenarios, planoCom, item } from './planos.apoio.ts';

// ---------- alterar item ----------

test('PATCH item muda status (arrastar no kanban), soma 1 na versão do item e persiste', async () => {
  const s = await iniciar();
  try {
    await cadastrarCenarios(s);
    const { plano } = await planoCom(s, ['CT03.1']);
    const r = await s.json('PATCH', `/api/planos/${plano.id}/testes/CT03.1`, { versao: 1, status: 'em_andamento', prioridade: 'P1', responsavel: 'ana', estimativaMin: 30 });
    assert.equal(r.status, 200);
    assert.equal(r.corpo.status, 'em_andamento');
    assert.equal(r.corpo.versao, 2);
    const depois = item((await s.json('GET', `/api/planos/${plano.id}`)).corpo, 'CT03.1');
    assert.deepEqual([depois.status, depois.prioridade, depois.responsavel, depois.estimativaMin], ['em_andamento', 'P1', 'ana', 30]);
  } finally {
    await s.fechar();
  }
});

test('PATCH item com versão antiga é 409 e não altera; item/plano inexistente é 404; corpo ruim é 400', async () => {
  const s = await iniciar();
  try {
    await cadastrarCenarios(s);
    const { plano } = await planoCom(s, ['CT03.1']);
    await s.json('PATCH', `/api/planos/${plano.id}/testes/CT03.1`, { versao: 1, observacoes: 'da Ana' });
    const velho = await s.json('PATCH', `/api/planos/${plano.id}/testes/CT03.1`, { versao: 1, observacoes: 'do Bia' });
    assert.equal(velho.status, 409);
    assert.equal(velho.corpo.erro, 'versao_antiga');
    assert.equal(item((await s.json('GET', `/api/planos/${plano.id}`)).corpo, 'CT03.1').observacoes, 'da Ana');

    assert.equal((await s.json('PATCH', `/api/planos/${plano.id}/testes/CT99.9`, { versao: 1, status: 'agendado' })).status, 404);
    assert.equal((await s.json('PATCH', '/api/planos/pl_00000000/testes/CT03.1', { versao: 1, status: 'agendado' })).status, 404);
    assert.equal((await s.json('PATCH', `/api/planos/${plano.id}/testes/CT03.1`, { versao: 2, status: 'voando' })).status, 400);
  } finally {
    await s.fechar();
  }
});

test('resultado só em teste concluído: sozinho é 400; junto com "concluido" funciona; reabrir apaga o resultado', async () => {
  const s = await iniciar();
  try {
    await cadastrarCenarios(s);
    const { plano } = await planoCom(s, ['CT03.1']);
    const caminho = `/api/planos/${plano.id}/testes/CT03.1`;
    const sozinho = await s.json('PATCH', caminho, { versao: 1, resultado: 'passou' });
    assert.equal(sozinho.status, 400);
    assert.equal(sozinho.corpo.erro, 'resultado_sem_conclusao');

    const feito = await s.json('PATCH', caminho, { versao: 1, status: 'concluido', resultado: 'falhou' });
    assert.equal(feito.status, 200);
    assert.equal(feito.corpo.resultado, 'falhou');

    const reaberto = await s.json('PATCH', caminho, { versao: 2, status: 'refinamento' });
    assert.equal(reaberto.status, 200);
    assert.equal('resultado' in reaberto.corpo, false);
  } finally {
    await s.fechar();
  }
});

// ---------- dependência por massa (regra de planejamento) ----------

test('CT03.7 só vai para "Em andamento" ou "Concluído" depois que CT03.2 passou', async () => {
  const s = await iniciar();
  try {
    await cadastrarCenarios(s);
    const { plano } = await planoCom(s, ['CT03.2', 'CT03.7']);
    const ct37 = `/api/planos/${plano.id}/testes/CT03.7`;
    const ct32 = `/api/planos/${plano.id}/testes/CT03.2`;

    const barrado = await s.json('PATCH', ct37, { versao: 1, status: 'em_andamento' });
    assert.equal(barrado.status, 409);
    assert.equal(barrado.corpo.erro, 'dependencia_pendente');
    assert.match(barrado.corpo.mensagem, /Aguardando CT03\.2 passar/);
    assert.equal((await s.json('PATCH', ct37, { versao: 1, status: 'concluido' })).status, 409);

    // "Refinamento" e "Agendado" não exigem a dependência
    assert.equal((await s.json('PATCH', ct37, { versao: 1, status: 'refinamento' })).status, 200);

    // CT03.2 concluído mas "falhou" ainda não libera
    await s.json('PATCH', ct32, { versao: 1, status: 'concluido', resultado: 'falhou' });
    assert.equal((await s.json('PATCH', ct37, { versao: 2, status: 'em_andamento' })).status, 409);

    // corrigido para "passou": libera
    await s.json('PATCH', ct32, { versao: 2, resultado: 'passou' });
    const liberado = await s.json('PATCH', ct37, { versao: 2, status: 'em_andamento' });
    assert.equal(liberado.status, 200);
    assert.deepEqual(liberado.corpo.bloqueadoPor, []);
  } finally {
    await s.fechar();
  }
});

test('dependência que não está no plano não bloqueia', async () => {
  const s = await iniciar();
  try {
    await cadastrarCenarios(s);
    const { plano } = await planoCom(s, ['CT03.7']);
    const r = await s.json('PATCH', `/api/planos/${plano.id}/testes/CT03.7`, { versao: 1, status: 'em_andamento' });
    assert.equal(r.status, 200);
    assert.deepEqual(r.corpo.bloqueadoPor, []);
  } finally {
    await s.fechar();
  }
});

test('data planejada: CT03.7 não pode ficar antes do CT03.2 (nem o CT03.2 depois do CT03.7)', async () => {
  const s = await iniciar();
  try {
    await cadastrarCenarios(s);
    const { plano } = await planoCom(s, ['CT03.2', 'CT03.7']);
    const ct32 = `/api/planos/${plano.id}/testes/CT03.2`;
    const ct37 = `/api/planos/${plano.id}/testes/CT03.7`;
    assert.equal((await s.json('PATCH', ct32, { versao: 1, dataPlanejada: '2026-10-05' })).status, 200);

    const antes = await s.json('PATCH', ct37, { versao: 1, dataPlanejada: '2026-10-04' });
    assert.equal(antes.status, 409);
    assert.equal(antes.corpo.erro, 'data_antes_da_dependencia');
    assert.equal((await s.json('PATCH', ct37, { versao: 1, dataPlanejada: '2026-10-05' })).status, 200);

    const empurrar = await s.json('PATCH', ct32, { versao: 2, dataPlanejada: '2026-10-09' });
    assert.equal(empurrar.status, 409);
    assert.equal(empurrar.corpo.erro, 'data_antes_da_dependencia');
  } finally {
    await s.fechar();
  }
});

test('POST /:id/testes com data não passa por cima da regra de datas', async () => {
  const s = await iniciar();
  try {
    await cadastrarCenarios(s);
    const { plano } = await planoCom(s, ['CT03.2']);
    await s.json('PATCH', `/api/planos/${plano.id}/testes/CT03.2`, { versao: 1, dataPlanejada: '2026-10-05' });
    const r = await s.json('POST', `/api/planos/${plano.id}/testes`, { idCenarios: ['CT03.7'], dataPlanejada: '2026-10-01' });
    assert.equal(r.status, 409);
    assert.equal(r.corpo.erro, 'data_antes_da_dependencia');
    assert.equal((await s.json('GET', `/api/planos/${plano.id}`)).corpo.itens.length, 1);
  } finally {
    await s.fechar();
  }
});
