import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chaveOrdem, derivarMassa, validarEntrada, type Cenario } from '../src/cenarios/modelo.ts';

const base = { idCenario: 'CT03.2', nome: 'Pagar o valor mínimo da fatura', funcionalidade: 'Faturas' };

function valido(entrada: unknown) {
  const r = validarEntrada(entrada);
  assert.equal(r.ok, true, JSON.stringify(r));
  return r.ok ? r.valor : (undefined as never);
}

function mensagens(entrada: unknown): string[] {
  const r = validarEntrada(entrada);
  assert.equal(r.ok, false);
  return r.ok ? [] : r.mensagens;
}

test('aceita o mínimo (id, nome e funcionalidade) e apara espaços', () => {
  const v = valido({ idCenario: ' CT03.2 ', nome: '  Pagar o valor mínimo  ', funcionalidade: ' Faturas ' });
  assert.deepEqual(v, { idCenario: 'CT03.2', nome: 'Pagar o valor mínimo', funcionalidade: 'Faturas' });
});

test('campos opcionais vazios somem do resultado', () => {
  const v = valido({ ...base, idMassa: '  ', cpf: '', passos: '', resultadoEsperado: ' ' });
  assert.deepEqual(Object.keys(v).sort(), ['funcionalidade', 'idCenario', 'nome']);
});

test('guarda massa, passos e resultado esperado', () => {
  const v = valido({ ...base, idMassa: '0483', passos: 'faturas.feature#CT03.2', resultadoEsperado: 'Pagamento aceito' });
  assert.equal(v.idMassa, '0483');
  assert.equal(v.passos, 'faturas.feature#CT03.2');
  assert.equal(v.resultadoEsperado, 'Pagamento aceito');
});

test('CPF: aceita com máscara e guarda só os 11 dígitos', () => {
  assert.equal(valido({ ...base, cpf: '123.456.789-09' }).cpf, '12345678909');
  assert.equal(valido({ ...base, cpf: '12345678909' }).cpf, '12345678909');
});

test('CPF com quantidade errada de dígitos é recusado com mensagem em português', () => {
  assert.deepEqual(mensagens({ ...base, cpf: '123' }), ['CPF deve ter 11 dígitos.']);
});

test('ID do cenário precisa seguir o formato CTnn.n', () => {
  for (const ruim of ['', 'CT3.2', 'ct03.2', 'CT03', 'CT03.', 'CT03.x', 'XX03.2']) {
    assert.deepEqual(mensagens({ ...base, idCenario: ruim }), ['ID do cenário deve seguir o formato CTnn.n (ex.: CT03.2).'], ruim);
  }
  for (const bom of ['CT01.1', 'CT03.10', 'CT12.3']) valido({ ...base, idCenario: bom });
});

test('nome e funcionalidade são obrigatórios; junta todas as mensagens de uma vez', () => {
  assert.deepEqual(mensagens({ idCenario: 'CT03.2', nome: ' ', funcionalidade: '' }), [
    'Nome é obrigatório.',
    'Funcionalidade é obrigatória.',
  ]);
});

test('limita o tamanho dos textos', () => {
  assert.deepEqual(mensagens({ ...base, nome: 'x'.repeat(121) }), ['Nome deve ter no máximo 120 caracteres.']);
  assert.deepEqual(mensagens({ ...base, passos: 'x'.repeat(301) }), ['Passos deve ter no máximo 300 caracteres.']);
});

test('ID da massa só aceita letras, números, hífen e sublinhado (até 20)', () => {
  assert.deepEqual(mensagens({ ...base, idMassa: '04 83' }), ['ID da massa deve ter só letras, números, "-" ou "_" (até 20).']);
  valido({ ...base, idMassa: 'MASSA_01-b' });
});

test('entrada que não é objeto é recusada', () => {
  for (const ruim of [null, undefined, 'texto', 42, []]) {
    assert.deepEqual(mensagens(ruim), ['Corpo da requisição deve ser um objeto JSON.']);
  }
});

test('campos fora da lista (senha, PIN, versao, qualquer outro) são descartados, nunca guardados', () => {
  const v = valido({ ...base, senha: 'segredo', pin: '1234', versao: 99, extra: 'x' });
  assert.deepEqual(Object.keys(v).sort(), ['funcionalidade', 'idCenario', 'nome']);
});

test('campo com tipo errado vira mensagem, não exceção', () => {
  assert.deepEqual(mensagens({ ...base, nome: 123 }), ['Nome é obrigatório.']);
  assert.deepEqual(mensagens({ ...base, idMassa: 483 }), ['ID da massa deve ser texto.']);
});

test('chaveOrdem compara por número, não por texto (CT03.10 vem depois de CT03.2)', () => {
  const ids = ['CT03.10', 'CT03.2', 'CT01.5', 'CT12.1', 'CT03.7'];
  ids.sort((a, b) => {
    const [a1, a2] = chaveOrdem(a);
    const [b1, b2] = chaveOrdem(b);
    return a1 - b1 || a2 - b2;
  });
  assert.deepEqual(ids, ['CT01.5', 'CT03.2', 'CT03.7', 'CT03.10', 'CT12.1']);
});

function cenario(idCenario: string, idMassa?: string): Cenario {
  return {
    idCenario,
    nome: `Cenário ${idCenario}`,
    funcionalidade: 'Faturas',
    ...(idMassa ? { idMassa } : {}),
    versao: 1,
    criadoEm: '2026-10-03T10:00:00.000Z',
    atualizadoEm: '2026-10-03T10:00:00.000Z',
  };
}

test('massa repetida detecta sozinha: o de numeração maior depende do menor', () => {
  const [ct32, ct37] = derivarMassa([cenario('CT03.7', '0483'), cenario('CT03.2', '0483')]);
  assert.equal(ct32.idCenario, 'CT03.2');
  assert.deepEqual(ct32.dependeDe, []);
  assert.deepEqual(ct32.massaCompartilhadaCom, ['CT03.7']);
  assert.equal(ct37.idCenario, 'CT03.7');
  assert.deepEqual(ct37.dependeDe, ['CT03.2']);
  assert.deepEqual(ct37.massaCompartilhadaCom, ['CT03.2']);
});

test('grupo de três: cada um depende de todos os anteriores', () => {
  const r = derivarMassa([cenario('CT03.9', 'M1'), cenario('CT03.2', 'M1'), cenario('CT03.7', 'M1')]);
  assert.deepEqual(
    r.map((c) => [c.idCenario, c.dependeDe]),
    [
      ['CT03.2', []],
      ['CT03.7', ['CT03.2']],
      ['CT03.9', ['CT03.2', 'CT03.7']],
    ],
  );
});

test('sem massa ou com massa única: sem dependência e sem marca de compartilhada', () => {
  const r = derivarMassa([cenario('CT01.1'), cenario('CT01.2', '0001'), cenario('CT01.3', '0002')]);
  for (const c of r) {
    assert.deepEqual(c.dependeDe, []);
    assert.deepEqual(c.massaCompartilhadaCom, []);
  }
});

test('o resultado vem ordenado pela numeração do ID', () => {
  const r = derivarMassa([cenario('CT03.10'), cenario('CT03.2'), cenario('CT01.1')]);
  assert.deepEqual(r.map((c) => c.idCenario), ['CT01.1', 'CT03.2', 'CT03.10']);
});
