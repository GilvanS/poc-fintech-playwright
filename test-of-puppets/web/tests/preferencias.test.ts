import { describe, expect, it } from 'vitest';
import { PADRAO_SHELL, gravarPreferencias, lerPreferencias } from '../src/shell/preferencias';

function memoria(inicial: string | null = null) {
  let valor = inicial;
  return {
    getItem: () => valor,
    setItem: (_chave: string, novo: string) => {
      valor = novo;
    },
    conteudo: () => valor,
  };
}

const quebrado = {
  getItem: () => {
    throw new Error('storage indisponível');
  },
  setItem: () => {
    throw new Error('storage indisponível');
  },
};

describe('preferências do shell', () => {
  it('sem nada salvo, o menu fica à esquerda e expandido', () => {
    expect(lerPreferencias(memoria())).toEqual({ lado: 'esquerda', recolhido: false });
    expect(PADRAO_SHELL).toEqual({ lado: 'esquerda', recolhido: false });
  });

  it('lê o que foi salvo', () => {
    const armazem = memoria(JSON.stringify({ lado: 'direita', recolhido: true }));
    expect(lerPreferencias(armazem)).toEqual({ lado: 'direita', recolhido: true });
  });

  it('ignora JSON corrompido e volta ao padrão', () => {
    expect(lerPreferencias(memoria('{isto não é json'))).toEqual(PADRAO_SHELL);
  });

  it('descarta campo a campo os valores desconhecidos, sem perder os válidos', () => {
    const armazem = memoria(JSON.stringify({ lado: 'cima', recolhido: true }));
    expect(lerPreferencias(armazem)).toEqual({ lado: 'esquerda', recolhido: true });

    const outro = memoria(JSON.stringify({ lado: 'direita', recolhido: 'sim' }));
    expect(lerPreferencias(outro)).toEqual({ lado: 'direita', recolhido: false });
  });

  it('não lança se o navegador bloquear a leitura', () => {
    expect(lerPreferencias(quebrado)).toEqual(PADRAO_SHELL);
    expect(lerPreferencias(null)).toEqual(PADRAO_SHELL);
  });

  it('grava e, se a gravação falhar, não lança', () => {
    const armazem = memoria();
    gravarPreferencias({ lado: 'direita', recolhido: true }, armazem);
    expect(JSON.parse(armazem.conteudo()!)).toEqual({ lado: 'direita', recolhido: true });

    expect(() => gravarPreferencias(PADRAO_SHELL, quebrado)).not.toThrow();
    expect(() => gravarPreferencias(PADRAO_SHELL, null)).not.toThrow();
  });
});
