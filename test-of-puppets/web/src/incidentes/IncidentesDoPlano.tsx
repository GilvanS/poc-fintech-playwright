import { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { usePessoas } from '../pessoas/ContextoPessoas.tsx';
import { ErroApi } from '../pages/cenarios/clienteApi.ts';
import type { ItemPlano } from '../pages/planos/clientePlanos.ts';
import { formatarData } from '../pages/planos/datas.ts';
import { desvincularIncidente, ROTULO_SEVERIDADE, ROTULO_STATUS_INC, type Incidente, type Severidade, type StatusInc } from './clienteIncidentes.ts';
import { useIncidentes } from './ContextoIncidentes.tsx';
import RegistrarIncModal from './RegistrarIncModal.tsx';
import VincularIncModal from './VincularIncModal.tsx';

interface Props {
  itens: ItemPlano[];
  onAbrirTeste: (idCenario: string) => void;
  /** Avisa o pai quando um modal ou a confirmação está aberto (o Esc deles não deve fechar o plano). */
  onCamada: (aberta: boolean) => void;
}

const COR_SEVERIDADE: Record<Severidade, string> = {
  alta: 'border-neon-error/50 text-neon-error',
  media: 'border-[#FFD700]/50 text-[#FFD700]',
  baixa: 'border-[#A2FF00]/50 text-[#A2FF00]',
};
const COR_STATUS: Record<StatusInc, string> = {
  novo: 'border-white/20 text-on-surface-variant',
  em_analise: 'border-[#00E5FF]/50 text-[#00E5FF]',
  resolvido: 'border-volt-green/50 text-volt-green',
};
const ORDEM_SEVERIDADE: Record<Severidade, number> = { alta: 0, media: 1, baixa: 2 };

/** Aba "Incidentes (n)" do plano: os INC que afetam algum teste do plano, com registrar, vincular e desvincular. */
export default function IncidentesDoPlano({ itens, onAbrirTeste, onCamada }: Props) {
  const { incidentes, recarregar } = useIncidentes();
  const { voce, nome } = usePessoas();
  const [registrando, setRegistrando] = useState(false);
  const [vinculando, setVinculando] = useState(false);
  const [desvincular, setDesvincular] = useState<{ inc: Incidente; ids: string[] } | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const idsDoPlano = useMemo(() => new Set(itens.map((i) => i.idCenario)), [itens]);
  const doPlano = useMemo(
    () =>
      incidentes
        .filter((i) => i.testesAfetados.some((t) => idsDoPlano.has(t)))
        .sort((a, b) => ORDEM_SEVERIDADE[a.severidade] - ORDEM_SEVERIDADE[b.severidade] || b.abertoEm.localeCompare(a.abertoEm)),
    [incidentes, idsDoPlano],
  );

  const camadaAberta = registrando || vinculando || desvincular !== null;
  useEffect(() => {
    onCamada(camadaAberta);
    return () => onCamada(false);
  }, [camadaAberta, onCamada]);

  useEffect(() => {
    if (!desvincular) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDesvincular(null);
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [desvincular]);

  const opcoes = itens.map((i) => ({ idCenario: i.idCenario, nome: i.nome }));

  const confirmarDesvinculo = async () => {
    if (!desvincular) return;
    const { inc, ids } = desvincular;
    setDesvincular(null);
    setErro(null);
    try {
      for (const id of ids) await desvincularIncidente(inc.numero, id, voce?.id ?? null);
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Erro inesperado.');
    }
    await recarregar();
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-black uppercase tracking-wide">Incidentes do Plano</h3>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setRegistrando(true)} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-volt-green text-black text-xs font-black cursor-pointer">
            <Plus size={14} aria-hidden />
            Registrar INC
          </button>
          <button type="button" onClick={() => setVinculando(true)} className="px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-xs font-bold hover:bg-white/10 cursor-pointer">
            Vincular INC existente
          </button>
        </div>
      </div>

      {erro && (
        <p role="alert" className="rounded-xl border border-neon-error/40 bg-neon-error/10 px-3 py-2 text-xs text-neon-error">
          {erro}
        </p>
      )}

      {doPlano.length === 0 ? (
        <p className="py-6 text-center text-sm text-on-surface-variant">Nenhum incidente afeta os testes deste plano</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-xs">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-on-surface-variant">
                <th className="py-2 pr-3">INC</th>
                <th className="py-2 pr-3">Título</th>
                <th className="py-2 pr-3">Sev.</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Registro</th>
                <th className="py-2 pr-3">Resp.</th>
                <th className="py-2 pr-3">Testes afetados</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {doPlano.map((inc) => {
                const nesteTeste = inc.testesAfetados.filter((t) => idsDoPlano.has(t));
                return (
                  <tr key={inc.numero} data-testid={`inc-${inc.numero}`} className="border-t border-white/5 align-top">
                    <td className="py-2 pr-3 font-mono font-black text-volt-green">{inc.numero}</td>
                    <td className="py-2 pr-3">{inc.titulo}</td>
                    <td className="py-2 pr-3">
                      <span className={`rounded-full border px-2 py-0.5 font-black ${COR_SEVERIDADE[inc.severidade]}`}>{ROTULO_SEVERIDADE[inc.severidade]}</span>
                    </td>
                    <td className="py-2 pr-3">
                      <span className={`rounded-full border px-2 py-0.5 font-black ${COR_STATUS[inc.status]}`}>{ROTULO_STATUS_INC[inc.status]}</span>
                    </td>
                    <td className="py-2 pr-3 text-on-surface-variant">{formatarData(inc.abertoEm)}</td>
                    <td className="py-2 pr-3 text-on-surface-variant">{inc.responsavel ? nome(inc.responsavel) : '-'}</td>
                    <td className="py-2 pr-3">
                      <div className="flex flex-wrap gap-1">
                        {inc.testesAfetados.map((t) =>
                          idsDoPlano.has(t) ? (
                            <button key={t} type="button" onClick={() => onAbrirTeste(t)} aria-label={`Abrir ${t}`} className="rounded-full border border-volt-green/30 bg-volt-green/10 px-2 py-0.5 font-mono text-[11px] text-volt-green hover:bg-volt-green/20 cursor-pointer">
                              {t}
                            </button>
                          ) : (
                            <span key={t} className="rounded-full border border-white/10 px-2 py-0.5 font-mono text-[11px] text-on-surface-variant" title="Teste que não está neste plano">
                              {t}
                            </span>
                          ),
                        )}
                      </div>
                    </td>
                    <td className="py-2 text-right">
                      <button
                        type="button"
                        onClick={() => setDesvincular({ inc, ids: nesteTeste })}
                        aria-label={`Desvincular ${inc.numero}`}
                        className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 font-bold hover:bg-white/10 cursor-pointer"
                      >
                        Desvincular
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {registrando && (
        <RegistrarIncModal
          testes={opcoes}
          onFechar={() => setRegistrando(false)}
          onRegistrado={async () => {
            setRegistrando(false);
            await recarregar();
          }}
        />
      )}
      {vinculando && (
        <VincularIncModal
          testes={opcoes}
          onFechar={() => setVinculando(false)}
          onVinculado={async () => {
            setVinculando(false);
            await recarregar();
          }}
        />
      )}
      {desvincular && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div role="alertdialog" aria-modal="true" aria-label="Confirmar desvínculo" className="w-full max-w-sm p-6 rounded-3xl bg-[#1a1a1a] border border-white/10 text-on-surface">
            <p className="text-sm font-bold">{`Desvincular ${desvincular.inc.numero} dos testes deste plano (${desvincular.ids.join(', ')})?`}</p>
            <p className="mt-2 text-xs text-on-surface-variant">O INC continua registrado; só deixa de afetar esses testes.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setDesvincular(null)} className="px-4 py-2.5 rounded-xl text-xs font-bold bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer">
                Manter
              </button>
              <button type="button" onClick={() => void confirmarDesvinculo()} className="px-4 py-2.5 rounded-xl text-xs font-black bg-neon-error text-black cursor-pointer">
                Desvincular
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
