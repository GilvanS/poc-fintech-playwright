import { useState, type FocusEvent, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { PanelLeft, PanelLeftClose, PanelLeftOpen, PanelRight, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { gruposComVisoes, type ChaveAtiva, type VisaoDoMenu } from './menu.ts';
import type { Lado } from './preferencias.ts';

interface Props {
  lado: Lado;
  recolhido: boolean;
  ativo: ChaveAtiva;
  /** Visões salvas que aparecem em "Minhas visões". */
  visoes?: VisaoDoMenu[];
  /** Números ao lado dos itens (ex.: INC abertos); sem entrada, não há selo. */
  selos?: Partial<Record<string, string>>;
  onSelecionar: (chave: ChaveAtiva) => void;
  onAlternarLado: () => void;
  onAlternarRecolhido: () => void;
}

/** Dica do trilho: aparece ao lado do ícone (fora do menu, que pode rolar sem cortá-la). */
interface Dica {
  rotulo: string;
  top: number;
  x: number;
}

const semBarra = '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden';
const botaoTopo = 'p-1 rounded-md text-on-surface-variant hover:text-on-surface hover:bg-white/5 transition-colors cursor-pointer';
const botaoTrilho = 'grid h-7 w-7 place-items-center rounded-full text-on-surface-variant hover:bg-white/10 hover:text-on-surface transition-colors cursor-pointer';

/**
 * Menu lateral. Por padrão é um trilho estreito só de ícones (como o exemplo aprovado): o item ativo é um círculo
 * preenchido, os grupos se separam por uma linha fina e o nome aparece numa dica ao passar o mouse. Expandido, mostra
 * o texto e os títulos dos grupos. Botões para trocar de lado e para expandir/recolher.
 */
export default function Sidebar({ lado, recolhido, ativo, visoes = [], selos = {}, onSelecionar, onAlternarLado, onAlternarRecolhido }: Props) {
  const [dica, setDica] = useState<Dica | null>(null);
  const naEsquerda = lado === 'esquerda';
  const IconeLado = naEsquerda ? PanelRight : PanelLeft;
  const IconeRecolher = naEsquerda
    ? recolhido ? PanelLeftOpen : PanelLeftClose
    : recolhido ? PanelRightOpen : PanelRightClose;
  const rotuloLado = naEsquerda ? 'Mover menu para a direita' : 'Mover menu para a esquerda';
  const rotuloRecolher = recolhido ? 'Expandir menu' : 'Recolher menu';

  const mostrarDica = (e: MouseEvent<HTMLElement> | FocusEvent<HTMLElement>, rotulo: string) => {
    const r = e.currentTarget.getBoundingClientRect();
    setDica({ rotulo, top: r.top + r.height / 2, x: naEsquerda ? r.right + 10 : r.left - 10 });
  };
  const esconderDica = () => setDica(null);
  const grupos = gruposComVisoes(visoes);

  if (recolhido) {
    return (
      <aside
        aria-label="Navegação"
        data-lado={lado}
        data-recolhido={recolhido}
        onScroll={esconderDica}
        className={`hidden md:flex flex-col items-center gap-1 w-14 py-2.5 rounded-[28px] border border-white/10 bg-volt-surface/70 backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.35)] self-start sticky top-8 max-h-[calc(100vh-4rem)] overflow-y-auto ${semBarra}`}
      >
        <div aria-hidden className="mb-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-volt-green text-[11px] font-black text-black">
          TP
        </div>

        {grupos.map((grupo, indice) => (
          <div key={grupo.titulo} className="flex flex-col items-center gap-1">
            {indice > 0 && <div aria-hidden className="my-0.5 h-px w-6 bg-white/10" />}
            {grupo.itens.map(({ chave, rotulo, icone: Icone, selo: seloFixo }) => {
              const ehAtivo = chave === ativo;
              const selo = selos[chave] ?? seloFixo;
              return (
                <button
                  key={chave}
                  type="button"
                  onClick={() => onSelecionar(chave)}
                  onMouseEnter={(e) => mostrarDica(e, rotulo)}
                  onMouseLeave={esconderDica}
                  onFocus={(e) => mostrarDica(e, rotulo)}
                  onBlur={esconderDica}
                  aria-label={rotulo}
                  aria-current={ehAtivo ? 'page' : undefined}
                  className={`relative grid h-9 w-9 shrink-0 place-items-center rounded-full transition-all cursor-pointer ${
                    ehAtivo
                      ? 'bg-volt-green text-black shadow-[0_0_16px_rgba(0,255,157,0.35)]'
                      : 'text-on-surface-variant hover:bg-white/10 hover:text-on-surface'
                  }`}
                >
                  <Icone size={18} aria-hidden />
                  {selo && (
                    <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-neon-error px-1 text-[9px] font-black text-black">
                      {selo}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}

        <div aria-hidden className="my-0.5 h-px w-6 bg-white/10" />
        <button type="button" onClick={onAlternarLado} aria-label={rotuloLado} onMouseEnter={(e) => mostrarDica(e, rotuloLado)} onMouseLeave={esconderDica} className={botaoTrilho}>
          <IconeLado size={15} aria-hidden />
        </button>
        <button type="button" onClick={onAlternarRecolhido} aria-label={rotuloRecolher} onMouseEnter={(e) => mostrarDica(e, rotuloRecolher)} onMouseLeave={esconderDica} className={botaoTrilho}>
          <IconeRecolher size={15} aria-hidden />
        </button>

        {dica &&
          // No body: o desfoque do menu faria o "fixed" valer só dentro dele, e o scroll o cortaria.
          createPortal(
            <span
              role="tooltip"
              style={{ top: dica.top, left: dica.x }}
              className={`pointer-events-none fixed z-[90] -translate-y-1/2 whitespace-nowrap rounded-lg border border-white/10 bg-black/90 px-2.5 py-1.5 text-xs font-bold text-on-surface shadow-lg ${naEsquerda ? '' : '-translate-x-full'}`}
            >
              {dica.rotulo}
            </span>,
            document.body,
          )}
      </aside>
    );
  }

  return (
    <aside
      aria-label="Navegação"
      data-lado={lado}
      data-recolhido={recolhido}
      className={`hidden md:flex flex-col gap-0.5 w-52 p-2.5 rounded-2xl border border-white/10 bg-volt-surface/80 backdrop-blur-sm self-start sticky top-8 max-h-[calc(100vh-4rem)] overflow-y-auto ${semBarra}`}
    >
      <div className="flex items-center justify-between px-2 py-1 mb-1 gap-1">
        <span className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant">Navegação</span>
        <div className="ml-auto flex items-center gap-1">
          <button type="button" onClick={onAlternarLado} aria-label={rotuloLado} title={rotuloLado} className={botaoTopo}>
            <IconeLado size={16} />
          </button>
          <button type="button" onClick={onAlternarRecolhido} aria-label={rotuloRecolher} title={rotuloRecolher} className={botaoTopo}>
            <IconeRecolher size={16} />
          </button>
        </div>
      </div>

      {grupos.map((grupo, indice) => (
        <div key={grupo.titulo} className="flex flex-col gap-0.5">
          <span className={`px-3 pt-1.5 pb-0.5 text-[9px] font-black uppercase tracking-wider truncate text-on-surface-variant/70 ${indice > 0 ? 'mt-1 border-t border-white/5' : ''}`}>
            {grupo.titulo}
          </span>
          {grupo.itens.map(({ chave, rotulo, icone: Icone, selo: seloFixo }) => {
            const ehAtivo = chave === ativo;
            const selo = selos[chave] ?? seloFixo;
            return (
              <button
                key={chave}
                type="button"
                onClick={() => onSelecionar(chave)}
                aria-label={rotulo}
                aria-current={ehAtivo ? 'page' : undefined}
                title={rotulo}
                className={`flex items-center gap-2 px-3 py-2 rounded-full border-2 text-xs font-bold text-left transition-all cursor-pointer ${
                  ehAtivo ? 'bg-volt-dark/70 text-volt-green border-white/70' : 'border-transparent text-on-surface-variant hover:bg-white/5 hover:text-on-surface'
                }`}
              >
                <Icone size={16} className="shrink-0" aria-hidden />
                <span className="min-w-0 flex-1 truncate">{rotulo}</span>
                {selo && <span className="shrink-0 rounded-full bg-volt-green/15 px-1.5 text-[10px] font-black text-volt-green">{selo}</span>}
              </button>
            );
          })}
        </div>
      ))}
    </aside>
  );
}
