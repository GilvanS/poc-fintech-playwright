import type { Lembrete } from '../src/lembretes/clienteLembretes';
import { json, type Rota } from './apiFalsaBase';

/** Rotas /api/lembretes do servidor falso: a lista é fixa; só a conta de "lida" ele faz sozinho. */
export function criarRotaLembretes(inicial: Lembrete[], recusarMarcacao = false) {
  const lembretes = structuredClone(inicial);
  const lidas = new Set(lembretes.filter((l) => l.lida).map((l) => l.chave));
  return ({ partes, metodo, corpo }: Rota): Response => {
    const resposta = () => {
      const lista = lembretes.map((l) => ({ ...l, lida: lidas.has(l.chave) }));
      return json(200, { lembretes: lista, naoLidas: lista.filter((l) => !l.lida).length });
    };
    if (metodo === 'POST' && partes[2] === 'lidas') {
      const chaves = (corpo?.chaves as string[] | undefined) ?? [];
      if (recusarMarcacao) return json(500, { erro: 'interno' });
      for (const c of chaves.filter((x) => lembretes.some((l) => l.chave === x))) {
        if (corpo?.lida === false) lidas.delete(c);
        else lidas.add(c);
      }
    }
    return resposta();
  };
}
