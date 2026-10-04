import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app.ts';

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

async function iniciar() {
  const dir = await mkdtemp(join(tmpdir(), 'puppets-retros-'));
  const server = createApp({ dirDados: dir }).listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', () => resolve()));
  const { port } = server.address() as AddressInfo;
  const base = `http://127.0.0.1:${port}`;
  const json = async (metodo: string, caminho: string, corpo?: unknown): Promise<{ status: number; corpo: Json }> => {
    const res = await fetch(`${base}${caminho}`, {
      method: metodo,
      headers: corpo === undefined ? undefined : { 'content-type': 'application/json' },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
    return { status: res.status, corpo: res.status === 204 ? {} : ((await res.json()) as Json) };
  };
  return { dir, json, fechar: () => new Promise<void>((r) => server.close(() => r())) };
}

type Servidor = Awaited<ReturnType<typeof iniciar>>;

/** Um plano com um teste; `concluido` marca o teste como passou (aí o plano está executado e a retro abre). */
async function plano(s: Servidor, concluido: boolean): Promise<string> {
  await s.json('POST', '/api/cenarios', { idCenario: 'CT01.1', nome: 'Pagar', funcionalidade: 'Faturas' });
  const r = await s.json('POST', '/api/planos', { nome: '14/09/26', idCenarios: ['CT01.1'] });
  assert.equal(r.status, 201);
  if (concluido) {
    const item = await s.json('PATCH', `/api/planos/${r.corpo.plano.id}/testes/CT01.1`, { versao: 1, status: 'concluido', resultado: 'passou' });
    assert.equal(item.status, 200, JSON.stringify(item.corpo));
  }
  return r.corpo.plano.id as string;
}

const NOTA = { coluna: 'bem', texto: 'Kanban com WIP ajudou.', autor: 'ana' };

test('plano sem registro devolve retro vazia e aberta, sem gravar nada', async () => {
  const s = await iniciar();
  try {
    const id = await plano(s, true);
    const r = await s.json('GET', `/api/retros/${id}`);
    assert.equal(r.status, 200);
    assert.deepEqual(r.corpo, { planoId: id, status: 'aberta', anonimas: false, fechadaEm: null, fechadaPor: null, notas: [], acoes: [], atualizadoEm: null });
    assert.deepEqual((await s.json('GET', '/api/retros')).corpo, { retros: [] });
  } finally {
    await s.fechar();
  }
});

test('plano inexistente responde 404', async () => {
  const s = await iniciar();
  try {
    assert.equal((await s.json('GET', '/api/retros/pl_nao')).status, 404);
    assert.equal((await s.json('POST', '/api/retros/pl_nao/acoes', { texto: 'x' })).status, 404);
  } finally {
    await s.fechar();
  }
});

test('plano em andamento: nota, voto e fechar dão 409 retro_indisponivel; ação continua livre', async () => {
  const s = await iniciar();
  try {
    const id = await plano(s, false);
    for (const [metodo, caminho, corpo] of [
      ['POST', `/api/retros/${id}/notas`, NOTA],
      ['PUT', `/api/retros/${id}`, { status: 'fechada' }],
    ] as const) {
      const r = await s.json(metodo, caminho, corpo);
      assert.equal(r.status, 409);
      assert.equal(r.corpo.erro, 'retro_indisponivel');
      assert.match(r.corpo.mensagem, /ainda está em andamento/);
    }
    assert.equal((await s.json('POST', `/api/retros/${id}/acoes`, { texto: 'Ação solta' })).status, 201);
  } finally {
    await s.fechar();
  }
});

test('nota: grava com id, autor, hora e zero votos, na ordem, em retros.json', async () => {
  const s = await iniciar();
  try {
    const id = await plano(s, true);
    const r = await s.json('POST', `/api/retros/${id}/notas`, NOTA);
    assert.equal(r.status, 201);
    await s.json('POST', `/api/retros/${id}/notas`, { coluna: 'melhorar', texto: '  Reuso de massa sem ordem.  ', autor: 'bia' });
    const retro = (await s.json('GET', `/api/retros/${id}`)).corpo;
    assert.deepEqual(retro.notas.map((n: Json) => [n.coluna, n.texto, n.autor, n.votos]), [['bem', 'Kanban com WIP ajudou.', 'ana', []], ['melhorar', 'Reuso de massa sem ordem.', 'bia', []]]);
    assert.match(retro.notas[0].id, /^nt_[0-9a-f]{8}$/);
    const arquivo = JSON.parse(await readFile(join(s.dir, 'retros.json'), 'utf8')) as Json;
    assert.equal(arquivo.retros[0].notas.length, 2);
  } finally {
    await s.fechar();
  }
});

test('nota: valida coluna, texto e autor', async () => {
  const s = await iniciar();
  try {
    const id = await plano(s, true);
    const r = await s.json('POST', `/api/retros/${id}/notas`, { coluna: 'x', texto: '  ', autor: '' });
    assert.equal(r.status, 400);
    const texto = r.corpo.mensagens.join(' | ');
    assert.match(texto, /Coluna deve ser uma destas/);
    assert.match(texto, /Texto da nota é obrigatório/);
    assert.match(texto, /Escolha quem você é/);
    assert.equal((await s.json('POST', `/api/retros/${id}/notas`, { ...NOTA, texto: 'x'.repeat(301) })).status, 400);
  } finally {
    await s.fechar();
  }
});

test('voto: um por pessoa por nota; o segundo clique tira o voto', async () => {
  const s = await iniciar();
  try {
    const id = await plano(s, true);
    const notaId = (await s.json('POST', `/api/retros/${id}/notas`, NOTA)).corpo.notas[0].id;
    const votar = (pessoa: string) => s.json('POST', `/api/retros/${id}/notas/${notaId}/votos`, { pessoa });
    assert.deepEqual((await votar('ana')).corpo.notas[0].votos, ['ana']);
    assert.deepEqual((await votar('bia')).corpo.notas[0].votos, ['ana', 'bia']);
    assert.deepEqual((await votar('ana')).corpo.notas[0].votos, ['bia']);
    assert.equal((await s.json('POST', `/api/retros/${id}/notas/${notaId}/votos`, {})).status, 400);
    assert.equal((await s.json('POST', `/api/retros/${id}/notas/nt_xxxx/votos`, { pessoa: 'ana' })).status, 404);
  } finally {
    await s.fechar();
  }
});

test('excluir nota tira a nota e os votos dela', async () => {
  const s = await iniciar();
  try {
    const id = await plano(s, true);
    const notaId = (await s.json('POST', `/api/retros/${id}/notas`, NOTA)).corpo.notas[0].id;
    const r = await s.json('DELETE', `/api/retros/${id}/notas/${notaId}`);
    assert.equal(r.status, 200);
    assert.deepEqual(r.corpo.notas, []);
    assert.equal((await s.json('DELETE', `/api/retros/${id}/notas/${notaId}`)).status, 404);
  } finally {
    await s.fechar();
  }
});

test('fechar trava notas, votos e anonimato; as ações continuam editáveis; reabrir destrava', async () => {
  const s = await iniciar();
  try {
    const id = await plano(s, true);
    const notaId = (await s.json('POST', `/api/retros/${id}/notas`, NOTA)).corpo.notas[0].id;
    const acaoId = (await s.json('POST', `/api/retros/${id}/acoes`, { texto: 'Revisar estimativas' })).corpo.acoes[0].id;

    const fechada = await s.json('PUT', `/api/retros/${id}`, { status: 'fechada', autor: 'ana' });
    assert.equal(fechada.corpo.status, 'fechada');
    assert.equal(fechada.corpo.fechadaPor, 'ana');
    assert.ok(fechada.corpo.fechadaEm);

    for (const [metodo, caminho, corpo] of [
      ['POST', `/api/retros/${id}/notas`, NOTA],
      ['POST', `/api/retros/${id}/notas/${notaId}/votos`, { pessoa: 'bia' }],
      ['DELETE', `/api/retros/${id}/notas/${notaId}`, undefined],
      ['PUT', `/api/retros/${id}`, { anonimas: true }],
    ] as const) {
      const r = await s.json(metodo, caminho, corpo);
      assert.equal(r.status, 409, caminho);
      assert.equal(r.corpo.erro, 'retro_fechada');
    }
    assert.equal((await s.json('PATCH', `/api/retros/${id}/acoes/${acaoId}`, { feito: true, autor: 'carlos' })).status, 200);

    const aberta = await s.json('PUT', `/api/retros/${id}`, { status: 'aberta' });
    assert.deepEqual([aberta.corpo.status, aberta.corpo.fechadaEm, aberta.corpo.fechadaPor], ['aberta', null, null]);
    assert.equal((await s.json('POST', `/api/retros/${id}/notas`, NOTA)).status, 201);
  } finally {
    await s.fechar();
  }
});

test('anonimato liga e desliga e é guardado na retro', async () => {
  const s = await iniciar();
  try {
    const id = await plano(s, true);
    assert.equal((await s.json('PUT', `/api/retros/${id}`, { anonimas: true })).corpo.anonimas, true);
    assert.equal((await s.json('GET', `/api/retros/${id}`)).corpo.anonimas, true);
    assert.equal((await s.json('PUT', `/api/retros/${id}`, { anonimas: false })).corpo.anonimas, false);
    assert.equal((await s.json('PUT', `/api/retros/${id}`, {})).status, 400);
    assert.equal((await s.json('PUT', `/api/retros/${id}`, { status: 'meio' })).status, 400);
  } finally {
    await s.fechar();
  }
});

test('ação: cria com responsável, prazo, origem e INC; marca feita com quem e quando; desmarca; edita; exclui', async () => {
  const s = await iniciar();
  try {
    const id = await plano(s, true);
    const criada = await s.json('POST', `/api/retros/${id}/acoes`, {
      texto: ' Ordenar CT03.2 → CT03.7 ',
      responsavel: 'ana',
      prazo: '2026-10-20',
      origem: 'Reuso de massa sem ordem',
      incId: 'inc0715800001',
      autor: 'ana',
    });
    assert.equal(criada.status, 201);
    const a = criada.corpo.acoes[0];
    assert.match(a.id, /^ac_[0-9a-f]{8}$/);
    assert.deepEqual(
      { texto: a.texto, responsavel: a.responsavel, prazo: a.prazo, feito: a.feito, origem: a.origem, incId: a.incId, criadaPor: a.criadaPor },
      { texto: 'Ordenar CT03.2 → CT03.7', responsavel: 'ana', prazo: '2026-10-20', feito: false, origem: 'Reuso de massa sem ordem', incId: 'INC0715800001', criadaPor: 'ana' },
    );

    const feita = (await s.json('PATCH', `/api/retros/${id}/acoes/${a.id}`, { feito: true, autor: 'carlos' })).corpo.acoes[0];
    assert.deepEqual([feita.feito, feita.feitoPor], [true, 'carlos']);
    assert.ok(feita.feitoEm);

    const edit = (await s.json('PATCH', `/api/retros/${id}/acoes/${a.id}`, { texto: 'Novo texto', responsavel: null, prazo: '' })).corpo.acoes[0];
    assert.deepEqual([edit.texto, edit.responsavel, edit.prazo, edit.feito], ['Novo texto', null, null, true]);

    const desfeita = (await s.json('PATCH', `/api/retros/${id}/acoes/${a.id}`, { feito: false })).corpo.acoes[0];
    assert.deepEqual([desfeita.feito, desfeita.feitoEm, desfeita.feitoPor], [false, null, null]);

    assert.deepEqual((await s.json('DELETE', `/api/retros/${id}/acoes/${a.id}`)).corpo.acoes, []);
    assert.equal((await s.json('DELETE', `/api/retros/${id}/acoes/${a.id}`)).status, 404);
  } finally {
    await s.fechar();
  }
});

test('ação: valida texto, prazo, responsável e edição vazia', async () => {
  const s = await iniciar();
  try {
    const id = await plano(s, true);
    const ruim = await s.json('POST', `/api/retros/${id}/acoes`, { texto: ' ', prazo: '31/12/2026', responsavel: 5, incId: '' });
    assert.equal(ruim.status, 400);
    const texto = ruim.corpo.mensagens.join(' | ');
    assert.match(texto, /Ação é obrigatório/);
    assert.match(texto, /Prazo deve ser uma data válida/);
    assert.match(texto, /Responsável deve ser o id/);
    assert.match(texto, /incId deve ser o número de um INC/);

    const acaoId = (await s.json('POST', `/api/retros/${id}/acoes`, { texto: 'ok' })).corpo.acoes[0].id;
    assert.equal((await s.json('PATCH', `/api/retros/${id}/acoes/${acaoId}`, {})).status, 400);
    assert.equal((await s.json('PATCH', `/api/retros/${id}/acoes/${acaoId}`, { feito: 'sim' })).status, 400);
    assert.equal((await s.json('PATCH', `/api/retros/${id}/acoes/ac_nada`, { feito: true })).status, 404);
  } finally {
    await s.fechar();
  }
});

test('GET /api/retros lista só as retros que têm registro', async () => {
  const s = await iniciar();
  try {
    const id = await plano(s, true);
    await s.json('POST', `/api/retros/${id}/acoes`, { texto: 'Algo' });
    const r = await s.json('GET', '/api/retros');
    assert.deepEqual(r.corpo.retros.map((x: Json) => x.planoId), [id]);
  } finally {
    await s.fechar();
  }
});
