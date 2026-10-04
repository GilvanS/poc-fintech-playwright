import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ErroNegocio } from '../src/erros.ts';
import type { ItemPlano } from '../src/planos/modelo.ts';
import { aplicarPatch, conflitoDeData, pendenciasDeDependencia } from '../src/planos/regras.ts';

function item(idCenario: string, extra: Partial<ItemPlano> = {}): ItemPlano {
  return { idCenario, status: 'agendado', posicao: 1, versao: 1, ...extra };
}

// ---------- aplicarPatch ----------

test('aplicarPatch altera os campos, soma 1 na versão e guarda a hora', () => {
  const novo = aplicarPatch(item('CT03.2'), { status: 'em_andamento', prioridade: 'P1', estimativaMin: 30, posicao: 2.5 }, '2026-10-03T10:00:00.000Z');
  assert.equal(novo.status, 'em_andamento');
  assert.equal(novo.prioridade, 'P1');
  assert.equal(novo.estimativaMin, 30);
  assert.equal(novo.posicao, 2.5);
  assert.equal(novo.versao, 2);
  assert.equal(novo.atualizadoEm, '2026-10-03T10:00:00.000Z');
});

test('aplicarPatch com null remove o campo (a chave some do item)', () => {
  const novo = aplicarPatch(item('CT03.2', { prioridade: 'P2', observacoes: 'x', dataPlanejada: '2026-10-05' }), { prioridade: null, observacoes: null }, 'agora');
  assert.equal('prioridade' in novo, false);
  assert.equal('observacoes' in novo, false);
  assert.equal(novo.dataPlanejada, '2026-10-05');
});

test('aplicarPatch não muda o item original', () => {
  const original = item('CT03.2');
  aplicarPatch(original, { status: 'refinamento' }, 'agora');
  assert.equal(original.status, 'agendado');
  assert.equal(original.versao, 1);
});

test('resultado só vale em item concluído: status + resultado no mesmo pedido funciona', () => {
  const novo = aplicarPatch(item('CT03.2'), { status: 'concluido', resultado: 'passou' }, 'agora');
  assert.equal(novo.resultado, 'passou');
});

test('resultado em item que não está concluído é recusado', () => {
  assert.throws(
    () => aplicarPatch(item('CT03.2'), { resultado: 'passou' }, 'agora'),
    (e: unknown) => e instanceof ErroNegocio && e.codigo === 'resultado_sem_conclusao',
  );
  assert.throws(
    () => aplicarPatch(item('CT03.2', { status: 'concluido' }), { status: 'refinamento', resultado: 'falhou' }, 'agora'),
    (e: unknown) => e instanceof ErroNegocio && e.codigo === 'resultado_sem_conclusao',
  );
});

test('tirar o item de "Concluído" apaga o resultado sozinho (reabrir o teste)', () => {
  const novo = aplicarPatch(item('CT03.2', { status: 'concluido', resultado: 'falhou' }), { status: 'refinamento' }, 'agora');
  assert.equal(novo.status, 'refinamento');
  assert.equal('resultado' in novo, false);
});

// ---------- dependência por massa ----------

test('pendenciasDeDependencia lista as dependências do plano que ainda não passaram', () => {
  const itens = [item('CT03.2'), item('CT03.5', { status: 'concluido', resultado: 'falhou' }), item('CT03.7')];
  assert.deepEqual(pendenciasDeDependencia(['CT03.2', 'CT03.5'], itens), ['CT03.2', 'CT03.5']);
});

test('dependência que passou não pendencia; concluído sem resultado ainda não conta como passou', () => {
  const itens = [item('CT03.2', { status: 'concluido', resultado: 'passou' }), item('CT03.5', { status: 'concluido' })];
  assert.deepEqual(pendenciasDeDependencia(['CT03.2', 'CT03.5'], itens), ['CT03.5']);
});

test('dependência que não está no plano é ignorada (não dá para cobrar o que não foi planejado)', () => {
  assert.deepEqual(pendenciasDeDependencia(['CT03.2'], [item('CT03.7')]), []);
  assert.deepEqual(pendenciasDeDependencia([], [item('CT03.7')]), []);
});

// ---------- datas ----------

const deps = new Map<string, string[]>([['CT03.7', ['CT03.2']]]);

test('conflitoDeData: o dependente não pode ser planejado antes da dependência', () => {
  const itens = [item('CT03.2', { dataPlanejada: '2026-10-05' }), item('CT03.7')];
  const msg = conflitoDeData('CT03.7', '2026-10-04', itens, deps);
  assert.match(msg ?? '', /CT03\.7/);
  assert.match(msg ?? '', /CT03\.2/);
  assert.equal(conflitoDeData('CT03.7', '2026-10-05', itens, deps), null); // mesmo dia vale
  assert.equal(conflitoDeData('CT03.7', '2026-10-09', itens, deps), null);
});

test('conflitoDeData: empurrar a dependência para depois do dependente também é conflito', () => {
  const itens = [item('CT03.2'), item('CT03.7', { dataPlanejada: '2026-10-05' })];
  const msg = conflitoDeData('CT03.2', '2026-10-08', itens, deps);
  assert.match(msg ?? '', /CT03\.7/);
  assert.equal(conflitoDeData('CT03.2', '2026-10-05', itens, deps), null);
});

test('conflitoDeData: sem data de um dos lados, ou limpando a data, não há conflito', () => {
  const itens = [item('CT03.2', { dataPlanejada: '2026-10-05' }), item('CT03.7')];
  assert.equal(conflitoDeData('CT03.7', null, itens, deps), null);
  assert.equal(conflitoDeData('CT03.2', '2026-10-30', [item('CT03.2'), item('CT03.7')], deps), null);
});
