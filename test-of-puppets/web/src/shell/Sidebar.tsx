import { useEffect, useState, type FocusEvent, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronUp, PanelLeft, PanelLeftClose, PanelLeftOpen, PanelRight, PanelRightClose, PanelRightOpen, Trash2 } from 'lucide-react';
import { gruposComVisoes, type ChaveAtiva, type GrupoMenu, type ItemMenu, type VisaoDoMenu } from './menu.ts';
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
  /** Lixeira ao lado de cada visão salva que a pessoa pode excluir (só aparece nas `excluivel`). */
  onExcluirVisao?: (chave: ChaveAtiva) => void;
  onAlternarLado: () => void;
  onAlternarRecolhido: () => void;
}

/** Dica do trilho: aparece ao lado do ícone (fora do menu, para o desfoque dele não prender o "fixed"). */
interface Dica {
  rotulo: string;
  top: number;
  x: number;
}

const semBarra = '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden';
const botaoTopo = 'p-1 rounded-md text-on-surface-variant hover:text-on-surface hover:bg-white/5 transition-colors cursor-pointer';
const botaoTrilho = 'grid h-7 w-7 place-items-center rounded-full text-on-surface-variant hover:bg-white/10 hover:text-on-surface transition-colors cursor-pointer';

/** Soma dos selos numéricos de um grupo (INC abertos, por exemplo); 0 se não há nenhum. */
const totalDosSelos = (grupo: GrupoMenu, selos: Partial<Record<string, string>>) =>
  grupo.itens.reduce((soma, i) => soma + (Number(selos[i.chave] ?? i.selo) || 0), 0);

/** Sub-opção do menu aberto: ícone pequeno + nome; a ativa leva o sublinhado verde, como no exemplo. */
function SubOpcao({
  item,
  ativo,
  selo,
  aoEscolher,
  aoExcluir,
}: {
  item: ItemMenu;
  ativo: boolean;
  selo?: string;
  aoEscolher: () => void;
  aoExcluir?: () => void;
}) {
  const Icone = item.icone;
  return (
    <div className="relative">
      <button
        type="button"
        onClick={aoEscolher}
        aria-label={item.rotulo}
        aria-current={ativo ? 'page' : undefined}
        title={item.rotulo}
        className={`flex w-full items-center gap-2 py-2 pl-3 text-left text-xs font-bold transition-colors cursor-pointer ${aoExcluir ? 'pr-8' : 'pr-3'} ${
          ativo ? 'border-b-2 border-volt-green text-volt-green' : 'rounded-lg border-b-2 border-transparent text-on-surface-variant hover:bg-white/5 hover:text-on-surface'
        }`}
      >
        <Icone size={14} className="shrink-0" aria-hidden />
        <span className="min-w-0 flex-1 truncate">{item.rotulo}</span>
        {selo && <span className="shrink-0 rounded-full bg-volt-green/15 px-1.5 text-[10px] font-black text-volt-green">{selo}</span>}
      </button>
      {aoExcluir && (
        <button
          type="button"
          onClick={aoExcluir}
          aria-label={`Excluir visão ${item.rotulo}`}
          title="Excluir visão"
          className="absolute right-1.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-md text-on-surface-variant opacity-70 hover:bg-neon-error/20 hover:text-neon-error hover:opacity-100 transition-colors cursor-pointer"
        >
          <Trash2 size={13} aria-hidden />
        </button>
      )}
    </div>
  );
}

/**
 * Menu lateral hierárquico, como no exemplo: cada grupo tem ícone e seta e guarda as sub-opções, que DESCEM na própria
 * coluna (nada abre por cima da tela). Trilho (padrão): ícone do grupo e, abaixo dele, os ícones das sub-opções.
 * Aberto: o grupo abre e fecha com as sub-opções recuadas (ícone + nome). Botões para trocar de lado e expandir/recolher.
 */
export default function Sidebar({ lado, recolhido, ativo, visoes = [], selos = {}, onSelecionar, onExcluirVisao, onAlternarLado, onAlternarRecolhido }: Props) {
  const grupos = gruposComVisoes(visoes);
  const grupoDoAtivo = grupos.find((g) => g.itens.some((i) => i.chave === ativo))?.titulo;
  const [dica, setDica] = useState<Dica | null>(null);
  // Grupos abertos (vale para o trilho e para o menu aberto). Começa com o grupo da tela ativa.
  const [abertos, setAbertos] = useState<Set<string>>(() => new Set(grupoDoAtivo ? [grupoDoAtivo] : []));

  // Ir para uma tela de outro grupo (pelo sino, por exemplo) abre o grupo dela.
  useEffect(() => {
    if (grupoDoAtivo) setAbertos((a) => (a.has(grupoDoAtivo) ? a : new Set(a).add(grupoDoAtivo)));
  }, [grupoDoAtivo]);

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
  const alternarGrupo = (titulo: string) => {
    esconderDica();
    setAbertos((a) => {
      const novo = new Set(a);
      if (novo.has(titulo)) novo.delete(titulo);
      else novo.add(titulo);
      return novo;
    });
  };

  if (recolhido) {
    return (
      <aside
        aria-label="Navegação"
        data-lado={lado}
        data-recolhido={recolhido}
        className="hidden md:flex flex-col items-center w-14 h-[calc(100vh-4rem)] py-2.5 rounded-[28px] border border-white/10 bg-volt-surface/70 backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.35)] self-start sticky top-8"
      >
        {/* Coluna esticada na altura da tela e parada (sticky): logo no topo, botões no pé e só o miolo rola. */}
        <div aria-hidden className="mb-1 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-volt-green text-[11px] font-black text-black">
          TP
        </div>

        <div onScroll={esconderDica} className={`flex min-h-0 w-full flex-1 flex-col items-center gap-1 overflow-y-auto py-1 ${semBarra}`}>
        {grupos.map((grupo, indice) => {
          const GrupoIcone = grupo.icone;
          const aberto = abertos.has(grupo.titulo);
          const ehDoAtivo = grupo.titulo === grupoDoAtivo;
          const total = totalDosSelos(grupo, selos);
          return (
            <div key={grupo.titulo} data-grupo={grupo.titulo} className="flex flex-col items-center gap-1">
              {indice > 0 && <div aria-hidden className="my-0.5 h-px w-6 bg-white/10" />}
              <button
                type="button"
                onClick={() => alternarGrupo(grupo.titulo)}
                onMouseEnter={(e) => mostrarDica(e, grupo.titulo)}
                onMouseLeave={esconderDica}
                aria-label={`Grupo ${grupo.titulo}`}
                aria-expanded={aberto}
                className={`relative grid h-9 w-9 shrink-0 place-items-center rounded-full transition-all cursor-pointer ${
                  ehDoAtivo && !aberto ? 'bg-volt-green text-black shadow-[0_0_16px_rgba(0,255,157,0.35)]' : ehDoAtivo ? 'text-volt-green' : 'text-on-surface-variant hover:bg-white/10 hover:text-on-surface'
                }`}
              >
                <GrupoIcone size={18} aria-hidden />
                {aberto ? <ChevronUp size={9} aria-hidden className="absolute -right-0.5 bottom-0.5" /> : <ChevronDown size={9} aria-hidden className="absolute -right-0.5 bottom-0.5" />}
                {!aberto && total > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-neon-error px-1 text-[9px] font-black text-black">{total}</span>
                )}
              </button>

              {/* As sub-opções descem aqui, na própria coluna: ícones menores, o da tela ativa em círculo verde. */}
              <div role="group" aria-label={`Sub-opções de ${grupo.titulo}`} className={`w-10 flex-col items-center gap-1 rounded-2xl bg-white/[0.05] py-1 ${aberto ? 'flex' : 'hidden'}`}>
                {grupo.itens.map((item) => {
                  const Icone = item.icone;
                  const selo = selos[item.chave] ?? item.selo;
                  const excluir = item.excluivel && onExcluirVisao ? () => onExcluirVisao(item.chave) : undefined;
                  return (
                    <div key={item.chave} className="group relative">
                    <button
                      type="button"
                      onClick={() => {
                        esconderDica();
                        onSelecionar(item.chave);
                      }}
                      onMouseEnter={(e) => mostrarDica(e, item.rotulo)}
                      onMouseLeave={esconderDica}
                      onFocus={(e) => mostrarDica(e, item.rotulo)}
                      onBlur={esconderDica}
                      aria-label={item.rotulo}
                      aria-current={item.chave === ativo ? 'page' : undefined}
                      className={`relative grid h-8 w-8 shrink-0 place-items-center rounded-full transition-all cursor-pointer ${
                        item.chave === ativo ? 'bg-volt-green text-black shadow-[0_0_14px_rgba(0,255,157,0.35)]' : 'text-on-surface-variant hover:bg-white/10 hover:text-on-surface'
                      }`}
                    >
                      <Icone size={16} aria-hidden />
                      {selo && <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-neon-error px-1 text-[9px] font-black text-black">{selo}</span>}
                    </button>
                    {excluir && (
                      <button
                        type="button"
                        onClick={() => {
                          esconderDica();
                          excluir();
                        }}
                        aria-label={`Excluir visão ${item.rotulo}`}
                        title="Excluir visão"
                        className="absolute -bottom-1 -right-1 hidden h-4 w-4 place-items-center rounded-full bg-neon-error text-black group-hover:grid group-focus-within:grid cursor-pointer"
                      >
                        <Trash2 size={9} aria-hidden />
                      </button>
                    )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        </div>

        <div className="flex shrink-0 flex-col items-center gap-1 pt-1">
          <div aria-hidden className="mb-0.5 h-px w-6 bg-white/10" />
          <button type="button" onClick={onAlternarLado} aria-label={rotuloLado} onMouseEnter={(e) => mostrarDica(e, rotuloLado)} onMouseLeave={esconderDica} className={botaoTrilho}>
            <IconeLado size={15} aria-hidden />
          </button>
          <button type="button" onClick={onAlternarRecolhido} aria-label={rotuloRecolher} onMouseEnter={(e) => mostrarDica(e, rotuloRecolher)} onMouseLeave={esconderDica} className={botaoTrilho}>
            <IconeRecolher size={15} aria-hidden />
          </button>
        </div>

        {dica &&
          // No body: o desfoque do menu faria o "fixed" valer só dentro dele.
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
      className="hidden md:flex flex-col w-56 h-[calc(100vh-4rem)] p-2.5 rounded-2xl border border-white/10 bg-volt-surface/80 backdrop-blur-sm self-start sticky top-8"
    >
      <div className="flex shrink-0 items-center justify-between px-2 py-1 mb-1 gap-1">
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

      {/* Coluna esticada e parada: o cabeçalho fica fixo e só a lista de grupos rola. */}
      <div className={`flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto ${semBarra}`}>
      {grupos.map((grupo) => {
        const GrupoIcone = grupo.icone;
        const aberto = abertos.has(grupo.titulo);
        const Seta = aberto ? ChevronUp : ChevronDown;
        const total = totalDosSelos(grupo, selos);
        return (
          <div key={grupo.titulo} data-grupo={grupo.titulo} className="flex flex-col">
            <button
              type="button"
              onClick={() => alternarGrupo(grupo.titulo)}
              aria-label={`Grupo ${grupo.titulo}`}
              aria-expanded={aberto}
              className={`flex items-center gap-2.5 rounded-full px-3 py-2.5 text-left transition-colors cursor-pointer hover:bg-white/5 ${grupo.titulo === grupoDoAtivo ? 'text-on-surface' : 'text-on-surface-variant'}`}
            >
              <GrupoIcone size={18} className={`shrink-0 ${grupo.titulo === grupoDoAtivo ? 'text-volt-green' : ''}`} aria-hidden />
              <span className="min-w-0 flex-1 truncate text-xs font-black">{grupo.titulo}</span>
              {!aberto && total > 0 && <span className="shrink-0 rounded-full bg-neon-error px-1.5 text-[10px] font-black text-black">{total}</span>}
              <Seta size={14} className="shrink-0 opacity-70" aria-hidden />
            </button>
            {/* Fechado fica só escondido (não some do DOM). */}
            <div className={`ml-[1.35rem] flex-col gap-0.5 border-l border-white/10 pl-2 ${aberto ? 'flex' : 'hidden'}`}>
              {grupo.itens.map((item) => (
                <SubOpcao
                  key={item.chave}
                  item={item}
                  ativo={item.chave === ativo}
                  selo={selos[item.chave] ?? item.selo}
                  aoEscolher={() => onSelecionar(item.chave)}
                  aoExcluir={item.excluivel && onExcluirVisao ? () => onExcluirVisao(item.chave) : undefined}
                />
              ))}
            </div>
          </div>
        );
      })}
      </div>
    </aside>
  );
}
