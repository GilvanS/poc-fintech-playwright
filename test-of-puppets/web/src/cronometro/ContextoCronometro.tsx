import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { ErroApi } from '../pages/cenarios/clienteApi.ts';
import { cronometroTeste, type AcaoCronometro, type EntradaFinalizar, type ItemPlano } from '../pages/planos/clientePlanos.ts';

export interface ValorCronometro {
  /** Sobe a cada ação: quem mostra o plano deve reler. */
  mudancas: number;
  erro: string | null;
  limparErro: () => void;
  acionar: (item: ItemPlano, acao: AcaoCronometro, extra?: EntradaFinalizar) => Promise<boolean>;
}

const ContextoCronometro = createContext<ValorCronometro | null>(null);

/** Null fora do provider (telas soltas e testes antigos): aí não há botão de cronômetro. */
export const useCronometro = () => useContext(ContextoCronometro);

const mensagemDe = (e: unknown) => (e instanceof ErroApi ? e.message : 'Erro inesperado.');

/** ▶/⏸/■ dos testes de um plano: chama o servidor (que carimba a hora) e avisa quem mostra o plano para reler. */
export function CronometroDoPlano({ planoId, children }: { planoId: string; children: ReactNode }) {
  const [mudancas, setMudancas] = useState(0);
  const [erro, setErro] = useState<string | null>(null);

  const acionar = useCallback(
    async (item: ItemPlano, acao: AcaoCronometro, extra?: EntradaFinalizar) => {
      setErro(null);
      try {
        await cronometroTeste(planoId, item.idCenario, item.versao, acao, extra);
        setMudancas((m) => m + 1);
        return true;
      } catch (e) {
        setErro(mensagemDe(e));
        setMudancas((m) => m + 1); // a versão pode ter mudado por outra pessoa: relê para mostrar o que é verdade
        return false;
      }
    },
    [planoId],
  );

  const valor = useMemo<ValorCronometro>(() => ({ mudancas, erro, limparErro: () => setErro(null), acionar }), [mudancas, erro, acionar]);
  return <ContextoCronometro.Provider value={valor}>{children}</ContextoCronometro.Provider>;
}
