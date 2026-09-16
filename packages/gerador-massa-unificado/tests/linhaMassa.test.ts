import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarContadores, montarLinha } from '../src/service/linhaMassa';
import type { Usuario } from '../src/generators/usuarioGenerator';
import type { Produto } from '../src/generators/produtoGenerator';
import type { Artigo } from '../src/generators/artigoGenerator';

function usuarioFake(): Usuario {
  return {
    nome: 'Sheila', sobrenome: 'Ferreira', nomeCompleto: 'Sheila Ferreira', nomeUsuario: 'sheila.ferreira',
    email: 'ferreira.sheila@gmail.com', senha: 'FerSh01', administrador: true, cpf: '12345678901',
    telefone: '11999998888', razaoSocial: 'Sheila Ferreira LTDA', cnpj: '12345678000190',
    addressLine: 'Rua X', numeroEndereco: '42', city: 'Sao Paulo', stateRegion: 'SP',
    zipCode: '01234567', country: 'Brasil', bairro: 'Centro', birthDate: '1990-01-01',
    cardBrand: 'VISA', cardTier: 'GOLD', cardDueDay: 10, cardPrintedName: 'SHEILA FERREIRA',
    plan: 'FREE', pixKey: '', tutorName: '', tutorCpf: '',
    cardNumber: '4111111111111111', expiryDate: '12/30',
  };
}

function produtoFake(overrides: Partial<Produto> = {}): Produto {
  return {
    nomeProduto: 'Notebook Potente', preco: '2500.00', descricaoProduto: 'Um notebook',
    quantidade: 10, nomeCategoria: 'Informatica', descricaoCategoria: 'Descricao para a categoria Informatica',
    ...overrides,
  };
}

function artigoFake(overrides: Partial<Artigo> = {}): Artigo {
  return {
    tituloArtigo: 'Guia de Python', conteudoArtigo: 'Texto sobre Guia de Python aqui.',
    nomeAutor: 'Sheila Ferreira', dataPublicacao: '2026-09-01T10:00:00.000Z',
    ...overrides,
  };
}

test('montarLinha retorna exatamente 29 colunas na ordem do header original', () => {
  const contadores = criarContadores();
  const linha = montarLinha(usuarioFake(), produtoFake(), artigoFake(), contadores);
  assert.equal(linha.length, 29);
  assert.equal(linha[0], 'Sheila');
  assert.equal(linha[4], 'ferreira.sheila@gmail.com');
  assert.equal(linha[6], 'true');
  assert.equal(linha[22], '10');
  assert.equal(linha[23], 'Informatica');
});

test('montarLinha sufixa categoria repetida com numeral romano e regera a descrição', () => {
  const contadores = criarContadores();
  montarLinha(usuarioFake(), produtoFake({ nomeCategoria: 'Informatica', descricaoCategoria: 'Descricao para a categoria Informatica' }), artigoFake(), contadores);
  const segunda = montarLinha(usuarioFake(), produtoFake({ nomeCategoria: 'Informatica', descricaoCategoria: 'Descricao para a categoria Informatica' }), artigoFake(), contadores);
  assert.equal(segunda[23], 'Informatica II');
  assert.equal(segunda[24], 'Descricao para a categoria Informatica II');
});

test('montarLinha sufixa titulo de artigo repetido e troca o titulo dentro do conteudo', () => {
  const contadores = criarContadores();
  montarLinha(usuarioFake(), produtoFake(), artigoFake({ tituloArtigo: 'Guia de Python', conteudoArtigo: 'Texto sobre Guia de Python aqui.' }), contadores);
  const segunda = montarLinha(usuarioFake(), produtoFake(), artigoFake({ tituloArtigo: 'Guia de Python', conteudoArtigo: 'Texto sobre Guia de Python aqui.' }), contadores);
  assert.equal(segunda[25], 'Guia de Python II');
  assert.equal(segunda[26], 'Texto sobre Guia de Python II aqui.');
});
