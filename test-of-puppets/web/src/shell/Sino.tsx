import { useEffect, useRef, useState } from 'react';
import { Bell, Check, ExternalLink, Undo2 } from 'lucide-react';
import { useLembretes } from '../lembretes/ContextoLembretes.tsx';
import type { Lembrete } from '../lembretes/clienteLembretes.ts';

interface Props {
  /** "Abrir" leva para a tela do lembrete. */
  onAbrir: (lembrete: Lembrete) => void;
}

const botaoCabecalho =
  'flex items-center gap-2 px-3 py-2.5 rounded-2xl border border-white/10 bg-white/5 text-sm font-bold text-on-surface hover:bg-white/10 transition-colors cursor-pointer';
const acao = 'flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-bold hover:bg-white/10 cursor-pointer';

/** O sino do cabeçalho: contador de lembretes não lidos e a lista (abrir, marcar como lida, desfazer). */
export default function Sino({ onAbrir }: Props) {
  const { lembretes, naoLidas, recarregar, marcar } = useLembretes();
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const raiz = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAberto(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAberto(false);
    };
    document.addEventListener('mousedown', fora);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', fora);
      document.removeEventListener('keydown', esc);
    };
  }, [aberto]);

  const alternar = () => {
    if (!aberto) void recarregar();
    setErro(null);
    setAberto((v) => !v);
  };

  const mudar = async (chaves: string[], lida: boolean) => {
    try {
      setErro(null);
      await marcar(chaves, lida);
    } catch {
      setErro('Não foi possível atualizar os lembretes.');
    }
  };

  const novos = lembretes.filter((l) => !l.lida);
  const lidos = lembretes.filter((l) => l.lida);

  const linha = (l: Lembrete) => (
    <li key={l.chave} data-testid={`lembrete-${l.chave}`} className={`flex flex-col gap-2 border-t border-white/10 px-4 py-3 first:border-t-0 ${l.lida ? 'opacity-60' : ''}`}>
      <div>
        <p className="text-sm font-black">{l.titulo}</p>
        <p className="text-xs text-on-surface-variant">{l.detalhe}</p>
      </div>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label={`Abrir: ${l.titulo}`}
          onClick={() => {
            setAberto(false);
            onAbrir(l);
          }}
          className={acao}
        >
          <ExternalLink size={12} aria-hidden /> Abrir
        </button>
        <button type="button" aria-label={`${l.lida ? 'Marcar como não lida' : 'Marcar como lida'}: ${l.titulo}`} onClick={() => void mudar([l.chave], !l.lida)} className={acao}>
          {l.lida ? <Undo2 size={12} aria-hidden /> : <Check size={12} aria-hidden />}
          {l.lida ? 'Marcar como não lida' : 'Marcar como lida'}
        </button>
      </div>
    </li>
  );

  return (
    <div ref={raiz} className="relative">
      <button type="button" aria-label={`Lembretes (${naoLidas})`} aria-expanded={aberto} aria-haspopup="dialog" onClick={alternar} className={`${botaoCabecalho} relative`}>
        <Bell size={16} aria-hidden />
        {naoLidas > 0 && (
          <span data-testid="sino-contador" className="absolute -top-1 -right-1 rounded-full bg-volt-green px-1.5 text-[10px] font-black text-black">
            {naoLidas}
          </span>
        )}
      </button>

      {aberto && (
        <div role="dialog" aria-label="Lembretes" className="absolute right-0 z-50 mt-2 w-[22rem] max-w-[90vw] overflow-hidden rounded-3xl border border-white/10 bg-[#1a1a1a] text-on-surface shadow-2xl">
          <div className="flex items-center justify-between gap-2 px-4 py-3">
            <h2 className="text-sm font-black uppercase tracking-wide">{naoLidas === 0 ? 'Lembretes' : `Lembretes (${naoLidas})`}</h2>
            {naoLidas > 0 && (
              <button type="button" onClick={() => void mudar(novos.map((l) => l.chave), true)} className={acao}>
                Marcar todas como lidas
              </button>
            )}
          </div>
          {erro && <p role="alert" className="mx-4 mb-2 rounded-xl border border-neon-error/40 bg-neon-error/10 px-3 py-2 text-xs text-neon-error">{erro}</p>}
          {lembretes.length === 0 ? (
            <p className="border-t border-white/10 px-4 py-6 text-center text-xs text-on-surface-variant">Nenhum lembrete.</p>
          ) : (
            <ul className="max-h-[60vh] overflow-y-auto">
              {novos.map(linha)}
              {lidos.length > 0 && <li aria-hidden className="border-t border-white/10 px-4 py-2 text-[10px] font-black uppercase tracking-wide text-on-surface-variant">{`Lidos (${lidos.length})`}</li>}
              {lidos.map(linha)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
