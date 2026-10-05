import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ErroApi } from '../pages/cenarios/clienteApi.ts';
import { emAberto, iniciarExecucao, listarExecucoes, pararExecucao, reexecutarFalhos, type Run } from './clienteExecucoes.ts';

/** De quanto em quanto tempo a tela pergunta ao servidor como estão as execuções. */
export const INTERVALO_EXECUCAO_MS = 2_000;

export interface ValorExecucao {
  /** Execuções deste plano, da mais nova para a mais velha. */
  execucoes: Run[];
  /** Sobe quando algo andou (execução mudou de estado ou há uma rodando): quem mostra o plano deve reler. */
  mudancas: number;
  erro: string | null;
  limparErro: () => void;
  /** A execução na fila ou rodando deste teste, se houver. */
  abertoDe: (idCenario: string) => Run | undefined;
  iniciar: (idCenario: string) => Promise<void>;
  parar: (runId: string) => Promise<void>;
  reexecutarFalhos: (funcionalidade?: string) => Promise<void>;
}

export const ContextoExecucao = createContext<ValorExecucao | null>(null);

/** Null fora do provider (testes de telas soltas): aí não há botão de executar. */
export const useExecucao = () => useContext(ContextoExecucao);

const mensagemDe = (e: unknown) => (e instanceof ErroApi ? e.message : 'Erro inesperado.');

/** Acompanha as execuções do plano (consulta a cada 2 s) e entrega Play/Stop às telas filhas. */
export function ExecucaoDoPlano({ planoId, children }: { planoId: string; children: ReactNode }) {
  const [execucoes, setExecucoes] = useState<Run[]>([]);
  const [mudancas, setMudancas] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const assinatura = useRef<string | null>(null);

  const atualizar = useCallback(async () => {
    try {
      const { execucoes: todas } = await listarExecucoes();
      const doPlano = (Array.isArray(todas) ? todas : []).filter((r) => r.planoId === planoId);
      const nova = doPlano.map((r) => `${r.runId}:${r.estado}`).join('|');
      const andando = doPlano.some(emAberto);
      const mudou = assinatura.current !== null && assinatura.current !== nova;
      assinatura.current = nova;
      setExecucoes(doPlano);
      if (mudou || andando) setMudancas((m) => m + 1);
    } catch {
      // servidor fora do ar: a tela segue sem execuções
    }
  }, [planoId]);

  useEffect(() => {
    assinatura.current = null;
    void atualizar();
    const relogio = window.setInterval(() => void atualizar(), INTERVALO_EXECUCAO_MS);
    return () => window.clearInterval(relogio);
  }, [atualizar]);

  const agir = useCallback(
    async (acao: () => Promise<unknown>) => {
      setErro(null);
      try {
        await acao();
      } catch (e) {
        setErro(mensagemDe(e));
      }
      await atualizar();
    },
    [atualizar],
  );

  const valor = useMemo<ValorExecucao>(
    () => ({
      execucoes,
      mudancas,
      erro,
      limparErro: () => setErro(null),
      abertoDe: (idCenario) => execucoes.find((r) => r.idCenario === idCenario && emAberto(r)),
      iniciar: (idCenario) => agir(() => iniciarExecucao(planoId, idCenario)),
      parar: (runId) => agir(() => pararExecucao(runId)),
      reexecutarFalhos: (funcionalidade) =>
        agir(async () => {
          const r = await reexecutarFalhos(planoId, funcionalidade);
          if (r.ignorados.length > 0) setErro(r.ignorados.map((i) => `${i.idCenario}: ${i.motivo}`).join(' '));
        }),
    }),
    [execucoes, mudancas, erro, agir, planoId],
  );

  return <ContextoExecucao.Provider value={valor}>{children}</ContextoExecucao.Provider>;
}
