import { estaAberto, ROTULO_SEVERIDADE, ROTULO_STATUS_INC, SEVERIDADES, type Incidente } from '../../incidentes/clienteIncidentes.ts';
import { diasUteisAte } from '../lancamento/quadroLancamento.ts';
import type { Decisao, ItemPlano, Prioridade, TipoDecisao } from '../planos/clientePlanos.ts';

/** Funções puras da tela Release (V4): os 7 critérios saem sozinhos dos dados; só a decisão final é humana. */

export const TOTAL_CRITERIOS = 7;
export const ROTULO_DECISAO: Record<TipoDecisao, string> = { go: 'GO', no_go: 'NO-GO', go_excecao: 'GO com exceção' };

export const TITULOS_CRITERIOS = [
  'Todos os testes executados',
  'Nenhum teste Falhou',
  'Nenhum INC aberto afetando o plano',
  'Todos os testes P1 passaram',
  'Dependências de massa respeitadas',
  'Todos os testes com responsável e estimativa',
  'Dentro do prazo',
];

export interface DetalheCriterio {
  texto: string;
  idCenario?: string;
  numeroInc?: string;
}

export interface Criterio {
  /** 1 a 7, fixo. */
  numero: number;
  titulo: string;
  /** O valor de hoje, como se lê na coluna "Atual". */
  atual: string;
  ok: boolean;
  /** O que falta (o "ver" do critério). */
  detalhes: DetalheCriterio[];
}

export interface EntradaCriterios {
  itens: ItemPlano[];
  incidentes: Incidente[];
  /** aaaa-mm-dd */
  previsao?: string;
  /** aaaa-mm-dd */
  hoje: string;
  nome: (id?: string) => string;
}

const diasUteis = (n: number) => `${n} ${n === 1 ? 'dia útil' : 'dias úteis'}`;
const ids = (lista: ItemPlano[]) => lista.map((i) => i.idCenario);

/** INC ainda abertos que afetam algum teste deste plano. */
export function incidentesAbertosDoPlano(itens: ItemPlano[], incidentes: Incidente[]): Incidente[] {
  const noPlano = new Set(itens.map((i) => i.idCenario));
  return incidentes.filter((inc) => estaAberto(inc) && inc.testesAfetados.some((t) => noPlano.has(t)));
}

/** "CT03.2 e CT04.1" / "CT03.2, CT04.1 e CT05.2". */
export function listaEm(textos: string[]): string {
  if (textos.length <= 1) return textos.join('');
  return `${textos.slice(0, -1).join(', ')} e ${textos[textos.length - 1]}`;
}

/** Os critérios "1, 2 e 3" para frases como "critérios 1, 2 e 3 não atendidos". */
export const listarCriterios = (numeros: number[]): string => listaEm(numeros.map(String));

export function calcularCriterios({ itens, incidentes, previsao, hoje, nome }: EntradaCriterios): Criterio[] {
  const total = itens.length;
  const feito = (c: number, ok: boolean, atual: string, detalhes: DetalheCriterio[] = []): Criterio => ({
    numero: c,
    titulo: TITULOS_CRITERIOS[c - 1],
    atual,
    ok,
    detalhes,
  });

  // 1 — todos executados
  const concluidos = itens.filter((i) => i.status === 'concluido');
  const c1 = feito(
    1,
    total > 0 && concluidos.length === total,
    total === 0 ? 'plano sem testes' : `${concluidos.length} de ${total}`,
    itens.filter((i) => i.status !== 'concluido').map((i) => ({ texto: `${i.idCenario} ainda não foi concluído`, idCenario: i.idCenario })),
  );

  // 2 — nenhum falhou
  const falhas = itens.filter((i) => i.resultado === 'falhou');
  const c2 = feito(
    2,
    falhas.length === 0,
    falhas.length === 0 ? 'nenhuma falha' : `${falhas.length} ${falhas.length === 1 ? 'falha' : 'falhas'} (${ids(falhas).join(', ')})`,
    falhas.map((i) => ({ texto: `${i.idCenario} falhou`, idCenario: i.idCenario })),
  );

  // 3 — nenhum INC aberto
  const abertos = incidentesAbertosDoPlano(itens, incidentes);
  const porSeveridade = SEVERIDADES.map((s) => ({ s, n: abertos.filter((i) => i.severidade === s).length })).filter((x) => x.n > 0);
  const c3 = feito(
    3,
    abertos.length === 0,
    abertos.length === 0
      ? 'nenhum aberto'
      : `${abertos.length} ${abertos.length === 1 ? 'aberto' : 'abertos'} (${porSeveridade.map((x) => `${ROTULO_SEVERIDADE[x.s]} ${x.n}`).join(', ')})`,
    abertos.map((inc) => ({
      texto: `${inc.numero} · ${ROTULO_SEVERIDADE[inc.severidade]} · ${ROTULO_STATUS_INC[inc.status]} · ${nome(inc.responsavel ?? undefined)} · afeta ${inc.testesAfetados.filter((t) => itens.some((i) => i.idCenario === t)).join(' ')}`,
      numeroInc: inc.numero,
    })),
  );

  // 4 — todos os P1 passaram
  const p1 = itens.filter((i) => i.prioridade === 'P1');
  const p1Pendem = p1.filter((i) => i.resultado !== 'passou');
  const c4 = feito(
    4,
    p1Pendem.length === 0,
    p1.length === 0
      ? 'nenhum teste P1 no plano'
      : `${p1.length - p1Pendem.length} de ${p1.length}${p1Pendem.length > 0 ? ` (${ids(p1Pendem).join(', ')} ${p1Pendem.length === 1 ? 'pende' : 'pendem'})` : ''}`,
    p1Pendem.map((i) => ({ texto: `${i.idCenario} (P1) ainda não passou`, idCenario: i.idCenario })),
  );

  // 5 — dependências de massa respeitadas
  const esperando = itens.filter((i) => i.bloqueadoPor.length > 0);
  const frase = (i: ItemPlano) => `${i.idCenario} espera o ${i.bloqueadoPor.join(', ')}${i.idMassa ? ` (mesma massa ${i.idMassa})` : ''}`;
  const c5 = feito(
    5,
    esperando.length === 0,
    esperando.length === 0 ? 'nenhum teste espera outro' : esperando.length === 1 ? frase(esperando[0]) : `${esperando.length} testes esperando outro`,
    esperando.map((i) => ({ texto: frase(i), idCenario: i.idCenario })),
  );

  // 6 — responsável e estimativa
  const incompletos = itens.filter((i) => !i.responsavel || i.estimativaMin === undefined);
  const c6 = feito(
    6,
    total > 0 && incompletos.length === 0,
    total === 0 ? 'plano sem testes' : `${total - incompletos.length} de ${total}`,
    incompletos.map((i) => ({
      texto: `${i.idCenario} sem ${[!i.responsavel ? 'responsável' : '', i.estimativaMin === undefined ? 'estimativa' : ''].filter(Boolean).join(' e ')}`,
      idCenario: i.idCenario,
    })),
  );

  // 7 — dentro do prazo
  let c7: Criterio;
  if (!previsao) {
    c7 = feito(7, false, 'sem previsão definida', [{ texto: 'O plano não tem previsão: defina uma para medir o prazo' }]);
  } else {
    const dias = diasUteisAte(hoje, previsao);
    const entregueNoPrazo = total > 0 && concluidos.length === total && itens.every((i) => !i.dataExecucao || i.dataExecucao <= previsao);
    if (dias >= 0) c7 = feito(7, true, dias === 0 ? 'alvo é hoje' : `alvo em ${diasUteis(dias)}`);
    else if (entregueNoPrazo) c7 = feito(7, true, 'concluído dentro do prazo');
    else c7 = feito(7, false, `venceu há ${diasUteis(-dias)}`, [{ texto: `A previsão (${previsao.split('-').reverse().join('/')}) já passou` }]);
  }

  return [c1, c2, c3, c4, c5, c6, c7];
}

export const cumpridos = (criterios: Criterio[]): number => criterios.filter((c) => c.ok).length;
export const naoAtendidos = (criterios: Criterio[]): number[] => criterios.filter((c) => !c.ok).map((c) => c.numero);

export interface EstadoDecisao {
  /** A decisão mais recente, se houver. */
  ultima?: Decisao;
  /** A última decisão foi GO (ou GO com exceção) e continua valendo. */
  liberado: boolean;
  /** Foi GO, mas algum teste mudou depois: precisa reavaliar. */
  reavaliar: boolean;
  /** Os testes que mudaram depois do GO. */
  mudaramDepois: string[];
}

/** "Alterar um teste depois do GO volta a situação para Reavaliar e avisa quem decidiu." */
export function estadoDaDecisao(decisoes: Decisao[] | undefined, itens: ItemPlano[]): EstadoDecisao {
  const ultima = decisoes && decisoes.length > 0 ? decisoes[decisoes.length - 1] : undefined;
  if (!ultima || ultima.decisao === 'no_go') return { ...(ultima ? { ultima } : {}), liberado: false, reavaliar: false, mudaramDepois: [] };
  const mudaramDepois = itens.filter((i) => i.atualizadoEm !== undefined && i.atualizadoEm > ultima.em).map((i) => i.idCenario);
  return { ultima, liberado: mudaramDepois.length === 0, reavaliar: mudaramDepois.length > 0, mudaramDepois };
}

export interface Prontidao {
  chave: string;
  rotulo: string;
  passou: number;
  falhou: number;
  total: number;
}

const conta = (chave: string, rotulo: string, itens: ItemPlano[]): Prontidao => ({
  chave,
  rotulo,
  passou: itens.filter((i) => i.resultado === 'passou').length,
  falhou: itens.filter((i) => i.resultado === 'falhou').length,
  total: itens.length,
});

export function prontidaoPorPrioridade(itens: ItemPlano[]): Prontidao[] {
  const grupos: { chave: string; rotulo: string; lista: ItemPlano[] }[] = (['P1', 'P2', 'P3'] as Prioridade[]).map((p) => ({
    chave: p,
    rotulo: p,
    lista: itens.filter((i) => i.prioridade === p),
  }));
  grupos.push({ chave: 'sem', rotulo: 'Sem prioridade', lista: itens.filter((i) => !i.prioridade) });
  return grupos.filter((g) => g.lista.length > 0).map((g) => conta(g.chave, g.rotulo, g.lista));
}

export function prontidaoPorPessoa(itens: ItemPlano[], nome: (id?: string) => string): Prontidao[] {
  const donos = [...new Set(itens.map((i) => i.responsavel).filter((r): r is string => Boolean(r)))];
  const linhas = donos
    .map((id) => conta(id, nome(id), itens.filter((i) => i.responsavel === id)))
    .sort((a, b) => a.rotulo.localeCompare(b.rotulo, 'pt-BR'));
  const sem = itens.filter((i) => !i.responsavel);
  return sem.length > 0 ? [...linhas, conta('sem', 'Sem responsável', sem)] : linhas;
}

export interface Pendencia {
  chave: string;
  tipo: 'teste' | 'inc' | 'plano';
  /** 1 = maior impacto. */
  peso: 1 | 2 | 3;
  /** "[P1]", "[Alta]". */
  etiqueta: string;
  /** Quem resolve (nome para mostrar). */
  quem: string;
  /** Id do teste ou número do INC. */
  ref: string;
  acao: string;
  espera: boolean;
}

const PESO_PRIORIDADE: Record<string, 1 | 2 | 3> = { P1: 1, P2: 2, P3: 3 };
const PESO_SEVERIDADE: Record<string, 1 | 2 | 3> = { alta: 1, media: 2, baixa: 3 };
const ORDEM_TIPO = { inc: 0, teste: 1, plano: 2 } as const;

function acoesDoTeste(i: ItemPlano, abertosDoTeste: Incidente[]): string[] {
  const acoes: string[] = [];
  if (i.status !== 'concluido') {
    if (i.bloqueadoPor.length > 0) acoes.push(`aguardar o ${i.bloqueadoPor.join(', ')} passar${i.idMassa ? ` (mesma massa ${i.idMassa})` : ''}`);
    else if (i.status === 'em_andamento') acoes.push('concluir o teste (em andamento)');
    else if (i.status === 'refinamento') acoes.push('concluir o teste (em refinamento)');
    else acoes.push(`executar${i.dataPlanejada ? ` (planejado ${i.dataPlanejada.split('-').reverse().slice(0, 2).join('/')})` : ''}`);
  } else if (i.resultado === 'falhou') {
    acoes.push(abertosDoTeste.length > 0 ? `reexecutar após ${abertosDoTeste.map((x) => x.numero).join(', ')}` : 'corrigir e reexecutar');
  } else if (i.resultado === undefined) {
    acoes.push('marcar o resultado');
  }
  if (!i.responsavel) acoes.push('definir responsável');
  if (i.estimativaMin === undefined) acoes.push('definir estimativa');
  return acoes;
}

/** O que falta para liberar, do que mais pesa (P1, INC Alta) para o que menos pesa; quem espera outro vai depois. */
export function montarPendencias(entrada: EntradaCriterios, criterios: Criterio[]): Pendencia[] {
  const { itens, incidentes, nome } = entrada;
  const abertos = incidentesAbertosDoPlano(itens, incidentes);
  const lista: Pendencia[] = [];

  for (const i of itens) {
    const acoes = acoesDoTeste(i, abertos.filter((x) => x.testesAfetados.includes(i.idCenario)));
    if (acoes.length === 0) continue;
    lista.push({
      chave: `teste-${i.idCenario}`,
      tipo: 'teste',
      peso: i.prioridade ? PESO_PRIORIDADE[i.prioridade] : 3,
      etiqueta: i.prioridade ? `[${i.prioridade}]` : '[sem prioridade]',
      quem: nome(i.responsavel),
      ref: i.idCenario,
      acao: acoes.join(' · '),
      espera: i.status !== 'concluido' && i.bloqueadoPor.length > 0,
    });
  }

  for (const inc of abertos) {
    lista.push({
      chave: `inc-${inc.numero}`,
      tipo: 'inc',
      peso: PESO_SEVERIDADE[inc.severidade],
      etiqueta: `[${ROTULO_SEVERIDADE[inc.severidade]}]`,
      quem: nome(inc.responsavel ?? undefined),
      ref: inc.numero,
      acao: `resolver o INC "${inc.titulo}"`,
      espera: false,
    });
  }

  if (!criterios[6].ok) {
    lista.push({
      chave: 'plano-prazo',
      tipo: 'plano',
      peso: 2,
      etiqueta: '[Plano]',
      quem: '-',
      ref: 'Prazo',
      acao: entrada.previsao ? 'renegociar a previsão do plano' : 'definir a previsão do plano',
      espera: false,
    });
  }

  return lista.sort(
    (a, b) =>
      a.peso - b.peso ||
      Number(a.espera) - Number(b.espera) ||
      ORDEM_TIPO[a.tipo] - ORDEM_TIPO[b.tipo] ||
      a.ref.localeCompare(b.ref, 'pt-BR', { numeric: true }),
  );
}
