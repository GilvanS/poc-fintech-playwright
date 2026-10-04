import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app.ts';

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const HOJE = '2026-10-04';

async function iniciar() {
  const dir = await mkdtemp(join(tmpdir(), 'puppets-lembretes-'));
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
  const lembretes = async (voce?: string) => (await json('GET', `/api/lembretes?hoje=${HOJE}${voce ? `&voce=${voce}` : ''}`)).corpo;
  const chaves = async (voce?: string) => ((await lembretes(voce)).lembretes as Json[]).map((l) => l.chave);
  return { dir, json, lembretes, chaves, fechar: () => new Promise<void>((r) => server.close(() => r())) };
}

type Servidor = Awaited<ReturnType<typeof iniciar>>;

async function cenarios(s: Servidor, ids: string[]) {
  for (const id of ids) await s.json('POST', '/api/cenarios', { idCenario: id, nome: `Nome de ${id}`, funcionalidade: 'Faturas' });
}

async function plano(s: Servidor, nome: string, ids: string[], extra: Json = {}): Promise<string> {
  const r = await s.json('POST', '/api/planos', { nome, idCenarios: ids, ...extra });
  assert.equal(r.status, 201, JSON.stringify(r.corpo));
  return r.corpo.plano.id as string;
}

const alterar = async (s: Servidor, idPlano: string, idCenario: string, campos: Json, versao = 1) => {
  const r = await s.json('PATCH', `/api/planos/${idPlano}/testes/${idCenario}`, { versao, ...campos });
  assert.equal(r.status, 200, JSON.stringify(r.corpo));
};

test('sem nada cadastrado o sino está vazio', async () => {
  const s = await iniciar();
  try {
    assert.deepEqual(await s.lembretes(), { lembretes: [], naoLidas: 0 });
  } finally {
    await s.fechar();
  }
});

test('teste planejado para hoje: aparece para o responsável e para o teste sem dono; não para outra pessoa; concluído some', async () => {
  const s = await iniciar();
  try {
    await cenarios(s, ['CT01.1', 'CT01.2', 'CT01.3']);
    const id = await plano(s, '28/09/26', ['CT01.1', 'CT01.2', 'CT01.3']);
    await alterar(s, id, 'CT01.1', { dataPlanejada: HOJE, responsavel: 'ana' });
    await alterar(s, id, 'CT01.2', { dataPlanejada: HOJE });
    await alterar(s, id, 'CT01.3', { dataPlanejada: '2026-10-05', responsavel: 'ana' });

    const deAna = (await s.lembretes('ana')).lembretes as Json[];
    assert.deepEqual(deAna.map((l) => l.idCenario), ['CT01.1', 'CT01.2']);
    assert.equal(deAna[0].tipo, 'teste_hoje');
    assert.equal(deAna[0].titulo, 'Teste de hoje · Plano 28/09/26');
    assert.equal(deAna[0].detalhe, 'CT01.1 — Nome de CT01.1');
    assert.equal(deAna[0].planoId, id);
    assert.equal(deAna[0].chave, `teste-hoje:${id}:CT01.1:${HOJE}`);
    assert.deepEqual(await s.chaves('bia'), [`teste-hoje:${id}:CT01.2:${HOJE}`]);
    assert.equal((await s.chaves()).length, 2);

    await alterar(s, id, 'CT01.2', { status: 'concluido', resultado: 'passou' }, 2);
    assert.deepEqual((await s.lembretes('ana')).lembretes.map((l: Json) => l.idCenario), ['CT01.1']);
  } finally {
    await s.fechar();
  }
});

test('plano com previsão vencida e ainda aberto vira lembrete; futuro, de hoje ou concluído não', async () => {
  const s = await iniciar();
  try {
    await cenarios(s, ['CT01.1', 'CT01.2']);
    const vencido = await plano(s, 'Vencido', ['CT01.1', 'CT01.2'], { previsao: '2026-10-01' });
    await plano(s, 'No prazo', ['CT01.1'], { previsao: '2026-10-13' });
    await plano(s, 'Hoje', ['CT01.1'], { previsao: HOJE });
    await plano(s, 'Sem previsão', ['CT01.1']);
    const feito = await plano(s, 'Feito', ['CT01.1'], { previsao: '2026-09-20' });
    await alterar(s, feito, 'CT01.1', { status: 'concluido', resultado: 'passou' });

    const lista = (await s.lembretes()).lembretes as Json[];
    assert.deepEqual(lista.map((l) => l.chave), [`plano-vencido:${vencido}:2026-10-01`]);
    assert.equal(lista[0].titulo, 'Plano Vencido passou da previsão');
    assert.equal(lista[0].detalhe, 'Previsão era 01/10/2026 · 2 testes pendentes');
  } finally {
    await s.fechar();
  }
});

test('INC aberto: Alta primeiro, resolvido some e o de outra pessoa não aparece', async () => {
  const s = await iniciar();
  try {
    await cenarios(s, ['CT01.1', 'CT01.2']);
    const inc = (numero: string, extra: Json) => s.json('POST', '/api/incidentes', { numero, titulo: `Título ${numero}`, testesAfetados: ['CT01.1', 'CT01.2'], ...extra });
    await inc('INC0000002', { severidade: 'baixa' });
    await inc('INC0000001', { severidade: 'alta', responsavel: 'ana' });
    await inc('INC0000003', { severidade: 'media', responsavel: 'bia' });
    await inc('INC0000004', { severidade: 'alta', status: 'resolvido' });

    const deAna = (await s.lembretes('ana')).lembretes as Json[];
    assert.deepEqual(deAna.map((l) => l.numero), ['INC0000001', 'INC0000002']);
    assert.equal(deAna[0].titulo, 'INC aberto · INC0000001 (2 testes)');
    assert.equal(deAna[0].detalhe, 'Título INC0000001');
    assert.deepEqual((await s.lembretes()).lembretes.map((l: Json) => l.numero), ['INC0000001', 'INC0000003', 'INC0000002']);
  } finally {
    await s.fechar();
  }
});

test('ação pendente de retro: atrasadas primeiro; feita some; retro de plano excluído não conta', async () => {
  const s = await iniciar();
  try {
    await cenarios(s, ['CT01.1']);
    const id = await plano(s, '14/09/26', ['CT01.1']);
    await alterar(s, id, 'CT01.1', { status: 'concluido', resultado: 'passou' });
    const nova = (texto: string, extra: Json) => s.json('POST', `/api/retros/${id}/acoes`, { texto, ...extra });
    await nova('Sem prazo', { responsavel: 'ana' });
    await nova('Atrasada', { responsavel: 'ana', prazo: '2026-10-01' });
    await nova('No prazo', { responsavel: 'ana', prazo: '2026-10-20' });
    const feita = (await nova('Feita', { responsavel: 'ana', prazo: '2026-10-02' })).corpo.acoes[3].id;
    await nova('De outra pessoa', { responsavel: 'bia' });
    await s.json('PATCH', `/api/retros/${id}/acoes/${feita}`, { feito: true });

    const lista = (await s.lembretes('ana')).lembretes as Json[];
    assert.deepEqual(lista.map((l) => l.detalhe), ['Atrasada · atrasada desde 01/10/2026', 'No prazo · até 20/10/2026', 'Sem prazo']);
    assert.equal(lista[0].titulo, 'Ação da retro · Plano 14/09/26');
    assert.equal(lista[0].tipo, 'acao_retro');
    assert.equal(lista[0].planoId, id);

    await s.json('DELETE', `/api/planos/${id}`);
    assert.deepEqual(await s.chaves('ana'), []);
  } finally {
    await s.fechar();
  }
});

test('marcar como lida: zera o contador, fica gravado só para a pessoa e dá para desfazer', async () => {
  const s = await iniciar();
  try {
    await cenarios(s, ['CT01.1']);
    await s.json('POST', '/api/incidentes', { numero: 'INC0000001', titulo: 'Um', testesAfetados: ['CT01.1'] });
    await s.json('POST', '/api/incidentes', { numero: 'INC0000002', titulo: 'Dois', testesAfetados: ['CT01.1'] });
    assert.equal((await s.lembretes('ana')).naoLidas, 2);

    const r = await s.json('POST', '/api/lembretes/lidas', { voce: 'ana', hoje: HOJE, chaves: ['inc-aberto:INC0000001'] });
    assert.equal(r.status, 200);
    assert.equal(r.corpo.naoLidas, 1);
    assert.deepEqual(r.corpo.lembretes.map((l: Json) => [l.numero, l.lida]), [['INC0000001', true], ['INC0000002', false]]);
    assert.equal((await s.lembretes('bia')).naoLidas, 2, 'a marca é por pessoa');
    assert.equal((await s.lembretes()).naoLidas, 2, 'quem não escolheu "Você" tem a própria lista');

    const arquivo = JSON.parse(await readFile(join(s.dir, 'lembretes.json'), 'utf8')) as Json;
    assert.deepEqual(arquivo.lidos.map((l: Json) => [l.pessoa, l.chave]), [['ana', 'inc-aberto:INC0000001']]);

    const tudo = await s.json('POST', '/api/lembretes/lidas', { voce: 'ana', hoje: HOJE, chaves: ['inc-aberto:INC0000001', 'inc-aberto:INC0000002'] });
    assert.equal(tudo.corpo.naoLidas, 0);
    assert.equal(JSON.parse(await readFile(join(s.dir, 'lembretes.json'), 'utf8')).lidos.length, 2, 'não duplica a marca que já existia');

    const volta = await s.json('POST', '/api/lembretes/lidas', { voce: 'ana', hoje: HOJE, chaves: ['inc-aberto:INC0000002'], lida: false });
    assert.deepEqual(volta.corpo.lembretes.map((l: Json) => l.lida), [true, false]);
  } finally {
    await s.fechar();
  }
});

test('chave que não existe é ignorada, e a marca de um motivo que acabou é apagada na próxima marcação', async () => {
  const s = await iniciar();
  try {
    await cenarios(s, ['CT01.1']);
    await s.json('POST', '/api/incidentes', { numero: 'INC0000001', titulo: 'Um', testesAfetados: ['CT01.1'] });
    await s.json('POST', '/api/incidentes', { numero: 'INC0000002', titulo: 'Dois', testesAfetados: ['CT01.1'] });
    await s.json('POST', '/api/lembretes/lidas', { voce: 'ana', hoje: HOJE, chaves: ['inc-aberto:INC0000001', 'inc-aberto:NAO-EXISTE'] });
    assert.deepEqual(JSON.parse(await readFile(join(s.dir, 'lembretes.json'), 'utf8')).lidos.map((l: Json) => l.chave), ['inc-aberto:INC0000001']);

    await s.json('PUT', '/api/incidentes/INC0000001', { versao: 1, status: 'resolvido' });
    await s.json('POST', '/api/lembretes/lidas', { voce: 'ana', hoje: HOJE, chaves: ['inc-aberto:INC0000002'] });
    assert.deepEqual(JSON.parse(await readFile(join(s.dir, 'lembretes.json'), 'utf8')).lidos.map((l: Json) => l.chave), ['inc-aberto:INC0000002']);
  } finally {
    await s.fechar();
  }
});

test('valida hoje, chaves e lida', async () => {
  const s = await iniciar();
  try {
    assert.equal((await s.json('GET', '/api/lembretes?hoje=04/10/2026')).status, 400);
    const ruim = await s.json('POST', '/api/lembretes/lidas', { chaves: [], lida: 'sim', hoje: 'ontem' });
    assert.equal(ruim.status, 400);
    const texto = ruim.corpo.mensagens.join(' | ');
    assert.match(texto, /hoje deve ser uma data válida/);
    assert.match(texto, /chaves deve ser uma lista/);
    assert.match(texto, /lida deve ser verdadeiro ou falso/);
    assert.equal((await s.json('POST', '/api/lembretes/lidas', 'texto')).status, 400);
  } finally {
    await s.fechar();
  }
});

test('sem o parâmetro hoje usa o dia do servidor', async () => {
  const s = await iniciar();
  try {
    await cenarios(s, ['CT01.1']);
    const id = await plano(s, 'Hoje real', ['CT01.1']);
    const d = new Date();
    const hoje = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    await alterar(s, id, 'CT01.1', { dataPlanejada: hoje });
    const r = await s.json('GET', '/api/lembretes');
    assert.deepEqual(r.corpo.lembretes.map((l: Json) => l.tipo), ['teste_hoje']);
  } finally {
    await s.fechar();
  }
});
