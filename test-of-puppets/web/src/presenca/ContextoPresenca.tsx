import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { usePessoas } from '../pessoas/ContextoPessoas.tsx';
import { baterPresenca, verPresenca } from './clientePresenca.ts';

/** De quanto em quanto tempo a tela dá sinal (o servidor esquece quem passa de 15 s sem sinal). */
export const INTERVALO_PRESENCA_MS = 5_000;

export const ContextoPresenca = createContext<string[]>([]);

/** Ids das pessoas online. Telas fora do provider (testes, por exemplo) enxergam ninguém. */
export const usePresenca = () => useContext(ContextoPresenca);

/**
 * Dá sinal de presença a cada 5 s enquanto "Você" está escolhido e a aba está visível, e guarda quem está online.
 * Aba escondida ou sem "Você": só olha. Falha de rede = ninguém online, sem quebrar a tela.
 */
export function PresencaProvider({ children }: { children: ReactNode }) {
  const { voce } = usePessoas();
  const idVoce = voce?.id ?? null;
  const [online, setOnline] = useState<string[]>([]);

  useEffect(() => {
    let vivo = true;
    const sinal = async () => {
      try {
        const escondida = document.visibilityState === 'hidden';
        const r = idVoce && !escondida ? await baterPresenca(idVoce) : await verPresenca();
        if (vivo) setOnline(Array.isArray(r?.online) ? r.online : []);
      } catch {
        if (vivo) setOnline([]);
      }
    };
    void sinal();
    const relogio = window.setInterval(() => void sinal(), INTERVALO_PRESENCA_MS);
    const aoVoltar = () => {
      if (document.visibilityState !== 'hidden') void sinal();
    };
    document.addEventListener('visibilitychange', aoVoltar);
    return () => {
      vivo = false;
      window.clearInterval(relogio);
      document.removeEventListener('visibilitychange', aoVoltar);
    };
  }, [idVoce]);

  return <ContextoPresenca.Provider value={online}>{children}</ContextoPresenca.Provider>;
}
