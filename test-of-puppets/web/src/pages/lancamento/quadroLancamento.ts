import type { ItemPlano } from '../planos/clientePlanos.ts';
import { SEM_VALOR, type Filtros } from '../planos/filtros.ts';
import { diaDaSemana, somarDias } from '../roadmap/linhaDoTempo.ts';

/** Funções puras da tela Lançamento (V5): agrupa os testes do plano em linhas × colunas de status e conta. */

export type Linhas = 'funcionalidade' | 'responsavel' | 'prioridade';
export type Valor = 'quantidade' | 'minutos' | 'percentual';
export type ColunaChave = 'agendado' | 'em_andamento' | 'refinamento' | 'passou' | 'falhou' | 'sem_resultado';

export interface Coluna {
  chave: ColunaChave;
  rotulo: string;
  /** O que a Lista deve filtrar quando se clica numa célula desta coluna. */
  filtro: Pick<Filtros, 'status' | 'resultado'>;
}

export const COLUNAS: Coluna[] = [
  { chave: 'agendado', rotulo: 'Agendado', filtro: { status: 'agendado', resultado: '' } },
  { chave: 'em_andamento', rotulo: 'Em andamento', filtro: { status: 'em_andamento', resultado: '' } },
  { chave: 'refinamento', rotulo: 'Refinamento', filtro: { status: 'refinamento', resultado: '' } },
  { chave: 'passou', rotulo: 'Passou', filtro: { status: 'concluido', resultado: 'passou' } },
  { chave: 'falhou', rotulo: 'Falhou', filtro: { status: 'concluido', resultado: 'falhou' } },
  { chave: 'sem_resultado', rotulo: 'Concluído sem resultado', filtro: { status: 'concluido', resultado: SEM_VALOR } },
];

/** Em que coluna o teste cai: concluído se divide pelo resultado marcado à mão. */
export function colunaDe(item: Pick<ItemPlano, 'status' | 'resultado'>): ColunaChave {
  if (item.status !== 'concluido') return item.status;
  return item.resultado === 'passou' ? 'passou' : item.resultado === 'falhou' ? 'falhou' : 'sem_resultado';
}

export interface Linha {
  chave: string;
  rotulo: string;
  /** Valor para o filtro da Lista; null quando a Lista não consegue filtrar por isso ("sem funcionalidade"). */
  filtro: string | null;
  itens: ItemPlano[];
}

const ordenar = (a: string, b: string) => a.localeCompare(b, 'pt-BR');

/** Agrupa por funcionalidade, responsável ou prioridade; quem não tem o campo vai para a última linha. */
export function agrupar(itens: ItemPlano[], por: Linhas, nome: (id?: string) => string): Linha[] {
  const grupos = new Map<string, ItemPlano[]>();
  for (const i of itens) {
    const chave = (por === 'funcionalidade' ? i.funcionalidade : por === 'responsavel' ? i.responsavel : i.prioridade) ?? '';
    grupos.set(chave, [...(grupos.get(chave) ?? []), i]);
  }
  const semValor = { funcionalidade: '(sem funcionalidade)', responsavel: 'Sem responsável', prioridade: 'Sem prioridade' }[por];
  const comValor = [...grupos.keys()].filter((k) => k !== '');
  const ordem = por === 'responsavel' ? comValor.sort((a, b) => ordenar(nome(a), nome(b))) : comValor.sort(ordenar);
  const linhas: Linha[] = ordem.map((chave) => ({ chave, rotulo: por === 'responsavel' ? nome(chave) : chave, filtro: chave, itens: grupos.get(chave) ?? [] }));
  if (grupos.has('')) linhas.push({ chave: '', rotulo: semValor, filtro: por === 'funcionalidade' ? null : SEM_VALOR, itens: grupos.get('') ?? [] });
  return linhas;
}

export interface Celula {
  n: number;
  minutos: number;
}

export function contar(itens: ItemPlano[]): Record<ColunaChave, Celula> {
  const celulas = Object.fromEntries(COLUNAS.map((c) => [c.chave, { n: 0, minutos: 0 }])) as Record<ColunaChave, Celula>;
  for (const i of itens) {
    const c = celulas[colunaDe(i)];
    c.n += 1;
    c.minutos += i.estimativaMin ?? 0;
  }
  return celulas;
}

/** passou ÷ total, em % inteiro. */
export function percentualPronto(itens: Pick<ItemPlano, 'status' | 'resultado'>[]): number {
  if (itens.length === 0) return 0;
  return Math.round((itens.filter((i) => colunaDe(i) === 'passou').length / itens.length) * 100);
}

/** O texto da célula conforme o "Valor" escolhido; o percentual é sobre o total geral do plano. */
export function textoDaCelula(valor: Valor, celula: Celula, totalGeral: number): string {
  if (valor === 'minutos') return String(celula.minutos);
  if (valor === 'percentual') return totalGeral === 0 ? '0%' : `${Math.round((celula.n / totalGeral) * 100)}%`;
  return String(celula.n);
}

/** Quem tem mais testes na linha; empate mostra os dois (ou mais). '-' se ninguém tem responsável. */
export function respPrincipal(itens: ItemPlano[], nome: (id?: string) => string): string {
  const cont = new Map<string, number>();
  for (const i of itens) if (i.responsavel) cont.set(i.responsavel, (cont.get(i.responsavel) ?? 0) + 1);
  if (cont.size === 0) return '-';
  const maior = Math.max(...cont.values());
  return [...cont.entries()]
    .filter(([, n]) => n === maior)
    .map(([id]) => nome(id))
    .sort(ordenar)
    .join(' / ');
}

/** Dias úteis (seg-sex) de hoje, exclusive, até `alvo`, inclusive; negativo se o alvo já passou. */
export function diasUteisAte(hoje: string, alvo: string): number {
  if (alvo === hoje) return 0;
  const sentido = alvo > hoje ? 1 : -1;
  let dias = 0;
  let atual = hoje;
  for (let guarda = 0; guarda < 3660 && atual !== alvo; guarda += 1) {
    atual = somarDias(atual, sentido);
    const dow = diaDaSemana(atual);
    if (dow !== 0 && dow !== 6) dias += sentido;
  }
  return dias;
}

/** "= massa 0483 compartilhada (CT03.2 → CT03.7)" para a linha, ou '' se ninguém depende de ninguém ali. */
export function notaDeMassa(itens: ItemPlano[]): string {
  const pares = itens.flatMap((i) => (i.idMassa ? i.dependeDe.map((d) => ({ massa: i.idMassa as string, de: d, para: i.idCenario })) : []));
  if (pares.length === 0) return '';
  return pares.map((p) => `= massa ${p.massa} compartilhada (${p.de} → ${p.para})`).join(' · ');
}

export interface Bloqueio {
  idCenario: string;
  grupo: string;
  texto: string;
}

/** Testes que esperam outro passar (mesma massa). Standby e INC ficam para quando existirem. */
export function bloqueios(itens: ItemPlano[]): Bloqueio[] {
  return itens
    .filter((i) => i.bloqueadoPor.length > 0)
    .map((i) => ({
      idCenario: i.idCenario,
      grupo: i.funcionalidade ?? '(sem funcionalidade)',
      texto: `${i.idCenario} espera ${i.bloqueadoPor.join(', ')}${i.idMassa ? ` (mesma massa ${i.idMassa})` : ''}`,
    }));
}
