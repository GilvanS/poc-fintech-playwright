import { useEffect, useRef, useState } from 'react';
import { urlLog, urlLogTexto, type EstadoRun } from './clienteExecucoes.ts';

const LINHAS_MAX = 2_000;

/** O log de uma execução: o que já saiu e depois ao vivo (SSE). Sem EventSource (jsdom) lê o texto de uma vez. */
export default function LogAoVivo({ runId }: { runId: string }) {
  const [linhas, setLinhas] = useState<string[]>([]);
  const [fim, setFim] = useState<EstadoRun | null>(null);
  const caixa = useRef<HTMLPreElement>(null);

  useEffect(() => {
    setLinhas([]);
    setFim(null);
    if (typeof EventSource === 'undefined') {
      let vivo = true;
      fetch(urlLogTexto(runId))
        .then((r) => r.text())
        .then((t) => vivo && setLinhas(t ? t.split('\n') : []))
        .catch(() => undefined);
      return () => {
        vivo = false;
      };
    }
    const fonte = new EventSource(urlLog(runId));
    fonte.addEventListener('linha', (e) => {
      const { texto } = JSON.parse((e as MessageEvent<string>).data) as { texto: string };
      setLinhas((atual) => (atual.length >= LINHAS_MAX ? [...atual.slice(1), texto] : [...atual, texto]));
    });
    fonte.addEventListener('fim', (e) => {
      setFim((JSON.parse((e as MessageEvent<string>).data) as { estado: EstadoRun }).estado);
      fonte.close();
    });
    fonte.onerror = () => fonte.close(); // sem isto o navegador reconecta e repete o log todo
    return () => fonte.close();
  }, [runId]);

  useEffect(() => {
    const el = caixa.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [linhas]);

  return (
    <div className="flex flex-col gap-1">
      <pre
        ref={caixa}
        role="log"
        aria-label={`Log da execução ${runId}`}
        className="max-h-64 overflow-auto whitespace-pre-wrap rounded-xl border border-white/10 bg-black/40 p-3 font-mono text-[11px] leading-relaxed text-on-surface"
      >
        {linhas.length > 0 ? linhas.join('\n') : 'Sem saída ainda…'}
      </pre>
      {fim && <span className="text-[11px] text-on-surface-variant">{`Execução encerrada: ${fim}`}</span>}
    </div>
  );
}
