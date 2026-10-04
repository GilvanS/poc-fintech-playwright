import { describe, expect, it } from 'vitest';
import { filtrar, SEM_FILTROS, temFiltro, type Filtros } from '../src/pages/planos/filtros';
import { hojeISO } from '../src/pages/planos/datas';

type Linha = Parameters<typeof filtrar>[0][number];

const HOJE = '2026-10-05';
const itens: Linha[] = [
  { idCenario: 'CT03.1', nome: 'Pagar valor total', funcionalidade: 'Faturas', status: 'concluido', dataPlanejada: '2026-10-02' },
  { idCenario: 'CT03.2', nome: 'Pagar valor mínimo', funcionalidade: 'Faturas', status: 'agendado', dataPlanejada: '2026-10-05' },
  { idCenario: 'CT04.1', nome: 'Bloquear cartão', funcionalidade: 'Cartões', status: 'em_andamento', dataPlanejada: '2026-10-05' },
  { idCenario: 'CT03.7', nome: 'Reenvio do pagamento', funcionalidade: 'Faturas', status: 'agendado', dataPlanejada: '2026-10-09' },
  { idCenario: 'CT05.1', nome: 'Sem data', funcionalidade: 'Pix', status: 'refinamento' },
];

const ids = (f: Partial<Filtros>) => filtrar(itens, { ...SEM_FILTROS, ...f }, HOJE).map((i) => i.idCenario);

describe('filtrar', () => {
  it('sem filtros devolve tudo, na mesma ordem', () => {
    expect(ids({})).toEqual(['CT03.1', 'CT03.2', 'CT04.1', 'CT03.7', 'CT05.1']);
  });

  it('texto procura no ID ou no nome, sem diferenciar maiúsculas de minúsculas', () => {
    expect(ids({ texto: 'ct03' })).toEqual(['CT03.1', 'CT03.2', 'CT03.7']);
    expect(ids({ texto: 'MÍNIMO' })).toEqual(['CT03.2']);
    expect(ids({ texto: '  cartão ' })).toEqual(['CT04.1']);
    expect(ids({ texto: 'nada' })).toEqual([]);
  });

  it('funcionalidade e status filtram por igualdade', () => {
    expect(ids({ funcionalidade: 'Faturas' })).toEqual(['CT03.1', 'CT03.2', 'CT03.7']);
    expect(ids({ status: 'agendado' })).toEqual(['CT03.2', 'CT03.7']);
    expect(ids({ funcionalidade: 'Faturas', status: 'agendado' })).toEqual(['CT03.2', 'CT03.7']);
    expect(ids({ funcionalidade: 'Pix', status: 'agendado' })).toEqual([]);
  });

  it('data mostra só os planejados naquele dia', () => {
    expect(ids({ data: '2026-10-05' })).toEqual(['CT03.2', 'CT04.1']);
  });

  it('"Apenas hoje" usa a data planejada igual a hoje', () => {
    expect(ids({ apenasHoje: true })).toEqual(['CT03.2', 'CT04.1']);
  });

  it('"Datas passadas" mostra os planejados para antes de hoje (só olha a data)', () => {
    expect(ids({ datasPassadas: true })).toEqual(['CT03.1']);
  });

  it('as duas caixas juntas somam (hoje OU passadas); sem data nunca entra', () => {
    expect(ids({ apenasHoje: true, datasPassadas: true })).toEqual(['CT03.1', 'CT03.2', 'CT04.1']);
  });

  it('os filtros se combinam (E)', () => {
    expect(ids({ apenasHoje: true, funcionalidade: 'Cartões' })).toEqual(['CT04.1']);
    expect(ids({ apenasHoje: true, status: 'refinamento' })).toEqual([]);
  });
});

describe('filtrar — responsável, prioridade e "só meus"', () => {
  const lista: Linha[] = [
    { idCenario: 'CT01.1', status: 'agendado', responsavel: 'ana', prioridade: 'P1' },
    { idCenario: 'CT01.2', status: 'agendado', responsavel: 'bia', prioridade: 'P2' },
    { idCenario: 'CT01.3', status: 'agendado', prioridade: 'P1' },
    { idCenario: 'CT01.4', status: 'agendado', responsavel: 'ana' },
  ];
  const r = (f: Partial<Filtros>, voce?: string | null) => filtrar(lista, { ...SEM_FILTROS, ...f }, HOJE, voce).map((i) => i.idCenario);

  it('responsável: uma pessoa, ou "__sem" para os sem responsável', () => {
    expect(r({ responsavel: 'ana' })).toEqual(['CT01.1', 'CT01.4']);
    expect(r({ responsavel: '__sem' })).toEqual(['CT01.3']);
  });

  it('prioridade: P1/P2/P3, ou "__sem" para os sem prioridade', () => {
    expect(r({ prioridade: 'P1' })).toEqual(['CT01.1', 'CT01.3']);
    expect(r({ prioridade: '__sem' })).toEqual(['CT01.4']);
  });

  it('"só meus" usa quem é "Você"; sem ninguém em "Você" o filtro não esconde nada', () => {
    expect(r({ somenteMeus: true }, 'ana')).toEqual(['CT01.1', 'CT01.4']);
    expect(r({ somenteMeus: true }, 'bia')).toEqual(['CT01.2']);
    expect(r({ somenteMeus: true }, null)).toEqual(['CT01.1', 'CT01.2', 'CT01.3', 'CT01.4']);
    expect(r({ somenteMeus: true })).toHaveLength(4);
  });

  it('combina com os outros filtros (E)', () => {
    expect(r({ somenteMeus: true, prioridade: 'P1' }, 'ana')).toEqual(['CT01.1']);
    expect(r({ responsavel: 'ana', prioridade: '__sem' })).toEqual(['CT01.4']);
  });

  it('temFiltro enxerga os três novos', () => {
    expect(temFiltro({ ...SEM_FILTROS, responsavel: 'ana' })).toBe(true);
    expect(temFiltro({ ...SEM_FILTROS, prioridade: 'P1' })).toBe(true);
    expect(temFiltro({ ...SEM_FILTROS, somenteMeus: true })).toBe(true);
  });
});

describe('temFiltro', () => {
  it('só é verdadeiro quando algo foi preenchido', () => {
    expect(temFiltro(SEM_FILTROS)).toBe(false);
    expect(temFiltro({ ...SEM_FILTROS, texto: '   ' })).toBe(false);
    expect(temFiltro({ ...SEM_FILTROS, texto: 'a' })).toBe(true);
    expect(temFiltro({ ...SEM_FILTROS, apenasHoje: true })).toBe(true);
    expect(temFiltro({ ...SEM_FILTROS, status: 'concluido' })).toBe(true);
  });
});

describe('hojeISO', () => {
  it('devolve a data local no formato aaaa-mm-dd', () => {
    expect(hojeISO(new Date(2026, 9, 5, 23, 30))).toBe('2026-10-05');
    expect(hojeISO(new Date(2026, 0, 2, 0, 5))).toBe('2026-01-02');
  });
});
