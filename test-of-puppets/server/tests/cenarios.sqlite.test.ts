import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app.ts';
import { analisarCsv, gerarCsv, lerLinhas } from '../src/cenarios/csv.ts';
import { LIMITES } from '../src/cenarios/limites.ts';
import { criarRepoCenarios } from '../src/cenarios/repo.ts';
import { validarEntrada } from '../src/cenarios/modelo.ts';

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

async function iniciar(dirDados?: string) {
  const dir = dirDados ?? (await mkdtemp(join(tmpdir(), 'puppets-sqlite-')));
  const server = createApp({ dirDados: dir }).listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', () => resolve()));
  const { port } = server.address() as AddressInfo;
  return {
    dir,
    fechar: () => new Promise<void>((r) => server.close(() => r())),
    enviar: (metodo: string, caminho: string, corpo?: unknown) =>
      fetch(`http://127.0.0.1:${port}${caminho}`, {
        method: metodo,
        headers: corpo === undefined ? undefined : { 'content-type': 'application/json' },
        body: corpo === undefined ? undefined : JSON.stringify(corpo),
      }),
  };
}

const novo = (n: number, extra: Json = {}) => ({ idCenario: `CT${String(n).padStart(2, '0')}.1`, nome: `Cenário ${n}`, funcionalidade: 'Faturas', ...extra });

// ---------- regras dos campos novos ----------

test('feature (até 120) e projeto (até 60) são opcionais e seguem os tamanhos máximos', () => {
  assert.equal(validarEntrada({ ...novo(3), feature: 'faturas.feature', projeto: 'FintechBankApp' }).ok, true);
  const ruim = validarEntrada({ ...novo(3), feature: 'f'.repeat(121), projeto: 'p'.repeat(61) });
  assert.equal(ruim.ok, false);
  if (!ruim.ok) assert.deepEqual(ruim.mensagens, ['Feature deve ter no máximo 120 caracteres.', 'Projeto deve ter no máximo 60 caracteres.']);
});

// ---------- SQLite ----------

test('o cadastro fica num .db, sobrevive a reiniciar e guarda feature e projeto', async () => {
  const a = await iniciar();
  const criado = (await (await a.enviar('POST', '/api/cenarios', novo(3, { feature: 'faturas.feature', projeto: 'FintechBankApp', idMassa: '0483' }))).json()) as Json;
  assert.equal(criado.feature, 'faturas.feature');
  assert.equal(criado.projeto, 'FintechBankApp');
  await a.fechar();
  await access(join(a.dir, 'cenarios.db'));

  const b = await iniciar(a.dir);
  try {
    const lista = (await (await b.enviar('GET', '/api/cenarios')).json()) as Json;
    assert.equal(lista.cenarios[0].projeto, 'FintechBankApp');
    assert.deepEqual(lista.projetos, ['FintechBankApp']);
  } finally {
    await b.fechar();
  }
});

test('um cenarios.json antigo é migrado uma vez para o banco e vira .migrado', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'puppets-migra-'));
  const antigo = {
    cenarios: [
      { idCenario: 'CT03.2', nome: 'Pagar mínimo', funcionalidade: 'Faturas', idMassa: '0483', cpf: '52998224725', versao: 4, criadoEm: '2026-10-01T10:00:00.000Z', atualizadoEm: '2026-10-02T10:00:00.000Z' },
      { idCenario: 'CT03.7', nome: 'Reenvio', funcionalidade: 'Faturas', idMassa: '0483', versao: 1, criadoEm: '2026-10-01T10:00:00.000Z', atualizadoEm: '2026-10-01T10:00:00.000Z' },
    ],
  };
  await writeFile(join(dir, 'cenarios.json'), JSON.stringify(antigo), 'utf8');
  const s = await iniciar(dir);
  try {
    const lista = (await (await s.enviar('GET', '/api/cenarios')).json()) as Json;
    assert.deepEqual(lista.cenarios.map((c: Json) => c.idCenario), ['CT03.2', 'CT03.7']);
    assert.equal(lista.cenarios[0].versao, 4); // versão e datas preservadas
    assert.equal(lista.cenarios[0].criadoEm, '2026-10-01T10:00:00.000Z');
    assert.deepEqual(lista.cenarios[1].dependeDe, ['CT03.2']);
    await assert.rejects(access(join(dir, 'cenarios.json')));
    await access(join(dir, 'cenarios.json.migrado'));
  } finally {
    await s.fechar();
  }
});

test('JSON antigo corrompido não é apagado nem vira banco vazio', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'puppets-migra-'));
  await writeFile(join(dir, 'cenarios.json'), '{ quebrado', 'utf8');
  const repo = criarRepoCenarios(join(dir, 'cenarios.db'), { caminhoJsonAntigo: join(dir, 'cenarios.json') });
  await assert.rejects(repo.listar(), /corrompido/);
  assert.equal(await readFile(join(dir, 'cenarios.json'), 'utf8'), '{ quebrado');
});

test('atualizar com versão antiga é 409 e excluir some do banco', async () => {
  const s = await iniciar();
  try {
    await s.enviar('POST', '/api/cenarios', novo(3));
    const ruim = await s.enviar('PUT', '/api/cenarios/CT03.1', { ...novo(3), nome: 'Outro', versao: 9 });
    assert.equal(ruim.status, 409);
    const ok = await s.enviar('PUT', '/api/cenarios/CT03.1', { ...novo(3), nome: 'Outro', versao: 1 });
    assert.equal(((await ok.json()) as Json).versao, 2);
    assert.equal((await s.enviar('DELETE', '/api/cenarios/CT03.1')).status, 204);
    assert.deepEqual(((await (await s.enviar('GET', '/api/cenarios')).json()) as Json).cenarios, []);
  } finally {
    await s.fechar();
  }
});

// ---------- limites ----------

test('o teto de cenários recusa o próximo cadastro (409 limite_cenarios) e a importação inteira (tudo ou nada)', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'puppets-limite-'));
  const repo = criarRepoCenarios(join(dir, 'cenarios.db'));
  // IDs CTnn.n distintos: 99 por grupo de dois dígitos
  const lote = Array.from({ length: LIMITES.maxCenarios }, (_, i) => ({ idCenario: `CT${String(Math.floor(i / 99) + 1).padStart(2, '0')}.${(i % 99) + 1}`, nome: `C${i}`, funcionalidade: 'F' }));
  assert.equal(new Set(lote.map((l) => l.idCenario)).size, LIMITES.maxCenarios);
  const r = await repo.importar(lote, 'ignorar');
  assert.equal(r.criados.length, LIMITES.maxCenarios);
  const a = await repo.armazenamento();
  assert.equal(a.cenarios, LIMITES.maxCenarios);
  assert.equal(a.perto, true);
  await assert.rejects(repo.criar({ idCenario: 'CT99.99', nome: 'Um a mais', funcionalidade: 'F' }), (e: Json) => e.codigo === 'limite_cenarios');
  // um que atualiza + um novo que estoura: nada é gravado
  await assert.rejects(
    repo.importar([{ idCenario: 'CT01.1', nome: 'Mudou', funcionalidade: 'F' }, { idCenario: 'CT99.99', nome: 'Novo', funcionalidade: 'F' }], 'atualizar'),
    (e: Json) => e.codigo === 'limite_cenarios',
  );
  assert.equal((await repo.listar()).find((c) => c.idCenario === 'CT01.1')?.nome, 'C0');
});

// ---------- CSV ----------

test('exporta com BOM, ; e CPF com pontuação; aspas, ; e quebra de linha dentro do campo; fórmula neutralizada', () => {
  const csv = gerarCsv([
    { idCenario: 'CT03.2', nome: 'Pagar; "mínimo"', funcionalidade: 'Faturas', feature: 'faturas.feature', projeto: 'FintechBankApp', idMassa: '0483', cpf: '52998224725', passos: 'linha 1\nlinha 2', resultadoEsperado: '=SOMA(1)' },
  ]);
  assert.ok(csv.startsWith('﻿ID;Nome;Funcionalidade;Feature;Projeto;Massa;CPF;Passos;Resultado esperado\r\n'));
  assert.match(csv, /"Pagar; ""mínimo"""/);
  assert.match(csv, /529\.982\.247-25/);
  assert.match(csv, /"linha 1\nlinha 2"/);
  assert.match(csv, /'=SOMA\(1\)/);
});

test('ida e volta: o que a exportação gera a importação lê igual (inclusive acento, quebra de linha, ; e fórmula)', () => {
  const original = [
    { idCenario: 'CT03.2', nome: 'Pagar; "mínimo"', funcionalidade: 'Faturas', feature: 'faturas.feature', projeto: 'FintechBankApp', idMassa: '0483', cpf: '52998224725', passos: 'linha 1\nlinha 2', resultadoEsperado: '=SOMA(1)' },
    { idCenario: 'CT04.1', nome: 'Pix', funcionalidade: 'Pix' },
  ];
  const { linhas } = analisarCsv(gerarCsv(original), new Map());
  assert.deepEqual(linhas.map((l) => l.entrada), original);
});

test('a importação aceita vírgula, cabeçalho com acento/variações e ID em minúsculas', () => {
  const { linhas, colunasIgnoradas } = analisarCsv('Id do Teste,Cenário,Funcionalidade,Extra\nct03.2,Pagar,Faturas,x\n', new Map());
  assert.deepEqual(colunasIgnoradas, ['Extra']);
  assert.deepEqual(linhas[0].entrada, { idCenario: 'CT03.2', nome: 'Pagar', funcionalidade: 'Faturas' });
});

test('cada linha passa pelas regras do cadastro: mensagens com o número da linha; ID repetido; coluna obrigatória faltando', () => {
  const csv = ['ID;Nome;Funcionalidade;CPF;Massa', 'CT03.2;Ok;Faturas;;', 'XX;;;123;@@', 'CT03.2;Repetido;Faturas;;'].join('\r\n');
  const { linhas } = analisarCsv(csv, new Map());
  assert.equal(linhas[0].situacao, 'novo');
  assert.equal(linhas[1].situacao, 'erro');
  assert.equal(linhas[1].linha, 3);
  assert.ok(linhas[1].mensagens.some((m) => m.includes('CTnn.n')) && linhas[1].mensagens.some((m) => m.includes('CPF')));
  assert.equal(linhas[2].situacao, 'erro');
  assert.match(linhas[2].mensagens[0], /linha 2/);
  assert.throws(() => analisarCsv('ID;Nome\r\nCT03.2;x', new Map()), /Faltam colunas obrigatórias.*Funcionalidade/);
  assert.throws(() => analisarCsv('', new Map()), /vazio/);
  assert.throws(() => lerLinhas('ID;Nome\r\n"aberta'), /Aspas sem fechar/);
});

test('situação de cada linha: novo, existente (mudou) ou igual', () => {
  const existentes = new Map([
    ['CT03.2', { idCenario: 'CT03.2', nome: 'Igual', funcionalidade: 'Faturas' }],
    ['CT03.3', { idCenario: 'CT03.3', nome: 'Antigo', funcionalidade: 'Faturas' }],
  ]);
  const csv = 'ID;Nome;Funcionalidade\r\nCT03.2;Igual;Faturas\r\nCT03.3;Novo nome;Faturas\r\nCT03.4;Outro;Faturas';
  assert.deepEqual(analisarCsv(csv, existentes).linhas.map((l) => l.situacao), ['igual', 'existente', 'novo']);
});

// ---------- API de importação e exportação ----------

const csvDe = (linhas: string[]) => ['ID;Nome;Funcionalidade;Feature;Projeto', ...linhas].join('\r\n');

test('prévia não grava; ignorar mantém o existente; atualizar sobrescreve; linhas com erro ficam de fora e voltam listadas', async () => {
  const s = await iniciar();
  try {
    await s.enviar('POST', '/api/cenarios', novo(3, { nome: 'Antigo' }));
    const csv = csvDe(['CT03.1;Atualizado;Faturas;faturas.feature;FintechBankApp', 'CT04.1;Novo;Pix;pix.feature;FintechBankApp', 'XX;Ruim;;;']);

    const previa = (await (await s.enviar('POST', '/api/cenarios/importar', { csv })).json()) as Json;
    assert.deepEqual(previa.resumo, { total: 3, novos: 1, existentes: 1, iguais: 0, comErro: 1 });
    assert.equal(previa.problemas[0].linha, 4);
    assert.equal(((await (await s.enviar('GET', '/api/cenarios')).json()) as Json).cenarios.length, 1); // nada gravado

    const ignorar = (await (await s.enviar('POST', '/api/cenarios/importar', { csv, modo: 'ignorar' })).json()) as Json;
    assert.deepEqual([ignorar.criados, ignorar.atualizados, ignorar.ignorados], [['CT04.1'], [], ['CT03.1']]);
    assert.equal(((await (await s.enviar('GET', '/api/cenarios')).json()) as Json).cenarios.find((c: Json) => c.idCenario === 'CT03.1').nome, 'Antigo');

    const atualizar = (await (await s.enviar('POST', '/api/cenarios/importar', { csv, modo: 'atualizar' })).json()) as Json;
    assert.deepEqual([atualizar.criados, atualizar.atualizados], [[], ['CT03.1']]);
    const c31 = ((await (await s.enviar('GET', '/api/cenarios')).json()) as Json).cenarios.find((c: Json) => c.idCenario === 'CT03.1');
    assert.equal(c31.nome, 'Atualizado');
    assert.equal(c31.projeto, 'FintechBankApp');
    assert.equal(c31.versao, 2);
  } finally {
    await s.fechar();
  }
});

test('importação recusa arquivo grande, modo inválido e corpo sem csv; exportar devolve o CSV baixável', async () => {
  const s = await iniciar();
  try {
    await s.enviar('POST', '/api/cenarios', novo(3, { feature: 'f.feature', projeto: 'P' }));
    assert.equal((await s.enviar('POST', '/api/cenarios/importar', {})).status, 400);
    assert.equal((await s.enviar('POST', '/api/cenarios/importar', { csv: 'ID;Nome;Funcionalidade', modo: 'apagar' })).status, 400);
    const grande = await s.enviar('POST', '/api/cenarios/importar', { csv: `ID;Nome;Funcionalidade\n${'x'.repeat(LIMITES.maxBytesCsv + 10)}` });
    assert.equal(grande.status, 400);
    assert.match(((await grande.json()) as Json).mensagem, /máximo por importação/);

    const exportar = await s.enviar('GET', '/api/cenarios/exportar.csv');
    assert.equal(exportar.status, 200);
    assert.match(exportar.headers.get('content-type') ?? '', /text\/csv/);
    assert.match(exportar.headers.get('content-disposition') ?? '', /cenarios\.csv/);
    const corpo = await exportar.text();
    assert.match(corpo, /CT03\.1;Cenário 3;Faturas;f\.feature;P/);
  } finally {
    await s.fechar();
  }
});

test('o CSV de controle é regravado a cada mudança (criar, atualizar, excluir, importar)', async () => {
  const s = await iniciar();
  try {
    const csv = () => readFile(join(s.dir, 'controle', 'cenarios.csv'), 'utf8');
    await s.enviar('POST', '/api/cenarios', novo(3));
    assert.match(await csv(), /CT03\.1;Cenário 3/);
    await s.enviar('PUT', '/api/cenarios/CT03.1', { ...novo(3), nome: 'Mudou', versao: 1 });
    assert.match(await csv(), /CT03\.1;Mudou/);
    await s.enviar('POST', '/api/cenarios/importar', { csv: csvDe(['CT05.1;Importado;Cartões;;']), modo: 'ignorar' });
    assert.match(await csv(), /CT05\.1;Importado/);
    await s.enviar('DELETE', '/api/cenarios/CT03.1');
    assert.doesNotMatch(await csv(), /CT03\.1/);
  } finally {
    await s.fechar();
  }
});
