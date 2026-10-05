import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, GripVertical, RefreshCw, Settings2 } from 'lucide-react';
import { usePessoas } from '../../pessoas/ContextoPessoas.tsx';
import { itemPorChave } from '../../shell/menu.ts';
import { ErroApi } from '../cenarios/clienteApi.ts';
import { alterarTeste, listarPlanos, obterPlano, type DetalhePlano } from '../planos/clientePlanos.ts';
import { hojeISO } from '../planos/datas.ts';
import PlanoDetalhe from '../planos/PlanoDetalhe.tsx';
import { segundaDa, somarDias } from '../roadmap/linhaDoTempo.ts';
import EquipeCapacidadeModal from './EquipeCapacidadeModal.tsx';
import GradeSemana from './GradeSemana.tsx';
import {
  backlog,
  diasDaSemana,
  excedente,
  folga,
  itensDaSemana,
  linhasDaEquipe,
  rotuloDaSemana,
  SEM_DONO,
  usoDaSemana,
  usoDepoisDeColocar,
  type ItemDoPlano,
  type LinhaPessoa,
} from './planejamentoEquipe.ts';

interface Props {
  /** Data de "hoje" (aaaa-mm-dd); só os testes passam isto. */
  hoje?: string;
  /** Leva à tela Equipe (o link "Abrir a tela Equipe" do modal M12 "Equipe e capacidade"). */
  onIrParaEquipe: () => void;
}

interface Excedeu {
  item: ItemDoPlano;
  linha: LinhaPessoa;
  dia: string;
  depois: number;
  alternativas: { linha: LinhaPessoa; folga: number }[];
}

const botao =
  'flex items-center gap-2 px-3 py-2 rounded-full border border-white/10 bg-white/5 text-sm font-bold text-on-surface-variant hover:bg-white/10 disabled:opacity-60 cursor-pointer';
const campo = 'rounded-lg border border-white/10 bg-volt-page px-2.5 py-2 text-xs text-on-surface outline-none focus:border-volt-green/50';
const BACKLOG_VISIVEL = 5;

const mensagemDe = (e: unknown) => (e instanceof ErroApi ? e.message : 'Erro inesperado.');

/**
 * Planejamento da equipe (V7): distribui testes entre as pessoas semana a semana, comparando o tempo estimado
 * com a capacidade. Arrastar um teste (da grade ou do backlog) para o dia de uma pessoa grava o dia e o responsável.
 */
export default function Planejamento({ hoje: hojeProp, onIrParaEquipe }: Props) {
  const hoje = hojeProp ?? hojeISO();
  const { rotulo, icone: Icone } = itemPorChave('planejamento');
  const { pessoas, nome, recarregar: recarregarEquipe } = usePessoas();
  const [equipeAberta, setEquipeAberta] = useState(false);
  const [inicio, setInicio] = useState(() => segundaDa(hoje));
  const [fimDeSemana, setFimDeSemana] = useState(false);
  const [planoSel, setPlanoSel] = useState('');
  const [pessoaSel, setPessoaSel] = useState('');
  const [planos, setPlanos] = useState<DetalhePlano[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [atualizando, setAtualizando] = useState(false);
  const [aberto, setAberto] = useState<ItemDoPlano | null>(null);
  const [excedeu, setExcedeu] = useState<Excedeu | null>(null);
  const [backlogCompleto, setBacklogCompleto] = useState(false);
  const arrastando = useRef<ItemDoPlano | null>(null);

  const carregar = useCallback(async () => {
    setAtualizando(true);
    try {
      const resumos = await listarPlanos();
      setPlanos(await Promise.all(resumos.map((p) => obterPlano(p.id))));
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
    if (!excedeu) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExcedeu(null);
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [excedeu]);

  const itens = useMemo<ItemDoPlano[]>(
    () =>
      (planos ?? [])
        .filter((d) => !planoSel || d.plano.id === planoSel)
        .flatMap((d) => d.itens.map((i) => ({ ...i, planoId: d.plano.id, planoNome: d.plano.nome }))),
    [planos, planoSel],
  );
  const todasLinhas = useMemo(() => linhasDaEquipe(pessoas, itens, nome), [pessoas, itens, nome]);
  const linhas = pessoaSel ? todasLinhas.filter((l) => l.chave === pessoaSel) : todasLinhas;
  const dias = diasDaSemana(inicio, fimDeSemana);
  const semDono = todasLinhas.find((l) => l.chave === SEM_DONO);
  const semDonoNaSemana = semDono ? itensDaSemana(semDono.itens, inicio).length : 0;
  const noFimDeSemana = fimDeSemana ? 0 : itensDaSemana(itens, inicio).filter((i) => i.dataPlanejada && !dias.includes(i.dataPlanejada)).length;
  const fila = useMemo(() => backlog(itens), [itens]);
  const filaVisivel = backlogCompleto ? fila : fila.slice(0, BACKLOG_VISIVEL);
  const comCapacidade = linhas.filter((l) => l.id !== null);
  const totalUso = linhas.reduce((soma, l) => soma + usoDaSemana(l.itens, inicio), 0);
  const totalCapacidade = linhas.reduce((soma, l) => soma + l.capacidade, 0);

  const gravar = async (item: ItemDoPlano, linha: LinhaPessoa, dia: string) => {
    setAviso(null);
    setExcedeu(null);
    try {
      await alterarTeste(item.planoId, item.idCenario, item.versao, { dataPlanejada: dia, responsavel: linha.id });
    } catch (e) {
      setAviso(mensagemDe(e));
    }
    await carregar();
  };

  /** Solta o teste no dia de uma pessoa; se a capacidade estoura, pergunta antes. */
  const soltar = (linha: LinhaPessoa, dia: string) => {
    const item = arrastando.current;
    arrastando.current = null;
    if (!item) return;
    if (item.dataPlanejada === dia && (item.responsavel ?? null) === linha.id) return;
    const depois = usoDepoisDeColocar(linha, item, inicio);
    const antes = usoDaSemana(linha.itens, inicio);
    if (linha.id !== null && excedente(linha.capacidade, depois) > excedente(linha.capacidade, antes)) {
      const minutos = item.estimativaMin ?? 0;
      const alternativas = todasLinhas
        .filter((l) => l.id !== null && l.chave !== linha.chave)
        .map((l) => ({ linha: l, folga: folga(l.capacidade, usoDaSemana(l.itens, inicio)) }))
        .filter((a): a is { linha: LinhaPessoa; folga: number } => a.folga !== null && a.folga >= minutos)
        .sort((a, b) => b.folga - a.folga)
        .slice(0, 3);
      setExcedeu({ item, linha, dia, depois, alternativas });
      return;
    }
    void gravar(item, linha, dia);
  };

  const arrastar = (item: ItemDoPlano) => {
    arrastando.current = item;
  };
  const abrir = (item: ItemDoPlano) => setAberto(item);
  const fecharDetalhe = useCallback(() => setAberto(null), []);

  return (
    <section aria-label={rotulo} className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="flex items-center gap-3 text-xl font-black uppercase tracking-tight text-on-surface">
          <Icone size={22} className="text-volt-green" aria-hidden />
          {rotulo}
        </h2>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setEquipeAberta(true)} className={botao}>
            <Settings2 size={16} aria-hidden />
            Equipe e capacidade
          </button>
          <button type="button" onClick={() => void carregar()} disabled={atualizando} className={botao}>
            <RefreshCw size={16} className={atualizando ? 'animate-spin' : ''} aria-hidden />
            Atualizar
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs">
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setInicio(somarDias(inicio, -7))} aria-label="Semana anterior" className="p-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 cursor-pointer">
            <ChevronLeft size={14} aria-hidden />
          </button>
          <span data-testid="semana" className="min-w-44 text-center font-black">{`Semana ${rotuloDaSemana(inicio, fimDeSemana)}`}</span>
          <button type="button" onClick={() => setInicio(somarDias(inicio, 7))} aria-label="Próxima semana" className="p-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 cursor-pointer">
            <ChevronRight size={14} aria-hidden />
          </button>
        </div>
        <button type="button" onClick={() => setInicio(segundaDa(hoje))} className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 font-bold hover:bg-white/10 cursor-pointer">
          Esta semana
        </button>
        <label className="flex items-center gap-2 font-bold text-on-surface-variant">
          Plano
          <select value={planoSel} onChange={(e) => setPlanoSel(e.target.value)} className={campo}>
            <option value="">Todos</option>
            {(planos ?? []).map((d) => (
              <option key={d.plano.id} value={d.plano.id}>
                {d.plano.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 font-bold text-on-surface-variant">
          Pessoas
          <select value={pessoaSel} onChange={(e) => setPessoaSel(e.target.value)} className={campo}>
            <option value="">Todas</option>
            {todasLinhas.map((l) => (
              <option key={l.chave} value={l.chave}>
                {l.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 font-bold text-on-surface-variant">
          <input type="checkbox" checked={fimDeSemana} onChange={(e) => setFimDeSemana(e.target.checked)} className="accent-volt-green" />
          Mostrar fins de semana
        </label>
      </div>

      {erro && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-neon-error/40 bg-neon-error/10 p-4 text-sm text-neon-error">
          <span>{`Não foi possível carregar o planejamento. ${erro}`}</span>
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

      {planos && (
        <>
          <GradeSemana dias={dias} inicio={inicio} hoje={hoje} linhas={linhas} onArrastar={arrastar} onSoltar={soltar} onAbrir={abrir} />

          {semDonoNaSemana > 0 && (
            <p role="status" className="text-xs text-on-surface-variant">
              {`! ${semDonoNaSemana} teste(s) sem responsável — arraste para uma pessoa ou use "Atribuir" na Lista.`}
            </p>
          )}
          {noFimDeSemana > 0 && (
            <p role="status" className="text-xs text-on-surface-variant">
              {`${noFimDeSemana} teste(s) planejado(s) no fim de semana — marque "Mostrar fins de semana" para vê-los.`}
            </p>
          )}

          <div className="grid gap-5 lg:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-volt-surface/80 backdrop-blur-sm p-5 flex flex-col gap-3">
              <h3 className="text-sm font-black uppercase tracking-wide">Capacidade da semana</h3>
              {comCapacidade.length === 0 && <p className="text-xs text-on-surface-variant">Nenhuma pessoa cadastrada ainda. Cadastre a Equipe para planejar por pessoa.</p>}
              {comCapacidade.map((l) => {
                const uso = usoDaSemana(l.itens, inicio);
                const passou = excedente(l.capacidade, uso);
                const livre = folga(l.capacidade, uso);
                const percentual = l.capacidade > 0 ? Math.min(100, Math.round((uso / l.capacidade) * 100)) : 0;
                return (
                  <div key={l.chave} data-testid={`capacidade-${l.chave}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                    <span className="w-20 truncate font-bold">{l.nome}</span>
                    <div role="progressbar" aria-label={`Capacidade de ${l.nome}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentual} className="h-2 w-40 overflow-hidden rounded-full bg-white/10">
                      <div className={`h-full ${passou > 0 ? 'bg-neon-error' : 'bg-volt-green'}`} style={{ width: `${percentual}%` }} />
                    </div>
                    {l.capacidade > 0 ? (
                      <>
                        <span className="font-black">{`${uso} de ${l.capacidade} min`}</span>
                        <span className={passou > 0 ? 'font-black text-neon-error' : 'text-on-surface-variant'}>
                          {passou > 0 ? `EXCEDEU em ${passou} min` : `disponível: ${livre} min`}
                        </span>
                      </>
                    ) : (
                      <span className="text-on-surface-variant">{`${uso} min · capacidade não informada`}</span>
                    )}
                  </div>
                );
              })}
              {totalCapacidade > 0 && (
                <p data-testid="capacidade-equipe" className="border-t border-white/10 pt-2 text-xs font-black">
                  {`Equipe ${totalUso} de ${totalCapacidade} min (${Math.round((totalUso / totalCapacidade) * 100)}%)`}
                </p>
              )}
            </div>

            <div className="rounded-3xl border border-white/10 bg-volt-surface/80 backdrop-blur-sm p-5 flex flex-col gap-2">
              <h3 className="text-sm font-black uppercase tracking-wide">Backlog — arraste para um dia da pessoa</h3>
              {fila.length === 0 ? (
                <p className="text-xs text-on-surface-variant">Todo teste já tem dia marcado.</p>
              ) : (
                <>
                  {filaVisivel.map((i) => (
                    <div
                      key={`${i.planoId}:${i.idCenario}`}
                      data-testid={`backlog-${i.idCenario}`}
                      draggable
                      onDragStart={() => arrastar(i)}
                      className="flex cursor-grab items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs"
                    >
                      <GripVertical size={14} className="text-on-surface-variant" aria-hidden />
                      <span className="w-7 font-black">{i.prioridade ?? '-'}</span>
                      <button type="button" onClick={() => abrir(i)} aria-label={`Abrir ${i.idCenario}`} className="font-mono text-volt-green hover:underline cursor-pointer">
                        {i.idCenario}
                      </button>
                      <span className="min-w-0 flex-1 truncate">{`${i.funcionalidade ?? '-'} · ${i.nome ?? '-'}`}</span>
                      <span className="text-on-surface-variant">{i.estimativaMin ? `${i.estimativaMin}m` : '?'}</span>
                      {i.idMassa && <span className="font-mono text-on-surface-variant">{i.idMassa}</span>}
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
          </div>
        </>
      )}

      {excedeu && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div role="alertdialog" aria-modal="true" aria-label="Capacidade excedida" className="w-full max-w-md p-6 rounded-3xl bg-[#1a1a1a] border border-white/10 text-on-surface">
            <h3 className="text-sm font-black uppercase tracking-wide">Capacidade excedida</h3>
            <p className="mt-3 text-sm font-bold">{`${excedeu.linha.nome} ficaria com ${excedeu.depois} min para ${excedeu.linha.capacidade} min de capacidade.`}</p>
            <p className="mt-2 text-xs text-on-surface-variant">
              {excedeu.alternativas.length === 0
                ? 'Ninguém tem folga suficiente nesta semana.'
                : `Quem tem folga nesta semana: ${excedeu.alternativas.map((a) => `${a.linha.nome} (${a.folga} min)`).join('  ')}`}
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => setExcedeu(null)} className="px-4 py-2.5 rounded-xl text-xs font-bold bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer">
                Cancelar
              </button>
              <button type="button" onClick={() => void gravar(excedeu.item, excedeu.linha, excedeu.dia)} className="px-4 py-2.5 rounded-xl text-xs font-bold bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer">
                {`Manter no ${excedeu.linha.nome}`}
              </button>
              {excedeu.alternativas.map((a) => (
                <button key={a.linha.chave} type="button" onClick={() => void gravar(excedeu.item, a.linha, excedeu.dia)} className="px-4 py-2.5 rounded-xl text-xs font-black bg-volt-green text-black cursor-pointer">
                  {`Colocar na ${a.linha.nome}`}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {aberto && <PlanoDetalhe key={`${aberto.planoId}:${aberto.idCenario}`} id={aberto.planoId} testeInicial={aberto.idCenario} onFechar={fecharDetalhe} onMudou={() => void carregar()} />}

      {equipeAberta && (
        <EquipeCapacidadeModal
          pessoas={pessoas}
          onSalvo={recarregarEquipe}
          onAbrirEquipe={() => {
            setEquipeAberta(false);
            onIrParaEquipe();
          }}
          onFechar={() => setEquipeAberta(false)}
        />
      )}
    </section>
  );
}
