import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ListChecks, X } from 'lucide-react';
import { ROTULO_SEVERIDADE, SEVERIDADES, type Severidade } from '../../incidentes/clienteIncidentes.ts';
import type { Pessoa } from '../../pessoas/clientePessoas.ts';
import type { Acao } from '../../retros/clienteRetros.ts';
import { ErroApi } from '../cenarios/clienteApi.ts';

export interface EntradaAcao {
  texto: string;
  responsavel: string | null;
  prazo: string | null;
  /** Só ao criar: abre também um INC com este número e severidade. */
  inc?: { numero: string; severidade: Severidade };
}

interface Props {
  /** Ação existente (edição); ausente = ação nova. */
  acao?: Acao;
  /** Texto da nota que originou a ação nova. */
  origem?: string | null;
  /** Texto já preenchido (a ação criada a partir de uma nota). */
  textoInicial?: string;
  pessoas: Pessoa[];
  voce: Pessoa | null;
  onSalvar: (entrada: EntradaAcao) => Promise<void>;
  onExcluir?: () => Promise<void>;
  onFechar: () => void;
}

const campo = 'w-full rounded-lg border border-white/10 bg-volt-page px-2.5 py-2 text-sm text-on-surface outline-none focus:border-volt-green/50';
const rotulo = 'text-xs font-bold uppercase tracking-wide text-on-surface-variant';

/** Modal M14 — Ação da retro: o que fazer, quem e até quando; ao criar pode abrir também um INC (o número vem do sistema de chamados). */
export default function AcaoModal({ acao, origem, textoInicial, pessoas, voce, onSalvar, onExcluir, onFechar }: Props) {
  const [texto, setTexto] = useState(acao?.texto ?? textoInicial ?? '');
  const [responsavel, setResponsavel] = useState(acao ? (acao.responsavel ?? '') : (voce?.id ?? ''));
  const [prazo, setPrazo] = useState(acao?.prazo ?? '');
  const [criarInc, setCriarInc] = useState(false);
  const [numeroInc, setNumeroInc] = useState('');
  const [severidade, setSeveridade] = useState<Severidade>('media');
  const [erros, setErros] = useState<string[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const primeiro = useRef<HTMLInputElement>(null);
  const origemMostrada = acao ? acao.origem : (origem ?? null);

  useEffect(() => {
    primeiro.current?.focus();
  }, []);

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFechar();
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [onFechar]);

  const executar = async (tarefa: () => Promise<void>) => {
    setOcupado(true);
    try {
      await tarefa();
    } catch (erro) {
      setErros(erro instanceof ErroApi ? erro.mensagens : ['Não foi possível concluir.']);
      setOcupado(false);
    }
  };

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    const faltando: string[] = [];
    if (!texto.trim()) faltando.push('Ação é obrigatória.');
    if (criarInc && !numeroInc.trim()) faltando.push('Informe o número do INC.');
    if (criarInc && texto.trim().length > 120) faltando.push('Para abrir o INC, a ação deve ter no máximo 120 caracteres (ela vira o título).');
    if (faltando.length > 0) {
      setErros(faltando);
      return;
    }
    setErros([]);
    void executar(() =>
      onSalvar({
        texto: texto.trim(),
        responsavel: responsavel || null,
        prazo: prazo || null,
        ...(!acao && criarInc ? { inc: { numero: numeroInc.trim(), severidade } } : {}),
      }),
    );
  };

  const titulo = acao ? 'Editar ação' : 'Nova ação';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <form role="dialog" aria-modal="true" aria-label={titulo} onSubmit={enviar} className="w-full max-w-lg p-6 rounded-3xl bg-[#1a1a1a] border border-white/10 text-on-surface">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 font-black uppercase text-sm">
            <ListChecks size={18} className="text-volt-green" aria-hidden /> {titulo}
          </div>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="p-1 opacity-60 hover:opacity-100 cursor-pointer">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4 text-sm">
          <div className="flex flex-col gap-1">
            <label htmlFor="acao-texto" className={rotulo}>Ação</label>
            <input id="acao-texto" ref={primeiro} value={texto} maxLength={200} onChange={(e) => setTexto(e.target.value)} className={campo} />
          </div>

          {origemMostrada && (
            <p className="text-xs text-on-surface-variant">
              <span className={rotulo}>Origem </span>
              {`nota "${origemMostrada}"`}
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="acao-resp" className={rotulo}>Responsável</label>
              <select id="acao-resp" value={responsavel} onChange={(e) => setResponsavel(e.target.value)} className={campo}>
                <option value="">Sem responsável</option>
                {pessoas.map((p) => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="acao-prazo" className={rotulo}>Prazo</label>
              <input id="acao-prazo" type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} className={campo} />
            </div>
          </div>

          {acao ? (
            <p className="text-xs text-on-surface-variant">{acao.incId ? `INC ligado: ${acao.incId}` : '(sem INC)'}</p>
          ) : (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={criarInc} onChange={(e) => setCriarInc(e.target.checked)} />
                Criar também um INC
              </label>
              {criarInc && (
                <>
                  <input aria-label="Número do INC" placeholder="INC0000000" value={numeroInc} maxLength={30} onChange={(e) => setNumeroInc(e.target.value)} className={`${campo} !w-40`} />
                  <select aria-label="Severidade do INC" value={severidade} onChange={(e) => setSeveridade(e.target.value as Severidade)} className={`${campo} !w-32`}>
                    {SEVERIDADES.map((s) => (
                      <option key={s} value={s}>{ROTULO_SEVERIDADE[s]}</option>
                    ))}
                  </select>
                </>
              )}
            </div>
          )}

          {erros.length > 0 && (
            <div role="alert" className="rounded-xl border border-neon-error/40 bg-neon-error/10 px-3 py-2 text-xs text-neon-error">
              <ul className="list-disc pl-4 space-y-0.5">
                {erros.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 pt-1">
            <div>
              {acao && onExcluir && (
                <button type="button" disabled={ocupado} onClick={() => void executar(onExcluir)} className="px-4 py-2.5 rounded-xl text-xs font-bold border border-neon-error/40 bg-neon-error/10 text-neon-error hover:bg-neon-error/20 cursor-pointer">
                  Excluir ação
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={onFechar} className="px-4 py-2.5 rounded-xl text-xs font-bold bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer">
                Cancelar
              </button>
              <button type="submit" disabled={ocupado} className="px-4 py-2.5 rounded-xl text-xs font-black bg-volt-green text-black disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed">
                Salvar ação
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
