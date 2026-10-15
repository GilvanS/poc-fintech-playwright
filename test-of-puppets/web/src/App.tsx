import { useCallback, useEffect, useMemo, useState } from 'react';
import GridRevealBackdrop from './shared/GridRevealBackdrop.tsx';
import Sobreposicao from './shared/Sobreposicao.tsx';
import Entrada from './pages/Entrada.tsx';
import Secao from './pages/Secao.tsx';
import Cenarios from './pages/cenarios/Cenarios.tsx';
import Configuracoes from './pages/configuracoes/Configuracoes.tsx';
import Equipe from './pages/equipe/Equipe.tsx';
import Iteracoes from './pages/iteracoes/Iteracoes.tsx';
import Lancamento from './pages/lancamento/Lancamento.tsx';
import Planejamento from './pages/planejamento/Planejamento.tsx';
import { SEM_FILTROS, type Filtros } from './pages/planos/filtros.ts';
import { listarPlanos, type PlanoResumido } from './pages/planos/clientePlanos.ts';
import PlanoPagina from './pages/planos/PlanoPagina.tsx';
import Planos from './pages/planos/Planos.tsx';
import Release from './pages/release/Release.tsx';
import Retro from './pages/retro/Retro.tsx';
import Roadmap from './pages/roadmap/Roadmap.tsx';
import NovaVisaoModal from './pages/visoes/NovaVisaoModal.tsx';
import { estaAberto } from './incidentes/clienteIncidentes.ts';
import { IncidentesProvider, useIncidentes } from './incidentes/ContextoIncidentes.tsx';
import type { Lembrete } from './lembretes/clienteLembretes.ts';
import { LembretesProvider } from './lembretes/ContextoLembretes.tsx';
import Incidentes from './pages/incidentes/Incidentes.tsx';
import { PessoasProvider, usePessoas } from './pessoas/ContextoPessoas.tsx';
import { PresencaProvider } from './presenca/ContextoPresenca.tsx';
import Shell from './shell/Shell.tsx';
import { jaEntrou, registrarEntrada } from './shell/entrada.ts';
import { gravarFundo, lerFundo, type ConfigFundo } from './shell/fundo.ts';
import { chaveDaVisao, idDaVisao, itemPorChave, type ChaveAtiva, type ChaveItem } from './shell/menu.ts';
import { criarVisao, excluirVisao, filtrosDaVisao, listarVisoes, type NovaVisao, type Visao } from './visoes/clienteVisoes.ts';

/** O plano escolhido no cabeçalho fica lembrado neste navegador (só o id). */
export const CHAVE_PLANO = 'puppets:plano';

function lerPlanoSalvo(): string | null {
  try {
    return window.localStorage.getItem(CHAVE_PLANO);
  } catch {
    return null;
  }
}

function gravarPlanoSalvo(id: string): void {
  try {
    window.localStorage.setItem(CHAVE_PLANO, id);
  } catch {
    // sem armazenamento a escolha vale só até recarregar a página
  }
}

interface PropsLogado {
  fundo: ConfigFundo;
  onFundo: (config: ConfigFundo) => void;
}

/** A parte logada: menu, plano escolhido, visões salvas e a tela do item ativo. */
function Logado({ fundo, onFundo }: PropsLogado) {
  const { voce } = usePessoas();
  const { incidentes } = useIncidentes();
  const idVoce = voce?.id ?? null;
  const incAbertos = incidentes.filter(estaAberto).length;
  const [ativo, setAtivo] = useState<ChaveAtiva>('planos');
  const [planos, setPlanos] = useState<PlanoResumido[]>([]);
  const [planoSalvo, setPlanoSalvo] = useState<string | null>(lerPlanoSalvo);
  const [visoes, setVisoes] = useState<Visao[]>([]);
  const [criandoVisao, setCriandoVisao] = useState(false);
  const [erroVisao, setErroVisao] = useState<string | null>(null);
  // Visão que está sendo confirmada para exclusão (popup "Excluir a visão ...?").
  const [excluindoVisao, setExcluindoVisao] = useState<Visao | null>(null);
  // Filtros com que a Lista foi aberta a partir do Lançamento; `n` faz a Lista recomeçar a cada clique.
  // `teste`: a Lista abre já com o detalhe desse teste (vem do Release).
  const [filtroLista, setFiltroLista] = useState<{ filtros: Filtros; n: number; teste?: string } | null>(null);

  const recarregarPlanos = useCallback(async () => {
    try {
      const lista = await listarPlanos();
      setPlanos(Array.isArray(lista) ? lista : []);
    } catch {
      // sem servidor o seletor fica como está; a tela de Planos mostra o erro
    }
  }, []);

  const recarregarVisoes = useCallback(async () => {
    try {
      setVisoes(await listarVisoes(idVoce));
    } catch {
      setVisoes([]);
    }
  }, [idVoce]);

  useEffect(() => {
    void recarregarPlanos();
  }, [recarregarPlanos]);

  useEffect(() => {
    void recarregarVisoes();
  }, [recarregarVisoes]);

  // O plano escolhido, ou (se nunca escolheu ou ele foi excluído) o primeiro que ainda está em execução.
  const planoAtivo = useMemo(
    () => planos.find((p) => p.id === planoSalvo) ?? planos.find((p) => !p.resumo.executado) ?? planos[0] ?? null,
    [planos, planoSalvo],
  );

  const escolherPlano = (id: string) => {
    gravarPlanoSalvo(id);
    setPlanoSalvo(id);
  };

  const selecionar = (chave: ChaveAtiva) => {
    // "Nova visão" abre o modal em vez de trocar de tela.
    if (chave === 'nova-visao') {
      setCriandoVisao(true);
      return;
    }
    // Abrir "Lista" pelo menu mostra tudo; só o clique no Lançamento abre filtrada.
    if (chave === 'lista') setFiltroLista(null);
    setAtivo(chave);
  };

  const criar = async (entrada: NovaVisao) => {
    const nova = await criarVisao(entrada);
    setCriandoVisao(false);
    await recarregarVisoes();
    setAtivo(chaveDaVisao(nova.id));
  };

  /**
   * Admin exclui qualquer visão; as demais pessoas só a própria visão pessoal (o servidor confere de novo). Ninguém escolhido
   * em "Você" = o dono da máquina, que conta como admin.
   */
  const podeExcluir = (visao: Visao) => idVoce === null || voce?.admin === true || (!visao.compartilhada && visao.dono !== null && visao.dono === idVoce);

  const pedirExclusao = (visao: Visao) => {
    setErroVisao(null);
    setExcluindoVisao(visao);
  };

  const excluir = async (visao: Visao) => {
    setErroVisao(null);
    try {
      await excluirVisao(visao.id, idVoce);
      setExcluindoVisao(null);
      setAtivo((atual) => (atual === chaveDaVisao(visao.id) ? 'planos' : atual));
      await recarregarVisoes();
    } catch (e) {
      setErroVisao(e instanceof Error ? e.message : 'Não foi possível excluir a visão.');
    }
  };

  /** "Abrir" de um lembrete do sino: escolhe o plano do lembrete e vai para a tela que resolve aquilo. */
  const abrirLembrete = (l: Lembrete) => {
    if (l.planoId) escolherPlano(l.planoId);
    if (l.tipo === 'teste_hoje') selecionar('lista');
    else if (l.tipo === 'plano_vencido') selecionar('release');
    else if (l.tipo === 'acao_retro') selecionar('retro');
    else selecionar('incidentes');
  };

  /** "abrir retro" do aviso de ações pendentes de retros anteriores: escolhe aquele plano e abre a Retro. */
  const abrirRetro = (idPlano: string) => {
    escolherPlano(idPlano);
    selecionar('retro');
  };

  const fecharCriar = useCallback(() => setCriandoVisao(false), []);
  const irParaPlanos = () => setAtivo('planos');
  const idVisao = idDaVisao(ativo);
  const visaoAtiva = idVisao ? (visoes.find((v) => v.id === idVisao) ?? null) : null;

  /** A tela de cada item do menu, sem Planos/Lista/Kanban (esses dependem de filtros e do plano). Vale também para visões salvas desses tipos. */
  const telaDe = (chave: ChaveItem) => {
    if (chave === 'roadmap') return <Roadmap onIrParaPlanos={irParaPlanos} />;
    if (chave === 'iteracoes') return <Iteracoes onIrParaPlanos={irParaPlanos} />;
    if (chave === 'planejamento') return <Planejamento onIrParaEquipe={() => setAtivo('equipe')} />;
    if (chave === 'lancamento') {
      return (
        <Lancamento
          planoId={planoAtivo?.id ?? null}
          onAbrirLista={(filtros) => {
            setFiltroLista((atual) => ({ filtros, n: (atual?.n ?? 0) + 1 }));
            setAtivo('lista');
          }}
          onIrParaPlanos={irParaPlanos}
        />
      );
    }
    if (chave === 'release') {
      return (
        <Release
          planoId={planoAtivo?.id ?? null}
          onAbrirIncidentes={() => setAtivo('incidentes')}
          onAbrirTeste={(idCenario) => {
            setFiltroLista((atual) => ({ filtros: SEM_FILTROS, n: (atual?.n ?? 0) + 1, teste: idCenario }));
            setAtivo('lista');
          }}
          onIrParaPlanos={irParaPlanos}
        />
      );
    }
    if (chave === 'retro') return <Retro planoId={planoAtivo?.id ?? null} onIrParaPlanos={irParaPlanos} />;
    if (chave === 'configuracoes') return <Configuracoes />;
    if (chave === 'incidentes') return <Incidentes />;
    if (chave === 'cenarios') return <Cenarios />;
    if (chave === 'equipe') return <Equipe />;
    return <Secao chave={chave} />;
  };

  const conteudo = () => {
    if (idVisao) {
      // A visão foi excluída (por outra pessoa, por exemplo): volta para Planos em vez de mostrar uma página vazia.
      if (!visaoAtiva) return <Planos onLista={setPlanos} />;
      const botaoExcluir = !podeExcluir(visaoAtiva) ? null : (
        <button
          type="button"
          onClick={() => pedirExclusao(visaoAtiva)}
          className="px-4 py-2 rounded-full border border-neon-error/40 bg-neon-error/10 text-sm font-bold text-neon-error hover:bg-neon-error/20 cursor-pointer"
        >
          Excluir visão
        </button>
      );
      // Roadmap, Release, Retro etc.: abre a tela do tipo, com uma faixa que diz qual visão salva é e deixa excluir.
      if (visaoAtiva.tipo !== 'lista' && visaoAtiva.tipo !== 'kanban') {
        return (
          <>
            {erroVisao && (
              <p role="alert" className="rounded-xl border border-neon-error/40 bg-neon-error/10 px-3 py-2 text-xs text-neon-error">
                {erroVisao}
              </p>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-bold text-on-surface-variant">{`Visão salva: ${visaoAtiva.nome}`}</p>
              {botaoExcluir}
            </div>
            {telaDe(visaoAtiva.tipo)}
          </>
        );
      }
      return (
        <>
          {erroVisao && (
            <p role="alert" className="rounded-xl border border-neon-error/40 bg-neon-error/10 px-3 py-2 text-xs text-neon-error">
              {erroVisao}
            </p>
          )}
          <PlanoPagina
            titulo={visaoAtiva.nome}
            icone={itemPorChave(visaoAtiva.tipo).icone}
            tipo={visaoAtiva.tipo}
            plano={planoAtivo}
            filtrosIniciais={filtrosDaVisao(visaoAtiva.filtros)}
            onAbrirRetro={abrirRetro}
            chaveReinicio={ativo}
            acoes={botaoExcluir}
            onIrParaPlanos={irParaPlanos}
            onMudou={() => void recarregarPlanos()}
          />
        </>
      );
    }
    const chave = ativo as ChaveItem;
    if (chave === 'planos') return <Planos onLista={setPlanos} />;
    if (chave === 'lista' || chave === 'kanban') {
      const { rotulo, icone } = itemPorChave(chave);
      return (
        <PlanoPagina
          titulo={rotulo}
          icone={icone}
          tipo={chave}
          plano={planoAtivo}
          filtrosIniciais={chave === 'lista' ? filtroLista?.filtros : undefined}
          testeInicial={chave === 'lista' ? filtroLista?.teste : undefined}
          onAbrirRetro={abrirRetro}
          chaveReinicio={chave === 'lista' ? `lista:${filtroLista?.n ?? 0}` : chave}
          onIrParaPlanos={irParaPlanos}
          onMudou={() => void recarregarPlanos()}
        />
      );
    }
    return telaDe(chave);
  };

  return (
    <Shell
      ativo={visaoAtiva || !idVisao ? ativo : 'planos'}
      onSelecionar={selecionar}
      planos={planos}
      planoAtivoId={planoAtivo?.id ?? null}
      onPlano={escolherPlano}
      visoes={visoes.map((v) => ({ ...v, podeExcluir: podeExcluir(v) }))}
      onExcluirVisao={(chave) => {
        const visao = visoes.find((v) => v.id === idDaVisao(chave));
        if (visao) pedirExclusao(visao);
      }}
      selos={incAbertos > 0 ? { incidentes: String(incAbertos) } : {}}
      onLembrete={abrirLembrete}
      fundo={fundo}
      onFundo={onFundo}
    >
      {conteudo()}
      {criandoVisao && <NovaVisaoModal onCriar={criar} onFechar={fecharCriar} />}
      {excluindoVisao && (
        <Sobreposicao>
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div role="alertdialog" aria-modal="true" aria-label="Confirmar exclusão da visão" className="w-full max-w-sm p-6 rounded-3xl bg-[#1a1a1a] border border-white/10 text-on-surface">
              <p className="text-sm font-bold">{`Excluir a visão ${excluindoVisao.nome}?`}</p>
              <p className="mt-2 text-xs text-on-surface-variant">
                {excluindoVisao.compartilhada ? 'Ela é compartilhada: some do menu de toda a equipe.' : 'Só a sua visão some; os testes e planos não mudam.'}
              </p>
              {erroVisao && (
                <p role="alert" className="mt-3 text-xs text-neon-error">
                  {erroVisao}
                </p>
              )}
              <div className="mt-5 flex justify-end gap-2">
                <button type="button" onClick={() => setExcluindoVisao(null)} className="px-4 py-2.5 rounded-xl text-xs font-bold bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer">
                  Manter
                </button>
                <button type="button" onClick={() => void excluir(excluindoVisao)} className="px-4 py-2.5 rounded-xl text-xs font-black bg-neon-error text-black cursor-pointer">
                  Excluir
                </button>
              </div>
            </div>
          </div>
        </Sobreposicao>
      )}
    </Shell>
  );
}

export default function App() {
  const [entrou, setEntrou] = useState(() => jaEntrou());
  const [fundo, setFundo] = useState(lerFundo);

  useEffect(() => {
    gravarFundo(fundo);
  }, [fundo]);

  return (
    <PessoasProvider>
      {/* O fundo animado do Admin fica atrás da entrada e do shell; a escolha de imagem é por pessoa. */}
      <GridRevealBackdrop src={fundo.src} opacity={fundo.opacity} dither ditherCellSize={fundo.ditherCellSize} ditherColor="#00ff9d" />
      {entrou ? (
        <IncidentesProvider>
          <LembretesProvider>
            <PresencaProvider>
              <Logado fundo={fundo} onFundo={setFundo} />
            </PresencaProvider>
          </LembretesProvider>
        </IncidentesProvider>
      ) : (
        <Entrada
          onEntrar={() => {
            registrarEntrada();
            setEntrou(true);
          }}
        />
      )}
    </PessoasProvider>
  );
}
