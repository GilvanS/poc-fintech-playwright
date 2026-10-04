import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { usePessoas } from '../pessoas/ContextoPessoas.tsx';
import { listarLembretes, marcarLembretes, type Lembrete } from './clienteLembretes.ts';

export interface ValorLembretes {
  lembretes: Lembrete[];
  naoLidas: number;
  recarregar: () => Promise<void>;
  /** Marca (ou desmarca, com `lida: false`) e já mostra a lista nova. */
  marcar: (chaves: string[], lida?: boolean) => Promise<void>;
}

const SEM_LEMBRETES: ValorLembretes = { lembretes: [], naoLidas: 0, recarregar: async () => {}, marcar: async () => {} };

export const ContextoLembretes = createContext<ValorLembretes>(SEM_LEMBRETES);

/** Telas fora do provider (testes, por exemplo) enxergam um sino vazio. */
export const useLembretes = () => useContext(ContextoLembretes);

/** De quanto em quanto tempo o sino confere se há lembrete novo (o dia vira, alguém abre um INC…). */
export const INTERVALO_LEMBRETES_MS = 60_000;

/**
 * Carrega os lembretes de quem é "Você" e os atualiza sozinho (a cada minuto e ao voltar para a aba).
 * Falha de rede = sino vazio, sem quebrar a tela.
 */
export function LembretesProvider({ children }: { children: ReactNode }) {
  const { voce } = usePessoas();
  const idVoce = voce?.id ?? null;
  const [dados, setDados] = useState<{ lembretes: Lembrete[]; naoLidas: number }>({ lembretes: [], naoLidas: 0 });

  const recarregar = useCallback(async () => {
    try {
      const r = await listarLembretes(idVoce);
      setDados({ lembretes: Array.isArray(r.lembretes) ? r.lembretes : [], naoLidas: r.naoLidas ?? 0 });
    } catch {
      setDados({ lembretes: [], naoLidas: 0 });
    }
  }, [idVoce]);

  useEffect(() => {
    void recarregar();
    const relogio = window.setInterval(() => void recarregar(), INTERVALO_LEMBRETES_MS);
    const aoVoltar = () => {
      if (document.visibilityState === 'visible') void recarregar();
    };
    document.addEventListener('visibilitychange', aoVoltar);
    return () => {
      window.clearInterval(relogio);
      document.removeEventListener('visibilitychange', aoVoltar);
    };
  }, [recarregar]);

  const marcar = useCallback(
    async (chaves: string[], lida = true) => {
      if (chaves.length === 0) return;
      const r = await marcarLembretes(idVoce, chaves, lida);
      setDados({ lembretes: r.lembretes, naoLidas: r.naoLidas });
    },
    [idVoce],
  );

  const valor = useMemo<ValorLembretes>(() => ({ ...dados, recarregar, marcar }), [dados, recarregar, marcar]);
  return <ContextoLembretes.Provider value={valor}>{children}</ContextoLembretes.Provider>;
}
