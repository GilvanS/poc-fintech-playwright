import { useEffect, useState } from 'react';
import { Pause, Play, Square } from 'lucide-react';
import type { ItemPlano } from '../pages/planos/clientePlanos.ts';
import { useCronometro } from './ContextoCronometro.tsx';
import FinalizarModal from './FinalizarModal.tsx';
import { decorridoMs, estaPausado, estaRodando, formatarDecorrido, minutosMedidos } from './tempo.ts';

const base = 'p-2 rounded-xl border cursor-pointer';
const verde = `${base} border-volt-green/40 bg-volt-green/10 text-volt-green hover:bg-volt-green/20`;
const neutro = `${base} border-white/10 bg-white/5 hover:bg-white/10`;
const vermelho = `${base} border-neon-error/40 bg-neon-error/10 text-neon-error hover:bg-neon-error/20`;

/** Relógio de tela: reconta a cada segundo só enquanto o teste está rodando. */
function useAgora(rodando: boolean): number {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    setAgora(Date.now());
    if (!rodando) return;
    const relogio = window.setInterval(() => setAgora(Date.now()), 1000);
    return () => window.clearInterval(relogio);
  }, [rodando]);
  return agora;
}

/**
 * ▶ Iniciar / ⏸ Pausar / ■ Finalizar de um teste. A ferramenta não roda nada: só marca o início, conta o tempo e,
 * no ■, pede o resultado. Sem o provider do cronômetro (telas soltas) não aparece nada.
 */
export default function BotaoCronometro({ item }: { item: ItemPlano }) {
  const cron = useCronometro();
  const [finalizando, setFinalizando] = useState(false);
  const rodando = estaRodando(item);
  const agora = useAgora(rodando);
  if (!cron) return null;

  const id = item.idCenario;
  const pausado = estaPausado(item);

  if (item.status !== 'em_andamento') {
    return (
      <button type="button" onClick={() => void cron.acionar(item, 'iniciar')} aria-label={`Iniciar ${id}`} className={verde}>
        <Play size={14} aria-hidden />
      </button>
    );
  }

  const ms = decorridoMs(item, agora);
  return (
    <span className="flex items-center gap-1">
      <span data-testid={`cron-${id}`} className={`rounded-full border px-2 py-0.5 font-mono text-[11px] font-black ${pausado ? 'border-yellow-400/40 text-yellow-300' : 'border-volt-green/40 text-volt-green'}`}>
        {pausado ? `Pausado ${formatarDecorrido(ms)}` : formatarDecorrido(ms)}
      </span>
      {pausado ? (
        <button type="button" onClick={() => void cron.acionar(item, 'retomar')} aria-label={`Retomar ${id}`} className={verde}>
          <Play size={14} aria-hidden />
        </button>
      ) : (
        <button type="button" onClick={() => void cron.acionar(item, 'pausar')} aria-label={`Pausar ${id}`} className={neutro}>
          <Pause size={14} aria-hidden />
        </button>
      )}
      <button type="button" onClick={() => setFinalizando(true)} aria-label={`Finalizar ${id}`} className={vermelho}>
        <Square size={14} aria-hidden />
      </button>
      {finalizando && (
        <FinalizarModal
          item={item}
          minutosSugeridos={minutosMedidos(ms)}
          onFechar={() => setFinalizando(false)}
          onRegistrar={async (entrada) => {
            if (await cron.acionar(item, 'finalizar', entrada)) setFinalizando(false);
          }}
        />
      )}
    </span>
  );
}
