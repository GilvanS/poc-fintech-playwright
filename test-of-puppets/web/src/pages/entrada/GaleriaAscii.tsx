import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin';
import { CARACTERES_EMBARALHAR, COLUNAS, gerarAscii, podeAnimar } from './ascii.ts';
import type { ImagemEntrada } from './imagens.ts';

gsap.registerPlugin(ScrambleTextPlugin);

type Fase = 'carregando' | 'animando' | 'pronto';

/**
 * Um quadro 4:5. A foto é lida num canvas pequeno, vira caracteres que "embaralham" até assentar
 * (cor verde da paleta sobre o fundo escuro) e então somem, revelando a foto.
 * Sem decode()/canvas, ou com "reduzir movimento" ligado, a foto aparece direto.
 */
function Quadro({ imagem, atraso }: { imagem: ImagemEntrada; atraso: number }) {
  const foto = useRef<HTMLImageElement>(null);
  const camada = useRef<HTMLDivElement>(null);
  const [fase, setFase] = useState<Fase>(() => (podeAnimar() ? 'carregando' : 'pronto'));
  const [caracteres, setCaracteres] = useState<string[]>([]);
  const [quebrada, setQuebrada] = useState(false);

  // 1) espera a foto decodificar e converte em caracteres
  useEffect(() => {
    const elemento = foto.current;
    if (fase !== 'carregando' || !elemento) return;
    let vivo = true;
    elemento
      .decode()
      .then(() => {
        if (!vivo) return;
        const chars = gerarAscii(elemento);
        if (chars) {
          setCaracteres(chars);
          setFase('animando');
        } else {
          setFase('pronto'); // sem canvas ou imagem de outro domínio sem CORS
        }
      })
      .catch(() => vivo && setFase('pronto'));
    return () => {
      vivo = false;
    };
  }, [fase, imagem.src]);

  // 2) embaralha os caracteres até o final e depois apaga a camada
  useEffect(() => {
    if (fase !== 'animando' || !camada.current) return;
    const sobre = camada.current;
    const celulas = Array.from(sobre.querySelectorAll('span'));
    const embaralhar = gsap.to(celulas, {
      delay: atraso,
      duration: 1,
      scrambleText: (_indice: number, celula: Element) => ({
        text: (celula as HTMLElement).dataset.char ?? '',
        chars: CARACTERES_EMBARALHAR,
        speed: 1,
        tweenLength: false,
      }),
      stagger: { each: 0.003, from: 'random' },
      onComplete: () => {
        gsap.to(sobre, { autoAlpha: 0, duration: 0.6, delay: 0.4, onComplete: () => setFase('pronto') });
      },
    } as unknown as gsap.TweenVars); // o tipo do scrambleText não prevê a forma com função
    return () => {
      embaralhar.kill();
      gsap.killTweensOf(sobre);
    };
  }, [fase, atraso]);

  return (
    <div
      className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-white/10 bg-volt-dark md:even:translate-y-12"
      style={{ containerType: 'inline-size' }}
    >
      {quebrada ? (
        <div className="absolute inset-0 grid place-items-center p-4 text-center font-mono text-xs text-on-surface-variant">
          {imagem.alt}
        </div>
      ) : (
        <img
          ref={foto}
          src={imagem.src}
          alt={imagem.alt}
          crossOrigin="anonymous"
          onError={() => setQuebrada(true)}
          className={`absolute inset-0 h-full w-full object-cover ${fase === 'carregando' ? 'opacity-0' : ''}`}
        />
      )}

      {fase === 'animando' && (
        <div
          ref={camada}
          data-testid="ascii"
          aria-hidden="true"
          className="absolute inset-0 grid bg-volt-dark font-mono font-bold leading-none text-volt-green"
          style={{ gridTemplateColumns: `repeat(${COLUNAS}, 1fr)`, gridAutoRows: '1fr', fontSize: '4.5cqw' }}
        >
          {caracteres.map((char, i) => (
            <span key={i} data-char={char} className="grid place-items-center" />
          ))}
        </div>
      )}
    </div>
  );
}

export default function GaleriaAscii({ imagens }: { imagens: ImagemEntrada[] }) {
  return (
    <section aria-label="Galeria" className="mx-auto grid w-full max-w-5xl grid-cols-2 gap-6 pb-16 md:grid-cols-4 md:gap-10">
      {imagens.map((imagem, indice) => (
        <Quadro key={`${indice}-${imagem.src.slice(0, 40)}`} imagem={imagem} atraso={indice * 0.15} />
      ))}
    </section>
  );
}
