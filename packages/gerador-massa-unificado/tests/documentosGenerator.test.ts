// tests/documentosGenerator.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  gerarCpf, gerarCnpj, gerarCep, formatarCpf, formatarCnpj,
  calcularDigitoVerificadorCpf, calcularDigitoVerificadorCnpj,
} from '../src/generators/documentosGenerator';

function cpfComDigitosValidos(cpf: string): boolean {
  const d = cpf.split('').map(Number);
  return d[9] === calcularDigitoVerificadorCpf(d.slice(0, 9), 9)
      && d[10] === calcularDigitoVerificadorCpf([...d.slice(0, 9), d[9]], 10);
}

function cnpjComDigitosValidos(cnpj: string): boolean {
  const d = cnpj.split('').map(Number);
  return d[12] === calcularDigitoVerificadorCnpj(d.slice(0, 12), 12)
      && d[13] === calcularDigitoVerificadorCnpj([...d.slice(0, 12), d[12]], 13);
}

test('gerarCpf produz 11 dígitos com verificadores válidos', () => {
  for (let i = 0; i < 20; i++) {
    const cpf = gerarCpf(false);
    assert.match(cpf, /^\d{11}$/);
    assert.equal(cpfComDigitosValidos(cpf), true, `CPF inválido: ${cpf}`);
  }
});

test('gerarCpf(true) retorna formatado com pontuação', () => {
  const cpf = gerarCpf(true);
  assert.match(cpf, /^\d{3}\.\d{3}\.\d{3}-\d{2}$/);
});

test('gerarCnpj produz 14 dígitos com sufixo de filial 0001 e verificadores válidos', () => {
  for (let i = 0; i < 20; i++) {
    const cnpj = gerarCnpj(false);
    assert.match(cnpj, /^\d{14}$/);
    assert.equal(cnpj.slice(8, 12), '0001');
    assert.equal(cnpjComDigitosValidos(cnpj), true, `CNPJ inválido: ${cnpj}`);
  }
});

test('gerarCnpj(true) retorna formatado com pontuação', () => {
  const cnpj = gerarCnpj(true);
  assert.match(cnpj, /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/);
});

test('formatarCpf e formatarCnpj fazem passthrough se o tamanho não bater', () => {
  assert.equal(formatarCpf('123'), '123');
  assert.equal(formatarCnpj('456'), '456');
});

test('gerarCep produz 8 dígitos, com ou sem hífen', () => {
  const cepSemPontuacao = gerarCep(false);
  assert.match(cepSemPontuacao, /^\d{8}$/);
  const cepComPontuacao = gerarCep(true);
  assert.match(cepComPontuacao, /^\d{5}-\d{3}$/);
});
