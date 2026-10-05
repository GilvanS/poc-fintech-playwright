import { useEffect, useRef } from 'react';
import { useCronometro } from './ContextoCronometro.tsx';

/**
 * Fica dentro do detalhe do plano: mostra o erro do cronômetro (ex.: "aguardando CT03.2 passar") e, a cada ação,
 * manda reler o plano. Sem o provider do cronômetro não aparece nada.
 */
export default function AvisoCronometro({ onReler }: { onReler: () => void }) {
  const cron = useCronometro();
  const mudancas = cron?.mudancas ?? 0;
  const reler = useRef(onReler);
  reler.current = onReler;
  useEffect(() => {
    if (mudancas > 0) reler.current();
  }, [mudancas]);

  if (!cron?.erro) return null;
  return (
    <p role="alert" className="mx-5 mb-3 rounded-xl border border-neon-error/40 bg-neon-error/10 px-3 py-2 text-xs text-neon-error">
      {cron.erro}
    </p>
  );
}
