import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GripVertical, Plus, RefreshCw } from 'lucide-react';
import { usePessoas } from '../../pessoas/ContextoPessoas.tsx';
import { itemPorChave } from '../../shell/menu.ts';
import { ErroApi, listarCenarios, type CenarioVisao } from '../cenarios/clienteApi.ts';
import { incluirTestes, listarPlanos, obterPlano, type DetalhePlano } from '../planos/clientePlanos.ts';
import { formatarData, hojeISO } from '../planos/datas.ts';
import PlanoDetalhe from '../planos/PlanoDetalhe.tsx';
import {
  backlogDoCatalogo,
  burndown,
  capacidadeDoPeriodo,
  classificar,
  diaDaIteracao,
  estimadoDe,
  periodoDoPlano,
  projetar,
  realDe,
  variacaoReal,
  velocidadeMedia,
  type ItemDoBacklog,
} from './calculoIteracoes.ts';
import GraficoBurndown from './GraficoBurndown.tsx';

interface Props {
  /** Data de "hoje" (aaaa-mm-dd); só os testes passam isto. */
  hoje?: string;
  /** "+ Nova iteração" leva a Planos, onde fica o Novo Plano. */
  onIrParaPlanos: () => void;
}

type Papel = 'anterior' | 'atual' | 'proxima';

const botao =
  'flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/5 text-sm font-bold text-on-surface-variant hover:bg-white/10 disabled:opacity-60 cursor-pointer';
const campo = 'rounded-lg border border-white/10 bg-volt-page px-2.5 py-2 text-xs text-on-surface outline-none focus:border-volt-green/50';
const ROTULO: Record<Papel, string> = { anterior: 'Anterior', atual: 'Atual', proxima: 'Próxima' };
const BACKLOG_VISIVEL = 5;

const mensagemDe = (e: unknown) => (e instanceof ErroApi ? e.message : 'Erro inesperado.');
const diaMes = (iso: string) => formatarData(iso).slice(0, 5);
const virgula = (n: number) => String(n).replace('.', ',');
const diasUteis = (n: number) => `${n} ${n === 1 ? 'dia útil' : 'dias úteis'}`;

/**
 * Iterações (V6): cada plano é uma iteração. Mostra a anterior, a atual e a próxima, o burndown, a velocidade da
 * equipe e o backlog (cenários do catálogo fora de plano aberto) para mover para uma iteração.
 */
export default function Iteracoes({ hoje: hojeProp, onIrParaPlanos }: Props) {
  const hoje = hojeProp ?? hojeISO();
  const { rotulo, icone: Icone } = itemPorChave('iteracoes');
  const { pessoas } = usePessoas();
  const [planos, setPlanos] = useState<DetalhePlano[] | null>(null);
  const [catalogo, setCatalogo] = useState<CenarioVisao[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [atualizando, setAtualizando] = useState(false);
  const [planoBurn, setPlanoBurn] = useState('');
  const [destino, setDestino] = useState('');
  const [aberto, setAberto] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState<{ item: ItemDoBacklog; plano: DetalhePlano } | null>(null);
  const [backlogCompleto, setBacklogCompleto] = useState(false);
  const arrastando = useRef<ItemDoBacklog | null>(null);

  const carregar = useCallback(async () => {
    setAtualizando(true);
    try {
      const resumos = await listarPlanos();
      const [detalhes, cat] = await Promise.all([Promise.all(resumos.map((p) => obterPlano(p.id))), listarCenarios().catch(() => null)]);
      setPlanos(detalhes);
      setCatalogo(cat?.cenarios ?? []);
      setErro(null);
    } catch (e) {
      setErro(mensagemDe(e));
    } finally {
      setAtualizando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    if (!confirmar) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setConfirmar(null);
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [confirmar]);

  const todos = useMemo(() => planos ?? [], [planos]);
  const { anterior, atual, proxima } = useMemo(() => classificar(todos), [todos]);
  const cards: [Papel, DetalhePlano | null][] = [['anterior', anterior], ['atual', atual], ['proxima', proxima]];
  const abertos = todos.filter((p) => !p.resumo.executado);
  const fila = useMemo(() => backlogDoCatalogo(catalogo, todos), [catalogo, todos]);
  const filaVisivel = backlogCompleto ? fila : fila.slice(0, BACKLOG_VISIVEL);
  const velocidade = useMemo(() => velocidadeMedia(todos), [todos]);

  const planoDoBurndown = todos.find((p) => p.plano.id === planoBurn) ?? atual ?? proxima ?? anterior ?? todos[0] ?? null;
  const planoDestino = abertos.find((p) => p.plano.id === destino) ?? proxima ?? atual ?? null;

  const burn = useMemo(() => {
    if (!planoDoBurndown) return null;
    const { inicio, fim } = periodoDoPlano(planoDoBurndown);
    const bd = burndown(planoDoBurndown.itens, inicio, fim, hoje);
    return { bd, inicio, fim, projecao: planoDoBurndown.resumo.executado ? null : projetar(bd, inicio, fim, hoje) };
  }, [planoDoBurndown, hoje]);

  const incluir = async (item: ItemDoBacklog, plano: DetalhePlano) => {
    setAviso(null);
    setConfirmar(null);
    try {
      await incluirTestes(plano.plano.id, [item.idCenario]);
    } catch (e) {
      setAviso(mensagemDe(e));
    }
    await carregar();
  };

  /** Mover para a iteração em andamento aumenta o escopo: pede confirmação com os minutos a mais. */
  const mover = (item: ItemDoBacklog, plano: DetalhePlano | null) => {
    arrastando.current = null;
    if (!plano || plano.resumo.executado) return;
    if (plano.plano.id === atual?.plano.id) setConfirmar({ item, plano });
    else void incluir(item, plano);
  };

  const soltarNoCard = (papel: Papel, plano: DetalhePlano | null) => {
    if (papel === 'anterior' || !arrastando.current) return;
    mover(arrastando.current, plano);
  };

  const textoProjecao = () => {
    const p = burn?.projecao;
    if (!p) return null;
    if (p.tipo === 'concluido') return 'Todos os testes deste plano estão concluídos.';
    if (p.tipo === 'sem_ritmo') return 'Projeção indisponível: nenhum teste concluído ainda.';
    const prazo = p.atrasoDiasUteis > 0 ? `${diasUteis(p.atrasoDiasUteis)} após o alvo` : 'dentro do prazo';
    return `Projeção no ritmo atual (${virgula(p.ritmo)} teste/dia): termina ~${diaMes(p.termino)} (${prazo})`;
  };

  const cardDe = (papel: Papel, d: DetalhePlano | null) => {
    if (!d) {
      return (
        <section key={papel} aria-label={`Iteração ${ROTULO[papel].toLowerCase()}`} className="rounded-3xl border border-dashed border-white/15 p-5 flex flex-col gap-2 text-sm text-on-surface-variant">
          <span className="text-[11px] font-black uppercase tracking-wide">{ROTULO[papel]}</span>
          <span>{papel === 'proxima' ? 'Nenhuma iteração planejada.' : 'Nenhuma.'}</span>
          {papel === 'proxima' && (
            <button type="button" onClick={onIrParaPlanos} className="self-start text-xs font-bold text-volt-green hover:underline cursor-pointer">
              + Criar a próxima iteração
            </button>
          )}
        </section>
      );
    }
    const { inicio, fim } = periodoDoPlano(d);
    const estimado = estimadoDe(d.itens);
    const real = realDe(d.itens);
    const dia = papel === 'atual' ? diaDaIteracao(inicio, fim, hoje) : null;
    const variacao = papel === 'anterior' ? variacaoReal(estimado, real) : null;
    return (
      <section
        key={papel}
        aria-label={`Iteração ${ROTULO[papel].toLowerCase()}`}
        data-testid={`iteracao-${papel}`}
        onDragOver={(e) => papel !== 'anterior' && e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          soltarNoCard(papel, d);
        }}
        className="rounded-3xl border border-white/10 bg-volt-surface/80 backdrop-blur-sm p-5 flex flex-col gap-1.5 text-xs"
      >
        <span className="text-[11px] font-black uppercase tracking-wide text-on-surface-variant">{ROTULO[papel]}</span>
        <h3 className="text-lg font-black tracking-tight text-on-surface">{`Plano ${d.plano.nome}`}</h3>
        <span className="text-on-surface-variant">{`${diaMes(inicio)} → ${d.plano.previsao ? diaMes(fim) : '--'}${dia ? `  ·  dia ${dia.dia} de ${dia.total}` : ''}`}</span>
        <span>{d.resumo.total === 0 ? '0 testes' : `${d.resumo.concluidos} de ${d.resumo.total} concluídos`}</span>
        {papel === 'proxima' ? (
          <span>{`Capacidade ${capacidadeDoPeriodo(pessoas, inicio, fim)} min`}</span>
        ) : (
          <>
            <span>{`Estimado ${estimado} min`}</span>
            <span>
              {papel === 'atual' ? `Real até agora ${real} min` : `Real ${real} min`}
              {variacao !== null && ` (${variacao > 0 ? '+' : ''}${variacao}%)`}
            </span>
          </>
        )}
        <button type="button" onClick={() => setAberto(d.plano.id)} className="mt-2 self-start text-xs font-bold text-volt-green hover:underline cursor-pointer">
          Abrir plano
        </button>
      </section>
    );
  };

  return (
    <section aria-label={rotulo} className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="flex items-center gap-3 text-xl font-black uppercase tracking-tight text-on-surface">
          <Icone size={22} className="text-volt-green" aria-hidden />
          {rotulo}
        </h2>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onIrParaPlanos} className="flex items-center gap-2 px-4 py-2 rounded-full bg-volt-green text-black text-sm font-black cursor-pointer">
            <Plus size={16} aria-hidden />
            Nova iteração
          </button>
          <button type="button" onClick={() => void carregar()} disabled={atualizando} className={botao}>
            <RefreshCw size={16} className={atualizando ? 'animate-spin' : ''} aria-hidden />
            Atualizar
          </button>
        </div>
      </div>

      {erro && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-neon-error/40 bg-neon-error/10 p-4 text-sm text-neon-error">
          <span>{`Não foi possível carregar as iterações. ${erro}`}</span>
          <button type="button" onClick={() => void carregar()} className={botao}>
            Tentar de novo
          </button>
        </div>
      )}
      {aviso && (
        <p role="alert" className="rounded-xl border border-neon-error/40 bg-neon-error/10 px-3 py-2 text-xs text-neon-error">
          {aviso}
        </p>
      )}

      {planos && todos.length === 0 && (
        <div className="rounded-3xl border border-white/10 bg-volt-surface/80 p-8 text-center text-sm text-on-surface-variant flex flex-col items-center gap-3">
          <p>Nenhuma iteração ainda: cada plano é uma iteração.</p>
          <button type="button" onClick={onIrParaPlanos} className="px-4 py-2 rounded-full border border-volt-green/40 bg-volt-green/10 text-sm font-black text-volt-green hover:bg-volt-green/20 cursor-pointer">
            Ir para Planos
          </button>
        </div>
      )}

      {planos && todos.length > 0 && (
        <>
          <div className="grid gap-4 lg:grid-cols-3">{cards.map(([papel, d]) => cardDe(papel, d))}</div>

          <div className="rounded-3xl border border-white/10 bg-volt-surface/80 backdrop-blur-sm p-5 flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-black uppercase tracking-wide">
                {`Burndown — testes restantes${planoDoBurndown ? ` (plano ${planoDoBurndown.plano.nome})` : ''}`}
              </h3>
              <div className="flex flex-wrap items-center gap-4 text-xs">
                <label className="flex items-center gap-2 font-bold text-on-surface-variant">
                  Iteração
                  <select value={planoDoBurndown?.plano.id ?? ''} onChange={(e) => setPlanoBurn(e.target.value)} className={campo}>
                    {todos.map((p) => (
                      <option key={p.plano.id} value={p.plano.id}>
                        {p.plano.nome}
                      </option>
                    ))}
                  </select>
                </label>
                <span data-testid="velocidade" className="font-bold">
                  {velocidade === null ? 'Velocidade média: sem iterações encerradas' : `Velocidade média: ${virgula(velocidade)} testes/iteração`}
                </span>
              </div>
            </div>
            {burn && planoDoBurndown && burn.bd.total === 0 ? (
              <p className="py-4 text-sm text-on-surface-variant">
                {`Burndown indisponível: a iteração ${planoDoBurndown.plano.nome} ainda não tem testes. Arraste itens do backlog para o card da iteração.`}
              </p>
            ) : (
              burn &&
              planoDoBurndown && (
                <>
                  <GraficoBurndown titulo={`Burndown do plano ${planoDoBurndown.plano.nome}`} bd={burn.bd} />
                  <p className="text-xs text-on-surface-variant">● real · tracejado ideal (reta até 0 na previsão)</p>
                  {textoProjecao() && <p data-testid="projecao" className="text-xs font-bold">{textoProjecao()}</p>}
                  {burn.bd.semData > 0 && (
                    <p className="text-[11px] text-on-surface-variant">{`${burn.bd.semData} teste(s) concluído(s) sem data de execução contam só a partir de hoje.`}</p>
                  )}
                </>
              )
            )}
          </div>

          <div className="rounded-3xl border border-white/10 bg-volt-surface/80 backdrop-blur-sm p-5 flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-black uppercase tracking-wide">{`Backlog priorizado (${fila.length})`}</h3>
              <label className="flex items-center gap-2 text-xs font-bold text-on-surface-variant">
                Mover para
                <select value={planoDestino?.plano.id ?? ''} onChange={(e) => setDestino(e.target.value)} disabled={abertos.length === 0} className={campo}>
                  {abertos.length === 0 && <option value="">Nenhuma iteração aberta</option>}
                  {abertos.map((p) => (
                    <option key={p.plano.id} value={p.plano.id}>
                      {`${p.plano.id === atual?.plano.id ? 'Atual' : p.plano.id === proxima?.plano.id ? 'Próxima' : 'Aberta'} ${p.plano.nome}`}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {fila.length === 0 ? (
              <p className="text-xs text-on-surface-variant">Todo cenário do catálogo já está em algum plano aberto.</p>
            ) : (
              <>
                <p className="text-[11px] text-on-surface-variant">Arraste para o card da iteração ou use “Mover”.</p>
                {filaVisivel.map((i) => (
                  <div
                    key={i.idCenario}
                    data-testid={`backlog-${i.idCenario}`}
                    draggable
                    onDragStart={() => {
                      arrastando.current = i;
                    }}
                    className="flex cursor-grab items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs"
                  >
                    <GripVertical size={14} className="text-on-surface-variant" aria-hidden />
                    <span className="w-7 font-black">{i.prioridade ?? '-'}</span>
                    <span className="font-mono text-volt-green">{i.idCenario}</span>
                    <span className="min-w-0 flex-1 truncate">{`${i.funcionalidade} · ${i.nome}`}</span>
                    <span className="text-on-surface-variant">{i.estimativaMin ? `${i.estimativaMin}m` : '?'}</span>
                    {i.idMassa && <span className="font-mono text-on-surface-variant">{i.idMassa}</span>}
                    <button
                      type="button"
                      onClick={() => mover(i, planoDestino)}
                      disabled={!planoDestino}
                      aria-label={`Mover ${i.idCenario}`}
                      className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 font-bold hover:bg-white/10 disabled:opacity-40 cursor-pointer"
                    >
                      Mover
                    </button>
                  </div>
                ))}
                {fila.length > BACKLOG_VISIVEL && (
                  <button type="button" onClick={() => setBacklogCompleto((v) => !v)} className="self-start text-xs font-bold text-volt-green hover:underline cursor-pointer">
                    {backlogCompleto ? 'Ver menos' : `... mais ${fila.length - BACKLOG_VISIVEL} · Ver todos`}
                  </button>
                )}
              </>
            )}
          </div>
        </>
      )}

      {confirmar && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div role="alertdialog" aria-modal="true" aria-label="Aumentar o escopo" className="w-full max-w-sm p-6 rounded-3xl bg-[#1a1a1a] border border-white/10 text-on-surface">
            <p className="text-sm font-bold">{`Adicionar à iteração em andamento aumenta o escopo (+${confirmar.item.estimativaMin ?? 0} min).`}</p>
            <p className="mt-2 text-xs text-on-surface-variant">{`${confirmar.item.idCenario} entra no plano ${confirmar.plano.plano.nome}.`}</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmar(null)} className="px-4 py-2.5 rounded-xl text-xs font-bold bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer">
                Cancelar
              </button>
              <button type="button" onClick={() => void incluir(confirmar.item, confirmar.plano)} className="px-4 py-2.5 rounded-xl text-xs font-black bg-volt-green text-black cursor-pointer">
                Adicionar mesmo assim
              </button>
            </div>
          </div>
        </div>
      )}

      {aberto && <PlanoDetalhe key={aberto} id={aberto} onFechar={() => setAberto(null)} onMudou={() => void carregar()} />}
    </section>
  );
}
