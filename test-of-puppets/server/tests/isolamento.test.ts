import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('../../', import.meta.url));

async function fontes(pasta: string): Promise<string[]> {
  const achados: string[] = [];
  for (const entrada of await readdir(pasta, { withFileTypes: true })) {
    const caminho = join(pasta, entrada.name);
    if (entrada.isDirectory()) achados.push(...(await fontes(caminho)));
    else if (/\.(ts|tsx)$/.test(entrada.name)) achados.push(caminho);
  }
  return achados;
}

test('a ferramenta não lê nem grava planilha: nenhum fonte menciona .xlsx, MassaDados ou a pasta data/', async () => {
  const arquivos = [...(await fontes(join(RAIZ, 'server', 'src'))), ...(await fontes(join(RAIZ, 'web', 'src')))];
  assert.ok(arquivos.length > 40, 'esperava varrer os fontes do servidor e da tela');
  const suspeitos: string[] = [];
  for (const arquivo of arquivos) {
    const texto = await readFile(arquivo, 'utf8');
    if (/\.xlsx|xlsx['"]|MassaDados|exceljs|\bdata\/MassaDados|['"`]\.\.\/data\//i.test(texto)) suspeitos.push(relative(RAIZ, arquivo));
  }
  assert.deepEqual(suspeitos, []);
});

test('não há código que execute programas ou avalie texto (child_process, eval, new Function)', async () => {
  const arquivos = [...(await fontes(join(RAIZ, 'server', 'src'))), ...(await fontes(join(RAIZ, 'web', 'src')))];
  const suspeitos: string[] = [];
  for (const arquivo of arquivos) {
    const texto = await readFile(arquivo, 'utf8');
    if (/child_process|\beval\(|new Function\(|dangerouslySetInnerHTML/.test(texto)) suspeitos.push(relative(RAIZ, arquivo));
  }
  assert.deepEqual(suspeitos, []);
});

test('o servidor escuta só o próprio computador por padrão (projeto local)', async () => {
  const index = await readFile(join(RAIZ, 'server', 'src', 'index.ts'), 'utf8');
  assert.match(index, /PUPPETS_HOST\s*\?\?\s*'127\.0\.0\.1'/);
});

test('a pasta de dados da ferramenta é a dela (test-of-puppets/dados), nunca a data/ do projeto de testes', async () => {
  const { DADOS_PADRAO } = await import('../src/repos.ts');
  assert.equal(relative(RAIZ, DADOS_PADRAO).replace(/\\/g, '/'), 'dados');
});
