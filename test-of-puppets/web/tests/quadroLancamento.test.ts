import { describe, expect, it } from 'vitest';
import {
  agrupar,
  bloqueios,
  colunaDe,
  contar,
  diasUteisAte,
  notaDeMassa,
  percentualPronto,
  respPrincipal,
  textoDaCelula,
} from '../src/pages/lancamento/quadroLancamento';
import { filtrar, SEM_FILTROS, SEM_VALOR, temFiltro } from '../src/pages/planos/filtros';
import { item } from './apiFalsa';

const nomes: Record<string, string> = { ana: 'Ana', bia: 'Bia', carlos: 'Carlos' };
const nome = (id?: string) => (id ? (nomes[id] ?? id) : '-');

const itens = () => [
  item('CT03.1', { funcionalidade: 'Faturas', status: 'concluido', resultado: 'passou', responsavel: 'ana', prioridade: 'P1', estimativaMin: 20 }),
  item('CT03.2', { funcionalidade: 'Faturas', status: 'em_andamento', responsavel: 'ana', prioridade: 'P1', estimativaMin: 30, idMassa: '0483' }),
  item('CT03.3', { funcionalidade: 'Faturas', responsavel: 'bia', prioridade: 'P2', estimativaMin: 25 }),
  item('CT03.7', { funcionalidade: 'Faturas', responsavel: 'bia', prioridade: 'P2', estimativaMin: 30, idMassa: '0483', dependeDe: ['CT03.2'], bloqueadoPor: ['CT03.2'] }),
  item('CT04.1', { funcionalidade: 'Pix', responsavel: 'carlos', prioridade: 'P1', estimativaMin: 20 }),
  item('CT04.2', { funcionalidade: 'Pix', status: 'refinamento', responsavel: 'carlos' }),
  item('CT05.1', { funcionalidade: 'Cadastro', status: 'concluido', resultado: 'passou', responsavel: 'bia' }),
  item('CT05.2', { funcionalidade: 'Cadastro', status: 'concluido', resultado: 'falhou', responsavel: 'bia' }),
  item('CT09.9', { funcionalidade: undefined, status: 'concluido' }),
];

describe('quadroLancamento — colunas', () => {
  it('concluído se divide pelo resultado; o resto segue o status', () => {
    expect(colunaDe({ status: 'agendado' })).toBe('agendado');
    expect(colunaDe({ status: 'refinamento' })).toBe('refinamento');
    expect(colunaDe({ status: 'concluido', resultado: 'passou' })).toBe('passou');
    expect(colunaDe({ status: 'concluido', resultado: 'falhou' })).toBe('falhou');
    expect(colunaDe({ status: 'concluido' })).toBe('sem_resultado');
  });

  it('conta testes e minutos por coluna', () => {
    const c = contar(itens());
    expect(c.agendado).toEqual({ n: 3, minutos: 75 });
    expect(c.em_andamento).toEqual({ n: 1, minutos: 30 });
    expect(c.refinamento.n).toBe(1);
    expect(c.passou).toEqual({ n: 2, minutos: 20 });
    expect(c.falhou.n).toBe(1);
    expect(c.sem_resultado.n).toBe(1);
  });

  it('pronto = passou ÷ total, arredondado; vazio dá 0', () => {
    expect(percentualPronto(itens().slice(0, 4))).toBe(25);
    expect(percentualPronto(itens())).toBe(22);
    expect(percentualPronto([])).toBe(0);
  });

  it('texto da célula conforme o valor escolhido', () => {
    expect(textoDaCelula('quantidade', { n: 3, minutos: 75 }, 9)).toBe('3');
    expect(textoDaCelula('minutos', { n: 3, minutos: 75 }, 9)).toBe('75');
    expect(textoDaCelula('percentual', { n: 3, minutos: 75 }, 9)).toBe('33%');
    expect(textoDaCelula('percentual', { n: 0, minutos: 0 }, 0)).toBe('0%');
  });
});

describe('quadroLancamento — linhas', () => {
  it('por funcionalidade: ordem alfabética e "(sem funcionalidade)" por último, sem filtro possível', () => {
    const linhas = agrupar(itens(), 'funcionalidade', nome);
    expect(linhas.map((l) => l.rotulo)).toEqual(['Cadastro', 'Faturas', 'Pix', '(sem funcionalidade)']);
    expect(linhas.map((l) => l.itens.length)).toEqual([2, 4, 2, 1]);
    expect(linhas[1].filtro).toBe('Faturas');
    expect(linhas[3].filtro).toBeNull();
  });

  it('por responsável: ordena pelo nome, mostra o nome e "Sem responsável" filtra por SEM_VALOR', () => {
    const linhas = agrupar(itens(), 'responsavel', nome);
    expect(linhas.map((l) => l.rotulo)).toEqual(['Ana', 'Bia', 'Carlos', 'Sem responsável']);
    expect(linhas[0].filtro).toBe('ana');
    expect(linhas[3].filtro).toBe(SEM_VALOR);
  });

  it('por prioridade: P1, P2 e "Sem prioridade"', () => {
    const linhas = agrupar(itens(), 'prioridade', nome);
    expect(linhas.map((l) => l.rotulo)).toEqual(['P1', 'P2', 'Sem prioridade']);
    expect(linhas[2].filtro).toBe(SEM_VALOR);
  });

  it('responsável principal: o de mais testes; empate mostra os dois; ninguém dá "-"', () => {
    expect(respPrincipal(itens().filter((i) => i.funcionalidade === 'Faturas'), nome)).toBe('Ana / Bia');
    expect(respPrincipal(itens().filter((i) => i.funcionalidade === 'Pix'), nome)).toBe('Carlos');
    expect(respPrincipal([item('CT1')], nome)).toBe('-');
    expect(respPrincipal([item('CT1', { responsavel: 'ana' }), item('CT2', { responsavel: 'ana' }), item('CT3', { responsavel: 'bia' })], nome)).toBe('Ana');
  });
});

describe('quadroLancamento — marco e bloqueios', () => {
  it('dias úteis até a previsão: pula sábado e domingo; passado dá negativo; mesmo dia dá 0', () => {
    expect(diasUteisAte('2026-10-03', '2026-10-13')).toBe(7);
    expect(diasUteisAte('2026-10-05', '2026-10-06')).toBe(1);
    expect(diasUteisAte('2026-10-09', '2026-10-12')).toBe(1);
    expect(diasUteisAte('2026-10-13', '2026-10-09')).toBe(-2);
    expect(diasUteisAte('2026-10-13', '2026-10-13')).toBe(0);
  });

  it('nota de massa mostra quem libera quem', () => {
    expect(notaDeMassa(itens())).toBe('= massa 0483 compartilhada (CT03.2 → CT03.7)');
    expect(notaDeMassa([item('CT1')])).toBe('');
  });

  it('bloqueios listam só quem espera outro passar, com a massa', () => {
    expect(bloqueios(itens())).toEqual([{ idCenario: 'CT03.7', grupo: 'Faturas', texto: 'CT03.7 espera CT03.2 (mesma massa 0483)' }]);
  });
});

describe('filtro por resultado da Lista', () => {
  it('filtra passou, falhou e os concluídos sem resultado; conta como filtro ativo', () => {
    const todos = itens();
    expect(filtrar(todos, { ...SEM_FILTROS, resultado: 'passou' }, '2026-10-03').map((i) => i.idCenario)).toEqual(['CT03.1', 'CT05.1']);
    expect(filtrar(todos, { ...SEM_FILTROS, resultado: 'falhou' }, '2026-10-03').map((i) => i.idCenario)).toEqual(['CT05.2']);
    expect(filtrar(todos, { ...SEM_FILTROS, status: 'concluido', resultado: SEM_VALOR }, '2026-10-03').map((i) => i.idCenario)).toEqual(['CT09.9']);
    expect(temFiltro({ ...SEM_FILTROS, resultado: 'passou' })).toBe(true);
    expect(temFiltro(SEM_FILTROS)).toBe(false);
  });
});
