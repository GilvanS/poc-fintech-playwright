import type { ReactNode, RefObject } from 'react';
import { PainelTela } from '../../shared/PainelTela.tsx';

interface Props {
  /** `pagina` (Lista, Kanban e visões): região dentro da página. Senão abre como painel de tela cheia (vindo de Planos). */
  ehPagina: boolean;
  janela: RefObject<HTMLDivElement | null>;
  nomeDoPlano?: string;
  onFechar: () => void;
  children: ReactNode;
}

/** O quadro do detalhe do plano: região na página, ou painel que ocupa a tela toda (antes era um popup grande). */
export default function QuadroPlano({ ehPagina, janela, nomeDoPlano, onFechar, children }: Props) {
  if (ehPagina) {
    return (
      <div ref={janela} role="region" aria-label="Plano" tabIndex={-1} className="w-full flex flex-col rounded-3xl bg-volt-surface/80 backdrop-blur-sm border border-white/10 text-on-surface outline-none">
        {children}
      </div>
    );
  }
  return (
    <PainelTela titulo="Detalhe do plano" trilha="Planos › Detalhe do plano" onFechar={onFechar}>
      <div ref={janela} tabIndex={-1} className="flex flex-col text-on-surface outline-none">
        {children}
      </div>
    </PainelTela>
  );
}
