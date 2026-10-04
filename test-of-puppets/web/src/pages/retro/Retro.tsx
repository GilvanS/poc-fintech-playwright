import { useCallback, useEffect, useMemo, useState } from 'react';
import { Lock, LockOpen, Plus, RefreshCw, Sparkles } from 'lucide-react';
import { criarIncidente } from '../../incidentes/clienteIncidentes.ts';
import { useIncidentes } from '../../incidentes/ContextoIncidentes.tsx';
import { usePessoas } from '../../pessoas/ContextoPessoas.tsx';
import {
  adicionarAcao,
  adicionarNota,
  editarAcao,
  excluirAcao,
  excluirNota,
  mudarEstadoRetro,
  obterRetro,
  ROTULO_COLUNA,
  votarNota,
  type Acao,
  type ColunaNota,
  type Nota,
  type Retro as DadosRetro,
} from '../../retros/clienteRetros.ts';
import { itemPorChave } from '../../shell/menu.ts';
import { ErroApi } from '../cenarios/clienteApi.ts';
import { listarPlanos, obterPlano, type DetalhePlano, type PlanoResumido } from '../planos/clientePlanos.ts';
import { formatarData, hojeISO } from '../planos/datas.ts';
import AcaoModal, { type EntradaAcao } from './AcaoModal.tsx';
import { calcularSugestoes, concluidas, pendentes, textoDoPrazo } from './calculoRetro.ts';
import ColunaNotas from './ColunaNotas.tsx';

interface Props {
  /** O plano escolhido no cabeçalho; null quando ainda não existe nenhum. */
  planoId: string | null;
  /** Data de "hoje" (aaaa-mm-dd); só os testes passam isto. */
  hoje?: string;
  onIrParaPlanos: () => void;
}

type Janela = { tipo: 'nova'; origem: string | null } | { tipo: 'editar'; acao: Acao } | null;

const botao =
  'flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/5 text-sm font-bold text-on-surface-variant hover:bg-white/10 disabled:opacity-60 cursor-pointer';
const cartao = 'rounded-3xl border border-white/10 bg-volt-surface/80 backdrop-blur-sm p-5 flex flex-col gap-3';
const avisoErro = 'rounded-xl border border-neon-error/40 bg-neon-error/10 px-3 py-2 text-xs text-neon-error';

/**
 * Retro (V8): retrospectiva do plano concluído. Notas "Foi bem" e "Pode melhorar" com voto, sugestões tiradas dos dados
 * e ações com responsável e prazo (que podem abrir também um INC). Fechada, trava notas e votos; as ações seguem editáveis.
 */
export default function Retro({ planoId, hoje: hojeProp, onIrParaPlanos }: Props) {
  const hoje = hojeProp ?? hojeISO();
  const { rotulo, icone: Icone } = itemPorChave('retro');
  const { nome, ativas, voce } = usePessoas();
  const { incidentes, recarregar: recarregarIncidentes } = useIncidentes();
  const idVoce = voce?.id ?? null;
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const alvo = escolhido ?? planoId;
  const [planos, setPlanos] = useState<PlanoResumido[]>([]);
  const [dados, setDados] = useState<DetalhePlano | null>(null);
  const [retro, setRetro] = useState<DadosRetro | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [atualizando, setAtualizando] = useState(false);
  const [janela, setJanela] = useState<Janela>(null);
  const [reabrindo, setReabrindo] = useState(false);

  // Trocar o plano no cabeçalho volta a retro para o plano escolhido lá.
  useEffect(() => setEscolhido(null), [planoId]);

  const carregar = useCallback(async () => {
    if (!alvo) {
      setDados(null);
      setRetro(null);
      return;
    }
    setAtualizando(true);
    try {
      const [detalhe, doPlano, lista] = await Promise.all([obterPlano(alvo), obterRetro(alvo), listarPlanos()]);
      setDados(detalhe);
      setRetro(doPlano);
      setPlanos(Array.isArray(lista) ? lista : []);
      setErro(null);
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Erro inesperado.');
    } finally {
      setAtualizando(false);
    }
  }, [alvo]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  /** Roda uma alteração e guarda a retro devolvida; falha vira o aviso da tela (e sobe para quem chamou). */
  const aplicar = async (tarefa: () => Promise<DadosRetro>) => {
    try {
      setRetro(await tarefa());
      setErro(null);
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Erro inesperado.');
      throw e;
    }
  };
  const semEstourar = (tarefa: () => Promise<DadosRetro>) => void aplicar(tarefa).catch(() => undefined);

  const executado = dados?.resumo.executado ?? false;
  const fechada = retro?.status === 'fechada';
  const notas = retro?.notas ?? [];
  const acoes = retro?.acoes ?? [];
  const sugestoes = useMemo(
    () => (dados ? calcularSugestoes({ itens: dados.itens, incidentes, previsao: dados.plano.previsao }) : []),
    [dados, incidentes],
  );
  const novas = sugestoes.filter((s) => !notas.some((n) => n.coluna === s.coluna && n.texto === s.texto));
  const anteriores = planos.filter((p) => p.resumo.executado);

  const escrever = (coluna: ColunaNota, texto: string) =>
    alvo && idVoce ? aplicar(() => adicionarNota(alvo, { coluna, texto, autor: idVoce })) : Promise.resolve();

  const salvarAcao = async (entrada: EntradaAcao) => {
    if (!alvo) return;
    if (janela?.tipo === 'editar') {
      await aplicar(() => editarAcao(alvo, janela.acao.id, { texto: entrada.texto, responsavel: entrada.responsavel, prazo: entrada.prazo, autor: idVoce }));
    } else {
      let incId: string | null = null;
      if (entrada.inc) {
        const inc = await criarIncidente({
          numero: entrada.inc.numero,
          titulo: entrada.texto,
          descricao: `Criado a partir da retro do plano ${dados?.plano.nome ?? ''}.`,
          severidade: entrada.inc.severidade,
          responsavel: entrada.responsavel,
          autor: idVoce,
        });
        incId = inc.numero;
        await recarregarIncidentes();
      }
      await aplicar(() =>
        adicionarAcao(alvo, {
          texto: entrada.texto,
          responsavel: entrada.responsavel,
          prazo: entrada.prazo,
          origem: janela?.tipo === 'nova' ? janela.origem : null,
          incId,
          autor: idVoce,
        }),
      );
    }
    setJanela(null);
  };

  const apagarAcao = async () => {
    if (!alvo || janela?.tipo !== 'editar') return;
    await aplicar(() => excluirAcao(alvo, janela.acao.id));
    setJanela(null);
  };

  const fechar = () => alvo && semEstourar(() => mudarEstadoRetro(alvo, { status: 'fechada', autor: idVoce }));
  const reabrir = () => {
    setReabrindo(false);
    if (alvo) semEstourar(() => mudarEstadoRetro(alvo, { status: 'aberta', autor: idVoce }));
  };

  const linhaDaAcao = (a: Acao) => (
    <li key={a.id} data-testid={`acao-${a.id}`} className="flex items-start gap-2 rounded-2xl border border-white/10 bg-white/5 p-3 text-sm">
      <input
        type="checkbox"
        aria-label={`Marcar como feita: ${a.texto}`}
        checked={a.feito}
        onChange={(e) => alvo && semEstourar(() => editarAcao(alvo, a.id, { feito: e.target.checked, autor: idVoce }))}
        className="mt-1 cursor-pointer"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <button type="button" aria-label={`Editar ação: ${a.texto}`} onClick={() => setJanela({ tipo: 'editar', acao: a })} className={`text-left font-bold hover:underline cursor-pointer ${a.feito ? 'line-through opacity-60' : ''}`}>
          {a.texto}
        </button>
        <span className="text-xs text-on-surface-variant">
          {[`Resp.: ${a.responsavel ? nome(a.responsavel) : '-'}`, a.prazo ? `até ${formatarData(a.prazo)}${!a.feito ? ` (${textoDoPrazo(a.prazo, hoje)})` : ''}` : 'sem prazo', a.incId ?? '(sem INC)'].join(' · ')}
        </span>
        {a.feito && a.feitoEm && <span className="text-xs text-volt-green">{`feita em ${formatarData(a.feitoEm)}${a.feitoPor ? ` por ${nome(a.feitoPor)}` : ''}`}</span>}
      </div>
    </li>
  );

  return (
    <section aria-label={rotulo} className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="flex items-center gap-3 text-xl font-black uppercase tracking-tight text-on-surface">
          <Icone size={22} className="text-volt-green" aria-hidden />
          {rotulo}
        </h2>
        <button type="button" onClick={() => void Promise.all([carregar(), recarregarIncidentes()])} disabled={atualizando || !alvo} className={botao}>
          <RefreshCw size={16} className={atualizando ? 'animate-spin' : ''} aria-hidden />
          Atualizar
        </button>
      </div>

      {erro && (
        <p role="alert" className={avisoErro}>
          {erro}
        </p>
      )}

      {!alvo && (
        <div className="rounded-3xl border border-white/10 bg-volt-surface/80 p-8 text-center text-sm text-on-surface-variant flex flex-col items-center gap-3">
          <p>Nenhum plano para mostrar. Crie um plano e escolha-o no cabeçalho.</p>
          <button type="button" onClick={onIrParaPlanos} className="px-4 py-2 rounded-full border border-volt-green/40 bg-volt-green/10 text-sm font-black text-volt-green hover:bg-volt-green/20 cursor-pointer">
            Ir para Planos
          </button>
        </div>
      )}

      {dados && retro && !executado && (
        <div className={cartao} data-testid="retro-indisponivel">
          <p className="text-sm font-bold">{`Plano ${dados.plano.nome} ainda está em andamento (${dados.resumo.concluidos} de ${dados.resumo.total}).`}</p>
          <p className="text-xs text-on-surface-variant">A retrospectiva abre quando todos os testes estiverem concluídos.</p>
          {anteriores.length > 0 && (
            <label className="flex items-center gap-2 text-xs font-bold text-on-surface-variant">
              Retros anteriores
              <select
                value=""
                onChange={(e) => e.target.value && setEscolhido(e.target.value)}
                className="rounded-lg border border-white/10 bg-volt-page px-2.5 py-2 text-xs text-on-surface outline-none focus:border-volt-green/50"
              >
                <option value="">Escolha…</option>
                {anteriores.map((p) => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}

      {dados && retro && executado && (
        <>
          <div className={cartao}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-lg font-black tracking-tight">{`Retrospectiva — Plano ${dados.plano.nome}`}</h3>
              <div className="flex flex-wrap items-center gap-4 text-xs">
                <span data-testid="retro-status" className={`rounded-full border px-3 py-1 font-black ${fechada ? 'border-white/20 bg-white/5 text-on-surface-variant' : 'border-volt-green/50 bg-volt-green/10 text-volt-green'}`}>
                  {fechada ? 'Status: FECHADA' : 'Status: ABERTA'}
                </span>
                <label className="flex items-center gap-2 font-bold text-on-surface-variant cursor-pointer">
                  <input
                    type="checkbox"
                    checked={retro.anonimas}
                    disabled={fechada}
                    onChange={(e) => alvo && semEstourar(() => mudarEstadoRetro(alvo, { anonimas: e.target.checked, autor: idVoce }))}
                  />
                  Notas anônimas
                </label>
                {fechada ? (
                  <button type="button" onClick={() => setReabrindo(true)} className={botao}>
                    <LockOpen size={16} aria-hidden /> Reabrir
                  </button>
                ) : (
                  <button type="button" onClick={fechar} className={botao}>
                    <Lock size={16} aria-hidden /> Fechar retro
                  </button>
                )}
              </div>
            </div>
            {fechada && retro.fechadaEm && (
              <p data-testid="retro-fechada-em" className="text-xs text-on-surface-variant">
                {`Fechada em ${formatarData(retro.fechadaEm)}${retro.fechadaPor ? ` por ${nome(retro.fechadaPor)}` : ''}. Notas e votos travados; as ações continuam editáveis.`}
              </p>
            )}
            {!fechada && idVoce === null && <p className="text-xs text-amber-300">Escolha “Você” no cabeçalho para escrever notas e votar.</p>}
          </div>

          {!fechada && (
            <details open className={cartao}>
              <summary className="flex cursor-pointer items-center gap-2 text-sm font-black uppercase tracking-wide">
                <Sparkles size={16} className="text-volt-green" aria-hidden /> Sugestões automáticas
              </summary>
              {novas.length === 0 ? (
                <p className="text-xs text-on-surface-variant">Nenhuma sugestão nova.</p>
              ) : (
                <ul data-testid="sugestoes" className="flex flex-col gap-2">
                  {novas.map((s) => (
                    <li key={s.chave} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span>{`• ${s.texto}`}</span>
                      <button
                        type="button"
                        disabled={idVoce === null}
                        aria-label={`Virar nota "${ROTULO_COLUNA[s.coluna]}": ${s.texto}`}
                        onClick={() => void escrever(s.coluna, s.texto).catch(() => undefined)}
                        className="rounded-full border border-white/10 bg-white/5 px-3 py-1 font-bold hover:bg-white/10 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                      >
                        {`+ nota "${ROTULO_COLUNA[s.coluna]}"`}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </details>
          )}

          <div className="grid gap-5 lg:grid-cols-3">
            {(['bem', 'melhorar'] as ColunaNota[]).map((c) => (
              <ColunaNotas
                key={c}
                coluna={c}
                titulo={ROTULO_COLUNA[c]}
                notas={notas.filter((n) => n.coluna === c)}
                anonimas={retro.anonimas}
                idVoce={idVoce}
                nome={nome}
                fechada={fechada}
                onNova={(texto) => escrever(c, texto)}
                onVotar={(n: Nota) => alvo && idVoce && semEstourar(() => votarNota(alvo, n.id, idVoce))}
                onVirarAcao={(n: Nota) => setJanela({ tipo: 'nova', origem: n.texto })}
                onExcluir={(n: Nota) => alvo && semEstourar(() => excluirNota(alvo, n.id))}
              />
            ))}

            <section aria-label="Ações" data-testid="coluna-retro-acoes" className="flex flex-col gap-3 rounded-3xl border border-white/10 bg-volt-surface/80 p-4">
              <h3 className="text-sm font-black uppercase tracking-wide">{`Ações (${acoes.length})`}</h3>
              <ul className="flex flex-col gap-2">{acoes.map(linhaDaAcao)}</ul>
              <button type="button" onClick={() => setJanela({ tipo: 'nova', origem: null })} className="flex items-center gap-2 self-start rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold hover:bg-white/10 cursor-pointer">
                <Plus size={14} aria-hidden />
                Nova ação
              </button>
            </section>
          </div>

          {fechada && (
            <div className={cartao} data-testid="resumo-acoes">
              <p className="text-sm font-bold">{`Ações pendentes (${pendentes(acoes).length})`}</p>
              {pendentes(acoes).map((a) => (
                <p key={a.id} className="text-xs">{`[ ] ${a.texto} — ${a.responsavel ? nome(a.responsavel) : 'sem responsável'}${a.prazo ? ` — até ${formatarData(a.prazo)} (${textoDoPrazo(a.prazo, hoje)})` : ''}`}</p>
              ))}
              <p className="pt-2 text-sm font-bold">{`Ações concluídas (${concluidas(acoes).length})`}</p>
              {concluidas(acoes).map((a) => (
                <p key={a.id} className="text-xs">{`[x] ${a.texto} — ${a.responsavel ? nome(a.responsavel) : 'sem responsável'}${a.feitoEm ? ` — ${formatarData(a.feitoEm)}` : ''}`}</p>
              ))}
            </div>
          )}
        </>
      )}

      {janela && (
        <AcaoModal
          acao={janela.tipo === 'editar' ? janela.acao : undefined}
          origem={janela.tipo === 'nova' ? janela.origem : null}
          pessoas={ativas}
          voce={voce}
          onSalvar={salvarAcao}
          onExcluir={janela.tipo === 'editar' ? apagarAcao : undefined}
          onFechar={() => setJanela(null)}
        />
      )}

      {reabrindo && retro && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70">
          <div role="alertdialog" aria-modal="true" aria-label="Confirmar reabertura" className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#1a1a1a] p-6 text-on-surface">
            <p className="text-sm font-bold">Reabrir a retrospectiva?</p>
            <p className="mt-2 text-xs text-on-surface-variant">
              {`Foi fechada${retro.fechadaPor ? ` por ${nome(retro.fechadaPor)}` : ''} em ${formatarData(retro.fechadaEm ?? undefined)}. Notas e votos voltam a poder mudar.`}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setReabrindo(false)} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-bold hover:bg-white/10 cursor-pointer">Manter fechada</button>
              <button type="button" onClick={reabrir} className="rounded-xl bg-volt-green px-4 py-2.5 text-xs font-black text-black cursor-pointer">Reabrir</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
