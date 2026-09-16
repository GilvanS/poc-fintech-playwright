// tests/passwordGenerator.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gerarSenhaCustomizada, capitalizar, gerarSenhaPadrao } from '../src/generators/passwordGenerator';

test('capitalizar trunca a palavra ao tamanho, capitaliza a 1a letra e força minúsculas no resto', () => {
  assert.equal(capitalizar('Ferreira', 3), 'Fer');
  assert.equal(capitalizar('SHEILA', 2), 'Sh');
  assert.equal(capitalizar('Ana', 10), 'Ana');
});

test('gerarSenhaCustomizada monta parte1(sobrenome,3) + parte2(primeiroNome,2) + 2 últimos dígitos do CPF', () => {
  const senha = gerarSenhaCustomizada('Sheila Ferreira', '12345678901');
  assert.equal(senha, 'FerSh01');
});

test('gerarSenhaCustomizada usa o primeiro nome como sobrenome quando só há um nome', () => {
  const senha = gerarSenhaCustomizada('Madonna', '00000000099');
  assert.equal(senha, 'MadMa99');
});

test('gerarSenhaCustomizada ignora não-dígitos do CPF antes de pegar os últimos 2', () => {
  const senha = gerarSenhaCustomizada('João Silva', '123.456.789-45');
  assert.equal(senha, 'SilJo45');
});

test('gerarSenhaCustomizada retorna SenhaInvalida para entradas ausentes', () => {
  assert.equal(gerarSenhaCustomizada(null, '12345678901'), 'SenhaInvalida');
  assert.equal(gerarSenhaCustomizada('  ', '12345678901'), 'SenhaInvalida');
  assert.equal(gerarSenhaCustomizada('Nome Valido', null), 'SenhaInvalida');
});

test('gerarSenhaPadrao retorna PasswordNNN com 3 dígitos zero-padded', () => {
  const senha = gerarSenhaPadrao();
  assert.match(senha, /^Password\d{3}$/);
});
