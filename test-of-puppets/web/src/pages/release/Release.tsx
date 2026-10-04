import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { Check, RefreshCw, X } from 'lucide-react';
import { useIncidentes } from '../../incidentes/ContextoIncidentes.tsx';
import { usePessoas } from '../../pessoas/ContextoPessoas.tsx';
import { itemPorChave } from '../../shell/menu.ts';
import { ErroApi } from '../cenarios/clienteApi.ts';
import { diasUteisAte } from '../lancamento/quadroLancamento.ts';
import { obterPlano, registrarDecisao, type DetalhePlano } from '../planos/clientePlanos.ts';
import { formatarData, hojeISO } from '../planos/datas.ts';
import {
  calcularCriterios,
  cumpridos,
  estadoDaDecisao,
  listarCriterios,
  montarPendencias,
  naoAtendidos,
  prontidaoPorPessoa,
  prontidaoPorPrioridade,
  ROTULO_DECISAO,
  TOTAL_CRITERIOS,
  type Prontidao,
} from './calculoRelease.ts';
import DecisaoModal, { type EntradaDecisao } from './DecisaoModal.tsx';

interface Props {
  /** O plano escolhido no cabeçalho; null quando ainda não existe nenhum. */
  planoId: string | null;
  /** Data de "hoje" (aaaa-mm-dd); só os testes passam isto. */
  hoje?: string;
  /** Abre a tela de Incidentes (o "abrir INC" de um critério). */
  onAbrirIncidentes: () => void;
  /** Abre o teste na Lista (o "abrir teste" de um critério e a pendência de um teste). */
  onAbrirTeste: (idCenario: string) => void;
  onIrParaPlanos: () => void;
}

const botao =
  'flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/5 text-sm font-bold text-on-surface-variant hover:bg-white/10 disabled:opacity-60 cursor-pointer';
const cartao = 'rounded-3xl border border-white/10 bg-volt-surface/80 backdrop-blur-sm p-5 flex flex-col gap-3';
const LIMITE_PENDENCIAS = 5;

const diasUteis = (n: number) => `${n} ${n === 1 ? 'dia útil' : 'dias úteis'}`;
const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

function Barra({ percentual, rotulo }: { percentual: number; rotulo: string }) {
  return (
    <div role="progressbar" aria-label={rotulo} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentual} className="h-2 w-40 overflow-hidden rounded-full bg-white/10">
      <div className="h-full bg-volt-green" style={{ width: `${percentual}%` }} />
    </div>
  );
}

function LinhaProntidao({ p, texto }: { p: Prontidao; texto: string }) {
  const percentual = p.total === 0 ? 0 : Math.round((p.passou / p.total) * 100);
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs" data-testid={`prontidao-${p.chave}`}>
      <span className="w-28 truncate font-bold">{p.rotulo}</span>
      <Barra percentual={percentual} rotulo={`Prontidão de ${p.rotulo}`} />
      <span className="text-on-surface-variant">{texto}</span>
    </div>
  );
}

/**
 * Release (V4): mostra se o plano está pronto para liberar. Os 7 critérios saem dos dados (nada se marca à mão);
 * só a decisão final é humana e fica registrada no plano, com autor e justificativa (M15).
 */
export default function Release({ planoId, hoje: hojeProp, onAbrirIncidentes, onAbrirTeste, onIrParaPlanos }: Props) {
  const hoje = hojeProp ?? hojeISO();
  const { rotulo, icone: Icone } = itemPorChave('release');
  const { nome, ativas, voce } = usePessoas();
  const { incidentes, recarregar: recarregarIncidentes } = useIncidentes();
  const [dados, setDados] = useState<DetalhePlano | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [atualizando, setAtualizando] = useState(false);
  const [abertos, setAbertos] = useState<number[]>([]);
  const [todasPendencias, setTodasPendencias] = useState(false);
  const [decidindo, setDecidindo] = useState(false);

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

  const entrada = useMemo(() => ({ itens: dados?.itens ?? [], incidentes, previsao: dados?.plano.previsao, hoje, nome }), [dados, incidentes, hoje, nome]);
  const criterios = useMemo(() => calcularCriterios(entrada), [entrada]);
  const pendentes = naoAtendidos(criterios);
  const ok = cumpridos(criterios);
  const percentual = Math.round((ok / TOTAL_CRITERIOS) * 100);
  const estado = useMemo(() => estadoDaDecisao(dados?.plano.decisoes, entrada.itens, incidentes), [dados, entrada.itens, incidentes]);
  const pendencias = useMemo(() => montarPendencias(entrada, criterios), [entrada, criterios]);
  const historico = useMemo(() => [...(dados?.plano.decisoes ?? [])].reverse(), [dados]);
  const situacao = estado.reavaliar ? 'REAVALIAR' : ok === TOTAL_CRITERIOS ? 'GO' : 'NO-GO';
  const visiveis = todasPendencias ? pendencias : pendencias.slice(0, LIMITE_PENDENCIAS);

  const atualizar = async () => {
    await Promise.all([carregar(), recarregarIncidentes()]);
  };

  const registrar = async (nova: EntradaDecisao) => {
    if (!planoId) return;
    setDados(await registrarDecisao(planoId, nova));
    setDecidindo(false);
  };

  const alternar = (n: number) => setAbertos((lista) => (lista.includes(n) ? lista.filter((x) => x !== n) : [...lista, n]));

  const alvo = () => {
    const previsao = dados?.plano.previsao;
    if (!previsao) return 'Sem previsão definida';
    const dias = diasUteisAte(hoje, previsao);
    return `Alvo ${formatarData(previsao)} (${dias === 0 ? 'é hoje' : dias > 0 ? diasUteis(dias) : `venceu há ${diasUteis(-dias)}`})`;
  };

  return (
    <section aria-label={rotulo} className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="flex items-center gap-3 text-xl font-black uppercase tracking-tight text-on-surface">
          <Icone size={22} className="text-volt-green" aria-hidden />
          {rotulo}
        </h2>
        <button type="button" onClick={() => void atualizar()} disabled={atualizando || !planoId} className={botao}>
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
          <div className={cartao}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-lg font-black tracking-tight">{`Release do plano ${dados.plano.nome}`}</h3>
              <div className="flex flex-wrap items-center gap-4 text-xs text-on-surface-variant">
                <span data-testid="alvo">{alvo()}</span>
                <span
                  data-testid="situacao"
                  className={`rounded-full border px-3 py-1 font-black ${situacao === 'GO' ? 'border-volt-green/50 bg-volt-green/10 text-volt-green' : situacao === 'REAVALIAR' ? 'border-amber-400/50 bg-amber-400/10 text-amber-300' : 'border-neon-error/40 bg-neon-error/10 text-neon-error'}`}
                >
                  {`Situação: ${situacao}`}
                </span>
              </div>
            </div>

            {estado.liberado && estado.ultima && (
              <p data-testid="selo-liberado" className="text-xs font-bold text-volt-green">
                {`Liberado em ${formatarData(estado.ultima.em)} por ${nome(estado.ultima.por)}`}
              </p>
            )}
            {estado.reavaliar && estado.ultima && (
              <p role="status" data-testid="aviso-reavaliar" className="rounded-xl border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
                {`${nome(estado.ultima.por)} decidiu ${ROTULO_DECISAO[estado.ultima.decisao]} em ${formatarData(estado.ultima.em)}, mas ${[
                  estado.mudaramDepois.length > 0 ? `${estado.mudaramDepois.join(', ')} mudou` : '',
                  estado.incDepois.length > 0 ? `${estado.incDepois.join(', ')} foi aberto` : '',
                ]
                  .filter(Boolean)
                  .join(' e ')} depois. Reavalie e registre uma nova decisão.`}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-3 text-sm font-bold">
              <span data-testid="cumpridos">{`Critérios cumpridos ${ok} de ${TOTAL_CRITERIOS}`}</span>
              <Barra percentual={percentual} rotulo="Critérios cumpridos" />
              <span>{`${percentual}%`}</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[34rem] text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-on-surface-variant">
                    <th className="py-2 pr-2 w-8">#</th>
                    <th className="py-2 pr-3">Critério</th>
                    <th className="py-2 pr-3">Atual</th>
                    <th className="py-2">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {criterios.map((c) => {
                    const aberto = abertos.includes(c.numero);
                    return (
                      <Fragment key={c.numero}>
                        <tr data-testid={`criterio-${c.numero}`} className="border-t border-white/5">
                          <td className="py-2 pr-2 font-black text-on-surface-variant">{c.numero}</td>
                          <th scope="row" className="py-2 pr-3 text-left font-bold">{c.titulo}</th>
                          <td className="py-2 pr-3 text-on-surface-variant">{c.atual}</td>
                          <td className="py-2">
                            <span className="flex items-center gap-3">
                              {c.ok ? (
                                <span className="flex items-center gap-1 font-black text-volt-green"><Check size={16} aria-hidden />Cumprido</span>
                              ) : (
                                <span className="flex items-center gap-1 font-black text-neon-error"><X size={16} aria-hidden />Pendente</span>
                              )}
                              {c.detalhes.length > 0 && (
                                <button
                                  type="button"
                                  aria-expanded={aberto}
                                  aria-label={`${aberto ? 'Ocultar' : 'Ver'} critério ${c.numero}`}
                                  onClick={() => alternar(c.numero)}
                                  className="text-xs underline-offset-2 hover:underline hover:text-volt-green cursor-pointer"
                                >
                                  {aberto ? 'ocultar' : 'ver'}
                                </button>
                              )}
                            </span>
                          </td>
                        </tr>
                        {aberto && (
                          <tr>
                            <td />
                            <td colSpan={3} className="pb-3">
                              <ul className="flex flex-col gap-1 text-xs text-on-surface-variant">
                                {c.detalhes.map((d) => (
                                  <li key={d.texto} className="flex flex-wrap items-center gap-3">
                                    <span>{d.texto}</span>
                                    {d.idCenario && (
                                      <button type="button" onClick={() => onAbrirTeste(d.idCenario as string)} aria-label={`Abrir o teste ${d.idCenario}`} className="font-bold text-volt-green hover:underline cursor-pointer">
                                        abrir teste
                                      </button>
                                    )}
                                    {d.numeroInc && (
                                      <button type="button" onClick={onAbrirIncidentes} aria-label={`Abrir o INC ${d.numeroInc}`} className="font-bold text-volt-green hover:underline cursor-pointer">
                                        abrir INC
                                      </button>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <div className={cartao}>
              <h3 className="text-sm font-black uppercase tracking-wide">Prontidão por prioridade</h3>
              {prontidaoPorPrioridade(entrada.itens).map((p) => (
                <LinhaProntidao key={p.chave} p={p} texto={`${p.passou}/${p.total}`} />
              ))}
              {entrada.itens.length === 0 && <p className="text-xs text-on-surface-variant">Este plano ainda não tem testes</p>}
            </div>
            <div className={cartao}>
              <h3 className="text-sm font-black uppercase tracking-wide">Prontidão por pessoa</h3>
              {prontidaoPorPessoa(entrada.itens, nome).map((p) => (
                <LinhaProntidao key={p.chave} p={p} texto={`${p.passou}/${p.total} passou${p.falhou > 0 ? ` (${p.falhou} ${p.falhou === 1 ? 'falha' : 'falhas'})` : ''}`} />
              ))}
              {entrada.itens.length === 0 && <p className="text-xs text-on-surface-variant">Este plano ainda não tem testes</p>}
            </div>
          </div>

          <div className={cartao}>
            <h3 className="text-sm font-black uppercase tracking-wide">Pendências para liberar (ordem de impacto)</h3>
            {pendencias.length === 0 ? (
              <p className="text-xs text-on-surface-variant">Nada pendente.</p>
            ) : (
              <>
                <ol data-testid="pendencias" className="flex flex-col gap-1 text-xs">
                  {visiveis.map((p, i) => (
                    <li key={p.chave} className="flex flex-wrap gap-x-2">
                      {p.tipo === 'plano' ? (
                        <span className="font-black">{`${i + 1}. ${p.ref} ${p.etiqueta}`}</span>
                      ) : (
                        <button
                          type="button"
                          aria-label={`Abrir pendência: ${p.ref}`}
                          onClick={() => (p.tipo === 'teste' ? onAbrirTeste(p.ref) : onAbrirIncidentes())}
                          className="font-black text-left hover:text-volt-green hover:underline cursor-pointer"
                        >
                          {`${i + 1}. ${p.ref} ${p.etiqueta}`}
                        </button>
                      )}
                      <span className="font-bold">{p.quem}</span>
                      <span className="text-on-surface-variant">{p.acao}</span>
                    </li>
                  ))}
                </ol>
                {pendencias.length > LIMITE_PENDENCIAS && (
                  <button type="button" onClick={() => setTodasPendencias((v) => !v)} className="self-start text-xs font-bold text-volt-green hover:underline cursor-pointer">
                    {todasPendencias ? 'Mostrar menos' : `... ${pendencias.length - LIMITE_PENDENCIAS} itens a mais · Ver todos`}
                  </button>
                )}
              </>
            )}
          </div>

          <div className={cartao}>
            <h3 className="text-sm font-black uppercase tracking-wide">Decisão</h3>
            <p data-testid="situacao-atual" className="text-sm">
              {`Situação atual: ${situacao} — ${pendentes.length === 0 ? 'todos os critérios cumpridos' : `critérios ${listarCriterios(pendentes)} não atendidos`}.`}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setDecidindo(true)}
                className="px-4 py-2 rounded-full border border-volt-green/40 bg-volt-green/10 text-sm font-black text-volt-green hover:bg-volt-green/20 cursor-pointer"
              >
                Registrar decisão GO/NO-GO
              </button>
              <span className="text-xs text-on-surface-variant">GO só habilita com 7 de 7, exceto com exceção justificada.</span>
            </div>

            <h4 className="pt-2 text-xs font-black uppercase tracking-wide text-on-surface-variant">Histórico de decisões</h4>
            {historico.length === 0 ? (
              <p className="text-xs text-on-surface-variant">(nenhuma ainda)</p>
            ) : (
              <ul data-testid="historico-decisoes" className="flex flex-col gap-1 text-xs">
                {historico.map((d) => (
                  <li key={d.id} className="flex flex-wrap gap-x-3">
                    <span className="text-on-surface-variant">{`${formatarData(d.em)} ${hora(d.em)}`}</span>
                    <span className={`font-black ${d.decisao === 'go' ? 'text-volt-green' : d.decisao === 'go_excecao' ? 'text-amber-300' : 'text-neon-error'}`}>{ROTULO_DECISAO[d.decisao]}</span>
                    <span className="font-bold">{nome(d.por)}</span>
                    <span>{`"${d.justificativa}"`}</span>
                    {d.decisao === 'go_excecao' && <span className="text-amber-300">{`exceção nos critérios ${listarCriterios(d.criterios)}`}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {decidindo && dados && (
        <DecisaoModal planoNome={dados.plano.nome} criterios={criterios} pessoas={ativas} voce={voce} onRegistrar={registrar} onFechar={() => setDecidindo(false)} />
      )}
    </section>
  );
}
