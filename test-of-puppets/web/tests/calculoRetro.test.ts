import { describe, expect, it } from 'vitest';
import type { Incidente } from '../src/incidentes/clienteIncidentes';
import type { Nota } from '../src/retros/clienteRetros';
import { autorVisivel, calcularSugestoes, diasAte, ordenarNotas, quemVotou, textoDoPrazo } from '../src/pages/retro/calculoRetro';
import { item } from './apiFalsa';

const nome = (id?: string) => (id ? id[0].toUpperCase() + id.slice(1) : '-');

function inc(numero: string, extra: Partial<Incidente> = {}): Incidente {
  return {
    numero,
    titulo: `Titulo de ${numero}`,
    descricao: '',
    status: 'novo',
    severidade: 'media',
    responsavel: null,
    testesAfetados: [],
    comentarios: [],
    historico: [],
    abertoEm: '2026-09-20T10:00:00.000Z',
    resolvidoEm: null,
    atualizadoEm: '2026-09-20T10:00:00.000Z',
    versao: 1,
    ...extra,
  };
}

function nota(id: string, extra: Partial<Nota> = {}): Nota {
  return { id, coluna: 'bem', texto: `Nota ${id}`, autor: 'ana', em: '2026-09-26T10:00:00.000Z', votos: [], ...extra };
}

const itensPlano = () => [
  item('CT03.2', { status: 'concluido', resultado: 'passou', estimativaMin: 30, tempoRealMin: 40, idMassa: '0483', posicao: 1, dataExecucao: '2026-09-20' }),
  item('CT03.7', { status: 'concluido', resultado: 'passou', estimativaMin: 30, tempoRealMin: 40, idMassa: '0483', posicao: 2, dependeDe: ['CT03.2'], dataExecucao: '2026-09-25' }),
  item('CT02.3', { status: 'concluido', resultado: 'falhou', estimativaMin: 70, tempoRealMin: 76, posicao: 3, dataExecucao: '2026-09-22' }),
];

describe('calcularSugestoes', () => {
  it('plano com falha, estimativa estourada, INC resolvido, massa repetida e atraso', () => {
    const incidentes = [inc('INC1', { status: 'resolvido', resolvidoEm: '2026-09-22T10:00:00.000Z', testesAfetados: ['CT02.3'] })];
    const s = calcularSugestoes({ itens: itensPlano(), incidentes, previsao: '2026-09-24' });
    expect(s.map((x) => [x.chave, x.coluna, x.texto])).toEqual([
      ['falhas', 'melhorar', '1 teste concluiu com falha (CT02.3)'],
      ['estimativa', 'melhorar', 'Estimado 130 min, real 156 min (+20%)'],
      ['inc-resolvidos', 'bem', '1 INC aberto e resolvido em 2 dias em média'],
      ['massa-0483', 'melhorar', 'Massa 0483 reutilizada por 2 testes (CT03.2 → CT03.7)'],
      ['prazo', 'melhorar', 'Último teste executado em 25/09/2026, depois da previsão de 24/09/2026'],
    ]);
  });

  it('tudo passou, estimativa dentro do tolerável e prazo cumprido viram "foi bem"', () => {
    const itens = [
      item('CT01.1', { status: 'concluido', resultado: 'passou', estimativaMin: 50, tempoRealMin: 45, dataExecucao: '2026-09-20' }),
      item('CT01.2', { status: 'concluido', resultado: 'passou', estimativaMin: 50, tempoRealMin: 45, dataExecucao: '2026-09-21' }),
    ];
    const s = calcularSugestoes({ itens, incidentes: [], previsao: '2026-09-24' });
    expect(s.map((x) => [x.chave, x.coluna, x.texto])).toEqual([
      ['todos-passaram', 'bem', 'Todos os 2 testes passaram'],
      ['estimativa', 'bem', 'Estimado 100 min, real 90 min (-10%)'],
      ['prazo', 'bem', 'Concluído dentro da previsão de 24/09/2026'],
    ]);
  });

  it('INC aberto que afeta o plano vira "pode melhorar"; INC de outro plano não conta', () => {
    const incidentes = [inc('INC7', { testesAfetados: ['CT02.3'] }), inc('INC8', { testesAfetados: ['CT99.9'] })];
    const s = calcularSugestoes({ itens: itensPlano(), incidentes });
    expect(s.find((x) => x.chave === 'inc-abertos')?.texto).toBe('1 INC ainda aberto (INC7)');
    expect(s.some((x) => x.chave === 'inc-resolvidos')).toBe(false);
  });

  it('sem estimativa e real medidos, sem previsão e sem massa repetida: não sugere nada disso', () => {
    const itens = [item('CT01.1', { status: 'concluido', resultado: 'passou', idMassa: '0100' }), item('CT01.2', { status: 'concluido', resultado: 'passou', estimativaMin: 10 })];
    const chaves = calcularSugestoes({ itens, incidentes: [] }).map((x) => x.chave);
    expect(chaves).toEqual(['todos-passaram']);
  });

  it('plano vazio não sugere nada', () => {
    expect(calcularSugestoes({ itens: [], incidentes: [] })).toEqual([]);
  });
});

describe('notas', () => {
  it('ordena pela mais votada; empate fica na ordem original', () => {
    const lista = [nota('a'), nota('b', { votos: ['ana', 'bia'] }), nota('c'), nota('d', { votos: ['ana'] })];
    expect(ordenarNotas(lista).map((n) => n.id)).toEqual(['b', 'd', 'a', 'c']);
  });

  it('autor aparece pelo nome; com anônimas só a própria pessoa vê "(sua nota)"', () => {
    const n = nota('a', { autor: 'ana' });
    expect(autorVisivel(n, false, null, nome)).toBe('Ana');
    expect(autorVisivel(n, true, 'ana', nome)).toBe('(sua nota)');
    expect(autorVisivel(n, true, 'bia', nome)).toBe('');
    expect(autorVisivel(n, true, null, nome)).toBe('');
  });

  it('quem votou aparece pelos nomes; anônimas escondem', () => {
    const n = nota('a', { votos: ['ana', 'bia'] });
    expect(quemVotou(n, false, nome)).toBe('Ana Bia');
    expect(quemVotou(n, true, nome)).toBe('');
  });
});

describe('prazos', () => {
  it('diasAte conta dias corridos, negativo se passou', () => {
    expect(diasAte('2026-10-08', '2026-10-20')).toBe(12);
    expect(diasAte('2026-10-08', '2026-10-08')).toBe(0);
    expect(diasAte('2026-10-08', '2026-10-05')).toBe(-3);
  });

  it('textoDoPrazo', () => {
    expect(textoDoPrazo('2026-10-20', '2026-10-08')).toBe('faltam 12 dias');
    expect(textoDoPrazo('2026-10-09', '2026-10-08')).toBe('faltam 1 dia');
    expect(textoDoPrazo('2026-10-08', '2026-10-08')).toBe('vence hoje');
    expect(textoDoPrazo('2026-10-05', '2026-10-08')).toBe('atrasada há 3 dias');
    expect(textoDoPrazo(null, '2026-10-08')).toBe('');
  });
});
