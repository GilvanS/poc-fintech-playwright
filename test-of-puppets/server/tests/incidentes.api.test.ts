import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app.ts';

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

async function iniciar() {
  const dir = await mkdtemp(join(tmpdir(), 'puppets-incidentes-'));
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
  for (const id of ['CT03.1', 'CT03.2', 'CT05.2']) {
    await json('POST', '/api/cenarios', { idCenario: id, nome: `Teste ${id}`, funcionalidade: 'Faturas' });
  }
  return { dir, json, fechar: () => new Promise<void>((r) => server.close(() => r())) };
}

const novo = { numero: 'INC0715802225', titulo: 'Saldo de Faturamento difere do extrato', severidade: 'alta', responsavel: 'ana', testesAfetados: ['CT03.1'], autor: 'ana' };

test('GET /api/incidentes começa vazio', async () => {
  const s = await iniciar();
  try {
    assert.deepEqual(await s.json('GET', '/api/incidentes'), { status: 200, corpo: { incidentes: [] } });
  } finally {
    await s.fechar();
  }
});

test('POST cria o INC: número em maiúsculas, padrões, versão 1 e histórico com o registro e o vínculo', async () => {
  const s = await iniciar();
  try {
    const r = await s.json('POST', '/api/incidentes', { ...novo, numero: ' inc0715802225 ' });
    assert.equal(r.status, 201);
    assert.equal(r.corpo.numero, 'INC0715802225');
    assert.equal(r.corpo.status, 'novo');
    assert.equal(r.corpo.descricao, '');
    assert.equal(r.corpo.versao, 1);
    assert.equal(r.corpo.resolvidoEm, null);
    assert.deepEqual(r.corpo.testesAfetados, ['CT03.1']);
    assert.deepEqual(
      r.corpo.historico.map((h: Json) => [h.tipo, h.autor, h.para ?? null]),
      [['registro', 'ana', null], ['vinculo', 'ana', 'CT03.1']],
    );
    const arquivo = JSON.parse(await readFile(join(s.dir, 'incidentes.json'), 'utf8')) as Json;
    assert.equal(arquivo.incidentes.length, 1);
  } finally {
    await s.fechar();
  }
});

test('só com número e título, a severidade padrão é média e não há responsável nem testes', async () => {
  const s = await iniciar();
  try {
    const r = await s.json('POST', '/api/incidentes', { numero: 'INC1', titulo: 'x' });
    assert.equal(r.status, 201);
    assert.equal(r.corpo.severidade, 'media');
    assert.equal(r.corpo.responsavel, null);
    assert.deepEqual(r.corpo.testesAfetados, []);
  } finally {
    await s.fechar();
  }
});

test('POST inválido é 400 com todas as mensagens', async () => {
  const s = await iniciar();
  try {
    const ruim = await s.json('POST', '/api/incidentes', { numero: '', titulo: '', status: 'aberto', severidade: 'critica', testesAfetados: 'CT03.1' });
    assert.equal(ruim.status, 400);
    assert.equal(ruim.corpo.erro, 'validacao');
    assert.equal(ruim.corpo.mensagens.length, 5);
    assert.equal((await s.json('POST', '/api/incidentes', { numero: 'a b', titulo: 'x' })).status, 400);
  } finally {
    await s.fechar();
  }
});

test('número repetido (sem diferenciar maiúsculas) é 409; teste que não existe no cadastro é 400', async () => {
  const s = await iniciar();
  try {
    await s.json('POST', '/api/incidentes', novo);
    const repetido = await s.json('POST', '/api/incidentes', { ...novo, numero: 'inc0715802225' });
    assert.equal(repetido.status, 409);
    assert.equal(repetido.corpo.erro, 'id_duplicado');
    const sem = await s.json('POST', '/api/incidentes', { numero: 'INC2', titulo: 'x', testesAfetados: ['CT99.9'] });
    assert.equal(sem.status, 400);
    assert.equal(sem.corpo.erro, 'cenario_inexistente');
  } finally {
    await s.fechar();
  }
});

test('a API não deixa escolher a data de abertura', async () => {
  const s = await iniciar();
  try {
    const r = await s.json('POST', '/api/incidentes', { ...novo, abertoEm: '2020-01-01T00:00:00.000Z', resolvidoEm: '2020-01-02T00:00:00.000Z', status: 'resolvido' });
    assert.equal(r.status, 201);
    assert.ok(!String(r.corpo.abertoEm).startsWith('2020'));
    assert.ok(!String(r.corpo.resolvidoEm).startsWith('2020'));
  } finally {
    await s.fechar();
  }
});

test('GET /:numero devolve o INC (qualquer caixa); inexistente é 404', async () => {
  const s = await iniciar();
  try {
    await s.json('POST', '/api/incidentes', novo);
    assert.equal((await s.json('GET', '/api/incidentes/inc0715802225')).corpo.titulo, novo.titulo);
    assert.equal((await s.json('GET', '/api/incidentes/INC404')).status, 404);
  } finally {
    await s.fechar();
  }
});

test('PUT muda status, severidade e responsável; cada mudança vai para o histórico com de/para e o autor', async () => {
  const s = await iniciar();
  try {
    await s.json('POST', '/api/incidentes', novo);
    const r = await s.json('PUT', '/api/incidentes/INC0715802225', { versao: 1, status: 'em_analise', severidade: 'media', responsavel: 'bia', autor: 'carlos' });
    assert.equal(r.status, 200);
    assert.equal(r.corpo.versao, 2);
    assert.equal(r.corpo.status, 'em_analise');
    const novas = r.corpo.historico.slice(2).map((h: Json) => [h.tipo, h.de, h.para, h.autor]);
    assert.deepEqual(novas, [['status', 'novo', 'em_analise', 'carlos'], ['severidade', 'alta', 'media', 'carlos'], ['responsavel', 'ana', 'bia', 'carlos']]);
  } finally {
    await s.fechar();
  }
});

test('resolver marca resolvidoEm; reabrir limpa', async () => {
  const s = await iniciar();
  try {
    await s.json('POST', '/api/incidentes', novo);
    const resolvido = await s.json('PUT', '/api/incidentes/INC0715802225', { versao: 1, status: 'resolvido' });
    assert.ok(resolvido.corpo.resolvidoEm);
    const reaberto = await s.json('PUT', '/api/incidentes/INC0715802225', { versao: 2, status: 'em_analise' });
    assert.equal(reaberto.corpo.resolvidoEm, null);
  } finally {
    await s.fechar();
  }
});

test('PUT com versão antiga é 409; sem campos é 400; sem mudança de verdade não sobe a versão', async () => {
  const s = await iniciar();
  try {
    await s.json('POST', '/api/incidentes', novo);
    await s.json('PUT', '/api/incidentes/INC0715802225', { versao: 1, titulo: 'Outro título' });
    const velha = await s.json('PUT', '/api/incidentes/INC0715802225', { versao: 1, titulo: 'De novo' });
    assert.equal(velha.status, 409);
    assert.equal(velha.corpo.erro, 'versao_antiga');
    assert.equal((await s.json('PUT', '/api/incidentes/INC0715802225', { versao: 2 })).status, 400);
    const igual = await s.json('PUT', '/api/incidentes/INC0715802225', { versao: 2, titulo: 'Outro título', severidade: 'alta' });
    assert.equal(igual.status, 200);
    assert.equal(igual.corpo.versao, 2);
  } finally {
    await s.fechar();
  }
});

test('PUT com testesAfetados liga os novos e desliga os que saíram, com histórico dos dois', async () => {
  const s = await iniciar();
  try {
    await s.json('POST', '/api/incidentes', novo);
    const r = await s.json('PUT', '/api/incidentes/INC0715802225', { versao: 1, testesAfetados: ['CT03.2', 'CT05.2'] });
    assert.deepEqual(r.corpo.testesAfetados.sort(), ['CT03.2', 'CT05.2']);
    const tipos = r.corpo.historico.slice(2).map((h: Json) => [h.tipo, h.de ?? null, h.para ?? null]);
    assert.deepEqual(tipos, [['vinculo', null, 'CT03.2'], ['vinculo', null, 'CT05.2'], ['desvinculo', 'CT03.1', null]]);
  } finally {
    await s.fechar();
  }
});

test('vincular acrescenta só os testes novos; lista vazia é 400; teste inexistente é 400', async () => {
  const s = await iniciar();
  try {
    await s.json('POST', '/api/incidentes', novo);
    const r = await s.json('POST', '/api/incidentes/INC0715802225/vincular', { idCenarios: ['CT03.1', 'CT03.2'], autor: 'ana' });
    assert.equal(r.status, 200);
    assert.deepEqual(r.corpo.testesAfetados, ['CT03.1', 'CT03.2']);
    assert.equal(r.corpo.historico.filter((h: Json) => h.tipo === 'vinculo').length, 2);
    const repetido = await s.json('POST', '/api/incidentes/INC0715802225/vincular', { idCenarios: ['CT03.2'] });
    assert.equal(repetido.corpo.versao, r.corpo.versao);
    assert.equal((await s.json('POST', '/api/incidentes/INC0715802225/vincular', { idCenarios: [] })).status, 400);
    assert.equal((await s.json('POST', '/api/incidentes/INC0715802225/vincular', { idCenarios: ['CT99.9'] })).corpo.erro, 'cenario_inexistente');
  } finally {
    await s.fechar();
  }
});

test('desvincular tira o teste e registra quem fez; teste que não estava ligado é 404', async () => {
  const s = await iniciar();
  try {
    await s.json('POST', '/api/incidentes', { ...novo, testesAfetados: ['CT03.1', 'CT03.2'] });
    const r = await s.json('DELETE', '/api/incidentes/INC0715802225/vinculo/CT03.1?autor=bia');
    assert.equal(r.status, 200);
    assert.deepEqual(r.corpo.testesAfetados, ['CT03.2']);
    const ultimo = r.corpo.historico[r.corpo.historico.length - 1];
    assert.deepEqual([ultimo.tipo, ultimo.de, ultimo.autor], ['desvinculo', 'CT03.1', 'bia']);
    assert.equal((await s.json('DELETE', '/api/incidentes/INC0715802225/vinculo/CT03.1')).status, 404);
  } finally {
    await s.fechar();
  }
});

test('comentário: 201, guarda o autor e sobe a versão; vazio é 400', async () => {
  const s = await iniciar();
  try {
    await s.json('POST', '/api/incidentes', novo);
    const r = await s.json('POST', '/api/incidentes/INC0715802225/comentarios', { texto: ' Reproduzi com a massa 0484. ', autor: 'bia' });
    assert.equal(r.status, 201);
    assert.equal(r.corpo.versao, 2);
    assert.deepEqual(r.corpo.comentarios.map((c: Json) => [c.autor, c.texto]), [['bia', 'Reproduzi com a massa 0484.']]);
    assert.equal((await s.json('POST', '/api/incidentes/INC0715802225/comentarios', { texto: '   ' })).status, 400);
  } finally {
    await s.fechar();
  }
});

test('DELETE apaga o INC; depois é 404', async () => {
  const s = await iniciar();
  try {
    await s.json('POST', '/api/incidentes', novo);
    assert.equal((await s.json('DELETE', '/api/incidentes/INC0715802225')).status, 204);
    assert.equal((await s.json('GET', '/api/incidentes')).corpo.incidentes.length, 0);
    assert.equal((await s.json('DELETE', '/api/incidentes/INC0715802225')).status, 404);
  } finally {
    await s.fechar();
  }
});
