// tests/romanNumeral.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toRoman } from '../src/utils/romanNumeral';

test('toRoman converte números simples e compostos corretamente', () => {
  assert.equal(toRoman(1), 'I');
  assert.equal(toRoman(4), 'IV');
  assert.equal(toRoman(9), 'IX');
  assert.equal(toRoman(14), 'XIV');
  assert.equal(toRoman(40), 'XL');
  assert.equal(toRoman(58), 'LVIII');
  assert.equal(toRoman(90), 'XC');
  assert.equal(toRoman(1994), 'MCMXCIV');
  assert.equal(toRoman(3999), 'MMMCMXCIX');
});

test('toRoman retorna string vazia para zero ou negativo', () => {
  assert.equal(toRoman(0), '');
  assert.equal(toRoman(-5), '');
});
