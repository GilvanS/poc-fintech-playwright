import { Settings2 } from 'lucide-react';
import type { Wip } from '../../config/clienteConfig.ts';
import { ROTULO_STATUS, STATUS } from './clientePlanos.ts';

export type Agrupar = 'nenhum' | 'responsavel';

interface Props {
  wip: Wip;
  agrupar: Agrupar;
  onAgrupar: (agrupar: Agrupar) => void;
  onEditarLimites: () => void;
}

/** Faixa acima do Kanban: resumo dos limites de WIP, botão do M13 e o "Agrupar" (raias por responsável). */
export default function BarraKanban({ wip, agrupar, onAgrupar, onEditarLimites }: Props) {
  const comLimite = STATUS.filter((s) => wip[s] !== null);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <span data-testid="resumo-wip" className="text-on-surface-variant">
          {comLimite.length === 0 ? 'Limite WIP: sem limites' : `Limite WIP: ${comLimite.map((s) => `${ROTULO_STATUS[s]} ${wip[s]}`).join(' · ')}`}
        </span>
        <button
          type="button"
          onClick={onEditarLimites}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 font-bold hover:bg-white/10 cursor-pointer"
        >
          <Settings2 size={13} aria-hidden />
          Editar limites
        </button>
      </div>
      <label className="flex items-center gap-2 font-bold text-on-surface-variant">
        Agrupar
        <select
          value={agrupar}
          onChange={(e) => onAgrupar(e.target.value as Agrupar)}
          className="rounded-lg border border-white/10 bg-volt-page px-2.5 py-1.5 text-xs text-on-surface outline-none focus:border-volt-green/50"
        >
          <option value="nenhum">Nenhum</option>
          <option value="responsavel">Responsável</option>
        </select>
      </label>
    </div>
  );
}
