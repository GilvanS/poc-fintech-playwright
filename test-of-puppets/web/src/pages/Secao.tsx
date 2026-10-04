import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { itemPorChave, type ChaveItem } from '../shell/menu.ts';

interface Props {
  chave: ChaveItem;
}

/**
 * Página provisória de cada item do menu. Mostra o título da seção e o botão "Atualizar"
 * como no Admin; o conteúdo de verdade chega nas tarefas indicadas no cartão.
 */
export default function Secao({ chave }: Props) {
  const { rotulo, icone: Icone, tarefa } = itemPorChave(chave);
  const [atualizando, setAtualizando] = useState(false);

  useEffect(() => {
    if (!atualizando) return;
    const t = setTimeout(() => setAtualizando(false), 700);
    return () => clearTimeout(t);
  }, [atualizando]);

  return (
    <section aria-label={rotulo} className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-4">
        <h2 className="flex items-center gap-3 text-xl font-black uppercase tracking-tight text-on-surface">
          <Icone size={22} className="text-volt-green" aria-hidden />
          {rotulo}
        </h2>
        <button
          type="button"
          onClick={() => setAtualizando(true)}
          disabled={atualizando}
          className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/5 text-sm font-bold text-on-surface-variant hover:bg-white/10 disabled:opacity-60 cursor-pointer"
        >
          <RefreshCw size={16} className={atualizando ? 'animate-spin' : ''} aria-hidden />
          Atualizar
        </button>
      </div>

      <div className="rounded-3xl border border-white/10 bg-volt-surface/80 backdrop-blur-sm p-8">
        <p className="text-lg font-black text-on-surface">Em construção</p>
        <p className="mt-2 text-sm text-on-surface-variant">
          Esta tela será entregue na tarefa <span className="font-mono text-volt-green">{tarefa}</span> do plano.
        </p>
      </div>
    </section>
  );
}
