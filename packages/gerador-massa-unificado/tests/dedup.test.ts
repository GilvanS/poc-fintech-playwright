import { test } from 'node:test';
import assert from 'node:assert/strict';
import { proximaContagem } from '../src/service/dedup';

test('proximaContagem retorna 1 na primeira ocorrência e incrementa nas seguintes', () => {
  const mapa = new Map<string, number>();
  assert.equal(proximaContagem(mapa, 'Tecnologia'), 1);
  assert.equal(proximaContagem(mapa, 'Tecnologia'), 2);
  assert.equal(proximaContagem(mapa, 'Tecnologia'), 3);
  assert.equal(proximaContagem(mapa, 'Saude'), 1);
});
