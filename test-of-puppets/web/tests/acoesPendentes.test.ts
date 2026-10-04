import { describe, expect, it } from 'vitest';
import type { Acao, Retro } from '../src/retros/clienteRetros';
import { acoesPendentesDeAnteriores } from '../src/pages/retro/acoesPendentes';

const planos = [
  { id: 'p1', nome: '14/09/26' },
  { id: 'p2', nome: '28/09/26' },
  { id: 'p3', nome: '05/10/26' },
];

const acao = (id: string, extra: Partial<Acao> = {}): Acao => ({
  id,
  texto: `Ação ${id}`,
  responsavel: 'ana',
  prazo: null,
  feito: false,
  feitoEm: null,
  feitoPor: null,
  origem: null,
  incId: null,
  criadaEm: '2026-09-26T10:00:00.000Z',
  criadaPor: null,
  ...extra,
});

const retro = (planoId: string, acoes: Acao[]): Retro => ({
  planoId,
  status: 'aberta',
  anonimas: false,
  fechadaEm: null,
  fechadaPor: null,
  notas: [],
  acoes,
  atualizadoEm: null,
});

describe('acoesPendentesDeAnteriores', () => {
  it('o primeiro plano e um plano desconhecido não têm "anteriores"', () => {
    const retros = [retro('p1', [acao('a1')])];
    expect(acoesPendentesDeAnteriores('p1', planos, retros)).toEqual([]);
    expect(acoesPendentesDeAnteriores('nao-existe', planos, retros)).toEqual([]);
  });

  it('traz só as pendentes das retros de planos criados antes, com o nome do plano de origem', () => {
    const retros = [
      retro('p1', [acao('feita', { feito: true }), acao('pendente1', { prazo: '2026-10-20' })]),
      retro('p3', [acao('de-um-plano-posterior')]),
    ];
    const r = acoesPendentesDeAnteriores('p2', planos, retros);
    expect(r.map((x) => [x.planoId, x.planoNome, x.acao.id])).toEqual([['p1', '14/09/26', 'pendente1']]);
  });

  it('ordena pelo prazo mais cedo; sem prazo vai para o fim, na ordem dos planos', () => {
    const retros = [
      retro('p1', [acao('sem-prazo-1'), acao('tarde', { prazo: '2026-11-01' })]),
      retro('p2', [acao('cedo', { prazo: '2026-10-05' }), acao('sem-prazo-2')]),
    ];
    expect(acoesPendentesDeAnteriores('p3', planos, retros).map((x) => x.acao.id)).toEqual(['cedo', 'tarde', 'sem-prazo-1', 'sem-prazo-2']);
  });

  it('plano anterior sem retro, ou com tudo feito, não conta', () => {
    const retros = [retro('p1', [acao('feita', { feito: true })])];
    expect(acoesPendentesDeAnteriores('p3', planos, retros)).toEqual([]);
    expect(acoesPendentesDeAnteriores('p3', planos, [])).toEqual([]);
  });
});
