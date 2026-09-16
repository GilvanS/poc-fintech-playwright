// tests/index.test.ts
// Smoke test do barrel público src/index.ts: garante que o entry point que um
// consumidor externo importaria (import { x } from 'gerador-massa-unificado')
// re-exporta a API real, e não apenas nomes vazios/quebrados.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  gerarMassaUnificada,
  habilitarModoOffline,
  gerarDados,
  gerarUsuario,
  gerarProduto,
  gerarArtigo,
  gerarCpf,
  gerarCnpj,
  gerarCep,
  gerarSenhaCustomizada,
} from '../src/index';
import type { DadosFaker } from '../src/index';

const DADOS_API_FAKE: DadosFaker = {
  firstName: 'Sheila',
  lastName: 'Ferreira',
  phoneNumber: '11999998888',
  password: 'abc123',
  fullName: 'Sheila Ferreira',
  addressLine: 'Rua X',
  buildingNumber: '42',
  city: 'Sao Paulo',
  stateRegion: 'SP',
  zipCode: null,
  country: 'Brasil',
  neighborhood: 'Centro',
  birthDate: '1990-01-01',
  cardNumber: '4111111111111111',
  cardFullName: 'Sheila Ferreira',
  expiryDate: '12/30',
  cvv: '123',
  articleTitle: 'Titulo Teste',
  articleContent: 'paragrafo um\n\nparagrafo dois',
};

test('src/index.ts re-exporta a API pública do pacote corretamente', () => {
  assert.equal(typeof gerarMassaUnificada, 'function');
  assert.equal(typeof habilitarModoOffline, 'function');
  assert.equal(typeof gerarUsuario, 'function');
  assert.equal(typeof gerarProduto, 'function');
  assert.equal(typeof gerarArtigo, 'function');
  assert.equal(typeof gerarCpf, 'function');
  assert.equal(typeof gerarCnpj, 'function');
  assert.equal(typeof gerarCep, 'function');
  assert.equal(typeof gerarSenhaCustomizada, 'function');
});

test('gerarProduto importado via src/index produz um produto com nome e preco validos', () => {
  const produto = gerarProduto();
  assert.ok(produto.nomeProduto.length > 0);
  assert.match(produto.preco, /^\d+\.\d{2}$/);
  assert.ok(produto.quantidade >= 1 && produto.quantidade <= 100);
});

test('gerarUsuario importado via src/index monta um usuario coerente a partir do DadosFaker', () => {
  const usuario = gerarUsuario(DADOS_API_FAKE);
  assert.equal(usuario.nomeCompleto, 'Sheila Ferreira');
  assert.match(usuario.cpf, /^\d{11}$/);
  assert.match(usuario.cnpj, /^\d{14}$/);
  // prova que a senha foi de fato calculada a partir de nome+cpf pela função real,
  // não apenas um placeholder
  const senhaEsperada = gerarSenhaCustomizada(usuario.nomeCompleto, usuario.cpf);
  assert.equal(usuario.senha, senhaEsperada);
});

test('gerarArtigo importado via src/index produz titulo e conteudo nao vazios', () => {
  const artigo = gerarArtigo(DADOS_API_FAKE);
  assert.ok(artigo.tituloArtigo.length > 0);
  assert.ok(artigo.conteudoArtigo.length > 0);
  assert.equal(artigo.nomeAutor, 'Sheila Ferreira');
});

test('gerarCpf/gerarCnpj/gerarCep importados via src/index produzem documentos com o formato correto', () => {
  assert.match(gerarCpf(false), /^\d{11}$/);
  assert.match(gerarCpf(true), /^\d{3}\.\d{3}\.\d{3}-\d{2}$/);
  assert.match(gerarCnpj(false), /^\d{14}$/);
  assert.match(gerarCep(true), /^\d{5}-\d{3}$/);
});

test('gerarSenhaCustomizada importada via src/index calcula a senha esperada', () => {
  const senha = gerarSenhaCustomizada('Sheila Ferreira', '12345678901');
  assert.equal(senha, 'FerSh01');
});

test('gerarDados e reexportado pelo barrel e retorna DadosFaker utilizavel', async () => {
  habilitarModoOffline();
  const dados = await gerarDados();
  assert.ok(dados.firstName && dados.firstName.length > 0);
  const usuario = gerarUsuario(dados);
  assert.ok(usuario.email.length > 0);
});

test('gerarMassaUnificada importada via src/index gera um CSV real de ponta a ponta', async () => {
  habilitarModoOffline();
  const arquivo = path.join(os.tmpdir(), `gerar-massa-index-teste-${Date.now()}.csv`);
  await gerarMassaUnificada(1, arquivo);

  const conteudo = fs.readFileSync(arquivo, 'utf-8');
  const linhas = conteudo.trim().split(/\r?\n/);
  assert.equal(linhas.length, 2); // header + 1 linha
  assert.ok(linhas[0].startsWith('Nome;Sobrenome;NomeCompleto;'));
  assert.equal(linhas[1].split(';').length, 29);

  fs.rmSync(arquivo);
});
