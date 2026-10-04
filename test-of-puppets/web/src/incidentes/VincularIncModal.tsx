import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link2, X } from 'lucide-react';
import { usePessoas } from '../pessoas/ContextoPessoas.tsx';
import { ErroApi } from '../pages/cenarios/clienteApi.ts';
import { ROTULO_STATUS_INC, vincularIncidente } from './clienteIncidentes.ts';
import { useIncidentes } from './ContextoIncidentes.tsx';
import SeletorTestes from './SeletorTestes.tsx';

interface Props {
  testes: { idCenario: string; nome?: string }[];
  marcadosInicial?: string[];
  onVinculado: () => void;
  onFechar: () => void;
}

const campo =
  'w-full p-2.5 rounded-xl text-sm bg-volt-page border border-white/20 text-on-surface outline-none focus:border-volt-green/50';

/** Modal M7 — Vincular INC existente: busca pelo número ou título, escolhe um e liga aos testes do plano. */
export default function VincularIncModal({ testes, marcadosInicial = [], onVinculado, onFechar }: Props) {
  const { incidentes } = useIncidentes();
  const { voce } = usePessoas();
  const [busca, setBusca] = useState('');
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const [marcados, setMarcados] = useState<string[]>(marcadosInicial);
  const [erros, setErros] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  const campoBusca = useRef<HTMLInputElement>(null);

  useEffect(() => {
    campoBusca.current?.focus();
  }, []);

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFechar();
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [onFechar]);

  const termo = busca.trim().toLowerCase();
  const visiveis = useMemo(
    () => incidentes.filter((i) => !termo || `${i.numero} ${i.titulo}`.toLowerCase().includes(termo)),
    [incidentes, termo],
  );

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!escolhido) return;
    setErros([]);
    setSalvando(true);
    try {
      await vincularIncidente(escolhido, marcados, voce?.id ?? null);
      onVinculado();
    } catch (erro) {
      setErros(erro instanceof ErroApi ? erro.mensagens : ['Não foi possível vincular o INC.']);
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <form
        role="dialog"
        aria-modal="true"
        aria-label="Vincular INC existente"
        onSubmit={enviar}
        className="w-full max-w-lg max-h-[92vh] overflow-y-auto p-6 rounded-3xl bg-[#1a1a1a] border border-white/10 text-on-surface"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 font-black uppercase text-sm">
            <Link2 size={18} className="text-volt-green" aria-hidden /> Vincular INC existente
          </div>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="p-1 opacity-60 hover:opacity-100 cursor-pointer">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label htmlFor="inc-busca" className="block mb-1 text-[11px] font-bold text-on-surface-variant">Buscar</label>
            <input id="inc-busca" ref={campoBusca} value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="INC0715… ou parte do título" autoComplete="off" className={campo} />
          </div>

          {incidentes.length === 0 ? (
            <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-xs text-on-surface-variant">Nenhum INC registrado ainda. Use “Registrar INC”.</p>
          ) : visiveis.length === 0 ? (
            <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-xs text-on-surface-variant">Nenhum INC encontrado para esta busca.</p>
          ) : (
            <div role="radiogroup" aria-label="Incidentes" className="max-h-52 overflow-y-auto space-y-1 rounded-xl border border-white/10 bg-white/5 p-2">
              {visiveis.map((i) => (
                <label key={i.numero} className={`flex items-start gap-2 rounded-lg px-2 py-1.5 text-xs cursor-pointer ${escolhido === i.numero ? 'bg-volt-green/10' : 'hover:bg-white/5'}`}>
                  <input type="radio" name="inc-escolhido" checked={escolhido === i.numero} onChange={() => setEscolhido(i.numero)} className="mt-0.5 accent-volt-green" />
                  <span className="font-mono text-volt-green">{i.numero}</span>
                  <span className="min-w-0 flex-1">{i.titulo}</span>
                  <span className="text-on-surface-variant">{ROTULO_STATUS_INC[i.status]}</span>
                </label>
              ))}
            </div>
          )}

          <SeletorTestes opcoes={testes} marcados={marcados} onChange={setMarcados} rotulo="Vincular aos testes" />

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
            <button type="submit" disabled={!escolhido || marcados.length === 0 || salvando} className="px-4 py-2.5 rounded-xl text-xs font-black bg-volt-green text-black disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed">
              Vincular
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
