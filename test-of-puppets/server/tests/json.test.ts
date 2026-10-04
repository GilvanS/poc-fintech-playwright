import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gravarJson, lerJson } from '../src/store/json.ts';

async function pasta() {
  return mkdtemp(join(tmpdir(), 'puppets-json-'));
}

test('lerJson devolve o padrão quando o arquivo ainda não existe', async () => {
  const dir = await pasta();
  assert.deepEqual(await lerJson(join(dir, 'x.json'), { itens: [] }), { itens: [] });
});

test('gravarJson cria o arquivo (e a pasta) e lerJson devolve o mesmo conteúdo', async () => {
  const dir = await pasta();
  const arquivo = join(dir, 'sub', 'x.json');
  await gravarJson(arquivo, { itens: [1, 2] });
  assert.deepEqual(await lerJson(arquivo, { itens: [] }), { itens: [1, 2] });
});

test('gravarJson não deixa arquivo temporário para trás', async () => {
  const dir = await pasta();
  await gravarJson(join(dir, 'x.json'), { a: 1 });
  await gravarJson(join(dir, 'x.json'), { a: 2 });
  const nomes = (await readdir(dir)).sort();
  assert.deepEqual(nomes, ['x.json', 'x.json.bak']);
});

test('a segunda gravação guarda a versão anterior em .bak', async () => {
  const dir = await pasta();
  const arquivo = join(dir, 'x.json');
  await gravarJson(arquivo, { a: 1 });
  await gravarJson(arquivo, { a: 2 });
  assert.deepEqual(JSON.parse(await readFile(`${arquivo}.bak`, 'utf8')), { a: 1 });
  assert.deepEqual(JSON.parse(await readFile(arquivo, 'utf8')), { a: 2 });
});

test('arquivo corrompido: lerJson falha com erro claro e o .bak bom não é sobrescrito', async () => {
  const dir = await pasta();
  const arquivo = join(dir, 'x.json');
  await gravarJson(arquivo, { a: 1 });
  await gravarJson(arquivo, { a: 2 }); // .bak = {a:1}
  await writeFile(arquivo, '{ quebrado', 'utf8');

  await assert.rejects(() => lerJson(arquivo, {}), /corrompido/i);

  await gravarJson(arquivo, { a: 3 }); // não pode copiar o arquivo quebrado por cima do .bak
  assert.deepEqual(JSON.parse(await readFile(`${arquivo}.bak`, 'utf8')), { a: 1 });
  assert.deepEqual(JSON.parse(await readFile(arquivo, 'utf8')), { a: 3 });
});
