import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { iniciar, cadastrarCenarios, planoCom, item, type Json } from './planos.apoio.ts';

// ---------- detalhe do teste (T6): dados do cenário e histórico ----------

test('GET /:id traz CPF (sem máscara), passos e resultado esperado do cadastro em cada item', async () => {
  const s = await iniciar();
  try {
    await s.json('POST', '/api/cenarios', {
      idCenario: 'CT03.2',
      nome: 'Pagar valor mínimo',
      funcionalidade: 'Faturas',
      idMassa: '0483',
      cpf: '123.456.789-09',
      passos: 'tests/features/faturas.feature#CT03.2',
      resultadoEsperado: 'Pagamento mínimo registrado',
    });
    await s.json('POST', '/api/cenarios', { idCenario: 'CT04.1', nome: 'Bloquear cartão', funcionalidade: 'Cartões' });
    const { plano } = await planoCom(s, ['CT03.2', 'CT04.1']);
    const r = await s.json('GET', `/api/planos/${plano.id}`);
    const ct32 = item(r.corpo, 'CT03.2');
    assert.equal(ct32.cpf, '12345678909');
    assert.equal(ct32.passos, 'tests/features/faturas.feature#CT03.2');
    assert.equal(ct32.resultadoEsperado, 'Pagamento mínimo registrado');
    const ct41 = item(r.corpo, 'CT04.1');
    assert.equal('cpf' in ct41, false);
    assert.equal('passos' in ct41, false);
  } finally {
    await s.fechar();
  }
});

test('GET /api/cenarios/:id/planos mostra o teste em cada plano onde está (status, resultado, datas, responsável, observações)', async () => {
  const s = await iniciar();
  try {
    await cadastrarCenarios(s);
    const a = await planoCom(s, ['CT03.1', 'CT04.1'], { nome: 'Plano A' });
    const b = await planoCom(s, ['CT03.1'], { nome: 'Plano B' });
    await planoCom(s, ['CT04.1'], { nome: 'Plano C' });
    await s.json('PATCH', `/api/planos/${a.plano.id}/testes/CT03.1`, {
      versao: 1, status: 'concluido', resultado: 'passou', dataPlanejada: '2026-10-02', dataExecucao: '2026-10-03', responsavel: 'ana', observacoes: 'ok',
    });

    const r = await s.json('GET', '/api/cenarios/CT03.1/planos');
    assert.equal(r.status, 200);
    assert.deepEqual(r.corpo.planos.map((p: Json) => [p.planoId, p.planoNome, p.status]), [
      [a.plano.id, 'Plano A', 'concluido'],
      [b.plano.id, 'Plano B', 'agendado'],
    ]);
    assert.deepEqual(
      [r.corpo.planos[0].resultado, r.corpo.planos[0].dataPlanejada, r.corpo.planos[0].dataExecucao, r.corpo.planos[0].responsavel, r.corpo.planos[0].observacoes],
      ['passou', '2026-10-02', '2026-10-03', 'ana', 'ok'],
    );
    assert.deepEqual((await s.json('GET', '/api/cenarios/CT05.9/planos')).status, 404);
  } finally {
    await s.fechar();
  }
});

test('GET /api/cenarios/:id/planos de cenário sem plano devolve lista vazia', async () => {
  const s = await iniciar();
  try {
    await cadastrarCenarios(s);
    assert.deepEqual((await s.json('GET', '/api/cenarios/CT04.1/planos')).corpo, { planos: [] });
  } finally {
    await s.fechar();
  }
});

// ---------- persistência, concorrência, vínculo com cenários ----------

test('os planos sobrevivem a reiniciar o servidor e o .bak guarda a gravação anterior', async () => {
  const primeiro = await iniciar();
  await cadastrarCenarios(primeiro);
  const { plano } = await planoCom(primeiro, ['CT03.1'], { nome: 'Persistente' });
  await primeiro.json('PATCH', `/api/planos/${plano.id}/testes/CT03.1`, { versao: 1, status: 'refinamento' });
  await primeiro.fechar();

  const segundo = await iniciar(primeiro.dir);
  try {
    const r = await segundo.json('GET', `/api/planos/${plano.id}`);
    assert.equal(r.corpo.plano.nome, 'Persistente');
    assert.equal(item(r.corpo, 'CT03.1').status, 'refinamento');
    const bak = JSON.parse(await readFile(join(segundo.dir, 'planos.json.bak'), 'utf8')) as Json;
    assert.equal(bak.planos[0].itens[0].status, 'agendado');
  } finally {
    await segundo.fechar();
  }
});

test('alterações simultâneas em testes diferentes não se perdem', async () => {
  const s = await iniciar();
  try {
    await cadastrarCenarios(s);
    const { plano } = await planoCom(s, ['CT03.1', 'CT03.2', 'CT04.1']);
    const respostas = await Promise.all(
      ['CT03.1', 'CT03.2', 'CT04.1'].map((id) => s.json('PATCH', `/api/planos/${plano.id}/testes/${id}`, { versao: 1, prioridade: 'P2', observacoes: `obs ${id}` })),
    );
    assert.ok(respostas.every((r) => r.status === 200));
    const itens = (await s.json('GET', `/api/planos/${plano.id}`)).corpo.itens as Json[];
    assert.deepEqual(itens.map((i) => i.observacoes).sort(), ['obs CT03.1', 'obs CT03.2', 'obs CT04.1']);
  } finally {
    await s.fechar();
  }
});

test('cenário que está em algum plano não pode ser excluído do cadastro (409); fora do plano, pode', async () => {
  const s = await iniciar();
  try {
    await cadastrarCenarios(s);
    const { plano } = await planoCom(s, ['CT03.1'], { nome: 'Plano X' });
    const barrado = await s.json('DELETE', '/api/cenarios/CT03.1');
    assert.equal(barrado.status, 409);
    assert.equal(barrado.corpo.erro, 'cenario_em_uso');
    assert.match(barrado.corpo.mensagem, /Plano X/);

    await s.json('DELETE', `/api/planos/${plano.id}/testes/CT03.1`);
    assert.equal((await s.json('DELETE', '/api/cenarios/CT03.1')).status, 204);
    assert.equal((await s.json('DELETE', '/api/cenarios/CT04.1')).status, 204); // nunca esteve em plano
  } finally {
    await s.fechar();
  }
});
