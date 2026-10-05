import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aplicarCronometro } from '../src/planos/regras.ts';
import { validarCronometro, type ItemPlano } from '../src/planos/modelo.ts';
import { cadastrarCenarios, iniciar, item, planoCom, type Json } from './planos.apoio.ts';

// Cronômetro: a ferramenta não executa nada. ▶ marca o início, ⏸ pausa, ■ registra o resultado e o tempo.

const T0 = new Date(2026, 9, 5, 10, 0, 0);
const em = (segundos: number) => new Date(T0.getTime() + segundos * 1000);
const parado = (): ItemPlano => ({ idCenario: 'CT03.1', status: 'agendado', posicao: 1, versao: 1 });

// ---------- a regra (relógio fixo) ----------

test('iniciar: Em andamento com a hora de início; refazer um teste concluído reabre o resultado', () => {
  const novo = aplicarCronometro(parado(), { acao: 'iniciar' }, T0);
  assert.deepEqual([novo.status, novo.iniciadoEm, novo.acumuladoMs, novo.versao], ['em_andamento', T0.toISOString(), 0, 2]);

  const concluido: ItemPlano = { ...parado(), status: 'concluido', resultado: 'falhou', dataExecucao: '2026-10-01', tempoRealMin: 7 };
  const refeito = aplicarCronometro(concluido, { acao: 'iniciar' }, T0);
  assert.equal(refeito.status, 'em_andamento');
  assert.equal(refeito.resultado, undefined);
  assert.throws(() => aplicarCronometro(novo, { acao: 'iniciar' }, em(5)), { codigo: 'cronometro_invalido', message: /já está em andamento/ });
});

test('pausar e retomar: o tempo parado não conta; finalizar soma só os trechos rodando', () => {
  let i = aplicarCronometro(parado(), { acao: 'iniciar' }, T0);
  i = aplicarCronometro(i, { acao: 'pausar' }, em(90)); // rodou 90 s
  assert.deepEqual([i.iniciadoEm, i.acumuladoMs, i.status], [undefined, 90_000, 'em_andamento']);
  assert.throws(() => aplicarCronometro(i, { acao: 'pausar' }, em(100)), { codigo: 'cronometro_invalido' });
  assert.throws(() => aplicarCronometro(i, { acao: 'iniciar' }, em(100)), { message: /pausado: use Retomar/ });

  i = aplicarCronometro(i, { acao: 'retomar' }, em(200)); // ficou 110 s pausado
  assert.equal(i.iniciadoEm, em(200).toISOString());
  assert.throws(() => aplicarCronometro(i, { acao: 'retomar' }, em(210)), { codigo: 'cronometro_invalido' });

  const fim = aplicarCronometro(i, { acao: 'finalizar', resultado: 'passou', observacoes: 'ok no navegador' }, em(230)); // +30 s
  assert.deepEqual(
    [fim.status, fim.resultado, fim.tempoRealMin, fim.dataExecucao, fim.observacoes, fim.iniciadoEm, fim.acumuladoMs],
    ['concluido', 'passou', 2, '2026-10-05', 'ok no navegador', undefined, undefined], // 90 s + 30 s = 2 min, a pausa fora
  );
});

test('finalizar pausado usa só o acumulado; tempo informado na hora vale mais que o medido; mínimo de 1 minuto', () => {
  const rodando = aplicarCronometro(parado(), { acao: 'iniciar' }, T0);
  const pausado = aplicarCronometro(rodando, { acao: 'pausar' }, em(10 * 60));
  assert.equal(aplicarCronometro(pausado, { acao: 'finalizar', resultado: 'falhou' }, em(3 * 3600)).tempoRealMin, 10);
  assert.equal(aplicarCronometro(rodando, { acao: 'finalizar', resultado: 'passou', tempoRealMin: 25 }, em(60)).tempoRealMin, 25);
  assert.equal(aplicarCronometro(rodando, { acao: 'finalizar', resultado: 'passou' }, em(5)).tempoRealMin, 1);
});

test('finalizar sem ter iniciado é recusado; em andamento antigo (sem relógio) mantém o tempo que já tinha', () => {
  assert.throws(() => aplicarCronometro(parado(), { acao: 'finalizar', resultado: 'passou' }, T0), { codigo: 'cronometro_invalido', message: /inicie o teste/ });
  const antigo: ItemPlano = { ...parado(), status: 'em_andamento', tempoRealMin: 12 }; // dado de antes do cronômetro
  assert.equal(aplicarCronometro(antigo, { acao: 'finalizar', resultado: 'passou' }, em(30)).tempoRealMin, 12);
  assert.equal(aplicarCronometro(antigo, { acao: 'finalizar', resultado: 'passou', tempoRealMin: 3 }, em(30)).tempoRealMin, 3);
});

test('validação do pedido: ação e resultado obrigatórios, tempo inteiro, observação limitada', () => {
  const mensagens = (corpo: unknown) => {
    const r = validarCronometro(corpo);
    return r.ok ? [] : r.mensagens;
  };
  assert.equal(validarCronometro({ versao: 1, acao: 'iniciar' }).ok, true);
  assert.match(mensagens({ versao: 1, acao: 'voar' })[0], /Ação deve ser/);
  assert.match(mensagens({ versao: 1, acao: 'finalizar' })[0], /resultado/);
  assert.match(mensagens({ versao: 1, acao: 'finalizar', resultado: 'passou', tempoRealMin: 1.5 })[0], /inteiro/);
  assert.match(mensagens({ versao: 1, acao: 'finalizar', resultado: 'passou', observacoes: 'x'.repeat(1001) })[0], /1000/);
  assert.ok(mensagens({ acao: 'iniciar' }).length > 0); // sem versão
  assert.equal(validarCronometro({ versao: 1, acao: 'pausar', resultado: 'lixo' }).ok, true); // extras de outras ações são ignorados
});

// ---------- a API ----------

async function montar() {
  const s = await iniciar();
  await cadastrarCenarios(s);
  const plano = await planoCom(s, ['CT03.1', 'CT03.2', 'CT03.7', 'CT04.1']);
  const url = (id: string) => `/api/planos/${plano.plano.id}/testes/${id}`;
  const cron = (id: string, versao: number, corpo: Json) => s.json('POST', `${url(id)}/cronometro`, { versao, ...corpo });
  const atual = async (id: string) => item((await s.json('GET', `/api/planos/${plano.plano.id}`)).corpo, id);
  return { s, plano, url, cron, atual };
}

test('API: ▶ inicia, ⏸ pausa, ▶ retoma e ■ conclui com resultado, data, tempo e observação — tudo gravado', async () => {
  const { s, cron, atual } = await montar();
  try {
    const iniciado = await cron('CT04.1', 1, { acao: 'iniciar' });
    assert.equal(iniciado.status, 200);
    assert.equal(iniciado.corpo.status, 'em_andamento');
    assert.match(iniciado.corpo.iniciadoEm, /^\d{4}-\d{2}-\d{2}T/);
    assert.equal((await cron('CT04.1', iniciado.corpo.versao, { acao: 'iniciar' })).status, 409);

    const pausado = await cron('CT04.1', iniciado.corpo.versao, { acao: 'pausar' });
    assert.equal(pausado.corpo.iniciadoEm, undefined);
    assert.equal(typeof pausado.corpo.acumuladoMs, 'number');
    const retomado = await cron('CT04.1', pausado.corpo.versao, { acao: 'retomar' });
    assert.ok(retomado.corpo.iniciadoEm);

    const sem = await cron('CT04.1', retomado.corpo.versao, { acao: 'finalizar' });
    assert.equal(sem.status, 400); // falta o resultado
    const fim = await cron('CT04.1', retomado.corpo.versao, { acao: 'finalizar', resultado: 'falhou', observacoes: 'erro no Pix', tempoRealMin: 14 });
    assert.equal(fim.status, 200);
    const gravado = await atual('CT04.1');
    assert.deepEqual([gravado.status, gravado.resultado, gravado.tempoRealMin, gravado.observacoes], ['concluido', 'falhou', 14, 'erro no Pix']);
    assert.match(gravado.dataExecucao, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(gravado.iniciadoEm, undefined);
  } finally {
    await s.fechar();
  }
});

test('API: respeita a dependência da massa, a versão e testes que não existem', async () => {
  const { s, cron, atual } = await montar();
  try {
    const ct37 = await atual('CT03.7'); // usa a massa do CT03.2, que ainda não passou
    const bloqueado = await cron('CT03.7', ct37.versao, { acao: 'iniciar' });
    assert.equal(bloqueado.status, 409);
    assert.equal(bloqueado.corpo.erro, 'dependencia_pendente');

    assert.equal((await cron('CT04.1', 99, { acao: 'iniciar' })).corpo.erro, 'versao_antiga');
    assert.equal((await cron('CT09.9', 1, { acao: 'iniciar' })).status, 404);
    assert.equal((await cron('CT04.1', 1, { acao: 'voar' })).status, 400);
  } finally {
    await s.fechar();
  }
});

test('API: mudar o status na mão também conta o tempo (arrastar no Kanban) e sair de Em andamento zera o relógio', async () => {
  const { s, url, atual } = await montar();
  try {
    const antes = await atual('CT04.1');
    const andando = await s.json('PATCH', url('CT04.1'), { versao: antes.versao, status: 'em_andamento' });
    assert.equal(andando.status, 200);
    assert.ok(andando.corpo.iniciadoEm);
    assert.equal(andando.corpo.acumuladoMs, 0);

    const voltou = await s.json('PATCH', url('CT04.1'), { versao: andando.corpo.versao, status: 'refinamento' });
    assert.equal(voltou.corpo.iniciadoEm, undefined);
    assert.equal(voltou.corpo.acumuladoMs, undefined);
  } finally {
    await s.fechar();
  }
});
