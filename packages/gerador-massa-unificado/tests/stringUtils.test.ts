// tests/stringUtils.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { removerAcentos, limparParaNomeSimples, formatarParaTextoCsv } from '../src/utils/stringUtils';

test('removerAcentos remove diacríticos preservando o resto do texto', () => {
  assert.equal(removerAcentos('São Paulo'), 'Sao Paulo');
  assert.equal(removerAcentos('Área de Ação'), 'Area de Acao');
  assert.equal(removerAcentos(null), null);
});

test('limparParaNomeSimples remove acentos, hífen, apóstrofo e colapsa espaços', () => {
  assert.equal(limparParaNomeSimples('D\'Ávila-Souza  Jr.'), 'DAvilaSouza Jr');
  assert.equal(limparParaNomeSimples('  Ana   Maria  '), 'Ana Maria');
  assert.equal(limparParaNomeSimples(null), null);
});

test('formatarParaTextoCsv envolve o valor em ="..." e duplica aspas internas', () => {
  assert.equal(formatarParaTextoCsv('12345678901'), '="12345678901"');
  assert.equal(formatarParaTextoCsv('a"b'), '="a""b"');
  assert.equal(formatarParaTextoCsv(null), '');
  assert.equal(formatarParaTextoCsv(undefined), '');
});
