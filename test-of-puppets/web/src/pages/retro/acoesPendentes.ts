import type { Acao, Retro } from '../../retros/clienteRetros.ts';

/** Uma ação de retro ainda não feita, com o plano de onde veio. */
export interface AcaoPendente {
  planoId: string;
  planoNome: string;
  acao: Acao;
}

/**
 * Ações pendentes das retros dos planos ANTERIORES a `planoId` ("anterior" = criado antes: `planos` vem na ordem de criação).
 * As com prazo mais cedo primeiro (as sem prazo ficam no fim, na ordem dos planos). Plano desconhecido ou o primeiro: vazio.
 */
export function acoesPendentesDeAnteriores(planoId: string, planos: { id: string; nome: string }[], retros: Retro[]): AcaoPendente[] {
  const indice = planos.findIndex((p) => p.id === planoId);
  if (indice <= 0) return [];
  const anteriores = planos.slice(0, indice);
  return anteriores
    .flatMap((p, ordem) =>
      (retros.find((r) => r.planoId === p.id)?.acoes ?? []).filter((a) => !a.feito).map((acao) => ({ planoId: p.id, planoNome: p.nome, acao, ordem })),
    )
    .sort((a, b) => (a.acao.prazo ?? '9999-99-99').localeCompare(b.acao.prazo ?? '9999-99-99') || a.ordem - b.ordem)
    .map(({ ordem: _ordem, ...resto }) => resto);
}
