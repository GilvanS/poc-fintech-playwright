import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gerarDados, habilitarModoOffline, __resetOfflineModeParaTestes, definirSeed } from '../src/generators/fakerApiData';

test('gerarDados produz dados sintéticos em português nativamente', async () => {
  __resetOfflineModeParaTestes();
  const dados = await gerarDados();

  assert.ok(dados.firstName && dados.firstName.length > 0);
  assert.ok(dados.lastName && dados.lastName.length > 0);
  assert.ok(dados.fullName && dados.fullName.includes(dados.firstName));
  assert.ok(dados.phoneNumber && dados.phoneNumber.length > 0);
  assert.ok(dados.addressLine && dados.addressLine.length > 0);
  assert.equal(dados.country, 'Brasil');
});

test('definirSeed permite reprodutibilidade dos dados gerados', async () => {
  definirSeed(12345);
  const dados1 = await gerarDados();

  definirSeed(12345);
  const dados2 = await gerarDados();

  assert.equal(dados1.firstName, dados2.firstName);
  assert.equal(dados1.lastName, dados2.lastName);
  assert.equal(dados1.zipCode, dados2.zipCode);
});

test('habilitarModoOffline funciona sem chamadas de rede', async () => {
  habilitarModoOffline();
  const dados = await gerarDados();
  assert.ok(dados.fullName);
});