import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Bug, X } from 'lucide-react';
import { usePessoas } from '../pessoas/ContextoPessoas.tsx';
import { ErroApi } from '../pages/cenarios/clienteApi.ts';
import { criarIncidente, ROTULO_SEVERIDADE, SEVERIDADES, type Severidade } from './clienteIncidentes.ts';
import SeletorTestes from './SeletorTestes.tsx';

interface Props {
  /** Os testes do plano aberto, para escolher quais o INC afeta. */
  testes: { idCenario: string; nome?: string }[];
  /** Testes já marcados ao abrir (ex.: "Criar INC" a partir de um teste que falhou). */
  marcadosInicial?: string[];
  onRegistrado: () => void;
  onFechar: () => void;
}

const campo =
  'w-full p-2.5 rounded-xl text-sm bg-volt-page border border-white/20 text-on-surface outline-none focus:border-volt-green/50';
const rotulo = 'block mb-1 text-[11px] font-bold text-on-surface-variant';

/** Modal M6 — Registrar INC. O INC é aberto fora da ferramenta; aqui só se registra o número e os testes que ele afeta. */
export default function RegistrarIncModal({ testes, marcadosInicial = [], onRegistrado, onFechar }: Props) {
  const { ativas, voce } = usePessoas();
  const [numero, setNumero] = useState('');
  const [titulo, setTitulo] = useState('');
  const [severidade, setSeveridade] = useState<Severidade>('media');
  const [responsavel, setResponsavel] = useState('');
  const [descricao, setDescricao] = useState('');
  const [marcados, setMarcados] = useState<string[]>(marcadosInicial);
  const [erros, setErros] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  const primeiro = useRef<HTMLInputElement>(null);

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

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setErros([]);
    setSalvando(true);
    try {
      await criarIncidente({ numero: numero.trim(), titulo: titulo.trim(), descricao, severidade, responsavel: responsavel || null, testesAfetados: marcados, autor: voce?.id ?? null });
      onRegistrado();
    } catch (erro) {
      setErros(erro instanceof ErroApi ? erro.mensagens : ['Não foi possível registrar o INC.']);
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <form
        role="dialog"
        aria-modal="true"
        aria-label="Registrar INC"
        onSubmit={enviar}
        className="w-full max-w-lg max-h-[92vh] overflow-y-auto p-6 rounded-3xl bg-[#1a1a1a] border border-white/10 text-on-surface"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 font-black uppercase text-sm">
            <Bug size={18} className="text-volt-green" aria-hidden /> Registrar INC
          </div>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="p-1 opacity-60 hover:opacity-100 cursor-pointer">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label htmlFor="inc-numero" className={rotulo}>Nº do INC</label>
            <input id="inc-numero" ref={primeiro} value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="INC0715802225" autoComplete="off" className={`${campo} font-mono`} />
          </div>
          <div>
            <label htmlFor="inc-titulo" className={rotulo}>Título</label>
            <input id="inc-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={120} autoComplete="off" className={campo} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="inc-sev" className={rotulo}>Severidade</label>
              <select id="inc-sev" value={severidade} onChange={(e) => setSeveridade(e.target.value as Severidade)} className={campo}>
                {SEVERIDADES.map((s) => (
                  <option key={s} value={s}>
                    {ROTULO_SEVERIDADE[s]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="inc-resp" className={rotulo}>Responsável</label>
              <select id="inc-resp" value={responsavel} onChange={(e) => setResponsavel(e.target.value)} className={campo}>
                <option value="">Ninguém</option>
                {ativas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <SeletorTestes opcoes={testes} marcados={marcados} onChange={setMarcados} />
          <div>
            <label htmlFor="inc-desc" className={rotulo}>Descrição (opcional)</label>
            <textarea id="inc-desc" value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} maxLength={2000} className={campo} />
          </div>

          {erros.length > 0 && (
            <div role="alert" className="rounded-xl border border-neon-error/40 bg-neon-error/10 px-3 py-2 text-xs text-neon-error">
              <ul className="list-disc pl-4 space-y-0.5">
                {erros.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onFechar} className="px-4 py-2.5 rounded-xl text-xs font-bold bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer">
              Cancelar
            </button>
            <button type="submit" disabled={numero.trim() === '' || titulo.trim() === '' || salvando} className="px-4 py-2.5 rounded-xl text-xs font-black bg-volt-green text-black disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed">
              Registrar
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
