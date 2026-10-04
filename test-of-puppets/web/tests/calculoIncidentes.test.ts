import { describe, expect, it } from 'vitest';
import type { Incidente } from '../src/incidentes/clienteIncidentes';
import {
  dataHora,
  diasAberto,
  filtrarIncidentes,
  haQuanto,
  ordenarIncidentes,
  resumirIncidentes,
  SEM_FILTRO_INC,
  textoDoHistorico,
  textoDoResumo,
} from '../src/pages/incidentes/calculoIncidentes';

const HOJE = '2026-10-02';

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
    abertoEm: '2026-10-01T14:10:00.000Z',
    resolvidoEm: null,
    atualizadoEm: '2026-10-01T14:10:00.000Z',
    versao: 1,
    ...extra,
  };
}

const alta = () => inc('INC0715802225', { titulo: 'Saldo de Faturamento difere do extrato', severidade: 'alta', status: 'em_analise', responsavel: 'ana', abertoEm: '2026-09-29T15:40:00.000Z', testesAfetados: ['CT03.1', 'CT03.2'] });
const media = () => inc('INC0715799001', { titulo: 'Cadastro duplicado aceita CPF repetido', responsavel: 'bia', testesAfetados: ['CT05.2'] });
const baixa = () => inc('INC0715790010', { titulo: 'Botão sem foco no cadastro PF', severidade: 'baixa', status: 'resolvido', responsavel: 'bia', abertoEm: '2026-09-28T10:00:00.000Z', resolvidoEm: '2026-09-30T16:30:00.000Z', testesAfetados: ['CT05.1'] });
const todos = () => [baixa(), media(), alta()];
const nome = (id?: string) => (id === 'ana' ? 'Ana' : id === 'bia' ? 'Bia' : (id ?? '-'));

describe('calculoIncidentes — ordem e filtros', () => {
  it('Alta primeiro; na mesma gravidade, o mais recente', () => {
    const outraMedia = inc('INC2', { abertoEm: '2026-10-02T08:00:00.000Z' });
    expect(ordenarIncidentes([baixa(), media(), outraMedia, alta()]).map((i) => i.numero)).toEqual(['INC0715802225', 'INC2', 'INC0715799001', 'INC0715790010']);
  });

  it('sem filtro mostra tudo; "mostrar resolvidos" desligado esconde os resolvidos', () => {
    expect(filtrarIncidentes(todos(), SEM_FILTRO_INC, null)).toHaveLength(3);
    expect(filtrarIncidentes(todos(), { ...SEM_FILTRO_INC, mostrarResolvidos: false }, null).map((i) => i.numero)).toEqual(['INC0715799001', 'INC0715802225']);
  });

  it('filtra por severidade, responsável e "só meus"', () => {
    expect(filtrarIncidentes(todos(), { ...SEM_FILTRO_INC, severidade: 'alta' }, null).map((i) => i.numero)).toEqual(['INC0715802225']);
    expect(filtrarIncidentes(todos(), { ...SEM_FILTRO_INC, responsavel: 'bia' }, null)).toHaveLength(2);
    expect(filtrarIncidentes(todos(), { ...SEM_FILTRO_INC, somenteMeus: true }, 'ana').map((i) => i.numero)).toEqual(['INC0715802225']);
    expect(filtrarIncidentes(todos(), { ...SEM_FILTRO_INC, somenteMeus: true }, null)).toHaveLength(3);
  });

  it('busca no número, no título e nos testes afetados, sem diferenciar maiúsculas', () => {
    expect(filtrarIncidentes(todos(), { ...SEM_FILTRO_INC, texto: '799001' }, null).map((i) => i.numero)).toEqual(['INC0715799001']);
    expect(filtrarIncidentes(todos(), { ...SEM_FILTRO_INC, texto: 'cpf repetido' }, null)).toHaveLength(1);
    expect(filtrarIncidentes(todos(), { ...SEM_FILTRO_INC, texto: 'ct03.2' }, null).map((i) => i.numero)).toEqual(['INC0715802225']);
    expect(filtrarIncidentes(todos(), { ...SEM_FILTRO_INC, texto: 'nada disso' }, null)).toEqual([]);
  });
});

describe('calculoIncidentes — tempo e resumo', () => {
  it('dias em aberto e o texto "há N dias"', () => {
    expect(diasAberto(alta(), HOJE)).toBe(3);
    expect(diasAberto(media(), HOJE)).toBe(1);
    expect(haQuanto(alta(), HOJE)).toBe('há 3 dias');
    expect(haQuanto(media(), HOJE)).toBe('há 1 dia');
    expect(haQuanto(inc('X', { abertoEm: '2026-10-02T09:00:00.000Z' }), HOJE)).toBe('hoje');
    expect(haQuanto(baixa(), HOJE)).toBe('resolvido 30/09');
  });

  it('resumo igual ao do desenho: abertos 2, Alta 1, Média 1, 2 dias, 3 testes travados', () => {
    const r = resumirIncidentes(todos());
    expect(r).toEqual({ abertos: 2, porSeveridade: { alta: 1, media: 1, baixa: 0 }, tempoMedioDias: 2, testesTravados: 3 });
    expect(textoDoResumo(r)).toBe('Resumo: abertos 2 · Alta 1 · Média 1 · tempo médio de resolução 2 dias · testes travados 3');
  });

  it('testes travados não contam duas vezes o mesmo teste, nem o de INC resolvido', () => {
    const r = resumirIncidentes([alta(), inc('INC9', { testesAfetados: ['CT03.2', 'CT09.9'] }), baixa()]);
    expect(r.testesTravados).toBe(3);
  });

  it('sem nenhum resolvido não inventa tempo médio; sem INC o resumo é zero', () => {
    expect(textoDoResumo(resumirIncidentes([alta()]))).toBe('Resumo: abertos 1 · Alta 1 · tempo médio de resolução sem INC resolvido · testes travados 2');
    expect(textoDoResumo(resumirIncidentes([]))).toBe('Resumo: abertos 0 · tempo médio de resolução sem INC resolvido · testes travados 0');
  });
});

describe('calculoIncidentes — histórico', () => {
  const h = (tipo: Parameters<typeof textoDoHistorico>[0]['tipo'], de?: string | null, para?: string | null) => ({ em: '2026-10-02T12:14:00.000Z', autor: 'ana', tipo, de, para });

  it('escreve cada tipo de mudança com os rótulos e os nomes', () => {
    expect(textoDoHistorico(h('registro'), nome)).toBe('registrou o INC');
    expect(textoDoHistorico(h('status', 'novo', 'em_analise'), nome)).toBe('mudou status: Novo → Em análise');
    expect(textoDoHistorico(h('severidade', 'media', 'alta'), nome)).toBe('mudou severidade: Média → Alta');
    expect(textoDoHistorico(h('responsavel', null, 'bia'), nome)).toBe('atribuiu a Bia');
    expect(textoDoHistorico(h('responsavel', 'bia', null), nome)).toBe('tirou o responsável');
    expect(textoDoHistorico(h('vinculo', null, 'CT03.2'), nome)).toBe('vinculou CT03.2');
    expect(textoDoHistorico(h('desvinculo', 'CT03.1', null), nome)).toBe('desvinculou CT03.1');
    expect(textoDoHistorico(h('titulo', 'a', 'b'), nome)).toBe('mudou o título');
    expect(textoDoHistorico(h('descricao'), nome)).toBe('editou a descrição');
  });

  it('data e hora no formato da tela; data inválida vira "-"', () => {
    expect(dataHora('2026-10-02T12:14:00.000Z')).toMatch(/^\d{2}\/\d{2} \d{2}:\d{2}$/);
    expect(dataHora('lixo')).toBe('-');
  });
});
