import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app.ts';

async function iniciar() {
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', () => resolve()));
  const { port } = server.address() as AddressInfo;
  return { base: `http://127.0.0.1:${port}`, fechar: () => new Promise<void>((r) => server.close(() => r())) };
}

test('GET /api/saude responde 200 com {ok:true}', async () => {
  const { base, fechar } = await iniciar();
  try {
    const res = await fetch(`${base}/api/saude`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true });
  } finally {
    await fechar();
  }
});

test('rota inexistente devolve 404 em JSON (sem página HTML do Express)', async () => {
  const { base, fechar } = await iniciar();
  try {
    const res = await fetch(`${base}/api/nao-existe`);
    assert.equal(res.status, 404);
    assert.match(res.headers.get('content-type') ?? '', /application\/json/);
    assert.deepEqual(await res.json(), { erro: 'nao_encontrado' });
  } finally {
    await fechar();
  }
});

test('não anuncia a tecnologia do servidor (sem X-Powered-By)', async () => {
  const { base, fechar } = await iniciar();
  try {
    const res = await fetch(`${base}/api/saude`);
    assert.equal(res.headers.get('x-powered-by'), null);
  } finally {
    await fechar();
  }
});
