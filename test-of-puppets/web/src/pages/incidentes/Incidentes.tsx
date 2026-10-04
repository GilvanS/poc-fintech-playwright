import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import {
  editarIncidente,
  ROTULO_SEVERIDADE,
  ROTULO_STATUS_INC,
  STATUS_INC,
  type Incidente,
  type Severidade,
  type StatusInc,
} from '../../incidentes/clienteIncidentes.ts';
import { useIncidentes } from '../../incidentes/ContextoIncidentes.tsx';
import RegistrarIncModal from '../../incidentes/RegistrarIncModal.tsx';
import VincularIncModal from '../../incidentes/VincularIncModal.tsx';
import { usePessoas } from '../../pessoas/ContextoPessoas.tsx';
import { itemPorChave } from '../../shell/menu.ts';
import { ErroApi, listarCenarios } from '../cenarios/clienteApi.ts';
import { formatarData, hojeISO } from '../planos/datas.ts';
import {
  filtrarIncidentes,
  haQuanto,
  ordenarIncidentes,
  resumirIncidentes,
  SEM_FILTRO_INC,
  textoDoResumo,
  type FiltroInc,
} from './calculoIncidentes.ts';
import PainelIncidente from './PainelIncidente.tsx';

interface Props {
  /** Data de "hoje" (aaaa-mm-dd); só os testes passam isto. */
  hoje?: string;
}

const botao =
  'flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/5 text-sm font-bold text-on-surface-variant hover:bg-white/10 disabled:opacity-60 cursor-pointer';
const campo = 'rounded-lg border border-white/10 bg-volt-page px-2.5 py-2 text-xs text-on-surface outline-none focus:border-volt-green/50';
const COR_SEVERIDADE: Record<Severidade, string> = {
  alta: 'border-neon-error/50 text-neon-error',
  media: 'border-[#FFD700]/50 text-[#FFD700]',
  baixa: 'border-[#A2FF00]/50 text-[#A2FF00]',
};

function Selo({ severidade }: { severidade: Severidade }) {
  return <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black ${COR_SEVERIDADE[severidade]}`}>{ROTULO_SEVERIDADE[severidade]}</span>;
}

/**
 * Incidentes (V3): triagem dos INC. Quadro por status (arrastar muda o status), tabela, resumo e o painel lateral
 * de cada INC. Os INC são registrados fora da ferramenta; aqui só se acompanha quem cuida, a gravidade e o que travam.
 */
export default function Incidentes({ hoje: hojeProp }: Props) {
  const hoje = hojeProp ?? hojeISO();
  const { rotulo, icone: Icone } = itemPorChave('incidentes');
  const { incidentes, recarregar } = useIncidentes();
  const { ativas, voce, nome } = usePessoas();
  const [filtro, setFiltro] = useState<FiltroInc>(SEM_FILTRO_INC);
  const [catalogo, setCatalogo] = useState<{ idCenario: string; nome?: string }[]>([]);
  const [aberto, setAberto] = useState<string | null>(null);
  const [registrando, setRegistrando] = useState(false);
  const [vinculando, setVinculando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [atualizando, setAtualizando] = useState(false);
  const arrastando = useRef<string | null>(null);

  useEffect(() => {
    let vivo = true;
    listarCenarios()
      .then((r) => vivo && setCatalogo(r.cenarios.map((c) => ({ idCenario: c.idCenario, nome: c.nome }))))
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, []);

  const atualizar = useCallback(async () => {
    setAtualizando(true);
    await recarregar();
    setAtualizando(false);
  }, [recarregar]);

  const visiveis = useMemo(() => ordenarIncidentes(filtrarIncidentes(incidentes, filtro, voce?.id ?? null)), [incidentes, filtro, voce]);
  const resumo = useMemo(() => resumirIncidentes(incidentes), [incidentes]);
  const colunas = STATUS_INC.filter((s) => s !== 'resolvido' || filtro.mostrarResolvidos);
  const selecionado = incidentes.find((i) => i.numero === aberto) ?? null;
  const mudar = (parcial: Partial<FiltroInc>) => setFiltro((f) => ({ ...f, ...parcial }));

  const responsaveis = useMemo(
    () => [...new Set([...ativas.map((p) => p.id), ...incidentes.map((i) => i.responsavel).filter((r): r is string => Boolean(r))])],
    [ativas, incidentes],
  );

  const mudarStatus = async (inc: Incidente, status: StatusInc) => {
    if (inc.status === status) return;
    setErro(null);
    try {
      await editarIncidente(inc.numero, { versao: inc.versao, status, autor: voce?.id ?? null });
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Erro inesperado.');
    }
    await recarregar();
  };

  const soltar = (status: StatusInc) => {
    const inc = incidentes.find((i) => i.numero === arrastando.current);
    arrastando.current = null;
    if (inc) void mudarStatus(inc, status);
  };

  const afeta = (inc: Incidente) => (inc.testesAfetados.length === 0 ? '-' : inc.testesAfetados.join(' '));
  const resp = (inc: Incidente) => (inc.responsavel ? nome(inc.responsavel) : '-');

  return (
    <section aria-label={rotulo} className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="flex items-center gap-3 text-xl font-black uppercase tracking-tight text-on-surface">
          <Icone size={22} className="text-volt-green" aria-hidden />
          {rotulo}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setRegistrando(true)} className="flex items-center gap-2 px-4 py-2 rounded-full bg-volt-green text-black text-sm font-black cursor-pointer">
            <Plus size={16} aria-hidden />
            Registrar INC
          </button>
          <button type="button" onClick={() => setVinculando(true)} className={botao}>
            Vincular INC existente
          </button>
          <button type="button" onClick={() => void atualizar()} disabled={atualizando} className={botao}>
            <RefreshCw size={16} className={atualizando ? 'animate-spin' : ''} aria-hidden />
            Atualizar
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs">
        <h3 className="font-black">{`Incidentes (${visiveis.length})`}</h3>
        <label className="flex items-center gap-2 font-bold text-on-surface-variant">
          Buscar
          <input type="search" value={filtro.texto} onChange={(e) => mudar({ texto: e.target.value })} className={`${campo} w-44`} />
        </label>
        <label className="flex items-center gap-2 font-bold text-on-surface-variant">
          Severidade
          <select value={filtro.severidade} onChange={(e) => mudar({ severidade: e.target.value as FiltroInc['severidade'] })} className={campo}>
            <option value="">Todas</option>
            <option value="alta">Alta</option>
            <option value="media">Média</option>
            <option value="baixa">Baixa</option>
          </select>
        </label>
        <label className="flex items-center gap-2 font-bold text-on-surface-variant">
          Resp.
          <select value={filtro.responsavel} onChange={(e) => mudar({ responsavel: e.target.value })} className={campo}>
            <option value="">Todos</option>
            {responsaveis.map((id) => (
              <option key={id} value={id}>
                {nome(id)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 font-bold text-on-surface-variant">
          <input type="checkbox" checked={filtro.mostrarResolvidos} onChange={(e) => mudar({ mostrarResolvidos: e.target.checked })} className="accent-volt-green" />
          Mostrar resolvidos
        </label>
        <label className={`flex items-center gap-2 font-bold text-on-surface-variant ${voce ? '' : 'opacity-50'}`}>
          <input type="checkbox" checked={filtro.somenteMeus} disabled={!voce} onChange={(e) => mudar({ somenteMeus: e.target.checked })} className="accent-volt-green" />
          Só meus
        </label>
      </div>

      {erro && (
        <p role="alert" className="rounded-xl border border-neon-error/40 bg-neon-error/10 px-3 py-2 text-xs text-neon-error">
          {erro}
        </p>
      )}

      {incidentes.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-volt-surface/80 p-8 text-center text-sm text-on-surface-variant">
          <p>Nenhum incidente</p>
          <p className="mt-1 text-xs">Registre o número do INC que você abriu e os testes que ele trava.</p>
        </div>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-3">
            {colunas.map((status) => {
              const daColuna = visiveis.filter((i) => i.status === status);
              return (
                <div
                  key={status}
                  data-testid={`coluna-inc-${status}`}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    soltar(status);
                  }}
                  className="flex min-h-40 flex-col gap-2 rounded-2xl border border-white/10 bg-white/5 p-3"
                >
                  <h3 className="text-[11px] font-black uppercase tracking-wide text-on-surface-variant">{`${ROTULO_STATUS_INC[status]} (${daColuna.length})`}</h3>
                  {daColuna.length === 0 && <p className="py-4 text-center text-xs text-on-surface-variant">Nenhum incidente</p>}
                  {daColuna.map((inc) => (
                    <article
                      key={inc.numero}
                      data-testid={`card-inc-${inc.numero}`}
                      draggable
                      onDragStart={() => {
                        arrastando.current = inc.numero;
                      }}
                      className="flex cursor-grab flex-col gap-1.5 rounded-xl border border-white/10 bg-volt-surface p-3 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <button type="button" onClick={() => setAberto(inc.numero)} aria-label={`Abrir ${inc.numero}`} className="font-mono font-black text-volt-green hover:underline cursor-pointer">
                          {inc.numero}
                        </button>
                        <Selo severidade={inc.severidade} />
                      </div>
                      <span className="font-bold leading-snug">{inc.titulo}</span>
                      <span className="text-on-surface-variant">{`Afeta: ${afeta(inc)}`}</span>
                      <span className="text-on-surface-variant">{`Resp.: ${resp(inc)} · ${haQuanto(inc, hoje)}`}</span>
                      <select
                        aria-label={`Status de ${inc.numero}`}
                        value={inc.status}
                        onChange={(e) => void mudarStatus(inc, e.target.value as StatusInc)}
                        className={`${campo} w-full`}
                      >
                        {STATUS_INC.map((s) => (
                          <option key={s} value={s}>
                            {ROTULO_STATUS_INC[s]}
                          </option>
                        ))}
                      </select>
                    </article>
                  ))}
                </div>
              );
            })}
          </div>

          <div className="overflow-x-auto rounded-2xl border border-white/10 bg-volt-surface/80">
            <table className="w-full min-w-[44rem] text-xs">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-on-surface-variant">
                  <th className="px-3 py-2">INC</th>
                  <th className="px-3 py-2">Sev.</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Título</th>
                  <th className="px-3 py-2">Afeta</th>
                  <th className="px-3 py-2">Resp.</th>
                  <th className="px-3 py-2">Aberto</th>
                  <th className="px-3 py-2">Há</th>
                </tr>
              </thead>
              <tbody>
                {visiveis.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-6 text-center text-on-surface-variant">Nenhum incidente com estes filtros</td>
                  </tr>
                )}
                {visiveis.map((inc) => (
                  <tr key={inc.numero} data-testid={`linha-inc-${inc.numero}`} className="border-t border-white/5">
                    <td className="px-3 py-2">
                      <button type="button" onClick={() => setAberto(inc.numero)} aria-label={`Abrir ${inc.numero} na tabela`} className="font-mono font-black text-volt-green hover:underline cursor-pointer">
                        {inc.numero}
                      </button>
                    </td>
                    <td className="px-3 py-2"><Selo severidade={inc.severidade} /></td>
                    <td className="px-3 py-2">{ROTULO_STATUS_INC[inc.status]}</td>
                    <td className="px-3 py-2">{inc.titulo}</td>
                    <td className="px-3 py-2 font-mono text-[11px]">{afeta(inc)}</td>
                    <td className="px-3 py-2">{resp(inc)}</td>
                    <td className="px-3 py-2">{formatarData(inc.abertoEm)}</td>
                    <td className="px-3 py-2 text-on-surface-variant">{haQuanto(inc, hoje)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <p data-testid="resumo-inc" className="text-xs font-bold text-on-surface-variant">{textoDoResumo(resumo)}</p>

      {selecionado && <PainelIncidente key={selecionado.numero} inc={selecionado} opcoesTestes={catalogo} onMudou={recarregar} onFechar={() => setAberto(null)} />}
      {registrando && (
        <RegistrarIncModal
          testes={catalogo}
          onFechar={() => setRegistrando(false)}
          onRegistrado={async () => {
            setRegistrando(false);
            await recarregar();
          }}
        />
      )}
      {vinculando && (
        <VincularIncModal
          testes={catalogo}
          onFechar={() => setVinculando(false)}
          onVinculado={async () => {
            setVinculando(false);
            await recarregar();
          }}
        />
      )}
    </section>
  );
}
