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

const botaoTopo =
  'p-1 rounded-md text-on-surface-variant hover:text-on-surface hover:bg-white/5 transition-colors cursor-pointer';

/**
 * Menu lateral no padrão do AllureShell do Admin: grupos com título, ícone + nome,
 * item ativo em pílula, botão de trocar de lado e botão de recolher (só os ícones).
 */
export default function Sidebar({ lado, recolhido, ativo, visoes = [], selos = {}, onSelecionar, onAlternarLado, onAlternarRecolhido }: Props) {
  const naEsquerda = lado === 'esquerda';
  const IconeLado = naEsquerda ? PanelRight : PanelLeft;
  const IconeRecolher = naEsquerda
    ? recolhido ? PanelLeftOpen : PanelLeftClose
    : recolhido ? PanelRightOpen : PanelRightClose;
  const rotuloLado = naEsquerda ? 'Mover menu para a direita' : 'Mover menu para a esquerda';
  const rotuloRecolher = recolhido ? 'Expandir menu' : 'Recolher menu';

  return (
    <aside
      aria-label="Navegação"
      data-lado={lado}
      data-recolhido={recolhido}
      className={`hidden md:flex flex-col gap-1 p-3 rounded-2xl border border-white/10 bg-volt-surface/80 backdrop-blur-sm self-start sticky top-8 transition-all duration-300 ${
        recolhido ? 'w-16' : 'w-56'
      }`}
    >
      <div className="flex items-center justify-between px-2 py-1 mb-2 gap-1">
        {!recolhido && (
          <span className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant">Navegação</span>
        )}
        <div className={`flex items-center gap-1 ${recolhido ? 'mx-auto flex-col' : 'ml-auto'}`}>
          <button type="button" onClick={onAlternarLado} aria-label={rotuloLado} title={rotuloLado} className={botaoTopo}>
            <IconeLado size={16} />
          </button>
          <button
            type="button"
            onClick={onAlternarRecolhido}
            aria-label={rotuloRecolher}
            title={rotuloRecolher}
            className={botaoTopo}
          >
            <IconeRecolher size={16} />
          </button>
        </div>
      </div>

      {gruposComVisoes(visoes).map((grupo, indice) => (
        <div key={grupo.titulo} className="flex flex-col gap-1">
          <span
            className={`px-3 pt-2 pb-0.5 text-[9px] font-black uppercase tracking-wider truncate text-on-surface-variant/70 ${
              indice > 0 ? 'mt-1 border-t border-white/5' : ''
            } ${recolhido ? 'text-center' : ''}`}
          >
            {recolhido ? '·' : grupo.titulo}
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
                className={`flex items-center gap-2 px-3 py-2.5 rounded-3xl border-2 text-xs font-bold text-left transition-all cursor-pointer ${
                  ehAtivo
                    ? 'bg-volt-dark/70 text-volt-green border-white/70'
                    : 'border-transparent text-on-surface-variant hover:bg-white/5 hover:text-on-surface'
                } ${recolhido ? 'justify-center px-2' : ''}`}
              >
                <Icone size={16} className="shrink-0" aria-hidden />
                {!recolhido && (
                  <>
                    <span className="min-w-0 flex-1 truncate">{rotulo}</span>
                    {selo && (
                      <span className="shrink-0 rounded-full bg-volt-green/15 px-1.5 text-[10px] font-black text-volt-green">
                        {selo}
                      </span>
                    )}
                  </>
                )}
              </button>
            );
          })}
        </div>
      ))}
    </aside>
  );
}
