import { Play, Square } from 'lucide-react';
import { useExecucao } from './ContextoExecucao.tsx';

/**
 * ▶ Executar / ■ Parar de um teste. Sem o provider da execução (testes de telas soltas) não aparece nada.
 * "Na fila" mostra que outro teste está rodando e este espera a vez.
 */
export default function BotaoExecutar({ idCenario }: { idCenario: string }) {
  const ex = useExecucao();
  if (!ex) return null;
  const run = ex.abertoDe(idCenario);
  const base = 'p-2 rounded-xl border cursor-pointer';

  if (run) {
    return (
      <span className="flex items-center gap-1">
        <span data-testid={`exec-${idCenario}`} className="rounded-full border border-volt-green/40 px-2 py-0.5 text-[10px] font-black uppercase text-volt-green">
          {run.estado === 'na_fila' ? 'Na fila' : 'Rodando'}
        </span>
        <button type="button" onClick={() => void ex.parar(run.runId)} aria-label={`Parar ${idCenario}`} className={`${base} border-neon-error/40 bg-neon-error/10 text-neon-error hover:bg-neon-error/20`}>
          <Square size={14} aria-hidden />
        </button>
      </span>
    );
  }
  return (
    <button type="button" onClick={() => void ex.iniciar(idCenario)} aria-label={`Executar ${idCenario}`} className={`${base} border-volt-green/40 bg-volt-green/10 text-volt-green hover:bg-volt-green/20`}>
      <Play size={14} aria-hidden />
    </button>
  );
}
