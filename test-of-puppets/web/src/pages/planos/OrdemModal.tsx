import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, GripVertical, ListOrdered, Lock, X } from 'lucide-react';
import { ErroApi } from '../cenarios/clienteApi.ts';
import type { ItemPlano } from './clientePlanos.ts';
import { corrigir, mover, ordenarPor, regraDoItem, violacoes } from './ordem.ts';

interface Props {
  planoNome: string;
  /** Testes do plano na ordem de execução de hoje. */
  itens: ItemPlano[];
  onSalvar: (ordem: string[]) => Promise<void>;
  onFechar: () => void;
}

type Criterio = 'manual' | 'prioridade' | 'data';

const botaoSeta =
  'p-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-white/5 cursor-pointer disabled:cursor-not-allowed';

/** Modal "Ordem de execução": ▲▼ ou arrastar a alça ≡; o cadeado impede passar da dependência de mesma massa. */
export default function OrdemModal({ planoNome, itens, onSalvar, onFechar }: Props) {
  const [lista, setLista] = useState<ItemPlano[]>(itens);
  const [criterio, setCriterio] = useState<Criterio>('manual');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const arrastando = useRef<number | null>(null);
  const janela = useRef<HTMLDivElement>(null);

  useEffect(() => {
    janela.current?.focus();
  }, []);

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFechar();
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [onFechar]);

  const problemas = useMemo(() => violacoes(lista), [lista]);
  const mudou = lista.some((i, p) => i.idCenario !== itens[p]?.idCenario);
  const temRegra = itens.some((i) => i.dependeDe.some((d) => itens.some((o) => o.idCenario === d)));

  const aplicar = (nova: ItemPlano[] | null) => {
    if (!nova) return;
    setLista(nova);
    setCriterio('manual');
    setErro(null);
  };

  const escolherCriterio = (valor: Criterio) => {
    setCriterio(valor);
    setErro(null);
    setLista(valor === 'manual' ? itens : ordenarPor(itens, valor === 'data' ? 'data' : 'prioridade'));
  };

  const salvar = async () => {
    setSalvando(true);
    setErro(null);
    try {
      await onSalvar(lista.map((i) => i.idCenario));
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Não foi possível salvar a ordem.');
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div
        ref={janela}
        role="dialog"
        aria-modal="true"
        aria-label="Ordem de execução"
        tabIndex={-1}
        className="w-full max-w-3xl max-h-[92vh] flex flex-col rounded-3xl bg-[#1a1a1a] border border-white/10 text-on-surface outline-none"
      >
        <div className="flex items-center justify-between p-5 pb-3">
          <div className="flex items-center gap-2 font-black uppercase text-sm">
            <ListOrdered size={18} className="text-volt-green" aria-hidden />
            <span>{`Ordem de execução · Plano ${planoNome}`}</span>
          </div>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="p-1 opacity-60 hover:opacity-100 cursor-pointer">
            <X size={20} />
          </button>
        </div>

        <div className="px-5 flex flex-wrap items-center justify-between gap-3 text-xs text-on-surface-variant">
          <p>Arraste ≡ ou use ▲ ▼. O número é a ordem em que os testes serão executados.</p>
          <label className="flex items-center gap-2 font-bold">
            Ordenar por
            <select
              value={criterio}
              onChange={(e) => escolherCriterio(e.target.value as Criterio)}
              className="rounded-xl border border-white/10 bg-volt-page px-2.5 py-1.5 text-xs text-on-surface outline-none focus:border-volt-green/50"
            >
              <option value="manual">Manual (ordem salva)</option>
              <option value="data">Data planejada</option>
              <option value="prioridade">Prioridade</option>
            </select>
          </label>
        </div>

        <div className="px-5 pt-3 overflow-y-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-on-surface-variant">
                <th className="py-2 pr-2 font-bold w-8">#</th>
                <th className="py-2 pr-2 w-6">
                  <span className="sr-only">Arrastar</span>
                </th>
                <th className="py-2 pr-3 font-bold">Teste</th>
                <th className="py-2 pr-3 font-bold">Massa</th>
                <th className="py-2 pr-3 font-bold">Regra</th>
                <th className="py-2 font-bold text-right">
                  <span className="sr-only">Mover</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {lista.map((item, indice) => {
                const regra = regraDoItem(lista, item.idCenario);
                return (
                  <tr
                    key={item.idCenario}
                    data-testid={`linha-${item.idCenario}`}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (arrastando.current !== null) aplicar(mover(lista, arrastando.current, indice));
                      arrastando.current = null;
                    }}
                    className="border-t border-white/10 align-middle"
                  >
                    <td className="py-2.5 pr-2 font-mono text-volt-green">{indice + 1}</td>
                    <td className="py-2.5 pr-2">
                      <span
                        role="img"
                        aria-label={`Arrastar ${item.idCenario}`}
                        draggable
                        onDragStart={() => {
                          arrastando.current = indice;
                        }}
                        className="inline-flex cursor-grab text-on-surface-variant"
                      >
                        <GripVertical size={16} aria-hidden />
                      </span>
                    </td>
                    <td className="py-2.5 pr-3">
                      <div className="font-mono text-xs text-volt-green">{item.idCenario}</div>
                      <div>{item.nome ?? '-'}</div>
                    </td>
                    <td className="py-2.5 pr-3 font-mono">{item.idMassa ?? '-'}</td>
                    <td className="py-2.5 pr-3 text-[11px] text-on-surface-variant">
                      <div className="flex flex-col gap-0.5">
                        {regra.libera.length > 0 && (
                          <span className="flex items-center gap-1">
                            <Lock size={11} aria-hidden />
                            {`libera o ${regra.libera.join(', ')}`}
                          </span>
                        )}
                        {regra.depoisDe.length > 0 && (
                          <span className="flex items-center gap-1">
                            <Lock size={11} aria-hidden />
                            {`depois do ${regra.depoisDe.join(', ')}`}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5">
                      <div className="flex justify-end gap-1">
                        <button type="button" aria-label={`Subir ${item.idCenario}`} disabled={mover(lista, indice, indice - 1) === null} onClick={() => aplicar(mover(lista, indice, indice - 1))} className={botaoSeta}>
                          <ChevronUp size={14} aria-hidden />
                        </button>
                        <button type="button" aria-label={`Descer ${item.idCenario}`} disabled={mover(lista, indice, indice + 1) === null} onClick={() => aplicar(mover(lista, indice, indice + 1))} className={botaoSeta}>
                          <ChevronDown size={14} aria-hidden />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="p-5 pt-3 flex flex-col gap-3">
          {problemas.length > 0 && (
            <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neon-error/40 bg-neon-error/10 px-3 py-2 text-xs text-neon-error">
              <span>
                {`Ordem inválida: ${problemas.map((p) => `${p.dependencia} precisa ficar antes de ${p.dependente}`).join('; ')}.`}
              </span>
              <button type="button" onClick={() => aplicar(corrigir(lista))} className="px-3 py-1.5 rounded-lg bg-white/10 font-bold text-on-surface hover:bg-white/20 cursor-pointer">
                Corrigir sozinho
              </button>
            </div>
          )}
          {erro && (
            <p role="alert" className="rounded-xl border border-neon-error/40 bg-neon-error/10 px-3 py-2 text-xs text-neon-error">
              {erro}
            </p>
          )}
          {temRegra && (
            <p className="flex items-center gap-1.5 text-[11px] text-on-surface-variant">
              <Lock size={12} aria-hidden />
              Mesma massa: o teste com cadeado nunca passa do teste de que depende (detectado sozinho).
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onFechar} className="px-4 py-2.5 rounded-xl text-xs font-bold bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer">
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void salvar()}
              disabled={!mudou || problemas.length > 0 || salvando}
              className="px-4 py-2.5 rounded-xl text-xs font-black bg-volt-green text-black disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            >
              Salvar a ordem
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
