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

// Fontes que PODEM citar a planilha de massa. O executor (Play) só confere que `data/MassaDados.xlsx` existe, em "Verificar ambiente".
// A atualização de massa (T9) vive só em `server/src/massa/` (serviço, leitor/gravador de células) e é a única que grava, com diff + confirmação + backup.
const PODE_CITAR_PLANILHA = ['server/src/runner/executor.ts', 'server/src/massa/modelo.ts', 'server/src/massa/servico.ts', 'server/src/massa/xlsx.ts'];
// Único fonte que PODE iniciar processo: o executor do Play, com comandos fixos montados por `runner/comando.ts` (ID validado).
const PODE_EXECUTAR_PROCESSO = ['server/src/runner/executor.ts'];

const caminhoRelativo = (arquivo: string) => relative(RAIZ, arquivo).replace(/\\/g, '/');

test('a ferramenta não lê nem grava planilha: só o executor cita .xlsx/MassaDados, e só para conferir que existe', async () => {
  const arquivos = [...(await fontes(join(RAIZ, 'server', 'src'))), ...(await fontes(join(RAIZ, 'web', 'src')))];
  assert.ok(arquivos.length > 40, 'esperava varrer os fontes do servidor e da tela');
  const suspeitos: string[] = [];
  for (const arquivo of arquivos) {
    const texto = await readFile(arquivo, 'utf8');
    if (/\.xlsx|xlsx['"]|MassaDados|exceljs|\bdata\/MassaDados|['"`]\.\.\/data\//i.test(texto) && !PODE_CITAR_PLANILHA.includes(caminhoRelativo(arquivo))) {
      suspeitos.push(caminhoRelativo(arquivo));
    }
  }
  assert.deepEqual(suspeitos, []);

  // No executor a planilha só passa por `access` (existe ou não): nenhuma leitura nem escrita do arquivo.
  const executor = await readFile(join(RAIZ, 'server', 'src', 'runner', 'executor.ts'), 'utf8');
  assert.match(executor, /access\(join\(deps\.raiz, 'data', 'MassaDados\.xlsx'\)\)/);
  assert.doesNotMatch(executor, /writeFile\(|XLSX\.|readFile\([^)]*MassaDados/);
});

test('a gravação da massa nunca reescreve o workbook: nada de XLSX.writeFile/exceljs/biblioteca xlsx no servidor', async () => {
  const arquivos = await fontes(join(RAIZ, 'server', 'src'));
  const suspeitos: string[] = [];
  for (const arquivo of arquivos) {
    const texto = await readFile(arquivo, 'utf8');
    if (/XLSX\.writeFile|from ['"]xlsx['"]|from ['"]exceljs['"]|require\(['"](xlsx|exceljs)['"]\)/.test(texto)) suspeitos.push(caminhoRelativo(arquivo));
  }
  assert.deepEqual(suspeitos, []);
  // Só `massa/xlsx.ts` escreve o .xlsx, e por troca de células no XML com rename atômico.
  const gravador = await readFile(join(RAIZ, 'server', 'src', 'massa', 'xlsx.ts'), 'utf8');
  assert.match(gravador, /renameSync\(temporario, caminho\)/);
  const servico = await readFile(join(RAIZ, 'server', 'src', 'massa', 'servico.ts'), 'utf8');
  assert.match(servico, /copyFileSync\(deps\.planilha, backup\)/); // backup antes de gravar
});

test('não há código que execute programas ou avalie texto: child_process só no executor do Play; nada de eval/new Function', async () => {
  const arquivos = [...(await fontes(join(RAIZ, 'server', 'src'))), ...(await fontes(join(RAIZ, 'web', 'src')))];
  const suspeitos: string[] = [];
  for (const arquivo of arquivos) {
    const texto = await readFile(arquivo, 'utf8');
    if (/\beval\(|new Function\(|dangerouslySetInnerHTML/.test(texto)) suspeitos.push(caminhoRelativo(arquivo));
    if (/child_process/.test(texto) && !PODE_EXECUTAR_PROCESSO.includes(caminhoRelativo(arquivo))) suspeitos.push(caminhoRelativo(arquivo));
  }
  assert.deepEqual(suspeitos, []);
});

test('o único comando que o Play monta aceita só IDs no formato CTnn.n (nada de texto livre chega ao shell)', async () => {
  const comando = await readFile(join(RAIZ, 'server', 'src', 'runner', 'comando.ts'), 'utf8');
  assert.match(comando, /FORMATO_ID = \/\^CT\\d\{2\}\\\.\\d\{1,2\}\$\//);
  assert.match(comando, /if \(!FORMATO_ID\.test\(idCenario\)\) throw/);
});

test('o servidor escuta só o próprio computador por padrão (projeto local)', async () => {
  const index = await readFile(join(RAIZ, 'server', 'src', 'index.ts'), 'utf8');
  assert.match(index, /PUPPETS_HOST\s*\?\?\s*'127\.0\.0\.1'/);
});

test('a pasta de dados da ferramenta é a dela (test-of-puppets/dados), nunca a data/ do projeto de testes', async () => {
  const { DADOS_PADRAO } = await import('../src/repos.ts');
  assert.equal(relative(RAIZ, DADOS_PADRAO).replace(/\\/g, '/'), 'dados');
});
