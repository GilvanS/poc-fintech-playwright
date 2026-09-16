export function proximaContagem(mapa: Map<string, number>, nomeBase: string): number {
  const contagem = (mapa.get(nomeBase) ?? 0) + 1;
  mapa.set(nomeBase, contagem);
  return contagem;
}
