import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft } from 'lucide-react';

interface ValorArea {
  /** Onde os painéis aparecem (dentro da área de conteúdo do Shell). */
  slot: HTMLElement | null;
  /** Avisa que um painel abriu; devolve o aviso de que fechou. */
  abrir: () => () => void;
}

const ContextoArea = createContext<ValorArea | null>(null);

/**
 * Área de conteúdo do Shell. Os "painéis" (o que antes era popup grande) abrem aqui, no lugar da página, com o menu e o
 * cabeçalho sempre à vista. A página de trás fica escondida (não desmonta), então filtros e rolagem voltam como estavam.
 */
export function AreaDePaineis({ children }: { children: ReactNode }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const [abertos, setAbertos] = useState(0);
  const abrir = useCallback(() => {
    setAbertos((n) => n + 1);
    return () => setAbertos((n) => n - 1);
  }, []);
  const valor = useMemo(() => ({ slot, abrir }), [slot, abrir]);

  return (
    <ContextoArea.Provider value={valor}>
      {/* Painel aberto: a página some por altura 0 (e não por display:none), senão os popups pequenos (confirmações) que
          nascem dentro dela sumiriam junto — elementos "fixed" não são cortados pelo overflow do pai. */}
      <div data-testid="pagina" className={abertos > 0 ? '-mb-6 h-0 overflow-hidden' : 'contents'}>
        {children}
      </div>
      {/* Mais de um painel aberto (o detalhe do teste sobre o do plano): só o último aparece. */}
      <div ref={setSlot} data-testid="paineis" className="min-w-0 flex-1 empty:hidden [&>*:not(:last-child)]:hidden" />
    </ContextoArea.Provider>
  );
}

interface Props {
  /** Nome da janela (vira o nome acessível do `dialog`). */
  titulo: string;
  /** Texto ao lado do botão de voltar; padrão: o título. */
  trilha?: string;
  onFechar: () => void;
  /** `cheia` usa a largura toda; `form` limita a um formulário centralizado. */
  largura?: 'cheia' | 'form';
  children: ReactNode;
}

/**
 * Janela grande que abre dentro da tela (não como popup). Fora do Shell (testes de tela solta) cai num painel que cobre
 * a janela inteira, então o comportamento continua o mesmo.
 */
export function PainelTela({ titulo, trilha, onFechar, largura = 'cheia', children }: Props) {
  const area = useContext(ContextoArea);
  const abrir = area?.abrir;
  useEffect(() => abrir?.(), [abrir]);

  const conteudo = (
    <div role="dialog" aria-label={titulo} className="flex flex-col gap-4 text-on-surface">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onFechar}
          aria-label="Retornar à tela anterior"
          className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold hover:bg-white/10 cursor-pointer"
        >
          <ArrowLeft size={14} aria-hidden />
          Voltar
        </button>
        <span className="text-xs font-bold text-on-surface-variant">{trilha ?? titulo}</span>
      </div>
      <div className={`w-full rounded-3xl border border-white/10 bg-volt-surface/80 backdrop-blur-sm ${largura === 'form' ? 'mx-auto max-w-3xl' : ''}`}>{children}</div>
    </div>
  );

  if (area?.slot) return createPortal(conteudo, area.slot);
  return <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 p-4 backdrop-blur-sm">{conteudo}</div>;
}
