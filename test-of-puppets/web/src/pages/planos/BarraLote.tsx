import { useState } from 'react';
import { X } from 'lucide-react';
import { usePessoas } from '../../pessoas/ContextoPessoas.tsx';
import type { CamposItem, Prioridade } from './clientePlanos.ts';
import { SEM_VALOR } from './filtros.ts';

interface Props {
  quantidade: number;
  /** "Remover do plano" só vale para testes que ainda não começaram. */
  podeRemover: boolean;
  /** Só traz os campos escolhidos; `null` limpa o campo nos testes marcados. */
  onAplicar: (campos: Pick<CamposItem, 'responsavel' | 'prioridade'>) => void;
  onRemover: () => void;
  onLimpar: () => void;
}

const campo =
  'rounded-lg border border-white/10 bg-volt-page px-2 py-1.5 text-xs text-on-surface outline-none focus:border-volt-green/50';

/** Barra que aparece quando há testes marcados na lista (V0): atribuir, prioridade e remover do plano. */
export default function BarraLote({ quantidade, podeRemover, onAplicar, onRemover, onLimpar }: Props) {
  const { ativas } = usePessoas();
  const [responsavel, setResponsavel] = useState('');
  const [prioridade, setPrioridade] = useState('');

  const aplicar = () => {
    const campos: Pick<CamposItem, 'responsavel' | 'prioridade'> = {};
    if (responsavel) campos.responsavel = responsavel === SEM_VALOR ? null : responsavel;
    if (prioridade) campos.prioridade = prioridade === SEM_VALOR ? null : (prioridade as Prioridade);
    onAplicar(campos);
    setResponsavel('');
    setPrioridade('');
  };

  return (
    <div role="region" aria-label="Ações em lote" className="flex flex-wrap items-end gap-3 rounded-2xl border border-volt-green/30 bg-volt-surface px-4 py-3 text-xs">
      <span className="pb-2 font-black text-volt-green">{`${quantidade} ${quantidade === 1 ? 'selecionado' : 'selecionados'}`}</span>
      <label className="flex flex-col gap-1 font-bold text-on-surface-variant">
        Atribuir a
        <select value={responsavel} onChange={(e) => setResponsavel(e.target.value)} className={campo}>
          <option value="">Manter</option>
          <option value={SEM_VALOR}>Remover responsável</option>
          {ativas.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 font-bold text-on-surface-variant">
        Definir prioridade
        <select value={prioridade} onChange={(e) => setPrioridade(e.target.value)} className={campo}>
          <option value="">Manter</option>
          <option value="P1">P1</option>
          <option value="P2">P2</option>
          <option value="P3">P3</option>
          <option value={SEM_VALOR}>Sem prioridade</option>
        </select>
      </label>
      <button
        type="button"
        onClick={aplicar}
        disabled={!responsavel && !prioridade}
        className="px-4 py-2 rounded-xl bg-volt-green text-black font-black disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
      >
        Aplicar
      </button>
      {podeRemover && (
        <button type="button" onClick={onRemover} className="px-4 py-2 rounded-xl border border-neon-error/40 bg-neon-error/20 text-neon-error font-black hover:bg-neon-error/30 cursor-pointer">
          Remover do plano
        </button>
      )}
      <button type="button" onClick={onLimpar} aria-label="Limpar seleção" className="ml-auto p-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 cursor-pointer">
        <X size={14} aria-hidden />
      </button>
    </div>
  );
}
