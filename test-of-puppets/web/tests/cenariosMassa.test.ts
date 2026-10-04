import { describe, expect, it } from 'vitest';
import { formatarCpf, massaCompartilhada } from '../src/pages/cenarios/massa';

describe('formatarCpf', () => {
  it('formata aos poucos enquanto a pessoa digita', () => {
    expect(formatarCpf('')).toBe('');
    expect(formatarCpf('123')).toBe('123');
    expect(formatarCpf('1234')).toBe('123.4');
    expect(formatarCpf('123456')).toBe('123.456');
    expect(formatarCpf('1234567')).toBe('123.456.7');
    expect(formatarCpf('123456789')).toBe('123.456.789');
    expect(formatarCpf('1234567890')).toBe('123.456.789-0');
    expect(formatarCpf('12345678909')).toBe('123.456.789-09');
  });

  it('ignora o que não é dígito e corta no 11º dígito', () => {
    expect(formatarCpf('123.456.789-09')).toBe('123.456.789-09');
    expect(formatarCpf('abc12x3')).toBe('123');
    expect(formatarCpf('123456789012345')).toBe('123.456.789-01');
  });
});

describe('massaCompartilhada', () => {
  const lista = [
    { idCenario: 'CT03.2', idMassa: '0483' },
    { idCenario: 'CT03.7', idMassa: '0483' },
    { idCenario: 'CT03.10', idMassa: '0483' },
    { idCenario: 'CT04.1', idMassa: '0500' },
    { idCenario: 'CT04.2' },
  ];

  it('novo cenário CT03.8 com massa 0483: usa a mesma massa de CT03.2, CT03.7 e CT03.10; depende dos de numeração menor', () => {
    expect(massaCompartilhada(lista, '0483', 'CT03.8')).toEqual({
      usadaPor: ['CT03.2', 'CT03.7', 'CT03.10'],
      dependeDe: ['CT03.2', 'CT03.7'],
    });
  });

  it('na edição, o próprio cenário não conta como "outro"', () => {
    expect(massaCompartilhada(lista, '0483', 'CT03.7')).toEqual({
      usadaPor: ['CT03.2', 'CT03.10'],
      dependeDe: ['CT03.2'],
    });
  });

  it('compara a numeração como número (CT03.10 vem depois de CT03.2)', () => {
    expect(massaCompartilhada(lista, '0483', 'CT03.2').dependeDe).toEqual([]);
  });

  it('massa vazia ou que ninguém usa não gera nada', () => {
    expect(massaCompartilhada(lista, '', 'CT03.8')).toEqual({ usadaPor: [], dependeDe: [] });
    expect(massaCompartilhada(lista, '9999', 'CT03.8')).toEqual({ usadaPor: [], dependeDe: [] });
    expect(massaCompartilhada(lista, '0500', 'CT04.1')).toEqual({ usadaPor: [], dependeDe: [] });
  });

  it('com o ID ainda incompleto mostra quem usa a massa, mas ainda não sabe a ordem', () => {
    expect(massaCompartilhada(lista, '0483', 'CT')).toEqual({
      usadaPor: ['CT03.2', 'CT03.7', 'CT03.10'],
      dependeDe: [],
    });
  });

  it('ignora espaços na massa digitada', () => {
    expect(massaCompartilhada(lista, ' 0500 ', 'CT04.9').usadaPor).toEqual(['CT04.1']);
  });
});
