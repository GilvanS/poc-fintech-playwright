import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app.ts';

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

async function iniciar() {
  const dir = await mkdtemp(join(tmpdir(), 'puppets-visoes-'));
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

const faturasP1 = { nome: 'Só Faturas P1', tipo: 'kanban', dono: 'ana', compartilhada: false, filtros: { funcionalidade: 'Faturas', prioridade: 'P1' } };

test('GET /api/visoes começa vazio', async () => {
  const s = await iniciar();
  try {
    assert.deepEqual(await s.json('GET', '/api/visoes'), { status: 200, corpo: { visoes: [] } });
  } finally {
    await s.fechar();
  }
});

test('POST cria a visão: id vem do nome, filtros completam com vazio, versão 1, grava em visoes.json', async () => {
  const s = await iniciar();
  try {
    const r = await s.json('POST', '/api/visoes', faturasP1);
    assert.equal(r.status, 201);
    assert.equal(r.corpo.id, 'so-faturas-p1');
    assert.equal(r.corpo.tipo, 'kanban');
    assert.equal(r.corpo.dono, 'ana');
    assert.equal(r.corpo.compartilhada, false);
    assert.deepEqual(r.corpo.filtros, { funcionalidade: 'Faturas', responsavel: '', prioridade: 'P1' });
    assert.equal(r.corpo.versao, 1);
    const arquivo = JSON.parse(await readFile(join(s.dir, 'visoes.json'), 'utf8')) as Json;
    assert.equal(arquivo.visoes.length, 1);
  } finally {
    await s.fechar();
  }
});

test('POST inválido é 400 com todas as mensagens', async () => {
  const s = await iniciar();
  try {
    const ruim = await s.json('POST', '/api/visoes', { nome: '', tipo: 'mural', filtros: { prioridade: 'P9' } });
    assert.equal(ruim.status, 400);
    assert.equal(ruim.corpo.erro, 'validacao');
    assert.equal(ruim.corpo.mensagens.length, 3);
  } finally {
    await s.fechar();
  }
});

test('visão sem dono é sempre compartilhada, mesmo que peçam pessoal', async () => {
  const s = await iniciar();
  try {
    const r = await s.json('POST', '/api/visoes', { nome: 'Geral', tipo: 'lista', compartilhada: false });
    assert.equal(r.status, 201);
    assert.equal(r.corpo.dono, null);
    assert.equal(r.corpo.compartilhada, true);
  } finally {
    await s.fechar();
  }
});

test('GET ?voce= mostra as compartilhadas e as próprias; a pessoal de outra pessoa não aparece', async () => {
  const s = await iniciar();
  try {
    await s.json('POST', '/api/visoes', faturasP1);
    await s.json('POST', '/api/visoes', { nome: 'Da equipe', tipo: 'lista', dono: 'bia', compartilhada: true });
    const ids = async (voce?: string) =>
      ((await s.json('GET', voce ? `/api/visoes?voce=${voce}` : '/api/visoes')).corpo.visoes as Json[]).map((v) => v.id);
    assert.deepEqual(await ids('ana'), ['so-faturas-p1', 'da-equipe']);
    assert.deepEqual(await ids('bia'), ['da-equipe']);
    assert.deepEqual(await ids(), ['da-equipe']);
  } finally {
    await s.fechar();
  }
});

test('nome repetido é 409 dentro do que a pessoa enxerga; pessoas diferentes podem repetir nome de pessoal', async () => {
  const s = await iniciar();
  try {
    await s.json('POST', '/api/visoes', faturasP1);
    const repetida = await s.json('POST', '/api/visoes', { ...faturasP1, nome: 'SÓ FATURAS p1' });
    assert.equal(repetida.status, 409);
    assert.equal(repetida.corpo.erro, 'nome_duplicado');
    const outra = await s.json('POST', '/api/visoes', { ...faturasP1, dono: 'bia' });
    assert.equal(outra.status, 201);
    assert.equal(outra.corpo.id, 'so-faturas-p1-2');
  } finally {
    await s.fechar();
  }
});

test('DELETE: o dono apaga a pessoal; a de outra pessoa dá 404; compartilhada só o admin apaga (403 para os outros)', async () => {
  const s = await iniciar();
  try {
    await s.json('POST', '/api/pessoas', { nome: 'Ana' });
    await s.json('POST', '/api/pessoas', { nome: 'Bia' });
    const chefe = await s.json('POST', '/api/pessoas', { nome: 'Chefe', admin: true });
    assert.equal(chefe.corpo.admin, true);
    assert.equal((await s.json('GET', '/api/pessoas')).corpo.pessoas.find((p: Json) => p.id === 'ana').admin, false);

    await s.json('POST', '/api/visoes', faturasP1);
    await s.json('POST', '/api/visoes', { nome: 'Da equipe', tipo: 'lista', dono: 'ana', compartilhada: true });

    assert.equal((await s.json('DELETE', '/api/visoes/so-faturas-p1?voce=bia')).status, 404);
    // Compartilhada: nem o dono que não é admin nem um id que não existe na Equipe apagam.
    const donoSemAdmin = await s.json('DELETE', '/api/visoes/da-equipe?voce=ana');
    assert.equal(donoSemAdmin.status, 403);
    assert.equal(donoSemAdmin.corpo.erro, 'sem_permissao');
    assert.equal((await s.json('DELETE', '/api/visoes/da-equipe?voce=desconhecido')).status, 403);

    assert.equal((await s.json('DELETE', '/api/visoes/so-faturas-p1?voce=ana')).status, 204);
    assert.equal((await s.json('DELETE', '/api/visoes/da-equipe?voce=chefe')).status, 204);
    assert.deepEqual((await s.json('GET', '/api/visoes?voce=ana')).corpo, { visoes: [] });
    assert.equal((await s.json('DELETE', '/api/visoes/da-equipe?voce=chefe')).status, 404);
  } finally {
    await s.fechar();
  }
});

test('DELETE sem "Você" (ninguém escolhido = dono da máquina) vale como admin e apaga até a compartilhada', async () => {
  const s = await iniciar();
  try {
    await s.json('POST', '/api/pessoas', { nome: 'Ana' });
    await s.json('POST', '/api/visoes', { nome: 'Sem dono', tipo: 'release', compartilhada: true });
    assert.equal((await s.json('DELETE', '/api/visoes/sem-dono')).status, 204);
    assert.deepEqual((await s.json('GET', '/api/visoes')).corpo, { visoes: [] });
  } finally {
    await s.fechar();
  }
});

test('DELETE: admin apaga até a visão pessoal de outra pessoa; admin desativado perde o poder', async () => {
  const s = await iniciar();
  try {
    await s.json('POST', '/api/pessoas', { nome: 'Ana' });
    const chefe = await s.json('POST', '/api/pessoas', { nome: 'Chefe', admin: true });
    await s.json('POST', '/api/visoes', faturasP1);

    await s.json('PUT', '/api/pessoas/chefe', { nome: 'Chefe', ativa: false, versao: chefe.corpo.versao });
    assert.equal((await s.json('DELETE', '/api/visoes/so-faturas-p1?voce=chefe')).status, 404);

    const atual = (await s.json('GET', '/api/pessoas')).corpo.pessoas.find((p: Json) => p.id === 'chefe');
    await s.json('PUT', '/api/pessoas/chefe', { nome: 'Chefe', ativa: true, versao: atual.versao });
    assert.equal((await s.json('DELETE', '/api/visoes/so-faturas-p1?voce=chefe')).status, 204);
  } finally {
    await s.fechar();
  }
});

test('POST/PUT de pessoa: admin deve ser verdadeiro ou falso', async () => {
  const s = await iniciar();
  try {
    const ruim = await s.json('POST', '/api/pessoas', { nome: 'Ana', admin: 'sim' });
    assert.equal(ruim.status, 400);
    assert.deepEqual(ruim.corpo.mensagens, ['Admin deve ser verdadeiro ou falso.']);
  } finally {
    await s.fechar();
  }
});
