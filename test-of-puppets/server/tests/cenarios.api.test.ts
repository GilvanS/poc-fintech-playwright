import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app.ts';

async function iniciar(dirDados?: string) {
  const dir = dirDados ?? (await mkdtemp(join(tmpdir(), 'puppets-api-')));
  const server = createApp({ dirDados: dir }).listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', () => resolve()));
  const { port } = server.address() as AddressInfo;
  const base = `http://127.0.0.1:${port}`;
  return {
    dir,
    base,
    fechar: () => new Promise<void>((r) => server.close(() => r())),
    enviar: (metodo: string, caminho: string, corpo?: unknown) =>
      fetch(`${base}${caminho}`, {
        method: metodo,
        headers: corpo === undefined ? undefined : { 'content-type': 'application/json' },
        body: corpo === undefined ? undefined : JSON.stringify(corpo),
      }),
  };
}

const ct32 = { idCenario: 'CT03.2', nome: 'Consultar faturas e pagar o valor mínimo', funcionalidade: 'Faturas', idMassa: '0483' };
const ct37 = { idCenario: 'CT03.7', nome: 'Reenvio do pagamento mínimo', funcionalidade: 'Faturas', idMassa: '0483' };

test('GET /api/cenarios começa vazio', async () => {
  const s = await iniciar();
  try {
    const res = await s.enviar('GET', '/api/cenarios');
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { cenarios: [], funcionalidades: [] });
  } finally {
    await s.fechar();
  }
});

test('POST cria o cenário com versão 1 e datas; responde 201', async () => {
  const s = await iniciar();
  try {
    const res = await s.enviar('POST', '/api/cenarios', ct32);
    assert.equal(res.status, 201);
    const c = (await res.json()) as Record<string, unknown>;
    assert.equal(c.idCenario, 'CT03.2');
    assert.equal(c.versao, 1);
    assert.match(String(c.criadoEm), /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(c.criadoEm, c.atualizadoEm);
  } finally {
    await s.fechar();
  }
});

test('POST inválido devolve 400 com as mensagens em português', async () => {
  const s = await iniciar();
  try {
    const res = await s.enviar('POST', '/api/cenarios', { idCenario: 'x', nome: '', funcionalidade: '' });
    assert.equal(res.status, 400);
    const j = (await res.json()) as { erro: string; mensagens: string[] };
    assert.equal(j.erro, 'validacao');
    assert.equal(j.mensagens.length, 3);
    assert.ok(j.mensagens.every((m) => /[a-zá-ú]/.test(m)));
  } finally {
    await s.fechar();
  }
});

test('POST com JSON quebrado devolve 400 em JSON, não a página de erro do Express', async () => {
  const s = await iniciar();
  try {
    const res = await fetch(`${s.base}/api/cenarios`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{ nao-e-json' });
    assert.equal(res.status, 400);
    assert.match(res.headers.get('content-type') ?? '', /application\/json/);
    assert.equal(((await res.json()) as { erro: string }).erro, 'json_invalido');
  } finally {
    await s.fechar();
  }
});

test('POST com ID repetido devolve 409 id_duplicado', async () => {
  const s = await iniciar();
  try {
    await s.enviar('POST', '/api/cenarios', ct32);
    const res = await s.enviar('POST', '/api/cenarios', ct32);
    assert.equal(res.status, 409);
    assert.equal(((await res.json()) as { erro: string }).erro, 'id_duplicado');
  } finally {
    await s.fechar();
  }
});

test('GET devolve a massa compartilhada e a dependência automática (CT03.7 depende de CT03.2)', async () => {
  const s = await iniciar();
  try {
    await s.enviar('POST', '/api/cenarios', ct37);
    await s.enviar('POST', '/api/cenarios', ct32);
    const j = (await (await s.enviar('GET', '/api/cenarios')).json()) as {
      cenarios: { idCenario: string; dependeDe: string[]; massaCompartilhadaCom: string[] }[];
      funcionalidades: string[];
    };
    assert.deepEqual(j.cenarios.map((c) => c.idCenario), ['CT03.2', 'CT03.7']);
    assert.deepEqual(j.cenarios[0].dependeDe, []);
    assert.deepEqual(j.cenarios[1].dependeDe, ['CT03.2']);
    assert.deepEqual(j.cenarios[1].massaCompartilhadaCom, ['CT03.2']);
    assert.deepEqual(j.funcionalidades, ['Faturas']);
  } finally {
    await s.fechar();
  }
});

test('PUT atualiza, soma 1 na versão e não deixa trocar o ID', async () => {
  const s = await iniciar();
  try {
    await s.enviar('POST', '/api/cenarios', ct32);
    const res = await s.enviar('PUT', '/api/cenarios/CT03.2', { ...ct32, idCenario: 'CT99.9', nome: 'Nome novo', versao: 1 });
    assert.equal(res.status, 200);
    const c = (await res.json()) as Record<string, unknown>;
    assert.equal(c.idCenario, 'CT03.2');
    assert.equal(c.nome, 'Nome novo');
    assert.equal(c.versao, 2);
  } finally {
    await s.fechar();
  }
});

test('PUT com versão antiga devolve 409 versao_antiga e não altera nada', async () => {
  const s = await iniciar();
  try {
    await s.enviar('POST', '/api/cenarios', ct32);
    await s.enviar('PUT', '/api/cenarios/CT03.2', { ...ct32, nome: 'Alteração da Ana', versao: 1 });
    const res = await s.enviar('PUT', '/api/cenarios/CT03.2', { ...ct32, nome: 'Alteração do Bia', versao: 1 });
    assert.equal(res.status, 409);
    assert.equal(((await res.json()) as { erro: string }).erro, 'versao_antiga');
    const lista = (await (await s.enviar('GET', '/api/cenarios')).json()) as { cenarios: { nome: string }[] };
    assert.equal(lista.cenarios[0].nome, 'Alteração da Ana');
  } finally {
    await s.fechar();
  }
});

test('PUT sem versão numérica é 400; PUT de cenário inexistente é 404', async () => {
  const s = await iniciar();
  try {
    await s.enviar('POST', '/api/cenarios', ct32);
    const semVersao = await s.enviar('PUT', '/api/cenarios/CT03.2', ct32);
    assert.equal(semVersao.status, 400);
    const inexistente = await s.enviar('PUT', '/api/cenarios/CT09.9', { ...ct32, versao: 1 });
    assert.equal(inexistente.status, 404);
  } finally {
    await s.fechar();
  }
});

test('DELETE remove (204) e repetir devolve 404', async () => {
  const s = await iniciar();
  try {
    await s.enviar('POST', '/api/cenarios', ct32);
    assert.equal((await s.enviar('DELETE', '/api/cenarios/CT03.2')).status, 204);
    assert.equal((await s.enviar('DELETE', '/api/cenarios/CT03.2')).status, 404);
    const j = (await (await s.enviar('GET', '/api/cenarios')).json()) as { cenarios: unknown[] };
    assert.deepEqual(j.cenarios, []);
  } finally {
    await s.fechar();
  }
});

test('os dados sobrevivem a reiniciar o servidor (mesma pasta dados/)', async () => {
  const primeiro = await iniciar();
  await primeiro.enviar('POST', '/api/cenarios', ct32);
  await primeiro.fechar();

  const segundo = await iniciar(primeiro.dir);
  try {
    const j = (await (await segundo.enviar('GET', '/api/cenarios')).json()) as { cenarios: { idCenario: string }[] };
    assert.deepEqual(j.cenarios.map((c) => c.idCenario), ['CT03.2']);
  } finally {
    await segundo.fechar();
  }
});

test('senha e PIN enviados por engano nunca chegam ao arquivo nem à resposta', async () => {
  const s = await iniciar();
  try {
    const res = await s.enviar('POST', '/api/cenarios', { ...ct32, senha: 'Segredo123', pin: '9876' });
    assert.equal(res.status, 201);
    assert.doesNotMatch(JSON.stringify(await res.json()), /Segredo123|9876/);
    const arquivo = await readFile(join(s.dir, 'cenarios.json'), 'utf8');
    assert.doesNotMatch(arquivo, /Segredo123|9876|senha|pin/i);
  } finally {
    await s.fechar();
  }
});

test('cadastros simultâneos não se perdem (gravação em fila)', async () => {
  const s = await iniciar();
  try {
    const ids = Array.from({ length: 10 }, (_, i) => `CT05.${i + 1}`);
    const respostas = await Promise.all(
      ids.map((idCenario) => s.enviar('POST', '/api/cenarios', { idCenario, nome: `Cenário ${idCenario}`, funcionalidade: 'Cartões' })),
    );
    assert.ok(respostas.every((r) => r.status === 201));
    const j = (await (await s.enviar('GET', '/api/cenarios')).json()) as { cenarios: unknown[] };
    assert.equal(j.cenarios.length, 10);
  } finally {
    await s.fechar();
  }
});
