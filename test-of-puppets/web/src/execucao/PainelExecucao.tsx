import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, RefreshCw, ShieldCheck, XCircle } from 'lucide-react';
import { ErroApi } from '../pages/cenarios/clienteApi.ts';
import type { ItemPlano } from '../pages/planos/clientePlanos.ts';
import { emAberto, ROTULO_ESTADO, urlArquivo, verificarAmbiente, type ChecagemAmbiente } from './clienteExecucoes.ts';
import { useExecucao } from './ContextoExecucao.tsx';
import LogAoVivo from './LogAoVivo.tsx';

const botao =
  'flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-xs font-bold hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer';

const segundos = (ms?: number) => (ms === undefined ? '' : ` · ${Math.max(1, Math.round(ms / 1000))} s`);

/**
 * Painel "Execução" do plano: verificar ambiente, reexecutar falhos, as últimas execuções com log ao vivo,
 * evidência (.docx) e pacote de falha (anexos do Allure). Sem o provider da execução não aparece.
 */
export default function PainelExecucao({ itens, onReler }: { itens: ItemPlano[]; onReler: () => void }) {
  const ex = useExecucao();
  // A execução mexe no plano (Em andamento, resultado, tempo): a cada sinal do servidor quem mostra o plano relê.
  const mudancas = ex?.mudancas ?? 0;
  const reler = useRef(onReler);
  reler.current = onReler;
  useEffect(() => {
    if (mudancas > 0) reler.current();
  }, [mudancas]);
  const [ambiente, setAmbiente] = useState<{ checagens: ChecagemAmbiente[]; ok: boolean } | null>(null);
  const [verificando, setVerificando] = useState(false);
  const [erroAmbiente, setErroAmbiente] = useState<string | null>(null);
  const [escolhida, setEscolhida] = useState<string | null>(null);
  if (!ex) return null;

  const falhos = itens.filter((i) => i.resultado === 'falhou').length;
  const recentes = ex.execucoes.slice(0, 5);
  const emCurso = ex.execucoes.find(emAberto);
  const idLog = escolhida && ex.execucoes.some((r) => r.runId === escolhida) ? escolhida : (emCurso ?? recentes[0])?.runId;

  const verificar = async () => {
    setVerificando(true);
    setErroAmbiente(null);
    try {
      setAmbiente(await verificarAmbiente());
    } catch (e) {
      setErroAmbiente(e instanceof ErroApi ? e.message : 'Erro inesperado.');
    }
    setVerificando(false);
  };

  return (
    <section aria-label="Execução" className="mx-5 mt-3 flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h4 className="text-sm font-black uppercase tracking-tight">Execução</h4>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => void verificar()} disabled={verificando} className={botao}>
            <ShieldCheck size={14} aria-hidden />
            Verificar ambiente
          </button>
          <button type="button" onClick={() => void ex.reexecutarFalhos()} disabled={falhos === 0} className={botao}>
            <RefreshCw size={14} aria-hidden />
            {`Reexecutar falhos (${falhos})`}
          </button>
        </div>
      </div>

      {(ex.erro || erroAmbiente) && (
        <p role="alert" className="rounded-xl border border-neon-error/40 bg-neon-error/10 px-3 py-2 text-xs text-neon-error">
          {ex.erro ?? erroAmbiente}
        </p>
      )}

      {ambiente && (
        <ul aria-label="Ambiente" className="flex flex-col gap-1 text-xs">
          {ambiente.checagens.map((c) => (
            <li key={c.chave} className="flex items-start gap-2">
              {c.ok ? <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-volt-green" aria-label="ok" /> : <XCircle size={14} className="mt-0.5 shrink-0 text-neon-error" aria-label="problema" />}
              <span>
                {c.titulo}
                <span className="text-on-surface-variant">{` — ${c.detalhe}`}</span>
              </span>
            </li>
          ))}
        </ul>
      )}

      {recentes.length > 0 && (
        <ul aria-label="Últimas execuções" className="flex flex-col gap-1.5 text-xs">
          {recentes.map((r) => (
            <li key={r.runId} data-testid={`run-${r.runId}`} className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-mono">{r.idCenario}</span>
              <span className={r.estado === 'passou' ? 'text-volt-green' : r.estado === 'falhou' ? 'text-neon-error' : 'text-on-surface-variant'}>
                {`${ROTULO_ESTADO[r.estado]}${segundos(r.duracaoMs)}`}
              </span>
              <button type="button" onClick={() => setEscolhida(r.runId)} aria-pressed={idLog === r.runId} className="underline-offset-2 hover:underline text-volt-green cursor-pointer">
                {`Ver log de ${r.idCenario}`}
              </button>
              {r.evidencia && (
                <a href={urlArquivo(r.runId, r.evidencia)} className="underline-offset-2 hover:underline text-volt-green">
                  {`Evidência de ${r.idCenario}`}
                </a>
              )}
              {r.estado === 'falhou' && r.anexos.length > 0 && (
                <span className="flex items-center gap-2">
                  {'Pacote de falha:'}
                  {r.anexos.map((a, n) => (
                    <a key={a} href={urlArquivo(r.runId, a)} className="underline-offset-2 hover:underline text-volt-green">
                      {`anexo ${n + 1}`}
                    </a>
                  ))}
                </span>
              )}
              {r.observacao && <span className="text-on-surface-variant">{r.observacao}</span>}
            </li>
          ))}
        </ul>
      )}

      {idLog && (
        <div aria-label="Execução ao vivo">
          <LogAoVivo key={idLog} runId={idLog} />
        </div>
      )}
    </section>
  );
}
