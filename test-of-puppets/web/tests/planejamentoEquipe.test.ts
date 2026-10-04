import { describe, expect, it } from 'vitest';
import {
  backlog,
  diasDaSemana,
  excedente,
  folga,
  itensDaSemana,
  linhasDaEquipe,
  rotuloDaSemana,
  rotuloDoDia,
  SEM_DONO,
  usoDaSemana,
  usoDepoisDeColocar,
  type ItemDoPlano,
} from '../src/pages/planejamento/planejamentoEquipe';
import { item, pessoa } from './apiFalsa';

// 05/10/2026 é segunda-feira.
const SEMANA = '2026-10-05';
const nomes: Record<string, string> = { ana: 'Ana', bia: 'Bia', carlos: 'Carlos' };
const nome = (id?: string) => (id ? (nomes[id] ?? id) : '-');
const doPlano = (id: string, extra: Partial<ItemDoPlano> = {}): ItemDoPlano => ({ ...item(id), planoId: 'pl_a', planoNome: '05/10/26', ...extra });

const equipe = [pessoa('ana', { capacidadeMinSemana: 120 }), pessoa('bia', { capacidadeMinSemana: 90 }), pessoa('carlos', { capacidadeMinSemana: 60 }), pessoa('dora', { ativa: false })];

const itens = () => [
  doPlano('CT03.3', { responsavel: 'bia', dataPlanejada: '2026-10-05', estimativaMin: 25, prioridade: 'P2' }),
  doPlano('CT03.7', { responsavel: 'bia', dataPlanejada: '2026-10-06', estimativaMin: 30, prioridade: 'P2' }),
  doPlano('CT04.1', { responsavel: 'carlos', dataPlanejada: '2026-10-07', estimativaMin: 20, prioridade: 'P1' }),
  doPlano('CT04.2', { responsavel: 'carlos', dataPlanejada: '2026-10-08' }),
  doPlano('CT04.4', { dataPlanejada: '2026-10-09', estimativaMin: 25 }),
  doPlano('CT03.1', { responsavel: 'ana', dataPlanejada: '2026-10-12', estimativaMin: 40 }),
  doPlano('CT06.1', { prioridade: 'P1', estimativaMin: 20 }),
  doPlano('CT05.3', { prioridade: 'P3', estimativaMin: 15 }),
  doPlano('CT04.3', { prioridade: 'P1', estimativaMin: 20 }),
  doPlano('CT09.9', { status: 'concluido' }),
  doPlano('CT07.1', {}),
];

describe('planejamentoEquipe — semana', () => {
  it('mostra segunda a sexta, ou os sete dias com fim de semana', () => {
    expect(diasDaSemana(SEMANA, false)).toEqual(['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09']);
    expect(diasDaSemana(SEMANA, true)).toHaveLength(7);
    expect(diasDaSemana(SEMANA, true)[6]).toBe('2026-10-11');
  });

  it('rótulos da semana e do dia', () => {
    expect(rotuloDaSemana(SEMANA, false)).toBe('05/10 – 09/10/2026');
    expect(rotuloDaSemana(SEMANA, true)).toBe('05/10 – 11/10/2026');
    expect(rotuloDaSemana('2026-12-28', false)).toBe('28/12 – 01/01/2027');
    expect(rotuloDoDia('2026-10-05')).toBe('Seg 05/10');
    expect(rotuloDoDia('2026-10-10')).toBe('Sáb 10/10');
  });
});

describe('planejamentoEquipe — linhas e uso', () => {
  it('uma linha por pessoa ativa na ordem do cadastro, "Sem dono" por último; inativa só aparece se ainda tiver teste', () => {
    expect(linhasDaEquipe(equipe, itens(), nome).map((l) => l.chave)).toEqual(['ana', 'bia', 'carlos', SEM_DONO]);
    const comInativa = [...itens(), doPlano('CT01.1', { responsavel: 'dora', dataPlanejada: SEMANA })];
    expect(linhasDaEquipe(equipe, comInativa, nome).map((l) => l.chave)).toEqual(['ana', 'bia', 'carlos', 'dora', SEM_DONO]);
  });

  it('cada linha leva a capacidade da pessoa e os testes dela; "Sem dono" tem os sem responsável', () => {
    const linhas = linhasDaEquipe(equipe, itens(), nome);
    expect(linhas[1]).toMatchObject({ nome: 'Bia', capacidade: 90 });
    expect(linhas[1].itens.map((i) => i.idCenario)).toEqual(['CT03.3', 'CT03.7']);
    const semDono = linhas[linhas.length - 1];
    expect(semDono).toMatchObject({ id: null, nome: 'Sem dono', capacidade: 0 });
    expect(semDono.itens.map((i) => i.idCenario)).toContain('CT04.4');
  });

  it('uso = soma das estimativas dos testes planejados na semana; sem estimativa conta 0; outras semanas ficam de fora', () => {
    const [ana, bia, carlos] = linhasDaEquipe(equipe, itens(), nome);
    expect(usoDaSemana(ana.itens, SEMANA)).toBe(0);
    expect(usoDaSemana(ana.itens, '2026-10-12')).toBe(40);
    expect(usoDaSemana(bia.itens, SEMANA)).toBe(55);
    expect(usoDaSemana(carlos.itens, SEMANA)).toBe(20);
    expect(itensDaSemana(carlos.itens, SEMANA).map((i) => i.idCenario)).toEqual(['CT04.1', 'CT04.2']);
  });

  it('o fim de semana entra no uso mesmo com as colunas escondidas', () => {
    expect(usoDaSemana([{ dataPlanejada: '2026-10-10', estimativaMin: 15 }], SEMANA)).toBe(15);
  });

  it('excedente e folga só existem com capacidade informada', () => {
    expect(excedente(60, 65)).toBe(5);
    expect(excedente(60, 60)).toBe(0);
    expect(excedente(60, 20)).toBe(0);
    expect(excedente(0, 500)).toBe(0);
    expect(folga(90, 55)).toBe(35);
    expect(folga(60, 65)).toBe(-5);
    expect(folga(0, 10)).toBeNull();
  });

  it('uso depois de colocar um teste na pessoa não conta o mesmo teste duas vezes', () => {
    const [, bia, carlos] = linhasDaEquipe(equipe, itens(), nome);
    const novo = itens().find((i) => i.idCenario === 'CT06.1') as ItemDoPlano;
    expect(usoDepoisDeColocar(carlos, novo, SEMANA)).toBe(40);
    const jaDaBia = bia.itens.find((i) => i.idCenario === 'CT03.3') as ItemDoPlano;
    expect(usoDepoisDeColocar(bia, jaDaBia, SEMANA)).toBe(55);
  });
});

describe('planejamentoEquipe — backlog', () => {
  it('só testes sem dia e não concluídos, por prioridade e depois pelo ID', () => {
    expect(backlog(itens()).map((i) => i.idCenario)).toEqual(['CT04.3', 'CT06.1', 'CT05.3', 'CT07.1']);
  });
});
