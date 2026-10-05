import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app.ts';
import { criarPresenca } from '../src/presenca/presenca.ts';

// ---------- a regra (relógio falso) ----------

test('quem deu sinal está online, na ordem em que apareceu; repetir o sinal não muda o lugar', () => {
  let agora = 1_000;
  const p = criarPresenca({ agora: () => agora, validadeMs: 15_000 });
  assert.deepEqual(p.online(), []);
  p.bater('ana');
  agora += 1_000;
  p.bater('bia');
  agora += 1_000;
  p.bater('ana');
  assert.deepEqual(p.online(), ['ana', 'bia']);
});

test('sem sinal por mais que a validade a pessoa sai; o sinal novo a traz de volta no fim da fila', () => {
  let agora = 0;
  const p = criarPresenca({ agora: () => agora, validadeMs: 15_000 });
  p.bater('ana');
  agora = 5_000;
  p.bater('bia');
  agora = 15_000; // a Ana está há exatamente 15 s sem sinal: já saiu
  assert.deepEqual(p.online(), ['bia']);
  p.bater('ana');
  assert.deepEqual(p.online(), ['bia', 'ana']);
  agora = 40_000;
  assert.deepEqual(p.online(), []);
});

// ---------- a API ----------

async function iniciar() {
  const dir = await mkdtemp(join(tmpdir(), 'puppets-presenca-'));
  const server = createApp({ dirDados: dir }).listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', () => resolve()));
  const { port } = server.address() as AddressInfo;
  const json = async (metodo: string, caminho: string, corpo?: unknown) => {
    const res = await fetch(`http://127.0.0.1:${port}${caminho}`, {
      method: metodo,
      headers: corpo === undefined ? undefined : { 'content-type': 'application/json' },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
    return { status: res.status, corpo: (await res.json()) as Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
  };
  return { dir, json, fechar: () => new Promise<void>((r) => server.close(() => r())) };
}

test('POST registra o sinal e devolve quem está online; GET mostra o mesmo', async () => {
  const s = await iniciar();
  try {
    assert.deepEqual((await s.json('GET', '/api/presenca')).corpo, { online: [] });
    assert.deepEqual((await s.json('POST', '/api/presenca', { pessoa: 'ana' })).corpo, { online: ['ana'] });
    assert.deepEqual((await s.json('POST', '/api/presenca', { pessoa: ' bia ' })).corpo, { online: ['ana', 'bia'] });
    assert.deepEqual((await s.json('GET', '/api/presenca')).corpo, { online: ['ana', 'bia'] });
  } finally {
    await s.fechar();
  }
});

test('pessoa vazia, grande demais ou corpo errado é 400', async () => {
  const s = await iniciar();
  try {
    for (const corpo of [{}, { pessoa: '   ' }, { pessoa: 'x'.repeat(41) }, { pessoa: 5 }]) {
      const r = await s.json('POST', '/api/presenca', corpo);
      assert.equal(r.status, 400, JSON.stringify(corpo));
      assert.equal(r.corpo.erro, 'validacao');
    }
    assert.equal((await s.json('POST', '/api/presenca', 'texto')).status, 400);
    assert.deepEqual((await s.json('GET', '/api/presenca')).corpo, { online: [] });
  } finally {
    await s.fechar();
  }
});

test('a presença não grava nada em disco', async () => {
  const s = await iniciar();
  try {
    await s.json('POST', '/api/presenca', { pessoa: 'ana' });
    assert.deepEqual(await readdir(s.dir), []);
  } finally {
    await s.fechar();
  }
});
