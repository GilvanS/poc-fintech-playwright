import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gerarProduto } from '../src/generators/produtoGenerator';

test('gerarProduto preenche todos os campos com valores não vazios', () => {
  const produto = gerarProduto();
  assert.ok(produto.nomeProduto.length > 0);
  assert.ok(produto.descricaoProduto.length > 0);
  assert.ok(produto.nomeCategoria.length > 0);
  assert.ok(produto.descricaoCategoria.length > 0);
});

test('gerarProduto preco fica na faixa [50.00, 5000.00) com 2 casas decimais', () => {
  for (let i = 0; i < 30; i++) {
    const produto = gerarProduto();
    const valor = Number(produto.preco);
    assert.ok(valor >= 50 && valor < 5000, `preco fora da faixa: ${produto.preco}`);
    assert.match(produto.preco, /^\d+\.\d{2}$/);
  }
});

test('gerarProduto quantidade fica na faixa [1, 100]', () => {
  for (let i = 0; i < 30; i++) {
    const produto = gerarProduto();
    assert.ok(produto.quantidade >= 1 && produto.quantidade <= 100);
  }
});

test('gerarProduto descreve o proprio produto, sem sortear tema solto', () => {
  for (let i = 0; i < 50; i++) {
    const { nomeProduto, descricaoProduto, nomeCategoria } = gerarProduto();
    // O nome é "<formato> <categoria>" e a descrição cita os dois, então a
    // última palavra da categoria tem de aparecer nos três campos.
    const palavrasDoNome = nomeProduto.split(' ');
    const nucleo = palavrasDoNome[palavrasDoNome.length - 1];
    assert.ok(
      descricaoProduto.includes(nucleo),
      `descricao "${descricaoProduto}" nao cita "${nucleo}" do produto "${nomeProduto}"`,
    );
    assert.ok(nomeCategoria.includes(nucleo), `categoria "${nomeCategoria}" nao casa com "${nomeProduto}"`);
  }
});

test('gerarProduto nao emite descricao em ingles', () => {
  // faker.commerce.productDescription() nao tem locale pt-BR e caia no ingles;
  // estas palavras apareciam em praticamente toda descricao gerada.
  const marcasDeIngles = /\b(our|the|with|for|and|new|your|is|features?|designed|perfect|technology)\b/i;
  for (let i = 0; i < 50; i++) {
    const { descricaoProduto } = gerarProduto();
    assert.doesNotMatch(descricaoProduto, marcasDeIngles, `descricao em ingles: "${descricaoProduto}"`);
  }
});

test('gerarProduto descricaoCategoria segue o padrão "Descricao para a categoria X"', () => {
  const produto = gerarProduto();
  assert.equal(produto.descricaoCategoria, `Descricao para a categoria ${produto.nomeCategoria}`);
});
