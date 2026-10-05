import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { ErroApi } from '../cenarios/clienteApi.ts';
import { formatarCpf } from '../cenarios/massa.ts';
import {
  historicoDoTeste,
  ROTULO_STATUS,
  STATUS,
  type CamposItem,
  type HistoricoDoTeste,
  type ItemPlano,
  type Prioridade,
  type Resultado,
  type Status,
} from './clientePlanos.ts';
import { usePessoas } from '../../pessoas/ContextoPessoas.tsx';
import { formatarData } from './datas.ts';

interface Props {
  planoNome: string;
  /** Todos os testes do plano, na ordem de execução (a navegação percorre esta lista). */
  itens: ItemPlano[];
  idAtual: string;
  onTrocar: (idCenario: string) => void;
  /** Recebe só os campos que mudaram. Se recusar (ErroApi), a mensagem aparece aqui e a alteração continua pendente. */
  onSalvar: (item: ItemPlano, campos: CamposItem) => Promise<void>;
  onTirar: (idCenario: string) => void;
  onFechar: () => void;
}

type Aba = 'geral' | 'cenario' | 'historico';

/** Valores dos campos como a pessoa os vê (texto); vazio = sem valor. */
interface Rascunho {
  status: Status;
  resultado: Resultado | '';
  prioridade: Prioridade | '';
  responsavel: string;
  estimativa: string;
  tempoReal: string;
  dataPlanejada: string;
  dataExecucao: string;
  observacoes: string;
}

const doItem = (i: ItemPlano): Rascunho => ({
  status: i.status,
  resultado: i.resultado ?? '',
  prioridade: i.prioridade ?? '',
  responsavel: i.responsavel ?? '',
  estimativa: i.estimativaMin === undefined ? '' : String(i.estimativaMin),
  tempoReal: i.tempoRealMin === undefined ? '' : String(i.tempoRealMin),
  dataPlanejada: i.dataPlanejada ?? '',
  dataExecucao: i.dataExecucao ?? '',
  observacoes: i.observacoes ?? '',
});

const minutos = (texto: string): number | null => (texto.trim() === '' ? null : Number(texto));

/** Só o que mudou em relação à base. Resultado só entra se o teste termina "Concluído". */
function diferencas(base: Rascunho, atual: Rascunho): CamposItem {
  const campos: CamposItem = {};
  if (atual.status !== base.status) campos.status = atual.status;
  if (atual.status === 'concluido' && atual.resultado !== base.resultado) campos.resultado = atual.resultado || null;
  if (atual.prioridade !== base.prioridade) campos.prioridade = atual.prioridade || null;
  if (atual.responsavel.trim() !== base.responsavel.trim()) campos.responsavel = atual.responsavel.trim() || null;
  if (atual.estimativa !== base.estimativa) campos.estimativaMin = minutos(atual.estimativa);
  if (atual.tempoReal !== base.tempoReal) campos.tempoRealMin = minutos(atual.tempoReal);
  if (atual.dataPlanejada !== base.dataPlanejada) campos.dataPlanejada = atual.dataPlanejada || null;
  if (atual.dataExecucao !== base.dataExecucao) campos.dataExecucao = atual.dataExecucao || null;
  if (atual.observacoes.trim() !== base.observacoes.trim()) campos.observacoes = atual.observacoes.trim() || null;
  return campos;
}

const campo =
  'w-full rounded-lg border border-white/10 bg-volt-page px-2.5 py-2 text-sm text-on-surface outline-none focus:border-volt-green/50';
const rotulo = 'block mb-1 text-[11px] font-bold text-on-surface-variant';
const botaoNav =
  'flex items-center gap-1 px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-xs font-bold hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer';

function Leitura({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div>
      <span className={rotulo}>{titulo}</span>
      <div className="text-sm">{children}</div>
    </div>
  );
}

/**
 * Modal M4 — detalhe do teste dentro do plano: "n de m", Anterior/Próximo e três abas.
 * A massa é dado de TESTE fictício e roda só nesta máquina: o CPF aparece sem máscara, com aviso.
 */
export default function TesteModal({ planoNome, itens, idAtual, onTrocar, onSalvar, onTirar, onFechar }: Props) {
  const { ativas, nome: nomeDe } = usePessoas();
  const indice = itens.findIndex((i) => i.idCenario === idAtual);
  const item = itens[indice];
  const [aba, setAba] = useState<Aba>('geral');
  const [base, setBase] = useState<Rascunho>(() => (item ? doItem(item) : ({} as Rascunho)));
  const [rascunho, setRascunho] = useState<Rascunho>(base);
  const [erros, setErros] = useState<string[]>([]);
  const [salvo, setSalvo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [historico, setHistorico] = useState<HistoricoDoTeste[] | null>(null);
  const janela = useRef<HTMLDivElement>(null);

  // Quando o teste aberto muda (navegação) ou o servidor devolve uma versão nova, os campos recomeçam do que está salvo.
  useEffect(() => {
    if (!item) return;
    const novo = doItem(item);
    setBase(novo);
    setRascunho(novo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.idCenario, item?.versao]);

  useEffect(() => {
    setSalvo(false);
    setErros([]);
  }, [idAtual]);

  useEffect(() => {
    janela.current?.focus();
  }, []);

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFechar();
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [onFechar]);

  useEffect(() => {
    let vivo = true;
    setHistorico(null);
    historicoDoTeste(idAtual)
      .then((h) => vivo && setHistorico(h))
      .catch(() => vivo && setHistorico([]));
    return () => {
      vivo = false;
    };
  }, [idAtual, item?.versao]);

  const campos = useMemo(() => diferencas(base, rascunho), [base, rascunho]);
  const pendente = Object.keys(campos).length > 0;

  if (!item) return null;

  const mudar = (parcial: Partial<Rascunho>) => {
    setSalvo(false);
    setRascunho((r) => ({ ...r, ...parcial }));
  };

  const salvar = async () => {
    setSalvando(true);
    setErros([]);
    try {
      await onSalvar(item, campos);
      setBase(rascunho);
      setSalvo(true);
    } catch (e) {
      setErros(e instanceof ErroApi ? e.mensagens : ['Não foi possível salvar as alterações.']);
    } finally {
      setSalvando(false);
    }
  };

  const ir = (passo: number) => onTrocar(itens[indice + passo].idCenario);
  const abas: { chave: Aba; texto: string }[] = [
    { chave: 'geral', texto: 'Geral' },
    { chave: 'cenario', texto: 'Cenário e Datas' },
    { chave: 'historico', texto: historico ? `Histórico (${historico.length})` : 'Histórico' },
  ];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div
        ref={janela}
        role="dialog"
        aria-modal="true"
        aria-label="Detalhe do teste"
        tabIndex={-1}
        className="w-full max-w-3xl max-h-[92vh] flex flex-col rounded-3xl bg-[#1a1a1a] border border-white/10 text-on-surface outline-none"
      >
        <div className="flex items-start justify-between gap-4 p-5 pb-3">
          <div className="min-w-0">
            <h2 className="text-lg font-black tracking-tight">{`${item.idCenario} · ${item.nome ?? '-'}`}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
              <span data-testid="status-atual" className="rounded-full border border-volt-green/30 bg-volt-surface px-2.5 py-0.5 font-bold text-volt-green">
                {ROTULO_STATUS[item.status]}
              </span>
              <span>{`Plano ${planoNome}`}</span>
              {item.bloqueadoPor.length > 0 && <span className="text-volt-green">{`Aguardando ${item.bloqueadoPor.join(', ')} passar`}</span>}
            </div>
          </div>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="p-1 opacity-60 hover:opacity-100 cursor-pointer">
            <X size={20} />
          </button>
        </div>

        <div className="px-5 flex flex-wrap items-center justify-between gap-3">
          <button type="button" onClick={() => ir(-1)} disabled={indice <= 0 || pendente} className={botaoNav}>
            <ChevronLeft size={14} aria-hidden />
            Anterior
          </button>
          <span className="text-xs text-on-surface-variant">{`${indice + 1} de ${itens.length} no plano`}</span>
          <button type="button" onClick={() => ir(1)} disabled={indice >= itens.length - 1 || pendente} className={botaoNav}>
            Próximo
            <ChevronRight size={14} aria-hidden />
          </button>
        </div>
        {pendente && <p className="px-5 pt-2 text-center text-[11px] text-on-surface-variant">Salve ou descarte as alterações para trocar de teste</p>}

        <div role="tablist" className="px-5 pt-3 flex gap-2">
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

        <div className="px-5 pt-4 pb-1 overflow-y-auto">
          {aba === 'geral' && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="tst-status" className={rotulo}>Status</label>
                <select id="tst-status" value={rascunho.status} onChange={(e) => mudar({ status: e.target.value as Status })} className={campo}>
                  {STATUS.map((s) => (
                    <option key={s} value={s}>
                      {ROTULO_STATUS[s]}
                    </option>
                  ))}
                </select>
              </div>
              {rascunho.status === 'concluido' && (
                <div>
                  <label htmlFor="tst-resultado" className={rotulo}>Resultado</label>
                  <select id="tst-resultado" value={rascunho.resultado} onChange={(e) => mudar({ resultado: e.target.value as Resultado | '' })} className={campo}>
                    <option value="">Sem resultado</option>
                    <option value="passou">Passou</option>
                    <option value="falhou">Falhou</option>
                  </select>
                </div>
              )}
              <div>
                <label htmlFor="tst-prioridade" className={rotulo}>Prioridade</label>
                <select id="tst-prioridade" value={rascunho.prioridade} onChange={(e) => mudar({ prioridade: e.target.value as Prioridade | '' })} className={campo}>
                  <option value="">Sem prioridade</option>
                  <option value="P1">P1</option>
                  <option value="P2">P2</option>
                  <option value="P3">P3</option>
                </select>
              </div>
              <div>
                <label htmlFor="tst-resp" className={rotulo}>Responsável</label>
                {ativas.length > 0 ? (
                  <select id="tst-resp" value={rascunho.responsavel} onChange={(e) => mudar({ responsavel: e.target.value })} className={campo}>
                    <option value="">Sem responsável</option>
                    {/* Quem já é responsável continua na lista mesmo se foi desativado depois. */}
                    {rascunho.responsavel && !ativas.some((p) => p.id === rascunho.responsavel) && (
                      <option value={rascunho.responsavel}>{nomeDe(rascunho.responsavel)}</option>
                    )}
                    {ativas.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input id="tst-resp" value={rascunho.responsavel} onChange={(e) => mudar({ responsavel: e.target.value })} autoComplete="off" className={campo} />
                )}
              </div>
              <div>
                <label htmlFor="tst-est" className={rotulo}>Estimativa (min)</label>
                <input id="tst-est" type="number" min={0} value={rascunho.estimativa} onChange={(e) => mudar({ estimativa: e.target.value })} className={campo} />
              </div>
              <div>
                <label htmlFor="tst-real" className={rotulo}>Tempo real (min)</label>
                <input id="tst-real" type="number" min={0} value={rascunho.tempoReal} onChange={(e) => mudar({ tempoReal: e.target.value })} className={campo} />
              </div>
            </div>
          )}

          {aba === 'cenario' && (
            <div className="flex flex-col gap-4">
              <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-on-surface-variant">
                Dados fictícios de massa de teste, não são dados reais. Esta ferramenta roda só nesta máquina.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Leitura titulo="Cenário">{item.nome ?? '-'}</Leitura>
                <Leitura titulo="Funcionalidade">{item.funcionalidade ?? '-'}</Leitura>
                <Leitura titulo="Massa (ID)">
                  <span className="font-mono">{item.idMassa ?? '-'}</span>
                  {item.massaCompartilhadaCom.length > 0 && (
                    <div className="text-[11px] text-on-surface-variant">{`= massa compartilhada com ${item.massaCompartilhadaCom.join(', ')}`}</div>
                  )}
                </Leitura>
                {item.cpf && (
                  <Leitura titulo="CPF">
                    <span className="font-mono">{formatarCpf(item.cpf)}</span>
                    <div className="text-[11px] text-on-surface-variant">CPF fictício de massa de teste (não é dado real)</div>
                  </Leitura>
                )}
                <Leitura titulo="Passos">{item.passos ?? '-'}</Leitura>
                <Leitura titulo="Resultado esperado">{item.resultadoEsperado ?? '-'}</Leitura>
                <Leitura titulo="Dependência (automática)">
                  {item.dependeDe.length > 0 ? `Depois de ${item.dependeDe.join(', ')} (mesma massa)` : 'Nenhuma'}
                </Leitura>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="tst-planejada" className={rotulo}>Data planejada</label>
                  <input id="tst-planejada" type="date" value={rascunho.dataPlanejada} onChange={(e) => mudar({ dataPlanejada: e.target.value })} className={campo} />
                </div>
                <div>
                  <label htmlFor="tst-execucao" className={rotulo}>Data de execução</label>
                  <input id="tst-execucao" type="date" value={rascunho.dataExecucao} onChange={(e) => mudar({ dataExecucao: e.target.value })} className={campo} />
                </div>
              </div>
              <div>
                <label htmlFor="tst-obs" className={rotulo}>Observações</label>
                <textarea id="tst-obs" rows={3} value={rascunho.observacoes} onChange={(e) => mudar({ observacoes: e.target.value })} className={campo} />
              </div>
            </div>
          )}

          {aba === 'historico' &&
            (historico === null ? (
              <p className="py-6 text-center text-sm text-on-surface-variant">Carregando…</p>
            ) : historico.length === 0 ? (
              <p className="py-6 text-center text-sm text-on-surface-variant">Este teste ainda não está em nenhum plano</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wide text-on-surface-variant">
                    <th className="py-2 pr-3 font-bold">Plano</th>
                    <th className="py-2 pr-3 font-bold">Status</th>
                    <th className="py-2 pr-3 font-bold">Planejada</th>
                    <th className="py-2 pr-3 font-bold">Executada</th>
                    <th className="py-2 pr-3 font-bold">Responsável</th>
                    <th className="py-2 font-bold">Observações</th>
                  </tr>
                </thead>
                <tbody>
                  {historico.map((h) => (
                    <tr key={h.planoId} data-testid={`historico-${h.planoId}`} className="border-t border-white/10 align-top">
                      <td className="py-2.5 pr-3 font-bold">{h.planoNome}</td>
                      <td className="py-2.5 pr-3">
                        <div>{ROTULO_STATUS[h.status]}</div>
                        {h.resultado && <div className="text-[11px] text-on-surface-variant">{h.resultado === 'passou' ? 'Passou' : 'Falhou'}</div>}
                      </td>
                      <td className="py-2.5 pr-3">{formatarData(h.dataPlanejada)}</td>
                      <td className="py-2.5 pr-3">{formatarData(h.dataExecucao)}</td>
                      <td className="py-2.5 pr-3">{h.responsavel ?? '-'}</td>
                      <td className="py-2.5">{h.observacoes ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ))}
        </div>

        <div className="p-5 pt-3 flex flex-col gap-3">
          {erros.length > 0 && (
            <div role="alert" className="rounded-xl border border-neon-error/40 bg-neon-error/10 px-3 py-2 text-xs text-neon-error">
              <ul className="list-disc pl-4 space-y-0.5">
                {erros.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
          )}
          {salvo && !pendente && (
            <p role="status" className="text-xs text-volt-green">
              Alterações salvas.
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => onTirar(item.idCenario)}
              className="px-4 py-2.5 rounded-xl text-xs font-black bg-neon-error/20 text-neon-error border border-neon-error/40 hover:bg-neon-error/30 cursor-pointer"
            >
              Tirar do plano
            </button>
            <div className="flex gap-2">
              {pendente && (
                <button
                  type="button"
                  onClick={() => {
                    setRascunho(base);
                    setErros([]);
                  }}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer"
                >
                  Descartar
                </button>
              )}
              <button
                type="button"
                onClick={() => void salvar()}
                disabled={!pendente || salvando}
                className="px-4 py-2.5 rounded-xl text-xs font-black bg-volt-green text-black disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
              >
                Salvar alterações
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
