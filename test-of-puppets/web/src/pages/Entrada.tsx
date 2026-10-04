import { LogIn } from 'lucide-react';
import GaleriaAscii from './entrada/GaleriaAscii.tsx';
import { IMAGENS_ENTRADA, type ImagemEntrada } from './entrada/imagens.ts';

interface Props {
  onEntrar: () => void;
  /** Imagens da galeria. Para trocar as do app, edite `pages/entrada/imagens.ts`. */
  imagens?: ImagemEntrada[];
}

/** Tela inicial: sem senha por enquanto, só o botão "Entrar", e a galeria ASCII embaixo. */
export default function Entrada({ onEntrar, imagens = IMAGENS_ENTRADA }: Props) {
  return (
    <main className="relative z-10 min-h-screen flex flex-col items-center gap-14 px-6 py-12 md:py-16">
      <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-volt-surface/80 backdrop-blur-sm p-8 text-center">
        <h1 className="text-3xl font-black tracking-tight text-on-surface">Test of Puppets</h1>
        <p className="mt-2 text-sm text-on-surface-variant">Gestão de planos de execução de testes</p>
        <button
          type="button"
          onClick={onEntrar}
          autoFocus
          className="mt-8 w-full flex items-center justify-center gap-2 rounded-2xl bg-volt-green px-6 py-3 text-base font-black text-black hover:brightness-110 transition cursor-pointer"
        >
          <LogIn size={18} aria-hidden />
          Entrar
        </button>
        <p className="mt-4 text-[11px] text-on-surface-variant/70">Acesso sem senha por enquanto.</p>
      </div>

      <GaleriaAscii imagens={imagens} />
    </main>
  );
}
