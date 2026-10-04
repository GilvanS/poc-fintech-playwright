import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import SeletorTestes from '../../incidentes/SeletorTestes.tsx';
import {
  comentarIncidente,
  editarIncidente,
  excluirIncidente,
  ROTULO_SEVERIDADE,
  ROTULO_STATUS_INC,
  SEVERIDADES,
  STATUS_INC,
  type Incidente,
  type Severidade,
  type StatusInc,
} from '../../incidentes/clienteIncidentes.ts';
import { usePessoas } from '../../pessoas/ContextoPessoas.tsx';
import { ErroApi } from '../cenarios/clienteApi.ts';
import { formatarData } from '../planos/datas.ts';
import { dataHora, textoDoHistorico } from './calculoIncidentes.ts';

interface Props {
  inc: Incidente;
  /** Os testes que podem ser ligados ao INC (o cadastro de cenários). */
  opcoesTestes: { idCenario: string; nome?: string }[];
  /** Relê os INC depois de qualquer alteração. */
  onMudou: () => Promise<void>;
  onFechar: () => void;
}

const campo =
  'w-full rounded-xl border border-white/10 bg-volt-page px-3 py-2 text-sm text-on-surface outline-none focus:border-volt-green/50';
const rotulo = 'block mb-1 text-[11px] font-bold text-on-surface-variant';

/** Painel lateral do INC (clicar no card ou na linha): edita, comenta, mostra o histórico e exclui. */
export default function PainelIncidente({ inc, opcoesTestes, onMudou, onFechar }: Props) {
  const { ativas, voce, nome } = usePessoas();
  const [titulo, setTitulo] = useState(inc.titulo);
  const [descricao, setDescricao] = useState(inc.descricao);
  const [status, setStatus] = useState<StatusInc>(inc.status);
  const [severidade, setSeveridade] = useState<Severidade>(inc.severidade);
  const [responsavel, setResponsavel] = useState(inc.responsavel ?? '');
  const [testes, setTestes] = useState<string[]>(inc.testesAfetados);
  // A versão que esta pessoa conhece: sobe quando ela mesma salva ou comenta, para só a mudança dos outros dar conflito.
  const [versaoBase, setVersaoBase] = useState(inc.versao);
  const [comentario, setComentario] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [confirmarExcluir, setConfirmarExcluir] = useState(false);

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (confirmarExcluir) setConfirmarExcluir(false);
      else onFechar();
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [confirmarExcluir, onFechar]);

  const autor = voce?.id ?? null;
  const mudou =
    titulo !== inc.titulo ||
    descricao !== inc.descricao ||
    status !== inc.status ||
    severidade !== inc.severidade ||
    (responsavel || null) !== inc.responsavel ||
    testes.length !== inc.testesAfetados.length ||
    testes.some((t) => !inc.testesAfetados.includes(t));

  const executar = async (acao: () => Promise<void>) => {
    setErro(null);
    setAviso(null);
    setOcupado(true);
    try {
      await acao();
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Erro inesperado.');
    } finally {
      setOcupado(false);
    }
  };

  const salvar = () =>
    executar(async () => {
      const salvo = await editarIncidente(inc.numero, { versao: versaoBase, titulo, descricao, status, severidade, responsavel: responsavel || null, testesAfetados: testes, autor });
      setVersaoBase(salvo.versao);
      await onMudou();
      setAviso('Alterações salvas.');
    });

  const enviarComentario = () =>
    executar(async () => {
      const salvo = await comentarIncidente(inc.numero, comentario, autor);
      setVersaoBase(salvo.versao);
      setComentario('');
      await onMudou();
    });

  const excluir = () =>
    executar(async () => {
      await excluirIncidente(inc.numero);
      setConfirmarExcluir(false);
      await onMudou();
      onFechar();
    });

  const historico = useMemo(() => [...inc.historico].reverse(), [inc.historico]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && onFechar()}>
      <aside role="dialog" aria-modal="true" aria-label={`Detalhe do ${inc.numero}`} className="h-full w-full max-w-xl overflow-y-auto border-l border-white/10 bg-[#1a1a1a] p-6 text-on-surface">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-mono text-lg font-black text-volt-green">{inc.numero}</h2>
            <p className="text-xs text-on-surface-variant">{`Aberto em ${formatarData(inc.abertoEm)}${inc.resolvidoEm ? ` · resolvido em ${formatarData(inc.resolvidoEm)}` : ''}`}</p>
          </div>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="p-1 opacity-60 hover:opacity-100 cursor-pointer">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="painel-titulo" className={rotulo}>Título</label>
            <input id="painel-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={120} className={campo} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label htmlFor="painel-sev" className={rotulo}>Severidade</label>
              <select id="painel-sev" value={severidade} onChange={(e) => setSeveridade(e.target.value as Severidade)} className={campo}>
                {SEVERIDADES.map((s) => (
                  <option key={s} value={s}>
                    {ROTULO_SEVERIDADE[s]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="painel-status" className={rotulo}>Status</label>
              <select id="painel-status" value={status} onChange={(e) => setStatus(e.target.value as StatusInc)} className={campo}>
                {STATUS_INC.map((s) => (
                  <option key={s} value={s}>
                    {ROTULO_STATUS_INC[s]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="painel-resp" className={rotulo}>Responsável</label>
              <select id="painel-resp" value={responsavel} onChange={(e) => setResponsavel(e.target.value)} className={campo}>
                <option value="">Ninguém</option>
                {[...ativas, ...(responsavel && !ativas.some((p) => p.id === responsavel) ? [{ id: responsavel, nome: nome(responsavel) }] : [])].map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <SeletorTestes opcoes={opcoesTestes} marcados={testes} onChange={setTestes} />
          <div>
            <label htmlFor="painel-desc" className={rotulo}>Descrição</label>
            <textarea id="painel-desc" value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={4} maxLength={2000} className={campo} />
          </div>

          {erro && (
            <p role="alert" className="rounded-xl border border-neon-error/40 bg-neon-error/10 px-3 py-2 text-xs text-neon-error">
              {erro}
            </p>
          )}
          {aviso && <p role="status" className="text-xs text-volt-green">{aviso}</p>}

          <section aria-label="Histórico">
            <h3 className="mb-2 text-xs font-black uppercase tracking-wide">Histórico</h3>
            <ul className="space-y-1 text-xs">
              {historico.map((h, i) => (
                <li key={`${h.em}-${i}`} className="flex gap-2">
                  <span className="shrink-0 font-mono text-on-surface-variant">{dataHora(h.em)}</span>
                  <span className="shrink-0 font-bold">{h.autor ? nome(h.autor) : '—'}</span>
                  <span>{textoDoHistorico(h, nome)}</span>
                </li>
              ))}
            </ul>
          </section>

          <section aria-label="Comentários">
            <h3 className="mb-2 text-xs font-black uppercase tracking-wide">Comentários</h3>
            {inc.comentarios.length === 0 && <p className="text-xs text-on-surface-variant">Nenhum comentário ainda.</p>}
            <ul className="space-y-1.5 text-xs">
              {inc.comentarios.map((c) => (
                <li key={c.id}>
                  <span className="font-bold">{c.autor ? nome(c.autor) : '—'}</span>
                  <span className="ml-1 text-on-surface-variant">{dataHora(c.em)}</span>
                  <p>{c.texto}</p>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex gap-2">
              <input aria-label="Escrever comentário" value={comentario} onChange={(e) => setComentario(e.target.value)} maxLength={1000} placeholder="escrever comentário…" className={campo} />
              <button type="button" onClick={() => void enviarComentario()} disabled={comentario.trim() === '' || ocupado} className="rounded-xl bg-white/10 px-4 text-xs font-black hover:bg-white/20 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed">
                Enviar
              </button>
            </div>
          </section>

          <div className="flex items-center justify-between pt-2">
            <button type="button" onClick={() => setConfirmarExcluir(true)} className="rounded-xl border border-neon-error/40 bg-neon-error/20 px-4 py-2.5 text-xs font-black text-neon-error hover:bg-neon-error/30 cursor-pointer">
              Excluir INC
            </button>
            <button type="button" onClick={() => void salvar()} disabled={!mudou || titulo.trim() === '' || ocupado} className="rounded-xl bg-volt-green px-4 py-2.5 text-xs font-black text-black disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed">
              Salvar
            </button>
          </div>
        </div>
      </aside>

      {confirmarExcluir && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70">
          <div role="alertdialog" aria-modal="true" aria-label="Confirmar exclusão" className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#1a1a1a] p-6 text-on-surface">
            <p className="text-sm font-bold">{`Excluir o ${inc.numero}?`}</p>
            <p className="mt-2 text-xs text-on-surface-variant">O INC some de todos os planos e o histórico dele também. Isto não tem volta.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmarExcluir(false)} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-bold hover:bg-white/10 cursor-pointer">
                Manter
              </button>
              <button type="button" onClick={() => void excluir()} disabled={ocupado} className="rounded-xl bg-neon-error px-4 py-2.5 text-xs font-black text-black cursor-pointer">
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
