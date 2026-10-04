import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app.ts';

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

async function iniciar() {
  const dir = await mkdtemp(join(tmpdir(), 'puppets-config-'));
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
    return { status: res.status, corpo: (await res.json()) as Json };
  };
  return { dir, json, fechar: () => new Promise<void>((r) => server.close(() => r())) };
}

const PADRAO = { agendado: null, em_andamento: 3, refinamento: 3, concluido: null };

test('GET /api/config sem arquivo devolve o padrão: Em andamento 3, Refinamento 3, o resto sem limite', async () => {
  const s = await iniciar();
  try {
    assert.deepEqual(await s.json('GET', '/api/config'), { status: 200, corpo: { wip: PADRAO } });
  } finally {
    await s.fechar();
  }
});

test('PUT muda só as colunas informadas, devolve tudo e grava em config.json', async () => {
  const s = await iniciar();
  try {
    const r = await s.json('PUT', '/api/config', { wip: { em_andamento: 5 } });
    assert.equal(r.status, 200);
    assert.deepEqual(r.corpo.wip, { ...PADRAO, em_andamento: 5 });
    assert.deepEqual((await s.json('GET', '/api/config')).corpo.wip, { ...PADRAO, em_andamento: 5 });
    const arquivo = JSON.parse(await readFile(join(s.dir, 'config.json'), 'utf8')) as Json;
    assert.equal(arquivo.wip.em_andamento, 5);
  } finally {
    await s.fechar();
  }
});

test('PUT com null tira o limite da coluna', async () => {
  const s = await iniciar();
  try {
    const r = await s.json('PUT', '/api/config', { wip: { refinamento: null } });
    assert.deepEqual(r.corpo.wip, { ...PADRAO, refinamento: null });
  } finally {
    await s.fechar();
  }
});

test('PUT inválido é 400 com todas as mensagens e não grava nada', async () => {
  const s = await iniciar();
  try {
    const ruim = await s.json('PUT', '/api/config', { wip: { em_andamento: 0, refinamento: 2.5, concluido: 100, fila: 1 } });
    assert.equal(ruim.status, 400);
    assert.equal(ruim.corpo.erro, 'validacao');
    assert.equal(ruim.corpo.mensagens.length, 4);

    assert.equal((await s.json('PUT', '/api/config', {})).status, 400);
    assert.equal((await s.json('PUT', '/api/config', { wip: {} })).status, 400);
    assert.deepEqual((await s.json('GET', '/api/config')).corpo.wip, PADRAO);
  } finally {
    await s.fechar();
  }
});
