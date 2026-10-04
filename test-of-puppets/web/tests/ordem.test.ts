import { describe, expect, it } from 'vitest';
import { corrigir, mover, ordenarPor, regraDoItem, violacoes, type ItemOrdem } from '../src/pages/planos/ordem';

const it_ = (idCenario: string, extra: Partial<ItemOrdem> = {}): ItemOrdem => ({ idCenario, dependeDe: [], ...extra });
const ids = (lista: ItemOrdem[] | null) => lista?.map((i) => i.idCenario);

// CT03.7 usa a massa do CT03.2: depende dele
const ct31 = it_('CT03.1');
const ct32 = it_('CT03.2');
const ct41 = it_('CT04.1');
const ct37 = it_('CT03.7', { dependeDe: ['CT03.2'] });

describe('violacoes', () => {
  it('lista o dependente que ficou antes da dependência', () => {
    expect(violacoes([ct37, ct32])).toEqual([{ dependente: 'CT03.7', dependencia: 'CT03.2' }]);
    expect(violacoes([ct32, ct37])).toEqual([]);
  });

  it('dependência que não está na lista não conta', () => {
    expect(violacoes([ct37, ct41])).toEqual([]);
  });
});

describe('mover', () => {
  const base = [ct31, ct32, ct41, ct37];

  it('move um item para outra posição', () => {
    expect(ids(mover(base, 2, 0))).toEqual(['CT04.1', 'CT03.1', 'CT03.2', 'CT03.7']);
    expect(ids(mover(base, 0, 2))).toEqual(['CT03.2', 'CT04.1', 'CT03.1', 'CT03.7']);
  });

  it('não altera a lista original', () => {
    mover(base, 2, 0);
    expect(ids(base)).toEqual(['CT03.1', 'CT03.2', 'CT04.1', 'CT03.7']);
  });

  it('bloqueia (null) o dependente subir além da dependência', () => {
    expect(mover(base, 3, 1)).toBeNull(); // CT03.7 antes do CT03.2
    expect(mover(base, 3, 0)).toBeNull();
  });

  it('bloqueia a dependência descer além de quem depende dela', () => {
    expect(mover(base, 1, 3)).toBeNull(); // CT03.2 depois do CT03.7
  });

  it('o dependente pode subir até colar na dependência', () => {
    expect(ids(mover(base, 3, 2))).toEqual(['CT03.1', 'CT03.2', 'CT03.7', 'CT04.1']);
  });

  it('posição igual ou fora dos limites não move', () => {
    expect(mover(base, 1, 1)).toBeNull();
    expect(mover(base, -1, 0)).toBeNull();
    expect(mover(base, 0, 9)).toBeNull();
  });

  it('com a ordem já inválida, não deixa piorar, mas deixa melhorar ou mexer em outros', () => {
    const ruim = [ct37, ct41, ct32]; // 1 violação
    expect(ids(mover(ruim, 1, 0))).toEqual(['CT04.1', 'CT03.7', 'CT03.2']); // continua com 1
    expect(ids(mover(ruim, 2, 0))).toEqual(['CT03.2', 'CT03.7', 'CT04.1']); // corrige
    expect(mover([ct32, ct37, ct41], 0, 2)).toBeNull(); // sairia de 0 para 1
  });
});

describe('corrigir', () => {
  it('põe cada dependência antes de quem depende dela, mantendo o resto na ordem', () => {
    expect(ids(corrigir([ct37, ct41, ct32, ct31]))).toEqual(['CT03.2', 'CT03.7', 'CT04.1', 'CT03.1']);
  });

  it('não mexe numa ordem que já está certa', () => {
    expect(ids(corrigir([ct31, ct32, ct41, ct37]))).toEqual(['CT03.1', 'CT03.2', 'CT04.1', 'CT03.7']);
  });

  it('cadeia de três: CT03.9 depende de CT03.2 e CT03.7', () => {
    const ct39 = it_('CT03.9', { dependeDe: ['CT03.2', 'CT03.7'] });
    expect(ids(corrigir([ct39, ct37, ct32]))).toEqual(['CT03.2', 'CT03.7', 'CT03.9']);
  });
});

describe('ordenarPor', () => {
  it('data planejada: mais cedo primeiro, sem data por último', () => {
    const lista = [it_('CT05.1'), it_('CT05.2', { dataPlanejada: '2026-10-09' }), it_('CT05.3', { dataPlanejada: '2026-10-02' })];
    expect(ids(ordenarPor(lista, 'data'))).toEqual(['CT05.3', 'CT05.2', 'CT05.1']);
  });

  it('prioridade: P1 antes de P2 antes de P3, sem prioridade por último; empate mantém a ordem atual', () => {
    const lista = [it_('CT05.1', { prioridade: 'P3' }), it_('CT05.2'), it_('CT05.3', { prioridade: 'P1' }), it_('CT05.4', { prioridade: 'P1' })];
    expect(ids(ordenarPor(lista, 'prioridade'))).toEqual(['CT05.3', 'CT05.4', 'CT05.1', 'CT05.2']);
  });

  it('depois de ordenar, respeita a regra da massa', () => {
    const lista = [it_('CT03.2', { prioridade: 'P3' }), it_('CT03.7', { dependeDe: ['CT03.2'], prioridade: 'P1' })];
    expect(ids(ordenarPor(lista, 'prioridade'))).toEqual(['CT03.2', 'CT03.7']);
  });
});

describe('regraDoItem', () => {
  it('diz depois de quem o item fica e quem ele libera, só entre os testes da lista', () => {
    const lista = [ct31, ct32, ct41, ct37];
    expect(regraDoItem(lista, 'CT03.2')).toEqual({ depoisDe: [], libera: ['CT03.7'] });
    expect(regraDoItem(lista, 'CT03.7')).toEqual({ depoisDe: ['CT03.2'], libera: [] });
    expect(regraDoItem(lista, 'CT04.1')).toEqual({ depoisDe: [], libera: [] });
    expect(regraDoItem([ct37, ct41], 'CT03.7')).toEqual({ depoisDe: [], libera: [] });
  });
});
