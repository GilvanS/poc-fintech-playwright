import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gerarId, validarPessoa } from '../src/pessoas/modelo.ts';

function mensagens(entrada: unknown): string[] {
  const r = validarPessoa(entrada);
  assert.equal(r.ok, false);
  return r.ok ? [] : r.mensagens;
}

test('só o nome é obrigatório; o resto fica de fora quando não vem', () => {
  assert.deepEqual(validarPessoa({ nome: '  Ana  ' }), { ok: true, valor: { nome: 'Ana' } });
});

test('aceita capacidade, cor e ativa', () => {
  assert.deepEqual(validarPessoa({ nome: 'Bia', capacidadeMinSemana: 120, cor: 'verde', ativa: false }), {
    ok: true,
    valor: { nome: 'Bia', capacidadeMinSemana: 120, cor: 'verde', ativa: false },
  });
});

test('nome obrigatório e com até 40 caracteres', () => {
  assert.deepEqual(mensagens({ nome: ' ' }), ['Nome é obrigatório.']);
  assert.deepEqual(mensagens({}), ['Nome é obrigatório.']);
  assert.deepEqual(mensagens({ nome: 'x'.repeat(41) }), ['Nome deve ter no máximo 40 caracteres.']);
});

test('capacidade: inteiro de 0 a 6000 minutos por semana', () => {
  for (const ruim of [-1, 6001, 1.5, '120', null]) {
    assert.deepEqual(mensagens({ nome: 'Ana', capacidadeMinSemana: ruim }), ['Capacidade deve ser um inteiro de 0 a 6000 (minutos por semana).'], String(ruim));
  }
  assert.equal(validarPessoa({ nome: 'Ana', capacidadeMinSemana: 0 }).ok, true);
  assert.equal(validarPessoa({ nome: 'Ana', capacidadeMinSemana: 6000 }).ok, true);
});

test('cor precisa ser uma da paleta; ativa precisa ser verdadeiro/falso', () => {
  assert.deepEqual(mensagens({ nome: 'Ana', cor: 'marrom' }), ['Cor deve ser uma destas: azul, verde, roxo, laranja, rosa, ciano.']);
  assert.deepEqual(mensagens({ nome: 'Ana', ativa: 'sim' }), ['Ativa deve ser verdadeiro ou falso.']);
});

test('corpo que não é objeto é recusado', () => {
  assert.deepEqual(mensagens(null), ['Corpo da requisição deve ser um objeto JSON.']);
  assert.deepEqual(mensagens([]), ['Corpo da requisição deve ser um objeto JSON.']);
});

test('gerarId: minúsculas, sem acento, hífen no lugar de símbolos', () => {
  assert.equal(gerarId('Ana', []), 'ana');
  assert.equal(gerarId('José Álvaro', []), 'jose-alvaro');
  assert.equal(gerarId('  Maria  da  Silva!! ', []), 'maria-da-silva');
  assert.equal(gerarId('***', []), 'pessoa');
});

test('gerarId: repetido ganha sufixo numérico', () => {
  assert.equal(gerarId('Ana', ['ana']), 'ana-2');
  assert.equal(gerarId('Ana', ['ana', 'ana-2']), 'ana-3');
});
