import { describe, expect, it } from 'vitest';
import {
  barraDoTeste,
  cargaPorColuna,
  deslocar,
  diaDaSemana,
  diasEntre,
  ehFimDeSemana,
  faixaNaJanela,
  indiceDaData,
  inicioPara,
  montarJanela,
  rotuloDoPeriodo,
  segundaDa,
  semanaISO,
  somarDias,
} from '../src/pages/roadmap/linhaDoTempo';

// 28/09/2026 é segunda-feira; 03/10/2026 é sábado.
describe('roadmap — datas', () => {
  it('soma dias atravessando mês e ano, sem depender de fuso', () => {
    expect(somarDias('2026-09-30', 2)).toBe('2026-10-02');
    expect(somarDias('2026-12-31', 1)).toBe('2027-01-01');
    expect(somarDias('2026-03-01', -1)).toBe('2026-02-28');
    expect(diasEntre('2026-09-28', '2026-10-06')).toBe(8);
    expect(diasEntre('2026-10-06', '2026-09-28')).toBe(-8);
  });

  it('dia da semana, fim de semana e segunda-feira da semana', () => {
    expect(diaDaSemana('2026-09-28')).toBe(1);
    expect(diaDaSemana('2026-10-04')).toBe(0);
    expect(ehFimDeSemana('2026-10-03')).toBe(true);
    expect(ehFimDeSemana('2026-10-04')).toBe(true);
    expect(ehFimDeSemana('2026-10-05')).toBe(false);
    expect(segundaDa('2026-10-03')).toBe('2026-09-28');
    expect(segundaDa('2026-10-04')).toBe('2026-09-28');
    expect(segundaDa('2026-09-28')).toBe('2026-09-28');
  });

  it('número da semana ISO, inclusive na virada do ano', () => {
    expect(semanaISO('2026-09-28')).toBe(40);
    expect(semanaISO('2026-10-05')).toBe(41);
    expect(semanaISO('2026-01-01')).toBe(1);
    expect(semanaISO('2027-01-01')).toBe(53);
  });
});

describe('roadmap — janela', () => {
  it('o início deixa "hoje" perto da esquerda: segunda-feira, 1 semana (mensal) ou 2 (trimestral) antes', () => {
    expect(inicioPara('mensal', '2026-10-03')).toBe('2026-09-21');
    expect(inicioPara('trimestral', '2026-10-03')).toBe('2026-09-14');
  });

  it('mensal tem 28 dias, marca fim de semana e agrupa por mês', () => {
    const j = montarJanela('mensal', '2026-09-21');
    expect(j.unidades).toHaveLength(28);
    expect(j.fim).toBe('2026-10-18');
    expect(j.unidades[0]).toMatchObject({ inicio: '2026-09-21', rotulo: '21', sub: 'S', fimDeSemana: false });
    expect(j.unidades[5]).toMatchObject({ inicio: '2026-09-26', fimDeSemana: true });
    expect(j.unidades[6]).toMatchObject({ inicio: '2026-09-27', fimDeSemana: true });
    expect(j.meses).toEqual([
      { rotulo: 'set/26', colunas: 10 },
      { rotulo: 'out/26', colunas: 18 },
    ]);
    expect(rotuloDoPeriodo(j)).toBe('set–out/2026');
  });

  it('trimestral tem 13 semanas rotuladas pelo número ISO', () => {
    const j = montarJanela('trimestral', '2026-09-14');
    expect(j.unidades).toHaveLength(13);
    expect(j.unidades[0]).toMatchObject({ inicio: '2026-09-14', fim: '2026-09-20', rotulo: 'S38' });
    expect(j.unidades[2].rotulo).toBe('S40');
    expect(j.fim).toBe('2026-12-13');
    expect(j.unidades.every((u) => !u.fimDeSemana)).toBe(true);
  });

  it('período dentro de um mês só mostra o mês uma vez', () => {
    expect(rotuloDoPeriodo({ ...montarJanela('mensal', '2026-10-05'), inicio: '2026-10-05', fim: '2026-10-25' })).toBe('out/2026');
  });

  it('deslocar anda 1 semana no mensal e 4 no trimestral, nos dois sentidos', () => {
    expect(deslocar('mensal', '2026-09-21', 1)).toBe('2026-09-28');
    expect(deslocar('mensal', '2026-09-21', -1)).toBe('2026-09-14');
    expect(deslocar('trimestral', '2026-09-14', 1)).toBe('2026-10-12');
  });

  it('acha a coluna de uma data; fora da janela dá -1', () => {
    const m = montarJanela('mensal', '2026-09-21');
    expect(indiceDaData(m, '2026-09-21')).toBe(0);
    expect(indiceDaData(m, '2026-10-06')).toBe(15);
    expect(indiceDaData(m, '2026-10-19')).toBe(-1);
    const t = montarJanela('trimestral', '2026-09-14');
    expect(indiceDaData(t, '2026-09-28')).toBe(2);
    expect(indiceDaData(t, '2026-10-04')).toBe(2);
  });

  it('faixa da barra: recorta nas bordas, avisa do corte e some quando fica toda fora', () => {
    const m = montarJanela('mensal', '2026-09-21');
    expect(faixaNaJanela(m, '2026-09-23', '2026-09-25')).toEqual({ de: 2, ate: 4, cortadaNaEsquerda: false, cortadaNaDireita: false });
    expect(faixaNaJanela(m, '2026-09-18', '2026-09-23')).toEqual({ de: 0, ate: 2, cortadaNaEsquerda: true, cortadaNaDireita: false });
    expect(faixaNaJanela(m, '2026-10-16', '2026-11-30')).toEqual({ de: 25, ate: 27, cortadaNaEsquerda: false, cortadaNaDireita: true });
    expect(faixaNaJanela(m, '2026-09-01', '2026-09-20')).toBeNull();
    expect(faixaNaJanela(m, '2026-10-19', '2026-10-30')).toBeNull();
  });
});

describe('roadmap — barra do teste', () => {
  const hoje = '2026-10-03';

  it('planejado no futuro ou hoje', () => {
    expect(barraDoTeste({ status: 'agendado', dataPlanejada: '2026-10-06' }, hoje)).toEqual({ estado: 'planejado', data: '2026-10-06' });
    expect(barraDoTeste({ status: 'em_andamento', dataPlanejada: hoje }, hoje).estado).toBe('planejado');
  });

  it('atrasado = data passada e não concluído', () => {
    expect(barraDoTeste({ status: 'refinamento', dataPlanejada: '2026-10-01' }, hoje)).toEqual({ estado: 'atrasado', data: '2026-10-01' });
  });

  it('concluído mostra o dia da execução e o resultado', () => {
    expect(barraDoTeste({ status: 'concluido', resultado: 'passou', dataPlanejada: '2026-09-28', dataExecucao: '2026-09-29' }, hoje)).toEqual({ estado: 'ok', data: '2026-09-29' });
    expect(barraDoTeste({ status: 'concluido', resultado: 'falhou', dataPlanejada: '2026-09-30' }, hoje)).toEqual({ estado: 'falhou', data: '2026-09-30' });
    expect(barraDoTeste({ status: 'concluido', dataExecucao: '2026-09-30' }, hoje)).toEqual({ estado: 'concluido', data: '2026-09-30' });
  });

  it('concluído nunca fica atrasado, mesmo com data planejada passada', () => {
    expect(barraDoTeste({ status: 'concluido', resultado: 'passou', dataPlanejada: '2026-09-01' }, hoje).estado).toBe('ok');
  });

  it('sem nenhuma data não tem barra', () => {
    expect(barraDoTeste({ status: 'agendado' }, hoje)).toEqual({ estado: 'sem_data' });
    expect(barraDoTeste({ status: 'concluido', resultado: 'passou' }, hoje)).toEqual({ estado: 'sem_data' });
  });
});

describe('roadmap — carga prevista', () => {
  it('soma os minutos por semana; ignora sem estimativa, sem data e fora da janela', () => {
    const t = montarJanela('trimestral', '2026-09-14');
    const carga = cargaPorColuna(t, [
      { dataPlanejada: '2026-09-28', estimativaMin: 30 },
      { dataPlanejada: '2026-10-02', estimativaMin: 20 },
      { dataPlanejada: '2026-10-06', estimativaMin: 45 },
      { dataPlanejada: '2026-10-07' },
      { estimativaMin: 99 },
      { dataPlanejada: '2027-05-01', estimativaMin: 99 },
    ]);
    expect(carga).toHaveLength(13);
    expect(carga[2]).toBe(50);
    expect(carga[3]).toBe(45);
    expect(carga.reduce((a, b) => a + b, 0)).toBe(95);
  });
});
