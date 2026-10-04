export type Lado = 'esquerda' | 'direita';

export interface PreferenciasShell {
  lado: Lado;
  recolhido: boolean;
}

export const CHAVE_SHELL = 'puppets:shell';
export const PADRAO_SHELL: PreferenciasShell = { lado: 'esquerda', recolhido: false };

type Leitura = Pick<Storage, 'getItem'>;
type Escrita = Pick<Storage, 'setItem'>;

/** O navegador pode bloquear o armazenamento (janela privada, dados desligados): nunca estoura. */
export function armazenamentoLocal(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function lerPreferencias(storage: Leitura | null = armazenamentoLocal()): PreferenciasShell {
  if (!storage) return { ...PADRAO_SHELL };
  try {
    const bruto = storage.getItem(CHAVE_SHELL);
    if (!bruto) return { ...PADRAO_SHELL };
    const dado: unknown = JSON.parse(bruto);
    if (typeof dado !== 'object' || dado === null) return { ...PADRAO_SHELL };
    const { lado, recolhido } = dado as Record<string, unknown>;
    return {
      lado: lado === 'esquerda' || lado === 'direita' ? lado : PADRAO_SHELL.lado,
      recolhido: typeof recolhido === 'boolean' ? recolhido : PADRAO_SHELL.recolhido,
    };
  } catch {
    return { ...PADRAO_SHELL };
  }
}

export function gravarPreferencias(preferencias: PreferenciasShell, storage: Escrita | null = armazenamentoLocal()): void {
  if (!storage) return;
  try {
    storage.setItem(CHAVE_SHELL, JSON.stringify(preferencias));
  } catch {
    // sem armazenamento a tela continua funcionando; só não lembra a escolha
  }
}
