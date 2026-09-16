import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gerarUsuario } from '../src/generators/usuarioGenerator';
import type { DadosFaker } from '../src/generators/fakerApiData';

function dadosBase(overrides: Partial<DadosFaker> = {}): DadosFaker {
  return {
    firstName: 'Sheila', lastName: 'Ferreira', phoneNumber: '(11) 91234-5678',
    password: null, fullName: 'Sheila Ferreira', addressLine: 'Rua Teste',
    buildingNumber: '100', city: 'São Paulo', stateRegion: 'SP', zipCode: null,
    country: 'Brasil', neighborhood: 'Centro', birthDate: '1990-01-01',
    cardNumber: '4111111111111111', cardFullName: 'Sheila Ferreira',
    expiryDate: '12/30', cvv: '123', articleTitle: null, articleContent: '',
    ...overrides,
  };
}

test('gerarUsuario monta email como sobrenome.nome@dominio (ordem invertida)', () => {
  const usuario = gerarUsuario(dadosBase());
  assert.match(usuario.email, /^ferreira\.sheila@[a-z.]+$/);
});

test('gerarUsuario monta nomeUsuario como nome.sobrenome normalizado', () => {
  const usuario = gerarUsuario(dadosBase());
  assert.equal(usuario.nomeUsuario, 'sheila.ferreira');
});

test('gerarUsuario é sempre administrador=true', () => {
  const usuario = gerarUsuario(dadosBase());
  assert.equal(usuario.administrador, true);
});

test('gerarUsuario usa fallback "Usuario"/"Convidado" quando firstName/lastName faltam (limparParaNomeSimples remove dígitos)', () => {
  const usuario = gerarUsuario(dadosBase({ firstName: null, lastName: '' }));
  assert.equal(usuario.nome, 'Usuario');
  assert.equal(usuario.sobrenome, 'Convidado');
});

test('gerarUsuario usa DocumentosGenerator.gerarCep, não o zipCode da API', () => {
  const usuario = gerarUsuario(dadosBase({ zipCode: '99999-999' }));
  assert.notEqual(usuario.zipCode, '99999-999');
  assert.match(usuario.zipCode, /^\d{8}$/);
});

test('gerarUsuario telefone remove tudo que não é dígito', () => {
  const usuario = gerarUsuario(dadosBase({ phoneNumber: '(11) 91234-5678' }));
  assert.equal(usuario.telefone, '11912345678');
});

test('gerarUsuario razaoSocial é nomeCompleto + " LTDA"', () => {
  const usuario = gerarUsuario(dadosBase());
  assert.equal(usuario.razaoSocial, 'Sheila Ferreira LTDA');
});

test('gerarUsuario senha segue a regra de gerarSenhaCustomizada (sobrenome[3]+nome[2]+2 dig CPF)', () => {
  const usuario = gerarUsuario(dadosBase());
  const parteEsperada = usuario.senha.slice(0, 3) + usuario.senha.slice(3, 5);
  assert.equal(parteEsperada, 'FerSh');
  assert.equal(usuario.senha.slice(-2), usuario.cpf.slice(-2));
});
