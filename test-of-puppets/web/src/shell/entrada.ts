/**
 * Entrada sem senha (decisão do usuário): só o botão "Entrar". Lembrar a entrada vale
 * só para a aba aberta (sessionStorage); uma aba nova volta a mostrar a tela de entrada.
 */
export const CHAVE_ENTRADA = 'puppets:entrada';

function sessao(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function jaEntrou(storage: Pick<Storage, 'getItem'> | null = sessao()): boolean {
  try {
    return storage?.getItem(CHAVE_ENTRADA) === '1';
  } catch {
    return false;
  }
}

export function registrarEntrada(storage: Pick<Storage, 'setItem'> | null = sessao()): void {
  try {
    storage?.setItem(CHAVE_ENTRADA, '1');
  } catch {
    // sem armazenamento a pessoa entra normalmente; só terá de clicar de novo ao recarregar
  }
}
