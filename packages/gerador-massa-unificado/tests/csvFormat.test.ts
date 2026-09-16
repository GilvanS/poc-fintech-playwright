import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { formatCsvField, limparValorCsv, carregarContagensDeArquivoExistente } from '../src/service/csvFormat';

test('formatCsvField envolve em ="..." e trata null como ""', () => {
  assert.equal(formatCsvField('12345678901'), '="12345678901"');
  assert.equal(formatCsvField(null), '=""');
  assert.equal(formatCsvField('a"b'), '="a""b"');
});

test('limparValorCsv desfaz o wrapper ="..." e faz passthrough se não tiver o wrapper', () => {
  assert.equal(limparValorCsv('="12345678901"'), '12345678901');
  assert.equal(limparValorCsv('="a""b"'), 'a"b');
  assert.equal(limparValorCsv('sem-wrapper'), 'sem-wrapper');
  assert.equal(limparValorCsv(null), null);
});

test('carregarContagensDeArquivoExistente lê NomeCategoria/TituloArtigo removendo sufixo romano antigo', () => {
  const arquivo = path.join(os.tmpdir(), `massa-teste-${Date.now()}.csv`);
  const header = 'Nome;NomeCategoria;TituloArtigo\n';
  const linhas = [
    '="A";="Informatica";="Guia de Python"',
    '="B";="Informatica II";="Guia de Python"',
    '="C";="Saude";="Guia de Python III"',
  ].join('\n');
  fs.writeFileSync(arquivo, header + linhas + '\n', 'utf-8');

  const contagens = carregarContagensDeArquivoExistente(arquivo);
  assert.equal(contagens.categorias.get('Informatica'), 2);
  assert.equal(contagens.categorias.get('Saude'), 1);
  assert.equal(contagens.artigos.get('Guia de Python'), 3);

  fs.rmSync(arquivo);
});

test('carregarContagensDeArquivoExistente preserva nome que termina em letra romana sem ser duplicata', () => {
  const arquivo = path.join(os.tmpdir(), `massa-romano-${Date.now()}.csv`);
  const header = 'Nome;NomeCategoria;TituloArtigo\n';
  const linhas = [
    '="A";="Filmes em DVD";="Colecao MIX"',
    '="B";="Livros em CD";="Analise do Cinema"',
  ].join('\n');
  fs.writeFileSync(arquivo, header + linhas + '\n', 'utf-8');

  const contagens = carregarContagensDeArquivoExistente(arquivo);
  // "DVD", "CD" e "MIX" terminam em letras romanas, mas a base ("Filmes em",
  // "Livros em", "Colecao") nunca aparece sozinha — logo não são sufixos.
  assert.equal(contagens.categorias.get('Filmes em DVD'), 1);
  assert.equal(contagens.categorias.get('Livros em CD'), 1);
  assert.equal(contagens.artigos.get('Colecao MIX'), 1);
  assert.equal(contagens.categorias.get('Filmes em'), undefined);

  fs.rmSync(arquivo);
});

test('carregarContagensDeArquivoExistente ainda agrupa quando a base existe sozinha', () => {
  const arquivo = path.join(os.tmpdir(), `massa-base-${Date.now()}.csv`);
  const header = 'Nome;NomeCategoria;TituloArtigo\n';
  const linhas = [
    '="A";="Colecao";="Tema"',
    '="B";="Colecao MIX";="Tema II"',
  ].join('\n');
  fs.writeFileSync(arquivo, header + linhas + '\n', 'utf-8');

  const contagens = carregarContagensDeArquivoExistente(arquivo);
  // Aqui "Colecao" aparece sozinha, então "Colecao MIX" é de fato duplicata.
  assert.equal(contagens.categorias.get('Colecao'), 2);
  assert.equal(contagens.artigos.get('Tema'), 2);

  fs.rmSync(arquivo);
});

test('carregarContagensDeArquivoExistente retorna mapas vazios se o arquivo não existir ou estiver vazio', () => {
  const contagens = carregarContagensDeArquivoExistente(path.join(os.tmpdir(), 'nao-existe-xyz.csv'));
  assert.equal(contagens.categorias.size, 0);
  assert.equal(contagens.artigos.size, 0);
});
