import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app.ts';
import { DADOS_PADRAO } from '../src/repos.ts';

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

async function iniciar(opcoes: { dirDados?: string; modoTeste?: boolean } = {}) {
  const dir = opcoes.dirDados ?? (await mkdtemp(join(tmpdir(), 'puppets-modoteste-')));
  const server = createApp({ dirDados: dir, modoTeste: opcoes.modoTeste }).listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', () => resolve()));
  const { port } = server.address() as AddressInfo;
  const json = async (metodo: string, caminho: string, corpo?: unknown): Promise<{ status: number; corpo: Json }> => {
    const res = await fetch(`http://127.0.0.1:${port}${caminho}`, {
      method: metodo,
      headers: corpo === undefined ? undefined : { 'content-type': 'application/json' },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
    return { status: res.status, corpo: res.status === 204 ? {} : ((await res.json()) as Json) };
  };
  return { dir, json, fechar: () => new Promise<void>((r) => server.close(() => r())) };
}

const contagens = async (s: Awaited<ReturnType<typeof iniciar>>) => ({
  cenarios: ((await s.json('GET', '/api/cenarios')).corpo.cenarios as unknown[]).length,
  pessoas: ((await s.json('GET', '/api/pessoas')).corpo.pessoas as unknown[]).length,
  planos: ((await s.json('GET', '/api/planos')).corpo.planos as unknown[]).length,
});

test('em modo de teste, POST /api/teste/reset esvazia cenários, pessoas e planos', async () => {
  const s = await iniciar({ modoTeste: true });
  try {
    await s.json('POST', '/api/semente');
    assert.deepEqual(await contagens(s), { cenarios: 8, pessoas: 3, planos: 3 });
    const r = await s.json('POST', '/api/teste/reset');
    assert.equal(r.status, 200);
    assert.deepEqual(r.corpo, { ok: true, semente: false });
    assert.deepEqual(await contagens(s), { cenarios: 0, pessoas: 0, planos: 0 });
    assert.deepEqual(await readdir(s.dir), []); // nem as cópias .bak ficam
  } finally {
    await s.fechar();
  }
});

test('reset com { semente: true } deixa a pasta exatamente como a semente (sempre o mesmo estado de partida)', async () => {
  const s = await iniciar({ modoTeste: true });
  try {
    await s.json('POST', '/api/cenarios', { idCenario: 'CT99.9', nome: 'Sobra de outro teste', funcionalidade: 'X' });
    const r = await s.json('POST', '/api/teste/reset', { semente: true });
    assert.deepEqual(r.corpo, { ok: true, semente: true });
    assert.deepEqual(await contagens(s), { cenarios: 8, pessoas: 3, planos: 3 });
    const ids = ((await s.json('GET', '/api/cenarios')).corpo.cenarios as Json[]).map((c) => c.idCenario);
    assert.ok(!ids.includes('CT99.9'));
  } finally {
    await s.fechar();
  }
});

test('fora do modo de teste a rota nem existe (404) e os dados ficam como estão', async () => {
  const s = await iniciar();
  try {
    await s.json('POST', '/api/semente');
    const r = await s.json('POST', '/api/teste/reset');
    assert.equal(r.status, 404);
    assert.deepEqual(await contagens(s), { cenarios: 8, pessoas: 3, planos: 3 });
  } finally {
    await s.fechar();
  }
});

test('mesmo em modo de teste, o reset recusa a pasta real dados/ (403) e não apaga nada', async () => {
  const s = await iniciar({ dirDados: DADOS_PADRAO, modoTeste: true });
  try {
    const antes = await readdir(DADOS_PADRAO);
    const r = await s.json('POST', '/api/teste/reset', { semente: true });
    assert.equal(r.status, 403);
    assert.equal(r.corpo.erro, 'reset_proibido');
    assert.deepEqual(await readdir(DADOS_PADRAO), antes);
  } finally {
    await s.fechar();
  }
});
