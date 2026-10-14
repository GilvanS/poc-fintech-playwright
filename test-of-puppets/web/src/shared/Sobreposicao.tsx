import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Popup de verdade: monta direto no <body>. Um `fixed inset-0` dentro de um elemento com `backdrop-blur` (os cards de vidro
 * do Kanban, a região do plano) deixa de ser relativo à tela e passa a ser relativo àquele elemento: o popup ficava preso,
 * cortado e fora do centro. Fora do DOM do vidro isso não acontece.
 */
export default function Sobreposicao({ children }: { children: ReactNode }) {
  return createPortal(<div className="contents font-sans">{children}</div>, document.body);
}
