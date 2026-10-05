import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ListOrdered, Plus, X } from 'lucide-react';
import { ErroApi } from '../cenarios/clienteApi.ts';
import { obterConfig, salvarWip, SEM_LIMITES, type Wip } from '../../config/clienteConfig.ts';
import { useIncidentes } from '../../incidentes/ContextoIncidentes.tsx';
import IncidentesDoPlano from '../../incidentes/IncidentesDoPlano.tsx';
import { usePessoas } from '../../pessoas/ContextoPessoas.tsx';
import BarraKanban, { type Agrupar } from './BarraKanban.tsx';
import BarraLote from './BarraLote.tsx';
import {
  alterarLote,
  listarPlanos,
  moverTestes,
  alterarTeste,
  definirOrdem,
  excluirPlano,
  incluirTestes,
  obterPlano,
  removerTeste,
  type CamposItem,
  type DetalhePlano,
  type ItemPlano,
} from './clientePlanos.ts';
import { formatarData, formatarMinutos, hojeISO } from './datas.ts';
import { filtrar, SEM_FILTROS, SEM_VALOR, temFiltro, type Filtros } from './filtros.ts';
import FiltrosTestes from './FiltrosTestes.tsx';
import IncluirTestesModal from './IncluirTestesModal.tsx';
import Kanban from './Kanban.tsx';
import LimitesWipModal from './LimitesWipModal.tsx';
import ListaTestes from './ListaTestes.tsx';
import OrdemModal from './OrdemModal.tsx';
import TesteModal from './TesteModal.tsx';
import AcoesPendentesAnteriores from '../retro/AcoesPendentesAnteriores.tsx';

interface Props {
  id: string;
  onFechar: () => void;
  /** Avisa a lista de planos que algo mudou (progresso, testes, plano excluído). */
  onMudou: () => void;
  /** Data de "hoje" (aaaa-mm-dd) para os filtros; só os testes passam isto. */
  hoje?: string;
  /** `modal` (padrão) abre por cima da tela; `pagina` ocupa a área de conteúdo (Lista, Kanban e visões salvas). */
  modo?: 'modal' | 'pagina';
  /** Com `pagina` não há abas: a visão vem do menu. */
  visaoInicial?: Visao;
  filtrosIniciais?: Filtros;
  /** Abre já no detalhe deste teste (vindo do Roadmap, por exemplo). */
  testeInicial?: string;
  /** "abrir retro" do aviso de ações pendentes de retros anteriores; sem isto o aviso só informa. */
  onAbrirRetro?: (planoId: string) => void;
}

type Confirmacao = { tipo: 'teste'; idCenario: string } | { tipo: 'lote'; idCenarios: string[] } | { tipo: 'plano' };
type Visao = 'lista' | 'card' | 'incidentes';

const VISOES: { chave: Visao; texto: string }[] = [
  { chave: 'lista', texto: 'Visão lista' },
  { chave: 'card', texto: 'Visão card' },
];

function mensagemDe(erro: unknown): string {
  return erro instanceof ErroApi ? erro.message : 'Erro inesperado.';
}

/**
 * Modal "Detalhe do plano" (M3): filtros, Visão lista e Visão card (kanban) sobre os mesmos testes,
 * mais o botão de ordem de execução. Tudo é planejamento: nada é executado.
 */
export default function PlanoDetalhe({ id, onFechar, onMudou, hoje, modo = 'modal', visaoInicial = 'lista', filtrosIniciais = SEM_FILTROS, testeInicial, onAbrirRetro }: Props) {
  const ehPagina = modo === 'pagina';
  const [visao, setVisao] = useState<Visao>(visaoInicial);
  const [filtros, setFiltros] = useState<Filtros>(filtrosIniciais);
  const [dados, setDados] = useState<DetalhePlano | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ordemAberta, setOrdemAberta] = useState(false);
  const [incluirAberto, setIncluirAberto] = useState(false);
  const [testeAberto, setTesteAberto] = useState<string | null>(testeInicial ?? null);
  const [confirmar, setConfirmar] = useState<Confirmacao | null>(null);
  const [destinos, setDestinos] = useState<{ id: string; nome: string }[]>([]);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [wip, setWip] = useState<Wip>(SEM_LIMITES);
  const [agrupar, setAgrupar] = useState<Agrupar>('nenhum');
  const [wipAberto, setWipAberto] = useState(false);
  const [movendo, setMovendo] = useState(false);
  const [incAberto, setIncAberto] = useState(false);
  const { incidentes } = useIncidentes();
  const { voce } = usePessoas();
  const janela = useRef<HTMLDivElement>(null);
  // O Esc fecha só a camada de cima: leitura no momento do evento, sem refazer o ouvinte.
  const camadas = useRef({ ordemAberta, incluirAberto, testeAberto, confirmar, wipAberto, movendo, incAberto });
  camadas.current = { ordemAberta, incluirAberto, testeAberto, confirmar, wipAberto, movendo, incAberto };

  const carregar = useCallback(async () => {
    try {
      setDados(await obterPlano(id));
    } catch (e) {
      setErro(mensagemDe(e));
    }
  }, [id]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  // Sem a configuração (servidor fora, por exemplo) o Kanban funciona sem limites.
  useEffect(() => {
    let vivo = true;
    obterConfig()
      .then((c) => vivo && c?.wip && setWip({ ...SEM_LIMITES, ...c.wip }))
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, []);

  // Para onde dá para mover testes: os outros planos que ainda estão em execução.
  useEffect(() => {
    let vivo = true;
    listarPlanos()
      .then((lista) => vivo && setDestinos(Array.isArray(lista) ? lista.filter((p) => p.id !== id && !p.resumo.executado).map((p) => ({ id: p.id, nome: p.nome })) : []))
      .catch(() => vivo && setDestinos([]));
    return () => {
      vivo = false;
    };
  }, [id]);

  useEffect(() => {
    if (!ehPagina) janela.current?.focus();
  }, [ehPagina]);

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (camadas.current.confirmar) setConfirmar(null);
      // Na página não há o que fechar com Esc: só os modais de cima respondem a ele.
      else if (ehPagina) return;
      else if (!camadas.current.ordemAberta && !camadas.current.incluirAberto && !camadas.current.testeAberto && !camadas.current.wipAberto && !camadas.current.movendo && !camadas.current.incAberto) onFechar();
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [onFechar, ehPagina]);

  /** Roda a alteração; sempre relê o plano (a regra da massa pode mudar o "Aguardando" de outros testes). */
  const executar = async (acao: () => Promise<unknown>) => {
    setErro(null);
    try {
      await acao();
      onMudou();
    } catch (e) {
      setErro(mensagemDe(e));
    }
    await carregar();
  };

  const alterar = (item: ItemPlano, campos: CamposItem) => void executar(() => alterarTeste(id, item.idCenario, item.versao, campos));

  const confirmarAcao = async () => {
    const acao = confirmar;
    setConfirmar(null);
    if (acao?.tipo === 'teste') {
      await executar(() => removerTeste(id, acao.idCenario));
      setTesteAberto((aberto) => (aberto === acao.idCenario ? null : aberto));
    }
    if (acao?.tipo === 'lote') {
      await executar(async () => {
        for (const idCenario of acao.idCenarios) await removerTeste(id, idCenario);
      });
      setSelecionados(new Set());
    }
    if (acao?.tipo === 'plano') {
      setErro(null);
      try {
        await excluirPlano(id);
        onMudou();
        onFechar();
      } catch (e) {
        setErro(mensagemDe(e));
      }
    }
  };

  const fecharOrdem = useCallback(() => setOrdemAberta(false), []);
  const fecharIncluir = useCallback(() => setIncluirAberto(false), []);
  const fecharTeste = useCallback(() => setTesteAberto(null), []);
  const itens = useMemo(() => dados?.itens ?? [], [dados]);
  const podeOrdenar = itens.length >= 2;
  const numeros = useMemo(() => new Map(itens.map((i, p) => [i.idCenario, p + 1])), [itens]);
  // Um filtro que veio de uma visão salva continua aparecendo no seletor mesmo que o plano não tenha mais testes assim.
  const funcionalidades = useMemo(
    () =>
      [...new Set([...itens.map((i) => i.funcionalidade), filtros.funcionalidade].filter((f): f is string => Boolean(f)))].sort((a, b) =>
        a.localeCompare(b, 'pt-BR'),
      ),
    [itens, filtros.funcionalidade],
  );
  const hojeData = hoje ?? hojeISO();
  const visiveis = useMemo(() => filtrar(itens, filtros, hojeData, voce?.id), [itens, filtros, hojeData, voce]);
  const contagem = temFiltro(filtros) ? `Testes (${visiveis.length} de ${itens.length})` : `Testes (${itens.length})`;
  const responsaveis = useMemo(
    () => [...new Set([...itens.map((i) => i.responsavel), filtros.responsavel === SEM_VALOR ? undefined : filtros.responsavel].filter((r): r is string => Boolean(r)))],
    [itens, filtros.responsavel],
  );

  // Só vale o que ainda existe no plano (um teste tirado some da seleção).
  const marcados = useMemo(() => itens.filter((i) => selecionados.has(i.idCenario)), [itens, selecionados]);
  const alternarMarca = (idCenario: string) =>
    setSelecionados((atual) => {
      const novo = new Set(atual);
      if (novo.has(idCenario)) novo.delete(idCenario);
      else novo.add(idCenario);
      return novo;
    });
  const marcarTodos = (marcar: boolean) =>
    setSelecionados((atual) => {
      const novo = new Set(atual);
      for (const i of visiveis) {
        if (marcar) novo.add(i.idCenario);
        else novo.delete(i.idCenario);
      }
      return novo;
    });

  const resumo = () => {
    const minutos = visiveis.reduce((soma, i) => soma + (i.estimativaMin ?? 0), 0);
    const feitos = visiveis.filter((i) => i.status === 'concluido').length;
    const falhas = visiveis.filter((i) => i.resultado === 'falhou').length;
    return `Total estimado: ${formatarMinutos(minutos)} · Executado: ${feitos} de ${visiveis.length} · Falhas: ${falhas}`;
  };

  const conteudo = () => {
    if (itens.length === 0) return <p className="py-8 text-center text-sm text-on-surface-variant">Este plano ainda não tem testes</p>;
    if (visiveis.length === 0) return <p className="py-8 text-center text-sm text-on-surface-variant">Nenhum teste encontrado com estes filtros</p>;
    if (visao === 'card') {
      return <Kanban itens={visiveis} todos={itens} wip={wip} agrupar={agrupar} onAlterar={alterar} onAbrir={setTesteAberto} onConfirmando={setMovendo} />;
    }
    return (
      <ListaTestes
        itens={visiveis}
        numeros={numeros}
        podeOrdenar={podeOrdenar}
        selecionados={selecionados}
        onSelecionar={alternarMarca}
        onSelecionarTodos={marcarTodos}
        onAlterar={alterar}
        onTirar={(idCenario) => setConfirmar({ tipo: 'teste', idCenario })}
        onOrdem={() => setOrdemAberta(true)}
        onVer={setTesteAberto}
      />
    );
  };

  const Titulo = ehPagina ? 'h3' : 'h2';
  // Quantos INC afetam algum teste deste plano (resolvidos também: ficam no histórico do plano).
  const qtdInc = incidentes.filter((i) => i.testesAfetados.some((t) => itens.some((x) => x.idCenario === t))).length;
  const noIncidentes = visao === 'incidentes';

  return (
    <div className={ehPagina ? 'flex flex-col' : 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm'}>
      <div
        ref={janela}
        role={ehPagina ? 'region' : 'dialog'}
        aria-modal={ehPagina ? undefined : true}
        aria-label={ehPagina ? 'Plano' : 'Detalhe do plano'}
        tabIndex={-1}
        className={
          ehPagina
            ? 'w-full flex flex-col rounded-3xl bg-volt-surface/80 backdrop-blur-sm border border-white/10 text-on-surface outline-none'
            : 'w-full max-w-5xl max-h-[92vh] flex flex-col rounded-3xl bg-[#1a1a1a] border border-white/10 text-on-surface outline-none'
        }
      >
        <div className="flex items-start justify-between gap-4 p-5 pb-3">
          <div className="min-w-0">
            <Titulo className="text-lg font-black tracking-tight">{dados ? `Plano: ${dados.plano.nome}` : 'Plano'}</Titulo>
            {dados && (
              <p className="mt-1 text-xs text-on-surface-variant">
                {`Criado em ${formatarData(dados.plano.criadoEm)} · Previsão ${formatarData(dados.plano.previsao)}`}
              </p>
            )}
          </div>
          {!ehPagina && (
            <button type="button" onClick={onFechar} aria-label="Fechar" className="p-1 opacity-60 hover:opacity-100 cursor-pointer">
              <X size={20} />
            </button>
          )}
        </div>

        {erro && (
          <p role="alert" className="mx-5 mb-3 rounded-xl border border-neon-error/40 bg-neon-error/10 px-3 py-2 text-xs text-neon-error">
            {erro}
          </p>
        )}

        {dados && <AcoesPendentesAnteriores planoId={id} hoje={hoje} onAbrirRetro={onAbrirRetro} />}

        {dados && (
          <>
            <div className="px-5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-[14rem]">
                <div
                  role="progressbar"
                  aria-label="Progresso do plano"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={dados.resumo.percentual}
                  className="h-2 w-40 overflow-hidden rounded-full bg-white/10"
                >
                  <div className="h-full bg-volt-green" style={{ width: `${dados.resumo.percentual}%` }} />
                </div>
                <span className="text-xs text-on-surface-variant">{`${dados.resumo.percentual}% executado`}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold">{contagem}</span>
                <button
                  type="button"
                  onClick={() => setIncluirAberto(true)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-volt-green text-black text-xs font-black cursor-pointer"
                >
                  <Plus size={14} aria-hidden />
                  Incluir testes
                </button>
                <button
                  type="button"
                  onClick={() => setOrdemAberta(true)}
                  disabled={!podeOrdenar}
                  aria-label="Ordem de execução do plano"
                  className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-xs font-bold hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <ListOrdered size={14} aria-hidden />
                  Ordem
                </button>
                {ehPagina && (
                  <button
                    type="button"
                    onClick={() => setVisao(noIncidentes ? visaoInicial : 'incidentes')}
                    aria-pressed={noIncidentes}
                    className={`px-3 py-2 rounded-xl border text-xs font-bold cursor-pointer ${noIncidentes ? 'border-volt-green/40 bg-volt-green/10 text-volt-green' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
                  >
                    {`Incidentes (${qtdInc})`}
                  </button>
                )}
              </div>
            </div>

            <div className="px-5 pt-3 pb-1 flex flex-col gap-3 overflow-y-auto">
              {itens.length > 0 && !noIncidentes && <FiltrosTestes filtros={filtros} onChange={setFiltros} funcionalidades={funcionalidades} responsaveis={responsaveis} />}
              {!ehPagina && (
                <div role="tablist" className="flex gap-2">
                  {[...VISOES, { chave: 'incidentes' as Visao, texto: `Incidentes (${qtdInc})` }].map(({ chave, texto }) => (
                    <button
                      key={chave}
                      type="button"
                      role="tab"
                      aria-selected={visao === chave}
                      onClick={() => setVisao(chave)}
                      className={`px-4 py-2 rounded-xl text-sm font-bold border cursor-pointer transition-colors ${
                        visao === chave ? 'bg-volt-surface text-volt-green border-volt-green/30' : 'bg-white/5 text-on-surface-variant border-white/10 hover:bg-white/10'
                      }`}
                    >
                      {texto}
                    </button>
                  ))}
                </div>
              )}
              {visao === 'lista' && marcados.length > 0 && (
                <BarraLote
                  quantidade={marcados.length}
                  podeRemover={marcados.every((i) => i.status === 'agendado')}
                  podeMover={marcados.every((i) => i.status === 'agendado')}
                  destinos={destinos}
                  onMover={(idDestino) => {
                    void executar(() => moverTestes(id, marcados.map((i) => i.idCenario), idDestino));
                    setSelecionados(new Set());
                  }}
                  onAplicar={(campos) => {
                    void executar(() => alterarLote(id, marcados.map((i) => i.idCenario), campos));
                    setSelecionados(new Set());
                  }}
                  onRemover={() => setConfirmar({ tipo: 'lote', idCenarios: marcados.map((i) => i.idCenario) })}
                  onLimpar={() => setSelecionados(new Set())}
                />
              )}
              {visao === 'card' && itens.length > 0 && (
                <BarraKanban wip={wip} agrupar={agrupar} onAgrupar={setAgrupar} onEditarLimites={() => setWipAberto(true)} />
              )}
              <div>{noIncidentes ? <IncidentesDoPlano itens={itens} onAbrirTeste={setTesteAberto} onCamada={setIncAberto} /> : conteudo()}</div>
              {itens.length > 0 && visiveis.length > 0 && !noIncidentes && (
                <p data-testid="resumo-lista" className="text-xs text-on-surface-variant">
                  {resumo()}
                </p>
              )}
            </div>

            <div className="p-5 pt-3 flex justify-start">
              <button
                type="button"
                onClick={() => setConfirmar({ tipo: 'plano' })}
                className="px-4 py-2.5 rounded-xl text-xs font-black bg-neon-error/20 text-neon-error border border-neon-error/40 hover:bg-neon-error/30 cursor-pointer"
              >
                Excluir plano
              </button>
            </div>
          </>
        )}
      </div>

      {ordemAberta && dados && (
        <OrdemModal
          planoNome={dados.plano.nome}
          itens={dados.itens}
          onFechar={fecharOrdem}
          onSalvar={async (ordem) => {
            await definirOrdem(id, ordem);
            setOrdemAberta(false);
            await carregar();
            onMudou();
          }}
        />
      )}

      {testeAberto && dados && itens.some((i) => i.idCenario === testeAberto) && (
        <TesteModal
          planoNome={dados.plano.nome}
          itens={itens}
          idAtual={testeAberto}
          onTrocar={setTesteAberto}
          onFechar={fecharTeste}
          onTirar={(idCenario) => setConfirmar({ tipo: 'teste', idCenario })}
          onSalvar={async (item, campos) => {
            await alterarTeste(id, item.idCenario, item.versao, campos);
            onMudou();
            await carregar();
          }}
        />
      )}

      {incluirAberto && dados && (
        <IncluirTestesModal
          planoNome={dados.plano.nome}
          idsNoPlano={itens.map((i) => i.idCenario)}
          onFechar={fecharIncluir}
          onIncluir={async (ids, data) => {
            await incluirTestes(id, ids, data);
            setIncluirAberto(false);
            await carregar();
            onMudou();
          }}
        />
      )}

      {wipAberto && (
        <LimitesWipModal
          wip={wip}
          onFechar={() => setWipAberto(false)}
          onSalvar={async (novo) => {
            const salvo = await salvarWip(novo);
            setWip({ ...SEM_LIMITES, ...salvo.wip });
            setWipAberto(false);
          }}
        />
      )}

      {confirmar && dados && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div role="alertdialog" aria-modal="true" aria-label="Confirmar" className="w-full max-w-sm p-6 rounded-3xl bg-[#1a1a1a] border border-white/10 text-on-surface">
            <p className="text-sm font-bold">
              {confirmar.tipo === 'teste'
                ? `Tirar o teste ${confirmar.idCenario} do plano?`
                : confirmar.tipo === 'lote'
                  ? `Tirar ${confirmar.idCenarios.length} testes do plano?`
                  : `Excluir o plano ${dados.plano.nome} e seus ${dados.resumo.total} testes?`}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmar(null)} className="px-4 py-2.5 rounded-xl text-xs font-bold bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer">
                Manter
              </button>
              <button type="button" onClick={() => void confirmarAcao()} className="px-4 py-2.5 rounded-xl text-xs font-black bg-neon-error text-black cursor-pointer">
                {confirmar.tipo === 'plano' ? 'Excluir' : 'Tirar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
