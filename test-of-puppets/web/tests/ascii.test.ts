import { describe, expect, it } from 'vitest';
import {
  CARACTERES_ASCII,
  COLUNAS,
  LINHAS,
  RAZAO_QUADRO,
  brilhoParaChar,
  calcularRecorte,
  mapearPixels,
} from '../src/pages/entrada/ascii';

function pixels(r: number, g: number, b: number, a = 255) {
  const dados = new Uint8ClampedArray(COLUNAS * LINHAS * 4);
  for (let i = 0; i < COLUNAS * LINHAS; i++) dados.set([r, g, b, a], i * 4);
  return dados;
}

describe('ASCII da galeria da tela inicial', () => {
  it('usa a grade de 25×22, a moldura 4:5 e a rampa de caracteres do exemplo', () => {
    expect(COLUNAS).toBe(25);
    expect(LINHAS).toBe(22);
    expect(RAZAO_QUADRO).toBeCloseTo(4 / 5);
    expect(CARACTERES_ASCII).toBe(' .:-=+*#%@');
  });

  describe('brilhoParaChar', () => {
    it('claro vira espaço e escuro vira o caractere mais denso', () => {
      expect(brilhoParaChar(1)).toBe(' ');
      expect(brilhoParaChar(0)).toBe('@');
    });

    it('tons intermediários ficam cada vez mais densos conforme escurecem', () => {
      const indices = [1, 0.75, 0.5, 0.25, 0].map((b) => CARACTERES_ASCII.indexOf(brilhoParaChar(b)));
      expect(indices).toEqual([...indices].sort((a, b) => a - b));
      expect(new Set(indices).size).toBe(5);
    });

    it('limita brilhos fora de 0 a 1', () => {
      expect(brilhoParaChar(2)).toBe(' ');
      expect(brilhoParaChar(-1)).toBe('@');
    });
  });

  describe('calcularRecorte (foto → moldura 4:5, centralizado)', () => {
    it('foto larga: corta as laterais', () => {
      expect(calcularRecorte(1000, 500)).toEqual({ x: 300, y: 0, largura: 400, altura: 500 });
    });

    it('foto alta: corta em cima e embaixo', () => {
      expect(calcularRecorte(400, 1000)).toEqual({ x: 0, y: 250, largura: 400, altura: 500 });
    });

    it('foto já na proporção: usa a imagem inteira', () => {
      expect(calcularRecorte(400, 500)).toEqual({ x: 0, y: 0, largura: 400, altura: 500 });
    });

    it('imagem sem tamanho (ainda não carregou) não tem recorte', () => {
      expect(calcularRecorte(0, 0)).toBeNull();
      expect(calcularRecorte(100, 0)).toBeNull();
    });
  });

  describe('mapearPixels', () => {
    it('imagem toda branca vira só espaços, na quantidade da grade', () => {
      const chars = mapearPixels(pixels(255, 255, 255));
      expect(chars).toHaveLength(COLUNAS * LINHAS);
      expect(new Set(chars)).toEqual(new Set([' ']));
    });

    it('imagem toda preta vira só o caractere mais denso', () => {
      expect(new Set(mapearPixels(pixels(0, 0, 0)))).toEqual(new Set(['@']));
    });

    it('usa a média de R, G e B e ignora a transparência', () => {
      // (255 + 0 + 0) / 3 / 255 = 1/3 de brilho → posição 6 da rampa
      const vermelho = mapearPixels(pixels(255, 0, 0, 10));
      expect(new Set(vermelho)).toEqual(new Set([CARACTERES_ASCII[6]]));
    });

    it('recusa dados de tamanho errado em vez de devolver uma grade quebrada', () => {
      expect(() => mapearPixels(new Uint8ClampedArray(4))).toThrow(RangeError);
    });
  });
});
