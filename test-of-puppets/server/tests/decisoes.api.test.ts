import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app.ts';

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

async function iniciar() {
  const dir = await mkdtemp(join(tmpdir(), 'puppets-decisoes-'));
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

async function planoPronto(s: Servidor): Promise<string> {
  const c = await s.json('POST', '/api/cenarios', { idCenario: 'CT03.1', nome: 'Pagar valor total', funcionalidade: 'Faturas' });
  assert.equal(c.status, 201);
  const r = await s.json('POST', '/api/planos', { nome: '28/09/26', idCenarios: ['CT03.1'] });
  assert.equal(r.status, 201);
  return r.corpo.plano.id as string;
}

const NO_GO = { decisao: 'no_go', justificativa: 'Aguardar correção do INC.', por: 'ana', criterios: [3, 1, 2] };

test('POST /decisoes registra, carimba a hora, ordena os critérios e devolve o plano com o histórico', async () => {
  const s = await iniciar();
  try {
    const id = await planoPronto(s);
    const r = await s.json('POST', `/api/planos/${id}/decisoes`, NO_GO);
    assert.equal(r.status, 201);
    const [d] = r.corpo.plano.decisoes;
    assert.match(d.id, /^dc_[0-9a-f]{8}$/);
    assert.equal(d.decisao, 'no_go');
    assert.equal(d.por, 'ana');
    assert.equal(d.justificativa, 'Aguardar correção do INC.');
    assert.deepEqual(d.criterios, [1, 2, 3]);
    assert.ok(!Number.isNaN(new Date(d.em).getTime()));
    assert.equal(r.corpo.itens.length, 1);
  } finally {
    await s.fechar();
  }
});

test('o histórico só cresce, na ordem, e fica em planos.json', async () => {
  const s = await iniciar();
  try {
    const id = await planoPronto(s);
    await s.json('POST', `/api/planos/${id}/decisoes`, NO_GO);
    const r = await s.json('POST', `/api/planos/${id}/decisoes`, { decisao: 'go_excecao', justificativa: 'Risco aceito.', por: 'bia', criterios: [4] });
    assert.deepEqual(r.corpo.plano.decisoes.map((d: Json) => d.decisao), ['no_go', 'go_excecao']);
    assert.notEqual(r.corpo.plano.decisoes[0].id, r.corpo.plano.decisoes[1].id);

    const lido = await s.json('GET', `/api/planos/${id}`);
    assert.equal(lido.corpo.plano.decisoes.length, 2);
    const arquivo = JSON.parse(await readFile(join(s.dir, 'planos.json'), 'utf8')) as Json;
    assert.equal(arquivo.planos[0].decisoes.length, 2);
  } finally {
    await s.fechar();
  }
});

test('decidir não muda a versão do plano (quem edita o nome ao mesmo tempo não toma conflito)', async () => {
  const s = await iniciar();
  try {
    const id = await planoPronto(s);
    const antes = (await s.json('GET', `/api/planos/${id}`)).corpo.plano.versao;
    await s.json('POST', `/api/planos/${id}/decisoes`, NO_GO);
    assert.equal((await s.json('GET', `/api/planos/${id}`)).corpo.plano.versao, antes);
    const edicao = await s.json('PATCH', `/api/planos/${id}`, { versao: antes, nome: 'Novo nome' });
    assert.equal(edicao.status, 200);
    assert.equal(edicao.corpo.plano.decisoes.length, 1, 'editar o plano não apaga o histórico');
  } finally {
    await s.fechar();
  }
});

test('GO exige 7 de 7; GO com exceção exige critério pendente; NO-GO aceita lista vazia', async () => {
  const s = await iniciar();
  try {
    const id = await planoPronto(s);
    const url = `/api/planos/${id}/decisoes`;
    const go = await s.json('POST', url, { decisao: 'go', justificativa: 'Tudo ok.', por: 'ana', criterios: [2] });
    assert.equal(go.status, 400);
    assert.match(go.corpo.mensagens.join(' '), /GO só vale com os 7 critérios/);

    const excecao = await s.json('POST', url, { decisao: 'go_excecao', justificativa: 'x', por: 'ana', criterios: [] });
    assert.equal(excecao.status, 400);
    assert.match(excecao.corpo.mensagens.join(' '), /GO com exceção só faz sentido/);

    assert.equal((await s.json('POST', url, { decisao: 'go', justificativa: 'Tudo ok.', por: 'ana', criterios: [] })).status, 201);
    assert.equal((await s.json('POST', url, { decisao: 'no_go', justificativa: 'Mudei de ideia.', por: 'ana', criterios: [] })).status, 201);
  } finally {
    await s.fechar();
  }
});

test('valida decisão, justificativa, autor e critérios — e não grava nada quando recusa', async () => {
  const s = await iniciar();
  try {
    const id = await planoPronto(s);
    const url = `/api/planos/${id}/decisoes`;
    const ruim = await s.json('POST', url, { decisao: 'talvez', justificativa: '   ', por: '', criterios: [0, 8, 1.5] });
    assert.equal(ruim.status, 400);
    const texto = ruim.corpo.mensagens.join(' | ');
    assert.match(texto, /Decisão deve ser uma destas/);
    assert.match(texto, /Justificativa é obrigatória/);
    assert.match(texto, /Informe quem decidiu/);
    assert.match(texto, /criterios deve conter só números inteiros de 1 a 7/);

    assert.equal((await s.json('POST', url, { ...NO_GO, justificativa: 'x'.repeat(1001) })).status, 400);
    assert.equal((await s.json('POST', url, { ...NO_GO, por: 'x'.repeat(41) })).status, 400);
    assert.equal((await s.json('POST', url, { ...NO_GO, criterios: 'todos' })).status, 400);
    assert.equal((await s.json('POST', url, 'texto')).status, 400);

    assert.equal((await s.json('GET', `/api/planos/${id}`)).corpo.plano.decisoes, undefined);
  } finally {
    await s.fechar();
  }
});

test('plano inexistente responde 404', async () => {
  const s = await iniciar();
  try {
    const r = await s.json('POST', '/api/planos/pl_naoexiste/decisoes', NO_GO);
    assert.equal(r.status, 404);
    assert.equal(r.corpo.erro, 'nao_encontrado');
  } finally {
    await s.fechar();
  }
});
