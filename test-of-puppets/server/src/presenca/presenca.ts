/** Quem está com a ferramenta aberta. Só na memória do servidor: nada é gravado e reiniciar o servidor zera tudo. */
export interface Presenca {
  /** A pessoa deu sinal agora (a tela manda a cada poucos segundos enquanto a aba está visível). */
  bater(pessoa: string): void;
  /** Quem deu sinal nos últimos `validadeMs`, na ordem em que apareceu pela primeira vez. */
  online(): string[];
}

interface Opcoes {
  agora?: () => number;
  /** Depois de quanto tempo sem sinal a pessoa deixa de estar online (padrão 15 s: três batimentos de 5 s). */
  validadeMs?: number;
}

export const VALIDADE_PADRAO_MS = 15_000;

export function criarPresenca({ agora = () => Date.now(), validadeMs = VALIDADE_PADRAO_MS }: Opcoes = {}): Presenca {
  // Map guarda a ordem de inserção; quem volta depois de sumir entra de novo no fim.
  const sinais = new Map<string, number>();

  function limpar(): void {
    const limite = agora() - validadeMs;
    for (const [pessoa, instante] of sinais) if (instante <= limite) sinais.delete(pessoa);
  }

  return {
    bater(pessoa) {
      limpar();
      sinais.set(pessoa, agora()); // quem já estava mantém o lugar na ordem
    },
    online() {
      limpar();
      return [...sinais.keys()];
    },
  };
}
