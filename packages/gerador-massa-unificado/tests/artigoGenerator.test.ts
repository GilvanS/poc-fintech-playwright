import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gerarArtigo } from '../src/generators/artigoGenerator';
import type { DadosFaker } from '../src/generators/fakerApiData';

function dadosBase(overrides: Partial<DadosFaker> = {}): DadosFaker {
  return {
    firstName: 'Sheila', lastName: 'Ferreira', phoneNumber: null, password: null,
    fullName: 'Sheila Ferreira', addressLine: null, buildingNumber: null, city: null,
    stateRegion: null, zipCode: null, country: null, neighborhood: null, birthDate: null,
    cardNumber: null, cardFullName: null,
    expiryDate: null, cvv: '123', articleTitle: null, articleContent: '',
    ...overrides,
  };
}

test('gerarArtigo produz titulo e conteudo não vazios com o {TEMA}/{TITULO} substituído', () => {
  const artigo = gerarArtigo(dadosBase());
  assert.ok(artigo.tituloArtigo.length > 0);
  assert.ok(!artigo.tituloArtigo.includes('{TEMA}'));
  assert.ok(artigo.conteudoArtigo.length > 0);
  assert.ok(!artigo.conteudoArtigo.includes('{TITULO}'));
  assert.ok(!artigo.conteudoArtigo.includes('{CATEGORIA}'));
  assert.ok(!artigo.conteudoArtigo.includes('{PALAVRA_CHAVE}'));
});

test('gerarArtigo usa fullName da API como nomeAutor (sem acentos)', () => {
  const artigo = gerarArtigo(dadosBase({ fullName: 'José Ação' }));
  assert.equal(artigo.nomeAutor, 'Jose Acao');
});

test('gerarArtigo usa "Autor Desconhecido" quando fullName falta', () => {
  const artigo = gerarArtigo(dadosBase({ fullName: null }));
  assert.equal(artigo.nomeAutor, 'Autor Desconhecido');
});

test('gerarArtigo dataPublicacao é ISO 8601 UTC com milissegundos', () => {
  const artigo = gerarArtigo(dadosBase());
  assert.match(artigo.dataPublicacao, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
});
