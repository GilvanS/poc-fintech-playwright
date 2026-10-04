import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Settings2, X } from 'lucide-react';
import type { Wip } from '../../config/clienteConfig.ts';
import { ErroApi } from '../cenarios/clienteApi.ts';
import { ROTULO_STATUS, type Status } from './clientePlanos.ts';

interface Props {
  wip: Wip;
  onSalvar: (wip: Partial<Wip>) => Promise<void>;
  onFechar: () => void;
}

/** Só estas duas têm limite no V1-kanban.md; Agendado e Concluído ficam sempre sem limite. */
const EDITAVEIS: Status[] = ['em_andamento', 'refinamento'];

const campo =
  'w-24 rounded-lg border border-white/10 bg-volt-page px-2.5 py-2 text-sm text-on-surface outline-none focus:border-volt-green/50';

/** Modal M13 — Limites de WIP. Limite "macio": a coluna cheia só avisa na hora de soltar um card. */
export default function LimitesWipModal({ wip, onSalvar, onFechar }: Props) {
  const [valores, setValores] = useState<Record<string, string>>(() =>
    Object.fromEntries(EDITAVEIS.map((s) => [s, wip[s] === null ? '' : String(wip[s])])),
  );
  const [erros, setErros] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  const primeiro = useRef<HTMLInputElement>(null);

  useEffect(() => {
    primeiro.current?.focus();
  }, []);

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFechar();
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [onFechar]);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    const novo: Partial<Wip> = {};
    for (const s of EDITAVEIS) {
      const texto = valores[s].trim();
      novo[s] = texto === '' ? null : Number(texto);
    }
    setErros([]);
    setSalvando(true);
    try {
      await onSalvar(novo);
    } catch (erro) {
      setErros(erro instanceof ErroApi ? erro.mensagens : ['Não foi possível salvar os limites.']);
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <form
        role="dialog"
        aria-modal="true"
        aria-label="Limites de WIP"
        onSubmit={enviar}
        className="w-full max-w-md p-6 rounded-3xl bg-[#1a1a1a] border border-white/10 text-on-surface"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 font-black uppercase text-sm">
            <Settings2 size={18} className="text-volt-green" aria-hidden /> Limites de WIP
          </div>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="p-1 opacity-60 hover:opacity-100 cursor-pointer">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-3 text-sm">
            <span className="text-on-surface-variant">{ROTULO_STATUS.agendado}</span>
            <span className="text-xs text-on-surface-variant">sem limite</span>
            {EDITAVEIS.map((s, i) => (
              <div key={s} className="contents">
                <label htmlFor={`wip-${s}`}>{ROTULO_STATUS[s]}</label>
                <input
                  id={`wip-${s}`}
                  ref={i === 0 ? primeiro : undefined}
                  type="number"
                  min={1}
                  max={99}
                  step={1}
                  inputMode="numeric"
                  placeholder="sem limite"
                  value={valores[s]}
                  onChange={(e) => setValores((v) => ({ ...v, [s]: e.target.value }))}
                  className={campo}
                />
              </div>
            ))}
            <span className="text-on-surface-variant">{ROTULO_STATUS.concluido}</span>
            <span className="text-xs text-on-surface-variant">sem limite</span>
          </div>
          <p className="text-[11px] text-on-surface-variant">
            Limite “macio”: passou do número, a coluna avisa e o card ainda pode ser solto. Deixe vazio para não ter limite. Vale para todos os planos.
          </p>

          {erros.length > 0 && (
            <div role="alert" className="rounded-xl border border-neon-error/40 bg-neon-error/10 px-3 py-2 text-xs text-neon-error">
              <ul className="list-disc pl-4 space-y-0.5">
                {erros.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onFechar} className="px-4 py-2.5 rounded-xl text-xs font-bold bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer">
              Cancelar
            </button>
            <button type="submit" disabled={salvando} className="px-4 py-2.5 rounded-xl text-xs font-black bg-volt-green text-black disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed">
              Salvar
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
