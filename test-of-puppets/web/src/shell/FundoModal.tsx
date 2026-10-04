import { useEffect, useRef, useState } from 'react';
import { Image as IconeImagem, RotateCcw, X } from 'lucide-react';
import { CELULA_MAXIMA, CELULA_MINIMA, OPACIDADE_MAXIMA, redimensionarImagem, type ConfigFundo } from './fundo.ts';

interface Props {
  config: ConfigFundo;
  onChange: (config: ConfigFundo) => void;
  onFechar: () => void;
}

const campoTexto = 'flex-1 p-2.5 rounded-xl text-xs bg-volt-page border border-white/20 text-on-surface';

/** Janela "Fundo" do Admin: imagem (envio ou endereço), visibilidade e tamanho dos quadrados do dither. */
export default function FundoModal({ config, onChange, onFechar }: Props) {
  const [endereco, setEndereco] = useState('');
  const [erro, setErro] = useState('');
  const janela = useRef<HTMLDivElement>(null);

  useEffect(() => {
    janela.current?.focus();
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFechar();
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [onFechar]);

  const usarEndereco = () => {
    const valor = endereco.trim();
    if (!valor) return;
    onChange({ ...config, src: valor });
    setEndereco('');
    onFechar();
  };

  const enviarArquivo = (arquivo: File) => {
    setErro('');
    redimensionarImagem(arquivo)
      .then((src) => {
        onChange({ ...config, src });
        onFechar();
      })
      .catch((e: Error) => setErro(e.message));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onFechar}>
      <div
        ref={janela}
        role="dialog"
        aria-modal="true"
        aria-label="Fundo do painel"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md p-6 rounded-3xl bg-[#1a1a1a] border border-white/10 text-on-surface outline-none"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 font-black uppercase text-sm">
            <IconeImagem size={18} aria-hidden /> Fundo do painel
          </div>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="p-1 opacity-60 hover:opacity-100 cursor-pointer">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-3">
          <label
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const arquivo = e.dataTransfer.files?.[0];
              if (arquivo) enviarArquivo(arquivo);
            }}
            className="flex flex-col items-center justify-center gap-1.5 p-5 rounded-2xl border-2 border-dashed border-white/20 hover:border-volt-green/50 bg-white/5 cursor-pointer transition-colors"
          >
            <input
              type="file"
              accept="image/*"
              className="hidden"
              aria-label="Enviar imagem de fundo"
              onChange={(e) => {
                const arquivo = e.target.files?.[0];
                if (arquivo) enviarArquivo(arquivo);
              }}
            />
            <IconeImagem size={22} className="opacity-60" aria-hidden />
            <span className="text-xs font-bold">Enviar imagem</span>
            <span className="text-[10px] opacity-60">clique ou arraste — JPG/PNG (reduzida para ≤1600px, salva neste navegador)</span>
          </label>
          {erro && <p role="alert" className="text-[11px] text-neon-error">{erro}</p>}

          <div className="flex gap-2">
            <input
              type="text"
              value={endereco}
              onChange={(e) => setEndereco(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && usarEndereco()}
              placeholder="ou cole um caminho/URL da imagem…"
              aria-label="Endereço da imagem"
              className={campoTexto}
            />
            <button
              type="button"
              disabled={!endereco.trim()}
              onClick={usarEndereco}
              className="px-4 rounded-xl text-xs font-black disabled:opacity-40 cursor-pointer bg-volt-green text-black"
            >
              Usar
            </button>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label htmlFor="fundo-opacidade" className="text-[11px] font-bold">Visibilidade do fundo</label>
              <span className="text-[10px] font-mono opacity-60">{Math.round(config.opacity * 100)}%</span>
            </div>
            <input
              id="fundo-opacidade"
              type="range"
              min={0}
              max={Math.round(OPACIDADE_MAXIMA * 100)}
              step={1}
              value={Math.round(config.opacity * 100)}
              onChange={(e) => onChange({ ...config, opacity: Number(e.target.value) / 100 })}
              aria-label="Opacidade do fundo"
              className="w-full cursor-pointer accent-volt-green"
            />
            <div className="flex justify-between text-[9px] opacity-50"><span>sutil</span><span>vibrante</span></div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label htmlFor="fundo-celula" className="text-[11px] font-bold">Tamanho dos quadrados (dither)</label>
              <span className="text-[10px] font-mono opacity-60">{config.ditherCellSize}px</span>
            </div>
            <input
              id="fundo-celula"
              type="range"
              min={CELULA_MINIMA}
              max={CELULA_MAXIMA}
              step={1}
              value={config.ditherCellSize}
              onChange={(e) => onChange({ ...config, ditherCellSize: Number(e.target.value) })}
              aria-label="Tamanho dos quadrados do dither"
              className="w-full cursor-pointer accent-volt-green"
            />
            <div className="flex justify-between text-[9px] opacity-50"><span>denso</span><span>pixelado</span></div>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <div className="flex-1 h-14 rounded-xl overflow-hidden bg-black/40">
              {config.src && (
                <img
                  src={config.src}
                  alt="Prévia do fundo"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              )}
            </div>
            <button
              type="button"
              onClick={() => onChange({ ...config, src: null })}
              disabled={!config.src}
              className="px-3 py-2.5 rounded-xl text-[11px] font-bold flex items-center gap-1.5 disabled:opacity-40 cursor-pointer bg-white/5 border border-white/10 hover:bg-white/10"
            >
              <RotateCcw size={13} aria-hidden /> Sem imagem
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
