import { describe, expect, it } from 'vitest';
import { PADRAO_FUNDO, gravarFundo, lerFundo, normalizarFundo } from '../src/shell/fundo';

function memoria(inicial: string | null = null, limite = Infinity) {
  let valor = inicial;
  const tentativas: string[] = [];
  return {
    getItem: () => valor,
    setItem: (_chave: string, novo: string) => {
      tentativas.push(novo);
      if (novo.length > limite) throw new DOMException('cota estourada', 'QuotaExceededError');
      valor = novo;
    },
    conteudo: () => valor,
    tentativas,
  };
}

describe('configuração do fundo animado', () => {
  it('padrão: sem imagem, 15% de visibilidade e quadrados de 8px', () => {
    expect(PADRAO_FUNDO).toEqual({ src: null, opacity: 0.15, ditherCellSize: 8 });
    expect(lerFundo(memoria())).toEqual(PADRAO_FUNDO);
  });

  it('mantém a opacidade entre 0 e 60% e o tamanho do quadrado entre 3 e 24px', () => {
    expect(normalizarFundo({ opacity: 2 }).opacity).toBe(0.6);
    expect(normalizarFundo({ opacity: -1 }).opacity).toBe(0);
    expect(normalizarFundo({ ditherCellSize: 1 }).ditherCellSize).toBe(3);
    expect(normalizarFundo({ ditherCellSize: 99 }).ditherCellSize).toBe(24);
    expect(normalizarFundo({ ditherCellSize: 10.6 }).ditherCellSize).toBe(11);
  });

  it('rejeita lixo: src que não é texto vira null e números inválidos viram o padrão', () => {
    expect(normalizarFundo({ src: 42 }).src).toBeNull();
    expect(normalizarFundo({ src: '' }).src).toBeNull();
    expect(normalizarFundo({ opacity: 'muito' }).opacity).toBe(PADRAO_FUNDO.opacity);
    expect(normalizarFundo({ ditherCellSize: NaN }).ditherCellSize).toBe(PADRAO_FUNDO.ditherCellSize);
    expect(normalizarFundo(null)).toEqual(PADRAO_FUNDO);
  });

  it('ignora JSON corrompido ao ler', () => {
    expect(lerFundo(memoria('{quebrado'))).toEqual(PADRAO_FUNDO);
  });

  it('grava e lê de volta', () => {
    const armazem = memoria();
    const config = { src: '/img/fundo.jpg', opacity: 0.3, ditherCellSize: 12 };
    gravarFundo(config, armazem);
    expect(lerFundo(armazem)).toEqual(config);
  });

  it('se a imagem estourar a cota do navegador, guarda só os ajustes, sem a imagem', () => {
    const armazem = memoria(null, 200);
    const imagemEnorme = 'data:image/jpeg;base64,' + 'A'.repeat(5000);
    gravarFundo({ src: imagemEnorme, opacity: 0.3, ditherCellSize: 12 }, armazem);

    expect(armazem.tentativas).toHaveLength(2);
    expect(lerFundo(armazem)).toEqual({ src: null, opacity: 0.3, ditherCellSize: 12 });
  });

  it('não lança nem quando o navegador bloqueia tudo', () => {
    const bloqueado = {
      getItem: () => {
        throw new Error('bloqueado');
      },
      setItem: () => {
        throw new Error('bloqueado');
      },
    };
    expect(lerFundo(bloqueado)).toEqual(PADRAO_FUNDO);
    expect(() => gravarFundo(PADRAO_FUNDO, bloqueado)).not.toThrow();
    expect(() => gravarFundo(PADRAO_FUNDO, null)).not.toThrow();
  });
});
