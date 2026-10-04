import { X } from 'lucide-react';

interface Props {
  /** Os testes que podem ser escolhidos (os do plano aberto). */
  opcoes: { idCenario: string; nome?: string }[];
  marcados: string[];
  onChange: (ids: string[]) => void;
  rotulo?: string;
}

const campo =
  'rounded-lg border border-white/10 bg-volt-page px-2.5 py-2 text-xs text-on-surface outline-none focus:border-volt-green/50';

/** Testes escolhidos como chips com ✕ e um seletor para acrescentar mais. */
export default function SeletorTestes({ opcoes, marcados, onChange, rotulo = 'Testes afetados' }: Props) {
  const livres = opcoes.filter((o) => !marcados.includes(o.idCenario));
  return (
    <div>
      <span className="block mb-1 text-[11px] font-bold text-on-surface-variant">{rotulo}</span>
      <div className="flex flex-wrap items-center gap-2">
        {marcados.map((id) => (
          <span key={id} className="flex items-center gap-1 rounded-full border border-volt-green/30 bg-volt-green/10 px-2.5 py-1 font-mono text-[11px] text-volt-green">
            {id}
            <button type="button" onClick={() => onChange(marcados.filter((m) => m !== id))} aria-label={`Tirar ${id}`} className="opacity-70 hover:opacity-100 cursor-pointer">
              <X size={12} aria-hidden />
            </button>
          </span>
        ))}
        <select
          aria-label="Adicionar teste"
          value=""
          disabled={livres.length === 0}
          onChange={(e) => e.target.value && onChange([...marcados, e.target.value])}
          className={`${campo} disabled:opacity-50`}
        >
          <option value="">{livres.length === 0 ? 'Todos já escolhidos' : '+ adicionar teste'}</option>
          {livres.map((o) => (
            <option key={o.idCenario} value={o.idCenario}>
              {o.nome ? `${o.idCenario} · ${o.nome}` : o.idCenario}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
