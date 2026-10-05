import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { EntradaFinalizar, ItemPlano, Resultado } from '../pages/planos/clientePlanos.ts';

interface Props {
  item: ItemPlano;
  /** Tempo medido pelo cronômetro (já sem as pausas), em minutos: vem preenchido e a pessoa pode corrigir. */
  minutosSugeridos: number;
  onRegistrar: (entrada: EntradaFinalizar) => Promise<void>;
  onFechar: () => void;
}

const campo = 'w-full rounded-lg border border-white/10 bg-volt-page px-3 py-2 text-sm text-on-surface outline-none focus:border-volt-green/50';

/** ■ Finalizar: a pessoa roda o teste por fora e aqui registra o resultado, o tempo e uma observação. */
export default function FinalizarModal({ item, minutosSugeridos, onRegistrar, onFechar }: Props) {
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [minutos, setMinutos] = useState(String(minutosSugeridos));
  const [observacoes, setObservacoes] = useState(item.observacoes ?? '');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const janela = useRef<HTMLDivElement>(null);

  useEffect(() => {
    janela.current?.focus();
    // O Esc fecha só este modal (captura na window: o detalhe do plano, por baixo, não recebe o mesmo Esc).
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onFechar();
    };
    window.addEventListener('keydown', aoTeclar, true);
    return () => window.removeEventListener('keydown', aoTeclar, true);
  }, [onFechar]);

  const registrar = async () => {
    const n = Number(minutos);
    if (!resultado) return setErro('Escolha o resultado: passou ou falhou.');
    if (minutos.trim() === '' || !Number.isInteger(n) || n < 0 || n > 100000) return setErro('Tempo deve ser um número inteiro de minutos (0 a 100000).');
    setSalvando(true);
    setErro(null);
    await onRegistrar({ resultado, tempoRealMin: n, ...(observacoes.trim() ? { observacoes: observacoes.trim() } : {}) });
    setSalvando(false);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div
        ref={janela}
        role="dialog"
        aria-modal="true"
        aria-label="Registrar resultado"
        tabIndex={-1}
        className="w-full max-w-md flex flex-col gap-4 rounded-3xl bg-[#1a1a1a] border border-white/10 p-6 text-on-surface outline-none"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-lg font-black tracking-tight">{`Registrar ${item.idCenario}`}</h2>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="p-1 opacity-60 hover:opacity-100 cursor-pointer">
            <X size={20} />
          </button>
        </div>

        <fieldset className="flex gap-3">
          <legend className="mb-2 text-xs font-bold text-on-surface-variant">Resultado</legend>
          {(['passou', 'falhou'] as const).map((r) => (
            <label
              key={r}
              className={`flex flex-1 cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold ${
                resultado === r ? (r === 'passou' ? 'border-volt-green/60 bg-volt-green/10 text-volt-green' : 'border-neon-error/60 bg-neon-error/10 text-neon-error') : 'border-white/10 bg-white/5'
              }`}
            >
              <input type="radio" name="resultado" value={r} checked={resultado === r} onChange={() => setResultado(r)} className="accent-volt-green" />
              {r === 'passou' ? 'Passou' : 'Falhou'}
            </label>
          ))}
        </fieldset>

        <div>
          <label htmlFor="fin-tempo" className="mb-1 block text-xs font-bold text-on-surface-variant">Tempo gasto (minutos)</label>
          <input id="fin-tempo" type="number" min={0} value={minutos} onChange={(e) => setMinutos(e.target.value)} className={campo} />
          <p className="mt-1 text-[11px] text-on-surface-variant">{`Cronômetro marcou ${minutosSugeridos} min (sem as pausas). Corrija se precisar.`}</p>
        </div>

        <div>
          <label htmlFor="fin-obs" className="mb-1 block text-xs font-bold text-on-surface-variant">Observações</label>
          <textarea id="fin-obs" rows={3} maxLength={1000} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} className={campo} />
        </div>

        {erro && (
          <p role="alert" className="text-xs text-neon-error">
            {erro}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onFechar} className="px-4 py-2.5 rounded-xl text-xs font-bold bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer">
            Cancelar
          </button>
          <button type="button" onClick={() => void registrar()} disabled={salvando} className="px-4 py-2.5 rounded-xl text-xs font-black bg-volt-green text-black disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed">
            Registrar
          </button>
        </div>
      </div>
    </div>
  );
}
