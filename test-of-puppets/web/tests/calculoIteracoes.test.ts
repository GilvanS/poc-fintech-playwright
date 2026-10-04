import { describe, expect, it } from 'vitest';
import {
  backlogDoCatalogo,
  burndown,
  capacidadeDoPeriodo,
  classificar,
  diaDaIteracao,
  diasUteisEntre,
  estimadoDe,
  periodoDoPlano,
  projetar,
  realDe,
  somarDiasUteis,
  variacaoReal,
  velocidadeMedia,
} from '../src/pages/iteracoes/calculoIteracoes';
import { cenario, item, pessoa, plano } from './apiFalsa';

// 28/09/2026 é segunda-feira; a iteração vai de 28/09 a 13/10 (12 dias úteis).
const INICIO = '2026-09-28';
const FIM = '2026-10-13';
const HOJE = '2026-10-02';

const feitos = (n: number, prefixo: string) => Array.from({ length: n }, (_, i) => item(`${prefixo}${i}`, { status: 'concluido', resultado: 'passou' }));
const meta = (criado: string, previsao?: string) => ({ criadoEm: `${criado}T12:00:00.000Z`, ...(previsao ? { previsao } : {}) });

const itensDaIteracao = () => [
  item('CT1', { status: 'concluido', resultado: 'passou', dataExecucao: '2026-09-29', estimativaMin: 20, tempoRealMin: 25 }),
  item('CT2', { status: 'concluido', resultado: 'passou', dataExecucao: '2026-09-30', estimativaMin: 30, tempoRealMin: 40 }),
  item('CT3', { status: 'concluido', resultado: 'falhou', dataExecucao: '2026-10-02', estimativaMin: 25 }),
  ...['CT4', 'CT5', 'CT6', 'CT7', 'CT8'].map((id) => item(id, { estimativaMin: 20 })),
];

describe('calculoIteracoes — dias úteis', () => {
  it('conta só segunda a sexta, os dois extremos inclusive', () => {
    const dias = diasUteisEntre(INICIO, FIM);
    expect(dias).toHaveLength(12);
    expect(dias[0]).toBe('2026-09-28');
    expect(dias[11]).toBe('2026-10-13');
    expect(dias).not.toContain('2026-10-03');
    expect(diasUteisEntre('2026-10-03', '2026-10-04')).toEqual([]);
    expect(diasUteisEntre('2026-10-13', '2026-10-01')).toEqual([]);
  });

  it('soma dias úteis pulando o fim de semana', () => {
    expect(somarDiasUteis('2026-10-02', 1)).toBe('2026-10-05');
    expect(somarDiasUteis('2026-10-02', 9)).toBe('2026-10-15');
    expect(somarDiasUteis('2026-10-03', 1)).toBe('2026-10-05');
  });

  it('dia da iteração: "dia 5 de 12"; fora do período dá null; fim de semana fica no último dia útil', () => {
    expect(diaDaIteracao(INICIO, FIM, HOJE)).toEqual({ dia: 5, total: 12 });
    expect(diaDaIteracao(INICIO, FIM, '2026-10-03')).toEqual({ dia: 5, total: 12 });
    expect(diaDaIteracao(INICIO, FIM, '2026-09-20')).toBeNull();
    expect(diaDaIteracao(INICIO, FIM, '2026-10-20')).toBeNull();
  });

  it('período do plano: criação até a previsão; sem previsão é um dia só', () => {
    expect(periodoDoPlano(plano('a', 'A', [], meta('2026-09-28', FIM)))).toEqual({ inicio: INICIO, fim: FIM });
    expect(periodoDoPlano(plano('a', 'A', [], meta('2026-09-28')))).toEqual({ inicio: INICIO, fim: INICIO });
  });
});

describe('calculoIteracoes — anterior, atual e próxima', () => {
  const velho = () => plano('pl_velho', '14/09/26', feitos(6, 'V'), meta('2026-09-14', '2026-09-25'));
  const atual = () => plano('pl_atual', '28/09/26', itensDaIteracao(), meta('2026-09-28', FIM));
  const proxima = () => plano('pl_prox', '05/10/26', [], meta('2026-10-05', '2026-10-20'));

  it('o último concluído é o anterior; os dois primeiros abertos, pela previsão, são atual e próxima', () => {
    const c = classificar([proxima(), velho(), atual()]);
    expect(c.anterior?.plano.id).toBe('pl_velho');
    expect(c.atual?.plano.id).toBe('pl_atual');
    expect(c.proxima?.plano.id).toBe('pl_prox');
  });

  it('com poucos planos, o que não existe fica null', () => {
    expect(classificar([])).toEqual({ anterior: null, atual: null, proxima: null });
    const so = classificar([atual()]);
    expect(so.atual?.plano.id).toBe('pl_atual');
    expect(so.anterior).toBeNull();
    expect(so.proxima).toBeNull();
  });

  it('velocidade = média de concluídos nas últimas 3 iterações encerradas', () => {
    const a = plano('a', 'A', feitos(6, 'A'), meta('2026-09-01', '2026-09-11'));
    const b = plano('b', 'B', feitos(5, 'B'), meta('2026-09-14', '2026-09-25'));
    expect(velocidadeMedia([a, b, atual()])).toBe(5.5);
    const c = plano('c', 'C', feitos(10, 'C'), meta('2026-08-01', '2026-08-10'));
    expect(velocidadeMedia([c, a, b, plano('d', 'D', feitos(1, 'D'), meta('2026-10-01', '2026-10-02'))])).toBe(4);
    expect(velocidadeMedia([atual()])).toBeNull();
  });
});

describe('calculoIteracoes — tempo e capacidade', () => {
  it('estimado, real e a variação em %', () => {
    const itens = itensDaIteracao();
    expect(estimadoDe(itens)).toBe(175);
    expect(realDe(itens)).toBe(65);
    expect(variacaoReal(130, 156)).toBe(20);
    expect(variacaoReal(100, 80)).toBe(-20);
    expect(variacaoReal(0, 50)).toBeNull();
  });

  it('capacidade do período = capacidades ativas × semanas (dias úteis ÷ 5)', () => {
    const equipe = [pessoa('ana', { capacidadeMinSemana: 120 }), pessoa('bia', { capacidadeMinSemana: 90 }), pessoa('carlos', { capacidadeMinSemana: 60 }), pessoa('dora', { capacidadeMinSemana: 999, ativa: false })];
    expect(capacidadeDoPeriodo(equipe, '2026-10-05', '2026-10-09')).toBe(270);
    expect(capacidadeDoPeriodo(equipe, '2026-10-05', '2026-10-16')).toBe(540);
    expect(capacidadeDoPeriodo([], '2026-10-05', '2026-10-09')).toBe(0);
  });
});

describe('calculoIteracoes — burndown e projeção', () => {
  it('ideal desce em reta até 0 na previsão; real = testes ainda não concluídos no fim de cada dia', () => {
    const bd = burndown(itensDaIteracao(), INICIO, FIM, HOJE);
    expect(bd.dias).toHaveLength(12);
    expect(bd.total).toBe(8);
    expect(bd.ideal[0]).toBe(8);
    expect(bd.ideal[1]).toBe(7.3);
    expect(bd.ideal[11]).toBe(0);
    expect(bd.real.slice(0, 6)).toEqual([8, 7, 6, 6, 5, null]);
    expect(bd.real.slice(5).every((r) => r === null)).toBe(true);
    expect(bd.semData).toBe(0);
  });

  it('concluído sem data de execução só conta a partir de hoje e é avisado', () => {
    const itens = [...itensDaIteracao().slice(0, 7), item('CT8', { status: 'concluido', resultado: 'passou' })];
    const bd = burndown(itens, INICIO, FIM, HOJE);
    expect(bd.semData).toBe(1);
    expect(bd.real.slice(0, 5)).toEqual([8, 7, 6, 6, 4]);
  });

  it('plano sem testes tem total 0 e linha reta', () => {
    const bd = burndown([], INICIO, FIM, HOJE);
    expect(bd.total).toBe(0);
    expect(bd.ideal.every((v) => v === 0)).toBe(true);
  });

  it('projeta o término no ritmo atual e quanto passa do alvo', () => {
    const bd = burndown(itensDaIteracao(), INICIO, FIM, HOJE);
    expect(projetar(bd, INICIO, FIM, HOJE)).toEqual({ tipo: 'projecao', ritmo: 0.6, termino: '2026-10-15', atrasoDiasUteis: 2 });
  });

  it('no prazo: atraso 0 quando o término cai antes do alvo', () => {
    const itens = [
      ...['A', 'B', 'C', 'D'].map((id) => item(id, { status: 'concluido', resultado: 'passou', dataExecucao: '2026-09-29' })),
      item('E'),
      item('F'),
    ];
    const bd = burndown(itens, INICIO, FIM, HOJE);
    const p = projetar(bd, INICIO, FIM, HOJE);
    expect(p).toMatchObject({ tipo: 'projecao', atrasoDiasUteis: 0 });
  });

  it('concluído quando nada resta; sem ritmo quando nada foi feito', () => {
    const todos = [item('A', { status: 'concluido', dataExecucao: '2026-09-29' })];
    expect(projetar(burndown(todos, INICIO, FIM, HOJE), INICIO, FIM, HOJE)).toEqual({ tipo: 'concluido' });
    expect(projetar(burndown([item('A')], INICIO, FIM, HOJE), INICIO, FIM, HOJE)).toEqual({ tipo: 'sem_ritmo' });
  });
});

describe('calculoIteracoes — backlog do catálogo', () => {
  it('fica de fora quem já está em plano aberto; o resto vem por prioridade do último plano em que apareceu', () => {
    const encerrado = plano('pl_velho', '14/09/26', [item('CT04.3', { status: 'concluido', prioridade: 'P1', estimativaMin: 20 }), item('CT05.3', { status: 'concluido', prioridade: 'P3', estimativaMin: 15 })], meta('2026-09-14', '2026-09-25'));
    const aberto = plano('pl_atual', '28/09/26', [item('CT03.2', { prioridade: 'P1' })], meta('2026-09-28', FIM));
    const catalogo = [cenario('CT06.1', { idMassa: '0530' }), cenario('CT05.3'), cenario('CT03.2'), cenario('CT04.3')];
    const fila = backlogDoCatalogo(catalogo, [encerrado, aberto]);
    expect(fila.map((i) => i.idCenario)).toEqual(['CT04.3', 'CT05.3', 'CT06.1']);
    expect(fila[0]).toMatchObject({ prioridade: 'P1', estimativaMin: 20 });
    expect(fila[2]).toMatchObject({ idMassa: '0530', prioridade: undefined, estimativaMin: undefined });
  });
});
