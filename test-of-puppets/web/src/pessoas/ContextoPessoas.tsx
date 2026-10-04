import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { listarPessoas, type Pessoa } from './clientePessoas.ts';

/** Quem está usando este navegador. Só o id é guardado; vale para esta pessoa neste navegador. */
export const CHAVE_VOCE = 'puppets:voce';

function lerVoce(): string | null {
  try {
    return window.localStorage.getItem(CHAVE_VOCE);
  } catch {
    return null;
  }
}

function gravarVoce(id: string | null): void {
  try {
    if (id) window.localStorage.setItem(CHAVE_VOCE, id);
    else window.localStorage.removeItem(CHAVE_VOCE);
  } catch {
    // sem armazenamento a escolha vale só até recarregar a página
  }
}

export interface ValorPessoas {
  pessoas: Pessoa[];
  /** Só as pessoas ativas (as que aparecem para escolher). */
  ativas: Pessoa[];
  /** A pessoa escolhida em "Você"; null se ninguém escolheu (ou se ela foi desativada/excluída). */
  voce: Pessoa | null;
  definirVoce: (id: string | null) => void;
  recarregar: () => Promise<void>;
  /** Nome para mostrar no lugar do id (id desconhecido aparece como está; vazio vira "-"). */
  nome: (id?: string) => string;
}

const SEM_PESSOAS: ValorPessoas = {
  pessoas: [],
  ativas: [],
  voce: null,
  definirVoce: () => {},
  recarregar: async () => {},
  nome: (id) => id ?? '-',
};

export const ContextoPessoas = createContext<ValorPessoas>(SEM_PESSOAS);

/** Telas que não estão dentro do provider (testes, por exemplo) enxergam uma equipe vazia. */
export const usePessoas = () => useContext(ContextoPessoas);

/** Carrega a Equipe do servidor uma vez e mantém "Você". Falha de rede = equipe vazia, sem quebrar a tela. */
export function PessoasProvider({ children }: { children: ReactNode }) {
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [idVoce, setIdVoce] = useState<string | null>(lerVoce);

  const recarregar = useCallback(async () => {
    try {
      setPessoas(await listarPessoas());
    } catch {
      setPessoas([]);
    }
  }, []);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  const definirVoce = useCallback((id: string | null) => {
    gravarVoce(id);
    setIdVoce(id);
  }, []);

  const valor = useMemo<ValorPessoas>(() => {
    const ativas = pessoas.filter((p) => p.ativa);
    return {
      pessoas,
      ativas,
      voce: ativas.find((p) => p.id === idVoce) ?? null,
      definirVoce,
      recarregar,
      nome: (id) => (id ? (pessoas.find((p) => p.id === id)?.nome ?? id) : '-'),
    };
  }, [pessoas, idVoce, definirVoce, recarregar]);

  return <ContextoPessoas.Provider value={valor}>{children}</ContextoPessoas.Provider>;
}
