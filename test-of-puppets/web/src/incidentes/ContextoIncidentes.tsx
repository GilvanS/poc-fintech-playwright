import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { estaAberto, listarIncidentes, type Incidente } from './clienteIncidentes.ts';

export interface ValorIncidentes {
  incidentes: Incidente[];
  /** Os INC ainda não resolvidos que afetam este teste (a etiqueta do INC nos cards e na lista). */
  abertosDe: (idCenario: string) => Incidente[];
  recarregar: () => Promise<void>;
}

const SEM_INCIDENTES: ValorIncidentes = { incidentes: [], abertosDe: () => [], recarregar: async () => {} };

export const ContextoIncidentes = createContext<ValorIncidentes>(SEM_INCIDENTES);

/** Telas fora do provider (testes, por exemplo) enxergam uma lista vazia. */
export const useIncidentes = () => useContext(ContextoIncidentes);

/** Carrega os INC do servidor uma vez; quem muda um INC chama `recarregar`. Falha de rede = lista vazia. */
export function IncidentesProvider({ children }: { children: ReactNode }) {
  const [incidentes, setIncidentes] = useState<Incidente[]>([]);

  const recarregar = useCallback(async () => {
    try {
      setIncidentes(await listarIncidentes());
    } catch {
      setIncidentes([]);
    }
  }, []);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  const valor = useMemo<ValorIncidentes>(
    () => ({
      incidentes,
      abertosDe: (idCenario) => incidentes.filter((i) => estaAberto(i) && i.testesAfetados.includes(idCenario)),
      recarregar,
    }),
    [incidentes, recarregar],
  );

  return <ContextoIncidentes.Provider value={valor}>{children}</ContextoIncidentes.Provider>;
}
