import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app.ts';

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

async function iniciar(dirDados?: string) {
  const dir = dirDados ?? (await mkdtemp(join(tmpdir(), 'puppets-planos-')));
  const server = createApp({ dirDados: dir }).listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', () => resolve()));
  const { port } = server.address() as AddressInfo;
  const base = `http://127.0.0.1:${port}`;
  const enviar = (metodo: string, caminho: string, corpo?: unknown) =>
    fetch(`${base}${caminho}`, {
      method: metodo,
      headers: corpo === undefined ? undefined : { 'content-type': 'application/json' },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
  const json = async (metodo: string, caminho: string, corpo?: unknown): Promise<{ status: number; corpo: Json }> => {
    const res = await enviar(metodo, caminho, corpo);
    return { status: res.status, corpo: res.status === 204 ? {} : ((await res.json()) as Json) };
  };
  return { dir, base, enviar, json, fechar: () => new Promise<void>((r) => server.close(() => r())) };
}

type Servidor = Awaited<ReturnType<typeof iniciar>>;

async function cadastrarCenarios(s: Servidor) {
  const base = { funcionalidade: 'Faturas' };
  for (const c of [
    { idCenario: 'CT03.1', nome: 'Pagar valor total', idMassa: '0100' },
    { idCenario: 'CT03.2', nome: 'Pagar valor mínimo', idMassa: '0483' },
    { idCenario: 'CT03.7', nome: 'Reenvio do pagamento mínimo', idMassa: '0483' },
    { idCenario: 'CT04.1', nome: 'Bloquear cartão', funcionalidade: 'Cartões' },
  ]) {
    const r = await s.json('POST', '/api/cenarios', { ...base, ...c });
    assert.equal(r.status, 201);
  }
}

async function planoCom(s: Servidor, idCenarios: string[], extra: Json = {}) {
  const r = await s.json('POST', '/api/planos', { nome: '28/09/26', idCenarios, ...extra });
  assert.equal(r.status, 201, JSON.stringify(r.corpo));
  return r.corpo;
}

const item = (corpo: Json, id: string): Json => corpo.itens.find((i: Json) => i.idCenario === id);

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
