/** O que o modal "Ordem de execução" precisa saber de cada teste do plano. */
export interface ItemOrdem {
  idCenario: string;
  /** Testes de mesma massa e numeração menor (calculado pelo servidor). Só vale o que está na lista. */
  dependeDe: string[];
  dataPlanejada?: string;
  prioridade?: 'P1' | 'P2' | 'P3';
}

export interface Violacao {
  dependente: string;
  dependencia: string;
}

/** Dependentes que ficaram antes da dependência. Dependência fora da lista não conta. */
export function violacoes(ordem: ItemOrdem[]): Violacao[] {
  const posicao = new Map(ordem.map((i, p) => [i.idCenario, p]));
  const lista: Violacao[] = [];
  ordem.forEach((item, p) => {
    for (const dep of item.dependeDe) {
      const pos = posicao.get(dep);
      if (pos !== undefined && pos > p) lista.push({ dependente: item.idCenario, dependencia: dep });
    }
  });
  return lista;
}

/**
 * Move o item de `de` para `para`. Devolve null se não mexe (mesma posição, fora dos limites) ou se a
 * mudança deixaria a regra da massa pior (o dependente não passa da dependência e vice-versa).
 */
export function mover<T extends ItemOrdem>(ordem: T[], de: number, para: number): T[] | null {
  const dentro = (i: number) => Number.isInteger(i) && i >= 0 && i < ordem.length;
  if (!dentro(de) || !dentro(para) || de === para) return null;
  const nova = [...ordem];
  const [item] = nova.splice(de, 1);
  nova.splice(para, 0, item);
  return violacoes(nova).length <= violacoes(ordem).length ? nova : null;
}

/** Põe cada dependência antes de quem depende dela, mantendo o resto na ordem atual. */
export function corrigir<T extends ItemOrdem>(ordem: T[]): T[] {
  const porId = new Map(ordem.map((i) => [i.idCenario, i]));
  const colocados = new Set<string>();
  const resultado: T[] = [];
  const colocar = (item: T) => {
    if (colocados.has(item.idCenario)) return;
    colocados.add(item.idCenario);
    for (const dep of item.dependeDe) {
      const anterior = porId.get(dep);
      if (anterior) colocar(anterior);
    }
    resultado.push(item);
  };
  ordem.forEach(colocar);
  return resultado;
}

/** Ordena por data ou prioridade (sem valor vai para o fim; empate mantém a ordem atual) e respeita a massa. */
export function ordenarPor<T extends ItemOrdem>(ordem: T[], criterio: 'data' | 'prioridade'): T[] {
  const chave = (i: T) => (criterio === 'data' ? i.dataPlanejada : i.prioridade);
  const ordenada = [...ordem].sort((a, b) => {
    const ca = chave(a);
    const cb = chave(b);
    if (ca === cb) return 0;
    if (ca === undefined) return 1;
    if (cb === undefined) return -1;
    return ca < cb ? -1 : 1;
  });
  return corrigir(ordenada);
}

/** Texto da coluna "Regra": depois de quem o teste fica e quem ele libera, só entre os testes da lista. */
export function regraDoItem(ordem: ItemOrdem[], idCenario: string): { depoisDe: string[]; libera: string[] } {
  const ids = new Set(ordem.map((i) => i.idCenario));
  const item = ordem.find((i) => i.idCenario === idCenario);
  return {
    depoisDe: (item?.dependeDe ?? []).filter((d) => ids.has(d)),
    libera: ordem.filter((o) => o.dependeDe.includes(idCenario)).map((o) => o.idCenario),
  };
}
