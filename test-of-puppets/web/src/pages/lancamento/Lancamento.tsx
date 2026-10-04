import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { usePessoas } from '../../pessoas/ContextoPessoas.tsx';
import { itemPorChave } from '../../shell/menu.ts';
import { ErroApi } from '../cenarios/clienteApi.ts';
import { obterPlano, type DetalhePlano, type ItemPlano } from '../planos/clientePlanos.ts';
import { formatarData, hojeISO } from '../planos/datas.ts';
import { SEM_FILTROS, SEM_VALOR, type Filtros } from '../planos/filtros.ts';
import {
  agrupar,
  bloqueios,
  COLUNAS,
  colunaDe,
  contar,
  diasUteisAte,
  notaDeMassa,
  percentualPronto,
  respPrincipal,
  textoDaCelula,
  type Coluna,
  type Linha,
  type Linhas,
  type Valor,
} from './quadroLancamento.ts';

interface Props {
  /** O plano escolhido no cabeçalho; null quando ainda não existe nenhum. */
  planoId: string | null;
  /** Data de "hoje" (aaaa-mm-dd); só os testes passam isto. */
  hoje?: string;
  /** Abre a Lista já com estes filtros. */
  onAbrirLista: (filtros: Filtros) => void;
  onIrParaPlanos: () => void;
}

const botao =
  'flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/5 text-sm font-bold text-on-surface-variant hover:bg-white/10 disabled:opacity-60 cursor-pointer';
const campo = 'rounded-lg border border-white/10 bg-volt-page px-2.5 py-2 text-xs text-on-surface outline-none focus:border-volt-green/50';
const ROTULO_LINHAS: Record<Linhas, string> = { funcionalidade: 'Funcionalidade', responsavel: 'Responsável', prioridade: 'Prioridade' };

const diasUteis = (n: number) => `${n} ${n === 1 ? 'dia útil' : 'dias úteis'}`;

function Barra({ percentual, rotulo }: { percentual: number; rotulo: string }) {
  return (
    <div role="progressbar" aria-label={rotulo} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentual} className="h-2 w-40 overflow-hidden rounded-full bg-white/10">
      <div className="h-full bg-volt-green" style={{ width: `${percentual}%` }} />
    </div>
  );
}

/**
 * Lançamento (V5): cruza funcionalidade (ou responsável, ou prioridade) com o andamento do plano escolhido.
 * Cada número abre a Lista já filtrada por aquela combinação. Só leitura: nada é gravado aqui.
 */
export default function Lancamento({ planoId, hoje: hojeProp, onAbrirLista, onIrParaPlanos }: Props) {
  const hoje = hojeProp ?? hojeISO();
  const { rotulo, icone: Icone } = itemPorChave('lancamento');
  const { nome, ativas } = usePessoas();
  const [dados, setDados] = useState<DetalhePlano | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [atualizando, setAtualizando] = useState(false);
  const [linhas, setLinhas] = useState<Linhas>('funcionalidade');
  const [valor, setValor] = useState<Valor>('quantidade');
  const [resp, setResp] = useState('');

  const carregar = useCallback(async () => {
    if (!planoId) {
      setDados(null);
      return;
    }
    setAtualizando(true);
    try {
      setDados(await obterPlano(planoId));
      setErro(null);
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Erro inesperado.');
    } finally {
      setAtualizando(false);
    }
  }, [planoId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const todos = useMemo<ItemPlano[]>(() => dados?.itens ?? [], [dados]);
  const itens = useMemo(
    () => todos.filter((i) => !resp || (resp === SEM_VALOR ? !i.responsavel : i.responsavel === resp)),
    [todos, resp],
  );
  const grupos = useMemo(() => agrupar(itens, linhas, nome), [itens, linhas, nome]);
  const total = useMemo(() => contar(itens), [itens]);
  const colunas = COLUNAS.filter((c) => c.chave !== 'sem_resultado' || total.sem_resultado.n > 0);
  const responsaveis = useMemo(
    () => [...new Set([...ativas.map((p) => p.id), ...todos.map((i) => i.responsavel).filter((r): r is string => Boolean(r))])],
    [ativas, todos],
  );
  const bloqueados = useMemo(() => bloqueios(itens), [itens]);
  const pronto = percentualPronto(itens);

  /** Os filtros da Lista para uma linha (e coluna, se houver); respeita o filtro de responsável da tela. */
  const filtrosDe = (linha: Linha, coluna?: Coluna): Filtros => {
    const f: Filtros = { ...SEM_FILTROS, ...(coluna?.filtro ?? {}) };
    if (resp) f.responsavel = resp;
    if (linha.filtro !== null) (f as unknown as Record<string, string>)[linhas] = linha.filtro;
    return f;
  };

  const marco = () => {
    const previsao = dados?.plano.previsao;
    if (!previsao) return 'Sem previsão definida';
    const dias = diasUteisAte(hoje, previsao);
    const quando = dias === 0 ? 'é hoje' : dias > 0 ? diasUteis(dias) : `venceu há ${diasUteis(-dias)}`;
    return `Próximo marco: previsão ${formatarData(previsao)} (${quando})`;
  };

  return (
    <section aria-label={rotulo} className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="flex items-center gap-3 text-xl font-black uppercase tracking-tight text-on-surface">
          <Icone size={22} className="text-volt-green" aria-hidden />
          {rotulo}
        </h2>
        <button type="button" onClick={() => void carregar()} disabled={atualizando || !planoId} className={botao}>
          <RefreshCw size={16} className={atualizando ? 'animate-spin' : ''} aria-hidden />
          Atualizar
        </button>
      </div>

      {erro && (
        <p role="alert" className="rounded-xl border border-neon-error/40 bg-neon-error/10 px-3 py-2 text-xs text-neon-error">
          {`Não foi possível carregar o plano. ${erro}`}
        </p>
      )}

      {!planoId && (
        <div className="rounded-3xl border border-white/10 bg-volt-surface/80 p-8 text-center text-sm text-on-surface-variant flex flex-col items-center gap-3">
          <p>Nenhum plano para mostrar. Crie um plano e escolha-o no cabeçalho.</p>
          <button type="button" onClick={onIrParaPlanos} className="px-4 py-2 rounded-full border border-volt-green/40 bg-volt-green/10 text-sm font-black text-volt-green hover:bg-volt-green/20 cursor-pointer">
            Ir para Planos
          </button>
        </div>
      )}

      {dados && (
        <>
          <div className="rounded-3xl border border-white/10 bg-volt-surface/80 backdrop-blur-sm p-5 flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-lg font-black tracking-tight">{`Lançamento do plano ${dados.plano.nome}`}</h3>
              <div className="flex flex-wrap items-center gap-4 text-xs text-on-surface-variant">
                <span data-testid="marco">{marco()}</span>
                <span className="flex items-center gap-2 font-bold text-on-surface">
                  Pronto
                  <Barra percentual={pronto} rotulo="Pronto do plano" />
                  {`${pronto}%`}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-on-surface-variant">
              <label className="flex items-center gap-2">
                Linhas
                <select value={linhas} onChange={(e) => setLinhas(e.target.value as Linhas)} className={campo}>
                  {(Object.keys(ROTULO_LINHAS) as Linhas[]).map((l) => (
                    <option key={l} value={l}>
                      {ROTULO_LINHAS[l]}
                    </option>
                  ))}
                </select>
              </label>
              <span>Colunas: Status</span>
              <label className="flex items-center gap-2">
                Valor
                <select value={valor} onChange={(e) => setValor(e.target.value as Valor)} className={campo}>
                  <option value="quantidade">Qtd de testes</option>
                  <option value="minutos">Minutos estimados</option>
                  <option value="percentual">% do total</option>
                </select>
              </label>
              <label className="flex items-center gap-2">
                Resp.
                <select value={resp} onChange={(e) => setResp(e.target.value)} className={campo}>
                  <option value="">Todos</option>
                  <option value={SEM_VALOR}>Sem responsável</option>
                  {responsaveis.map((id) => (
                    <option key={id} value={id}>
                      {nome(id)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {itens.length === 0 ? (
              <p className="py-6 text-center text-sm text-on-surface-variant">{todos.length === 0 ? 'Este plano ainda não tem testes' : 'Nenhum teste com este filtro'}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[40rem] text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wide text-on-surface-variant">
                      <th className="py-2 pr-3">{ROTULO_LINHAS[linhas]}</th>
                      {linhas === 'funcionalidade' && <th className="py-2 pr-3">Resp. principal</th>}
                      {colunas.map((c) => (
                        <th key={c.chave} className="py-2 px-2 text-center">{c.rotulo}</th>
                      ))}
                      <th className="py-2 px-2 text-center">Pronto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grupos.map((g) => {
                      const cont = contar(g.itens);
                      return (
                        <tr key={g.chave || '__sem'} data-testid={`linha-${g.chave || '__sem'}`} className="border-t border-white/5">
                          <th scope="row" className="py-2 pr-3 text-left font-bold">
                            {g.filtro === null ? (
                              g.rotulo
                            ) : (
                              <button type="button" onClick={() => onAbrirLista(filtrosDe(g))} aria-label={`Abrir a Lista só de ${g.rotulo}`} className="underline-offset-2 hover:underline hover:text-volt-green cursor-pointer">
                                {g.rotulo}
                              </button>
                            )}
                          </th>
                          {linhas === 'funcionalidade' && <td className="py-2 pr-3 text-on-surface-variant">{respPrincipal(g.itens, nome)}</td>}
                          {colunas.map((c) => {
                            const texto = textoDaCelula(valor, cont[c.chave], itens.length);
                            return (
                              <td key={c.chave} className="py-2 px-2 text-center">
                                {cont[c.chave].n > 0 && g.filtro !== null ? (
                                  <button
                                    type="button"
                                    onClick={() => onAbrirLista(filtrosDe(g, c))}
                                    aria-label={`${g.rotulo} × ${c.rotulo}: ${texto}`}
                                    className="min-w-8 rounded-md px-2 py-0.5 font-black hover:bg-volt-green/15 hover:text-volt-green cursor-pointer"
                                  >
                                    {texto}
                                  </button>
                                ) : (
                                  <span className={cont[c.chave].n > 0 ? 'font-black' : 'text-on-surface-variant/60'}>{texto}</span>
                                )}
                              </td>
                            );
                          })}
                          <td className="py-2 px-2 text-center font-black">{`${percentualPronto(g.itens)}%`}</td>
                        </tr>
                      );
                    })}
                    <tr data-testid="linha-total" className="border-t-2 border-white/20 font-black">
                      <th scope="row" className="py-2 pr-3 text-left">TOTAL</th>
                      {linhas === 'funcionalidade' && <td />}
                      {colunas.map((c) => (
                        <td key={c.chave} className="py-2 px-2 text-center">{textoDaCelula(valor, total[c.chave], itens.length)}</td>
                      ))}
                      <td className="py-2 px-2 text-center">{`${pronto}%`}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {itens.length > 0 && (
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-volt-surface/80 backdrop-blur-sm p-5 flex flex-col gap-3">
                <h3 className="text-sm font-black uppercase tracking-wide">{`Pronto por ${ROTULO_LINHAS[linhas].toLowerCase()}`}</h3>
                {grupos.map((g) => {
                  const p = percentualPronto(g.itens);
                  const passaram = g.itens.filter((i) => colunaDe(i) === 'passou').length;
                  const nota = notaDeMassa(g.itens);
                  return (
                    <div key={g.chave || '__sem'} className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                      <span className="w-32 truncate font-bold">{g.rotulo}</span>
                      <Barra percentual={p} rotulo={`Pronto de ${g.rotulo}`} />
                      <span className="font-black">{`${p}%`}</span>
                      <span className="text-on-surface-variant">{`${passaram} de ${g.itens.length} passaram`}</span>
                      {nota && <span className="text-on-surface-variant">{nota}</span>}
                    </div>
                  );
                })}
              </div>

              <div className="rounded-3xl border border-white/10 bg-volt-surface/80 backdrop-blur-sm p-5 flex flex-col gap-2">
                <h3 className="text-sm font-black uppercase tracking-wide">Bloqueios</h3>
                {bloqueados.length === 0 ? (
                  <p className="text-xs text-on-surface-variant">Nenhum teste esperando outro.</p>
                ) : (
                  bloqueados.map((b) => (
                    <p key={b.idCenario} className="text-xs">
                      <span className="font-black">{b.grupo}</span>
                      <span className="ml-2 text-on-surface-variant">{b.texto}</span>
                    </p>
                  ))
                )}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
