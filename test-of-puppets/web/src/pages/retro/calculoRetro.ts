import { estaAberto, type Incidente } from '../../incidentes/clienteIncidentes.ts';
import type { Acao, ColunaNota, Nota } from '../../retros/clienteRetros.ts';
import type { ItemPlano } from '../planos/clientePlanos.ts';
import { formatarData } from '../planos/datas.ts';

/** Funções puras da tela Retro (V8): sugestões tiradas dos dados, quem aparece como autor e o que está pendente. */

export interface Sugestao {
  /** Estável: serve para não repetir a sugestão que já virou nota. */
  chave: string;
  coluna: ColunaNota;
  texto: string;
}

export interface EntradaSugestoes {
  itens: ItemPlano[];
  incidentes: Incidente[];
  /** aaaa-mm-dd */
  previsao?: string;
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
const MS_DIA = 24 * 60 * 60 * 1000;

/** Sugestões automáticas; calculadas na hora e só gravadas quando alguém as transforma em nota. */
export function calcularSugestoes({ itens, incidentes, previsao }: EntradaSugestoes): Sugestao[] {
  const lista: Sugestao[] = [];
  const total = itens.length;

  const falhas = itens.filter((i) => i.resultado === 'falhou');
  if (falhas.length > 0) {
    lista.push({ chave: 'falhas', coluna: 'melhorar', texto: `${plural(falhas.length, 'teste concluiu', 'testes concluíram')} com falha (${falhas.map((i) => i.idCenario).join(', ')})` });
  } else if (total > 0 && itens.every((i) => i.resultado === 'passou')) {
    lista.push({ chave: 'todos-passaram', coluna: 'bem', texto: `Todos os ${total} testes passaram` });
  }

  const medidos = itens.filter((i) => i.estimativaMin !== undefined && i.tempoRealMin !== undefined);
  const estimado = medidos.reduce((soma, i) => soma + (i.estimativaMin ?? 0), 0);
  const real = medidos.reduce((soma, i) => soma + (i.tempoRealMin ?? 0), 0);
  if (estimado > 0) {
    const pct = Math.round(((real - estimado) / estimado) * 100);
    lista.push({
      chave: 'estimativa',
      coluna: pct > 10 ? 'melhorar' : 'bem',
      texto: `Estimado ${estimado} min, real ${real} min (${pct > 0 ? '+' : ''}${pct}%)`,
    });
  }

  const noPlano = new Set(itens.map((i) => i.idCenario));
  const doPlano = incidentes.filter((inc) => inc.testesAfetados.some((t) => noPlano.has(t)));
  const resolvidos = doPlano.filter((inc) => !estaAberto(inc) && inc.resolvidoEm);
  if (resolvidos.length > 0) {
    const dias = resolvidos.map((inc) => Math.max(0, Math.round((Date.parse(inc.resolvidoEm as string) - Date.parse(inc.abertoEm)) / MS_DIA)));
    const media = Math.round(dias.reduce((a, b) => a + b, 0) / dias.length);
    lista.push({ chave: 'inc-resolvidos', coluna: 'bem', texto: `${plural(resolvidos.length, 'INC aberto e resolvido', 'INC abertos e resolvidos')} em ${plural(media, 'dia', 'dias')} em média` });
  }
  const abertos = doPlano.filter(estaAberto);
  if (abertos.length > 0) {
    lista.push({ chave: 'inc-abertos', coluna: 'melhorar', texto: `${plural(abertos.length, 'INC ainda aberto', 'INC ainda abertos')} (${abertos.map((i) => i.numero).join(', ')})` });
  }

  const porMassa = new Map<string, ItemPlano[]>();
  for (const i of itens) if (i.idMassa) porMassa.set(i.idMassa, [...(porMassa.get(i.idMassa) ?? []), i]);
  for (const [massa, grupo] of [...porMassa].sort(([a], [b]) => a.localeCompare(b))) {
    if (grupo.length < 2) continue;
    const ordem = [...grupo].sort((a, b) => a.posicao - b.posicao).map((i) => i.idCenario);
    lista.push({ chave: `massa-${massa}`, coluna: 'melhorar', texto: `Massa ${massa} reutilizada por ${grupo.length} testes (${ordem.join(' → ')})` });
  }

  const datas = itens.map((i) => i.dataExecucao).filter((d): d is string => Boolean(d));
  if (previsao && datas.length > 0) {
    const ultima = [...datas].sort().at(-1) as string;
    lista.push(
      ultima > previsao
        ? { chave: 'prazo', coluna: 'melhorar', texto: `Último teste executado em ${formatarData(ultima)}, depois da previsão de ${formatarData(previsao)}` }
        : { chave: 'prazo', coluna: 'bem', texto: `Concluído dentro da previsão de ${formatarData(previsao)}` },
    );
  }

  return lista;
}

export const totalVotos = (nota: Pick<Nota, 'votos'>): number => nota.votos.length;

/** Mais votada primeiro; empate fica na ordem em que foi escrita. */
export function ordenarNotas(notas: Nota[]): Nota[] {
  return notas.map((n, i) => ({ n, i })).sort((a, b) => totalVotos(b.n) - totalVotos(a.n) || a.i - b.i).map((x) => x.n);
}

/** Quem aparece como autor. Com "notas anônimas" só a própria pessoa vê "(sua nota)"; os outros não veem nada. */
export function autorVisivel(nota: Pick<Nota, 'autor'>, anonimas: boolean, idVoce: string | null, nome: (id?: string) => string): string {
  if (!anonimas) return nome(nota.autor);
  return idVoce !== null && nota.autor === idVoce ? '(sua nota)' : '';
}

/** Os nomes de quem votou; anônimas escondem (só o número aparece). */
export function quemVotou(nota: Pick<Nota, 'votos'>, anonimas: boolean, nome: (id?: string) => string): string {
  return anonimas ? '' : nota.votos.map((v) => nome(v)).join(' ');
}

/** Dias corridos de `hoje` até `alvo` (aaaa-mm-dd); negativo se já passou. */
export function diasAte(hoje: string, alvo: string): number {
  return Math.round((Date.parse(`${alvo}T00:00:00Z`) - Date.parse(`${hoje}T00:00:00Z`)) / MS_DIA);
}

/** "faltam 12 dias", "vence hoje", "atrasada há 3 dias"; vazio sem prazo. */
export function textoDoPrazo(prazo: string | null, hoje: string): string {
  if (!prazo) return '';
  const d = diasAte(hoje, prazo);
  if (d === 0) return 'vence hoje';
  return d > 0 ? `faltam ${plural(d, 'dia', 'dias')}` : `atrasada há ${plural(-d, 'dia', 'dias')}`;
}

export const pendentes = (acoes: Acao[]): Acao[] => acoes.filter((a) => !a.feito);
export const concluidas = (acoes: Acao[]): Acao[] => acoes.filter((a) => a.feito);
