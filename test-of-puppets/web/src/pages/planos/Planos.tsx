import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, RefreshCw } from 'lucide-react';
import { ErroApi } from '../cenarios/clienteApi.ts';
import { itemPorChave } from '../../shell/menu.ts';
import { usePessoas } from '../../pessoas/ContextoPessoas.tsx';
import { carregarSemente, criarPlano, listarPlanos, type NovoPlano, type PlanoResumido } from './clientePlanos.ts';
import { formatarData } from './datas.ts';
import NovoPlanoModal from './NovoPlanoModal.tsx';
import PlanoDetalhe from './PlanoDetalhe.tsx';

type Aba = 'em_execucao' | 'executados';

const botao =
  'flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/5 text-sm font-bold text-on-surface-variant hover:bg-white/10 disabled:opacity-60 cursor-pointer';

function Cartao({ plano, aoAbrir }: { plano: PlanoResumido; aoAbrir: () => void }) {
  const { resumo } = plano;
  return (
    <button
      type="button"
      onClick={aoAbrir}
      className="text-left rounded-3xl border border-white/10 bg-volt-surface/80 backdrop-blur-sm p-5 flex flex-col gap-2 hover:border-volt-green/40 transition-colors cursor-pointer"
    >
      <span data-testid="plano-nome" className="text-lg font-black tracking-tight">
        {plano.nome}
      </span>
      <span className="text-xs text-on-surface-variant">{`Criado em: ${formatarData(plano.criadoEm)}`}</span>
      <span className="text-xs text-on-surface-variant">{`Previsão de término: ${formatarData(plano.previsao)}`}</span>
      <div
        role="progressbar"
        aria-label="Progresso do plano"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={resumo.percentual}
        className="mt-1 h-2 w-full overflow-hidden rounded-full bg-white/10"
      >
        <div className="h-full bg-volt-green" style={{ width: `${resumo.percentual}%` }} />
      </div>
      <span className="text-xs font-bold">{`${resumo.percentual}% executado`}</span>
      <span className="text-xs text-on-surface-variant">
        {resumo.total === 0 ? '0 teste(s) · vazio' : `${resumo.total} teste(s) · ${resumo.pendentes} pendente(s)`}
      </span>
    </button>
  );
}

/** Tela "Planos de Execução" (T4): cards com progresso, abas, busca, ordem e o modal Novo Plano. */
export default function Planos({ onLista }: { onLista?: (planos: PlanoResumido[]) => void } = {}) {
  const { rotulo, icone: Icone } = itemPorChave('planos');
  const [planos, setPlanos] = useState<PlanoResumido[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [atualizando, setAtualizando] = useState(false);
  const [aba, setAba] = useState<Aba>('em_execucao');
  const [busca, setBusca] = useState('');
  const [crescente, setCrescente] = useState(true);
  const [novoAberto, setNovoAberto] = useState(false);
  const [detalheId, setDetalheId] = useState<string | null>(null);
  const [semeando, setSemeando] = useState(false);
  const [erroSemente, setErroSemente] = useState<string | null>(null);
  const { recarregar: recarregarEquipe } = usePessoas();

  const carregar = useCallback(async () => {
    setAtualizando(true);
    try {
      const lista = await listarPlanos();
      setPlanos(lista);
      onLista?.(lista); // o seletor "Plano" do cabeçalho acompanha a lista que esta tela acabou de ler
      setErro(null);
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Erro inesperado.');
    } finally {
      setAtualizando(false);
    }
  }, [onLista]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const fecharNovo = useCallback(() => setNovoAberto(false), []);
  const fecharDetalhe = useCallback(() => setDetalheId(null), []);
  const detalheMudou = useCallback(() => void carregar(), [carregar]);

  const todos = useMemo(() => planos ?? [], [planos]);
  const emExecucao = useMemo(() => todos.filter((p) => !p.resumo.executado), [todos]);
  const executados = useMemo(() => todos.filter((p) => p.resumo.executado), [todos]);

  const visiveis = useMemo(() => {
    const daAba = aba === 'em_execucao' ? emExecucao : executados;
    const termo = busca.trim().toLowerCase();
    const filtrados = termo ? daAba.filter((p) => p.nome.toLowerCase().includes(termo)) : daAba;
    return crescente ? filtrados : [...filtrados].reverse();
  }, [aba, emExecucao, executados, busca, crescente]);

  const carregarExemplos = async () => {
    setSemeando(true);
    setErroSemente(null);
    try {
      await carregarSemente();
      await Promise.all([carregar(), recarregarEquipe()]);
    } catch (e) {
      setErroSemente(e instanceof ErroApi ? e.message : 'Não foi possível carregar os dados de exemplo.');
    } finally {
      setSemeando(false);
    }
  };

  const criar = async (entrada: NovoPlano) => {
    await criarPlano(entrada);
    setNovoAberto(false);
    await carregar();
  };

  const vazio = (): string => {
    if (todos.length === 0) return 'Nenhum plano ainda';
    if (busca.trim()) return 'Nenhum plano encontrado para esta busca';
    return aba === 'em_execucao' ? 'Nenhum plano em execução' : 'Nenhum plano executado ainda';
  };

  const abas: { chave: Aba; texto: string }[] = [
    { chave: 'em_execucao', texto: `Em execução (${emExecucao.length})` },
    { chave: 'executados', texto: `Executados (${executados.length})` },
  ];

  return (
    <section aria-label={rotulo} className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="flex items-center gap-3 text-xl font-black uppercase tracking-tight text-on-surface">
          <Icone size={22} className="text-volt-green" aria-hidden />
          {rotulo}
        </h2>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => void carregar()} disabled={atualizando} className={botao}>
            <RefreshCw size={16} className={atualizando ? 'animate-spin' : ''} aria-hidden />
            Atualizar
          </button>
          <button
            type="button"
            onClick={() => setNovoAberto(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-volt-green text-black text-sm font-black cursor-pointer"
          >
            <Plus size={16} aria-hidden />
            Novo Plano
          </button>
        </div>
      </div>

      {erro && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-neon-error/40 bg-neon-error/10 p-4 text-sm text-neon-error">
          <span>Não foi possível carregar os planos. {erro}</span>
          <button type="button" onClick={() => void carregar()} className={botao}>
            Tentar de novo
          </button>
        </div>
      )}

      {planos && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              aria-label="Buscar plano"
              placeholder="Buscar plano pelo nome…"
              className="flex-1 min-w-[14rem] p-2.5 rounded-xl text-sm bg-volt-page border border-white/20 text-on-surface outline-none focus:border-volt-green/50"
            />
            <button type="button" onClick={() => setCrescente((c) => !c)} className={botao}>
              {crescente ? <ArrowUp size={14} aria-hidden /> : <ArrowDown size={14} aria-hidden />}
              {crescente ? 'Ordenar: Crescente' : 'Ordenar: Decrescente'}
            </button>
          </div>

          <div role="tablist" className="flex gap-2">
            {abas.map(({ chave, texto }) => (
              <button
                key={chave}
                type="button"
                role="tab"
                aria-selected={aba === chave}
                onClick={() => setAba(chave)}
                className={`px-4 py-2 rounded-xl text-sm font-bold border cursor-pointer transition-colors ${
                  aba === chave ? 'bg-volt-surface text-volt-green border-volt-green/30' : 'bg-white/5 text-on-surface-variant border-white/10 hover:bg-white/10'
                }`}
              >
                {texto}
              </button>
            ))}
          </div>

          {visiveis.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-volt-surface/80 p-8 text-center text-sm text-on-surface-variant flex flex-col items-center gap-3">
              <p>{vazio()}</p>
              {todos.length === 0 && (
                <>
                  <p className="text-xs">Para conhecer a ferramenta, carregue 8 cenários, 3 pessoas e 3 planos fictícios (CPFs de exemplo, sem dados reais).</p>
                  <button
                    type="button"
                    onClick={() => void carregarExemplos()}
                    disabled={semeando}
                    className="px-4 py-2 rounded-full border border-volt-green/40 bg-volt-green/10 text-sm font-black text-volt-green hover:bg-volt-green/20 disabled:opacity-50 cursor-pointer"
                  >
                    Carregar dados de exemplo
                  </button>
                  {erroSemente && <p role="alert" className="text-xs text-neon-error">{erroSemente}</p>}
                </>
              )}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {visiveis.map((p) => (
                <Cartao key={p.id} plano={p} aoAbrir={() => setDetalheId(p.id)} />
              ))}
            </div>
          )}
        </>
      )}

      {novoAberto && <NovoPlanoModal planos={todos} onCriar={criar} onFechar={fecharNovo} />}
      {detalheId && <PlanoDetalhe id={detalheId} onFechar={fecharDetalhe} onMudou={detalheMudou} />}
    </section>
  );
}
