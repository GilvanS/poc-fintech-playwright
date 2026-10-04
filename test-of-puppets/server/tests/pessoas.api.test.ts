import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app.ts';

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

async function iniciar(dirDados?: string) {
  const dir = dirDados ?? (await mkdtemp(join(tmpdir(), 'puppets-pessoas-')));
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

test('GET /api/pessoas começa vazio', async () => {
  const s = await iniciar();
  try {
    assert.deepEqual(await s.json('GET', '/api/pessoas'), { status: 200, corpo: { pessoas: [] } });
  } finally {
    await s.fechar();
  }
});

test('POST cria a pessoa: id vem do nome, padrões (capacidade 0, cor azul, ativa) e versão 1', async () => {
  const s = await iniciar();
  try {
    const r = await s.json('POST', '/api/pessoas', { nome: ' José Álvaro ' });
    assert.equal(r.status, 201);
    assert.equal(r.corpo.id, 'jose-alvaro');
    assert.equal(r.corpo.nome, 'José Álvaro');
    assert.equal(r.corpo.capacidadeMinSemana, 0);
    assert.equal(r.corpo.cor, 'azul');
    assert.equal(r.corpo.ativa, true);
    assert.equal(r.corpo.versao, 1);
  } finally {
    await s.fechar();
  }
});

test('POST inválido é 400; nome repetido (sem diferenciar maiúsculas) é 409', async () => {
  const s = await iniciar();
  try {
    const ruim = await s.json('POST', '/api/pessoas', { nome: '', cor: 'marrom' });
    assert.equal(ruim.status, 400);
    assert.equal(ruim.corpo.erro, 'validacao');
    assert.equal(ruim.corpo.mensagens.length, 2);

    await s.json('POST', '/api/pessoas', { nome: 'Ana' });
    const repetida = await s.json('POST', '/api/pessoas', { nome: 'ANA' });
    assert.equal(repetida.status, 409);
    assert.equal(repetida.corpo.erro, 'nome_duplicado');
  } finally {
    await s.fechar();
  }
});

test('GET lista na ordem de cadastro', async () => {
  const s = await iniciar();
  try {
    for (const nome of ['Carlos', 'Ana', 'Bia']) await s.json('POST', '/api/pessoas', { nome });
    const r = await s.json('GET', '/api/pessoas');
    assert.deepEqual(r.corpo.pessoas.map((p: Json) => p.id), ['carlos', 'ana', 'bia']);
  } finally {
    await s.fechar();
  }
});

test('PUT atualiza, soma 1 na versão e mantém o id; versão antiga é 409; inexistente é 404; sem versão é 400', async () => {
  const s = await iniciar();
  try {
    await s.json('POST', '/api/pessoas', { nome: 'Ana' });
    const ok = await s.json('PUT', '/api/pessoas/ana', { versao: 1, nome: 'Ana Souza', capacidadeMinSemana: 180, cor: 'roxo', ativa: false });
    assert.equal(ok.status, 200);
    assert.deepEqual([ok.corpo.id, ok.corpo.nome, ok.corpo.capacidadeMinSemana, ok.corpo.cor, ok.corpo.ativa, ok.corpo.versao], ['ana', 'Ana Souza', 180, 'roxo', false, 2]);

    assert.equal((await s.json('PUT', '/api/pessoas/ana', { versao: 1, nome: 'Outra' })).corpo.erro, 'versao_antiga');
    assert.equal((await s.json('PUT', '/api/pessoas/zzz', { versao: 1, nome: 'X' })).status, 404);
    assert.equal((await s.json('PUT', '/api/pessoas/ana', { nome: 'X' })).status, 400);
  } finally {
    await s.fechar();
  }
});

test('PUT que só manda alguns campos mantém os outros', async () => {
  const s = await iniciar();
  try {
    await s.json('POST', '/api/pessoas', { nome: 'Ana', capacidadeMinSemana: 120, cor: 'verde' });
    const r = await s.json('PUT', '/api/pessoas/ana', { versao: 1, nome: 'Ana', ativa: false });
    assert.deepEqual([r.corpo.capacidadeMinSemana, r.corpo.cor, r.corpo.ativa], [120, 'verde', false]);
  } finally {
    await s.fechar();
  }
});

test('PUT que troca o nome para o de outra pessoa é 409', async () => {
  const s = await iniciar();
  try {
    await s.json('POST', '/api/pessoas', { nome: 'Ana' });
    await s.json('POST', '/api/pessoas', { nome: 'Bia' });
    const r = await s.json('PUT', '/api/pessoas/bia', { versao: 1, nome: 'ana' });
    assert.equal(r.status, 409);
    assert.equal(r.corpo.erro, 'nome_duplicado');
  } finally {
    await s.fechar();
  }
});

test('DELETE remove (204); repetir é 404', async () => {
  const s = await iniciar();
  try {
    await s.json('POST', '/api/pessoas', { nome: 'Ana' });
    assert.equal((await s.json('DELETE', '/api/pessoas/ana')).status, 204);
    assert.equal((await s.json('DELETE', '/api/pessoas/ana')).status, 404);
  } finally {
    await s.fechar();
  }
});

test('pessoa que é responsável por algum teste não pode ser excluída (409 pessoa_em_uso); desativar continua possível', async () => {
  const s = await iniciar();
  try {
    await s.json('POST', '/api/pessoas', { nome: 'Ana' });
    await s.json('POST', '/api/cenarios', { idCenario: 'CT01.1', nome: 'Login', funcionalidade: 'Acesso' });
    const plano = (await s.json('POST', '/api/planos', { nome: 'Plano X', idCenarios: ['CT01.1'] })).corpo;
    await s.json('PATCH', `/api/planos/${plano.plano.id}/testes/CT01.1`, { versao: 1, responsavel: 'ana' });

    const barrada = await s.json('DELETE', '/api/pessoas/ana');
    assert.equal(barrada.status, 409);
    assert.equal(barrada.corpo.erro, 'pessoa_em_uso');
    assert.match(barrada.corpo.mensagem, /Plano X/);
    assert.equal((await s.json('PUT', '/api/pessoas/ana', { versao: 1, nome: 'Ana', ativa: false })).status, 200);

    await s.json('PATCH', `/api/planos/${plano.plano.id}/testes/CT01.1`, { versao: 2, responsavel: null });
    assert.equal((await s.json('DELETE', '/api/pessoas/ana')).status, 204);
  } finally {
    await s.fechar();
  }
});

test('as pessoas sobrevivem a reiniciar o servidor', async () => {
  const primeiro = await iniciar();
  await primeiro.json('POST', '/api/pessoas', { nome: 'Ana', capacidadeMinSemana: 90 });
  await primeiro.fechar();
  const segundo = await iniciar(primeiro.dir);
  try {
    const r = await segundo.json('GET', '/api/pessoas');
    assert.deepEqual(r.corpo.pessoas.map((p: Json) => [p.id, p.capacidadeMinSemana]), [['ana', 90]]);
  } finally {
    await segundo.fechar();
  }
});

test('cadastros simultâneos não se perdem', async () => {
  const s = await iniciar();
  try {
    const nomes = Array.from({ length: 8 }, (_, i) => `Pessoa ${i + 1}`);
    const respostas = await Promise.all(nomes.map((nome) => s.json('POST', '/api/pessoas', { nome })));
    assert.ok(respostas.every((r) => r.status === 201));
    assert.equal((await s.json('GET', '/api/pessoas')).corpo.pessoas.length, 8);
  } finally {
    await s.fechar();
  }
});
