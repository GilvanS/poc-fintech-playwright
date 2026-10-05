import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cadastrarCenarios, iniciar, item, planoCom, type Json, type Servidor } from './planos.apoio.ts';

// POST /api/planos/:id/mover — "Mover para plano" em lote (só testes ainda não iniciados).

async function cenario(s: Servidor) {
  await cadastrarCenarios(s); // CT03.1, CT03.2 e CT03.7 (mesma massa 0483), CT04.1
}

const ajustar = async (s: Servidor, idPlano: string, idCenario: string, versao: number, campos: Json) => {
  const r = await s.json('PATCH', `/api/planos/${idPlano}/testes/${idCenario}`, { versao, ...campos });
  assert.equal(r.status, 200, JSON.stringify(r.corpo));
};

const obter = async (s: Servidor, id: string): Promise<Json> => (await s.json('GET', `/api/planos/${id}`)).corpo;
const ids = (plano: Json) => plano.itens.map((i: Json) => i.idCenario);

test('move testes agendados: saem da origem, chegam ao fim do destino com os campos de planejamento e em ordem', async () => {
  const s = await iniciar();
  try {
    await cenario(s);
    const origem = await planoCom(s, ['CT03.1', 'CT03.2', 'CT04.1']);
    const destino = await planoCom(s, ['CT03.7'], { nome: '05/10/26' });
    await ajustar(s, origem.plano.id, 'CT03.1', 1, { responsavel: 'ana', prioridade: 'P1', estimativaMin: 20, dataPlanejada: '2026-10-07', observacoes: 'Levar a massa 0481' });

    const r = await s.json('POST', `/api/planos/${origem.plano.id}/mover`, { idCenarios: ['CT04.1', 'CT03.1'], paraPlano: destino.plano.id });
    assert.equal(r.status, 200, JSON.stringify(r.corpo));
    assert.deepEqual(r.corpo.movidos, ['CT03.1', 'CT04.1'], 'na ordem em que estavam na origem, não na do pedido');
    assert.deepEqual(ids(r.corpo.origem), ['CT03.2'], 'a resposta traz a origem já sem os testes');

    const depois = await obter(s, destino.plano.id);
    assert.deepEqual(ids(depois), ['CT03.7', 'CT03.1', 'CT04.1']);
    const movido = item(depois, 'CT03.1');
    assert.deepEqual(
      [movido.status, movido.responsavel, movido.prioridade, movido.estimativaMin, movido.dataPlanejada, movido.observacoes, movido.versao],
      ['agendado', 'ana', 'P1', 20, '2026-10-07', 'Levar a massa 0481', 1],
    );
    assert.ok(movido.posicao > item(depois, 'CT03.7').posicao);
    assert.ok(item(depois, 'CT04.1').posicao > movido.posicao);
    assert.ok(movido.atualizadoEm, 'o teste que chega é marcado como alterado agora');
    assert.deepEqual(ids(await obter(s, origem.plano.id)), ['CT03.2']);
  } finally {
    await s.fechar();
  }
});

test('a dependência por massa continua valendo no destino (CT03.7 passa a esperar o CT03.2 que já estava lá)', async () => {
  const s = await iniciar();
  try {
    await cenario(s);
    const origem = await planoCom(s, ['CT03.7']);
    const destino = await planoCom(s, ['CT03.2'], { nome: '05/10/26' });
    await s.json('POST', `/api/planos/${origem.plano.id}/mover`, { idCenarios: ['CT03.7'], paraPlano: destino.plano.id });
    assert.deepEqual(item(await obter(s, destino.plano.id), 'CT03.7').bloqueadoPor, ['CT03.2']);
  } finally {
    await s.fechar();
  }
});

test('teste que já começou (ou terminou) não muda de plano: 409 teste_iniciado e nada se mexe, nem os agendados do pedido', async () => {
  const s = await iniciar();
  try {
    await cenario(s);
    const origem = await planoCom(s, ['CT03.1', 'CT03.2', 'CT04.1']);
    const destino = await planoCom(s, [], { nome: '05/10/26' });
    await ajustar(s, origem.plano.id, 'CT03.2', 1, { status: 'em_andamento' });
    await ajustar(s, origem.plano.id, 'CT04.1', 1, { status: 'concluido', resultado: 'passou' });

    const r = await s.json('POST', `/api/planos/${origem.plano.id}/mover`, { idCenarios: ['CT03.1', 'CT03.2', 'CT04.1'], paraPlano: destino.plano.id });
    assert.equal(r.status, 409);
    assert.equal(r.corpo.erro, 'teste_iniciado');
    assert.match(r.corpo.mensagem, /CT03\.2, CT04\.1 já começou/);
    assert.deepEqual(ids(await obter(s, origem.plano.id)), ['CT03.1', 'CT03.2', 'CT04.1']);
    assert.deepEqual(ids(await obter(s, destino.plano.id)), []);
  } finally {
    await s.fechar();
  }
});

test('teste que já está no destino: 409 ja_no_plano, tudo ou nada', async () => {
  const s = await iniciar();
  try {
    await cenario(s);
    const origem = await planoCom(s, ['CT03.1', 'CT04.1']);
    const destino = await planoCom(s, ['CT04.1'], { nome: '05/10/26' });
    const r = await s.json('POST', `/api/planos/${origem.plano.id}/mover`, { idCenarios: ['CT03.1', 'CT04.1'], paraPlano: destino.plano.id });
    assert.equal(r.status, 409);
    assert.equal(r.corpo.erro, 'ja_no_plano');
    assert.match(r.corpo.mensagem, /Já está no plano 05\/10\/26: CT04\.1/);
    assert.deepEqual(ids(await obter(s, origem.plano.id)), ['CT03.1', 'CT04.1']);
    assert.deepEqual(ids(await obter(s, destino.plano.id)), ['CT04.1']);
  } finally {
    await s.fechar();
  }
});

test('destino já concluído é recusado (409 plano_concluido); plano vazio como destino é aceito', async () => {
  const s = await iniciar();
  try {
    await cenario(s);
    const origem = await planoCom(s, ['CT03.1', 'CT03.2']);
    const concluido = await planoCom(s, ['CT04.1'], { nome: '14/09/26' });
    await ajustar(s, concluido.plano.id, 'CT04.1', 1, { status: 'concluido', resultado: 'passou' });
    const vazio = await planoCom(s, [], { nome: '05/10/26' });

    const recusado = await s.json('POST', `/api/planos/${origem.plano.id}/mover`, { idCenarios: ['CT03.1'], paraPlano: concluido.plano.id });
    assert.equal(recusado.status, 409);
    assert.equal(recusado.corpo.erro, 'plano_concluido');
    assert.deepEqual(ids(await obter(s, concluido.plano.id)), ['CT04.1']);

    const ok = await s.json('POST', `/api/planos/${origem.plano.id}/mover`, { idCenarios: ['CT03.1'], paraPlano: vazio.plano.id });
    assert.equal(ok.status, 200);
    assert.deepEqual(ids(await obter(s, vazio.plano.id)), ['CT03.1']);
  } finally {
    await s.fechar();
  }
});

test('a regra de datas vale no destino: CT03.7 não pode chegar antes do CT03.2 de lá (409) e nada se mexe', async () => {
  const s = await iniciar();
  try {
    await cenario(s);
    const origem = await planoCom(s, ['CT03.7']);
    const destino = await planoCom(s, ['CT03.2'], { nome: '05/10/26' });
    await ajustar(s, origem.plano.id, 'CT03.7', 1, { dataPlanejada: '2026-10-05' });
    await ajustar(s, destino.plano.id, 'CT03.2', 1, { dataPlanejada: '2026-10-10' });

    const r = await s.json('POST', `/api/planos/${origem.plano.id}/mover`, { idCenarios: ['CT03.7'], paraPlano: destino.plano.id });
    assert.equal(r.status, 409);
    assert.equal(r.corpo.erro, 'data_antes_da_dependencia');
    assert.deepEqual(ids(await obter(s, origem.plano.id)), ['CT03.7']);
    assert.deepEqual(ids(await obter(s, destino.plano.id)), ['CT03.2']);
  } finally {
    await s.fechar();
  }
});

test('origem e destino iguais, planos ou testes que não existem', async () => {
  const s = await iniciar();
  try {
    await cenario(s);
    const origem = await planoCom(s, ['CT03.1']);
    const outro = await planoCom(s, [], { nome: '05/10/26' });
    const mover = (de: string, corpo: Json) => s.json('POST', `/api/planos/${de}/mover`, corpo);

    const mesmo = await mover(origem.plano.id, { idCenarios: ['CT03.1'], paraPlano: origem.plano.id });
    assert.equal(mesmo.status, 409);
    assert.equal(mesmo.corpo.erro, 'ja_no_plano');
    assert.equal((await mover(origem.plano.id, { idCenarios: ['CT03.1'], paraPlano: 'pl_nao_existe' })).status, 404);
    assert.equal((await mover('pl_nao_existe', { idCenarios: ['CT03.1'], paraPlano: outro.plano.id })).status, 404);
    const fora = await mover(origem.plano.id, { idCenarios: ['CT04.1'], paraPlano: outro.plano.id });
    assert.equal(fora.status, 404);
    assert.match(fora.corpo.mensagem, /fora do plano 28\/09\/26: CT04\.1/);
    assert.deepEqual(ids(await obter(s, origem.plano.id)), ['CT03.1']);
  } finally {
    await s.fechar();
  }
});

test('pedido inválido é 400 com as mensagens', async () => {
  const s = await iniciar();
  try {
    await cenario(s);
    const origem = await planoCom(s, ['CT03.1']);
    const ruim = await s.json('POST', `/api/planos/${origem.plano.id}/mover`, { idCenarios: [], paraPlano: '  ' });
    assert.equal(ruim.status, 400);
    assert.match(ruim.corpo.mensagens.join(' | '), /Informe ao menos um cenário/);
    assert.match(ruim.corpo.mensagens.join(' | '), /Informe o plano de destino/);
    assert.equal((await s.json('POST', `/api/planos/${origem.plano.id}/mover`, { idCenarios: ['x'], paraPlano: 'pl_1' })).status, 400);
    assert.equal((await s.json('POST', `/api/planos/${origem.plano.id}/mover`, 'texto')).status, 400);
  } finally {
    await s.fechar();
  }
});
