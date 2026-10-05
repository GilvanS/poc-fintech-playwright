import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdir, mkdtemp, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ChildProcess } from 'node:child_process';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app.ts';
import { criarRepos } from '../src/repos.ts';
import { comandosDe } from '../src/runner/comando.ts';
import { criarExecutor, type Run, type Spawn } from '../src/runner/executor.ts';
import { lerResultado, type ResultadoDoRun } from '../src/runner/resultado.ts';

// Nada aqui roda comando de verdade: o processo é falso e a pasta é temporária.

const esperar = async (cond: () => boolean, ms = 3_000) => {
  const limite = Date.now() + ms;
  while (!cond()) {
    if (Date.now() > limite) throw new Error('timeout esperando a condição');
    await new Promise((r) => setTimeout(r, 5));
  }
};

type Filho = EventEmitter & { stdout: EventEmitter; stderr: EventEmitter; comando: string };

async function montar(extra: { resultado?: ResultadoDoRun | null } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'puppets-runner-'));
  const repos = criarRepos(dir);
  for (const c of [
    { idCenario: 'CT03.1', nome: 'Pagar total', idMassa: '0100' },
    { idCenario: 'CT03.2', nome: 'Pagar mínimo', idMassa: '0483' },
    { idCenario: 'CT03.7', nome: 'Reenvio do mínimo', idMassa: '0483' },
  ]) await repos.cenarios.criar({ funcionalidade: 'Faturas', ...c });
  const plano = (await repos.planos.criar({ nome: '28/09/26', idCenarios: ['CT03.1', 'CT03.2', 'CT03.7'] })).plano;

  const filhos: Filho[] = [];
  const mortos: Filho[] = [];
  const spawn: Spawn = (comando) => {
    const f = Object.assign(new EventEmitter(), { stdout: new EventEmitter(), stderr: new EventEmitter(), comando }) as Filho;
    filhos.push(f);
    return f as unknown as ChildProcess;
  };
  const estado = {
    resultado:
      extra.resultado === undefined
        ? ({ resultado: 'passou', statusAllure: 'passed', duracaoMs: 20_000, evidencia: 'evidences/CT03.2.docx', anexos: ['output/allure-results/a.png'] } as ResultadoDoRun)
        : extra.resultado,
  };
  const executor = criarExecutor({
    raiz: dir,
    dirLogs: join(dir, 'execucoes'),
    planos: repos.planos,
    spawn,
    matar: (p) => {
      mortos.push(p as unknown as Filho);
      (p as unknown as Filho).emit('close', null);
    },
    agora: () => new Date(2026, 9, 4, 10, 0, 0),
    lerResultado: async () => estado.resultado,
    comandos: (id) => ({ gerar: `gerar ${id}`, rodar: `rodar ${id}` }),
    urlsApp: [],
  });
  const item = async (id: string) => (await repos.planos.obter(plano.id)).itens.find((i) => i.idCenario === id)!;
  /** Espera o processo número `n` (1 = gerar, 2 = rodar...) aparecer e termina com o código. */
  const terminarPasso = async (n: number, codigo = 0) => {
    await esperar(() => filhos.length >= n);
    filhos[n - 1].emit('close', codigo);
  };
  return { dir, repos, plano, executor, filhos, mortos, estado, item, terminarPasso };
}

// ---------- comando e resultado ----------

test('comandosDe: mesmos comandos do projeto, com o ID exato; ID estranho nunca vira comando', () => {
  const c = comandosDe('CT03.2', {});
  assert.equal(c.gerar, 'npm run bdd:gen');
  assert.ok(c.rodar.endsWith('--project=bdd-headed --headed --workers=1 --grep "@CT03\\.2( |$)"'), c.rodar);
  assert.equal(comandosDe('CT03.2', { PUPPETS_CMD_RODAR: 'node fake.js {id}' }).rodar, 'node fake.js CT03.2');
  for (const ruim of ['CT3.2', 'CT03.2; calc', '../x', 'CT03.123', '']) assert.throws(() => comandosDe(ruim, {}));
});

test('lerResultado: pega o resultado do cenário gravado depois do início; ignora outros testes e resultados velhos', async () => {
  const raiz = await mkdtemp(join(tmpdir(), 'puppets-allure-'));
  const dir = join(raiz, 'output', 'allure-results');
  await mkdir(dir, { recursive: true });
  await mkdir(join(raiz, 'evidences'), { recursive: true });
  const inicio = Date.now();
  const grava = (nome: string, r: object) => writeFile(join(dir, `${nome}-result.json`), JSON.stringify(r));
  await grava('velho', { status: 'failed', start: inicio - 90_000, stop: inicio - 60_000, labels: [{ name: 'tag', value: 'CT03.2' }] });
  await grava('outro', { status: 'failed', start: inicio, stop: inicio + 1_000, labels: [{ name: 'tag', value: 'CT03.1' }] });
  await grava('novo', {
    status: 'passed',
    start: inicio + 1_000,
    stop: inicio + 31_000,
    labels: [{ name: 'tag', value: 'CT03.2' }],
    attachments: [{ source: 'abc-attachment.png' }],
  });
  await writeFile(join(raiz, 'evidences', 'velha.docx'), 'x');
  await utimes(join(raiz, 'evidences', 'velha.docx'), new Date(inicio - 3_600_000), new Date(inicio - 3_600_000));
  await writeFile(join(raiz, 'evidences', 'CT03.2.docx'), 'x');

  const r = await lerResultado(raiz, 'CT03.2', inicio);
  assert.equal(r?.resultado, 'passou');
  assert.equal(r?.duracaoMs, 30_000);
  assert.equal(r?.evidencia, 'evidences/CT03.2.docx');
  assert.deepEqual(r?.anexos, ['output/allure-results/abc-attachment.png']);
  assert.equal(await lerResultado(raiz, 'CT03.7', inicio), null); // nenhum resultado desse teste
  assert.equal(await lerResultado(join(raiz, 'nao-existe'), 'CT03.2', inicio), null);
});

test('lerResultado: skipped não é resultado; broken conta como falhou', async () => {
  const raiz = await mkdtemp(join(tmpdir(), 'puppets-allure-'));
  const dir = join(raiz, 'output', 'allure-results');
  await mkdir(dir, { recursive: true });
  const t = Date.now();
  await writeFile(join(dir, 'a-result.json'), JSON.stringify({ status: 'skipped', start: t, stop: t + 1, labels: [{ name: 'tag', value: 'CT03.1' }] }));
  await writeFile(join(dir, 'b-result.json'), JSON.stringify({ status: 'broken', start: t, stop: t + 1, labels: [{ name: 'tag', value: 'CT03.2' }] }));
  assert.equal(await lerResultado(raiz, 'CT03.1', t), null);
  assert.equal((await lerResultado(raiz, 'CT03.2', t))?.resultado, 'falhou');
});

// ---------- executor ----------

test('Play: marca Em andamento, roda gerar e depois o teste, grava resultado, data, tempo e observação', async () => {
  const m = await montar();
  const run = await m.executor.iniciar(m.plano.id, 'CT03.2');
  assert.equal(run.idCenario, 'CT03.2');
  await m.terminarPasso(1);
  assert.equal((await m.item('CT03.2')).status, 'em_andamento');
  assert.equal(m.filhos[0].comando, 'gerar CT03.2');
  await m.terminarPasso(2);
  assert.equal(m.filhos[1].comando, 'rodar CT03.2');
  await esperar(() => run.estado === 'passou');

  const depois = await m.item('CT03.2');
  assert.equal(depois.status, 'concluido');
  assert.equal(depois.resultado, 'passou');
  assert.equal(depois.dataExecucao, '2026-10-04');
  assert.equal(depois.tempoRealMin, 1); // 20 s arredonda para o mínimo de 1 min
  assert.match(depois.observacoes ?? '', /passou em 20 s/);
  assert.equal(run.evidencia, 'evidences/CT03.2.docx');
});

test('teste que falha vira Concluído com resultado "falhou"', async () => {
  const m = await montar({ resultado: { resultado: 'falhou', statusAllure: 'failed', duracaoMs: 150_000, anexos: [] } });
  const run = await m.executor.iniciar(m.plano.id, 'CT03.1');
  await m.terminarPasso(1);
  await m.terminarPasso(2, 1);
  await esperar(() => run.estado === 'falhou');
  const i = await m.item('CT03.1');
  assert.deepEqual([i.status, i.resultado, i.tempoRealMin], ['concluido', 'falhou', 3]);
});

test('Stop: mata o processo e o teste volta para Refinamento com observação', async () => {
  const m = await montar();
  const run = await m.executor.iniciar(m.plano.id, 'CT03.2');
  await m.terminarPasso(1);
  await esperar(() => m.filhos.length === 2);
  m.executor.parar(run.runId);
  await esperar(() => run.estado === 'interrompida');
  assert.equal(m.mortos.length, 1);
  const i = await m.item('CT03.2');
  assert.equal(i.status, 'refinamento');
  assert.match(i.observacoes ?? '', /interrompida \(Stop\)/);
  assert.equal(i.resultado, undefined);
});

test('geração dos specs falha: interrompe sem rodar o teste', async () => {
  const m = await montar();
  const run = await m.executor.iniciar(m.plano.id, 'CT03.1');
  await m.terminarPasso(1, 2);
  await esperar(() => run.estado === 'interrompida');
  assert.equal(m.filhos.length, 1);
  assert.equal((await m.item('CT03.1')).status, 'refinamento');
});

test('sem resultado do Allure: interrompida, Refinamento, nada de passou/falhou inventado', async () => {
  const m = await montar({ resultado: null });
  const run = await m.executor.iniciar(m.plano.id, 'CT03.1');
  await m.terminarPasso(1);
  await m.terminarPasso(2, 0);
  await esperar(() => run.estado === 'interrompida');
  const i = await m.item('CT03.1');
  assert.deepEqual([i.status, i.resultado], ['refinamento', undefined]);
  assert.match(run.observacao ?? '', /não deixou resultado/);
});

test('um por vez: o segundo espera na fila e roda quando o primeiro termina; Stop na fila cancela', async () => {
  const m = await montar();
  const a = await m.executor.iniciar(m.plano.id, 'CT03.1');
  const b = await m.executor.iniciar(m.plano.id, 'CT03.2');
  const c = await m.executor.iniciar(m.plano.id, 'CT03.7'); // espera CT03.2, que está na fila: pode entrar
  await esperar(() => m.filhos.length === 1);
  assert.deepEqual([a.estado, b.estado, c.estado], ['rodando', 'na_fila', 'na_fila']);
  assert.equal((await m.item('CT03.2')).status, 'agendado'); // quem está na fila não mexe no plano

  m.executor.parar(c.runId);
  assert.equal(c.estado, 'cancelada');
  await m.terminarPasso(1);
  await m.terminarPasso(2);
  await esperar(() => a.estado === 'passou');
  await esperar(() => b.estado === 'rodando');
  await esperar(() => m.filhos.length === 3); // o processo do segundo nasce depois de ele marcar o item
  assert.equal((await m.item('CT03.7')).status, 'agendado');
});

test('recusa: mesmo teste duas vezes; dependência que ainda não passou e não está na fila', async () => {
  const m = await montar();
  await m.executor.iniciar(m.plano.id, 'CT03.1');
  await assert.rejects(() => m.executor.iniciar(m.plano.id, 'CT03.1'), { codigo: 'execucao_em_andamento' });
  await assert.rejects(() => m.executor.iniciar(m.plano.id, 'CT03.7'), { codigo: 'dependencia_pendente' });
  await assert.rejects(() => m.executor.iniciar(m.plano.id, 'CT09.9'), { codigo: 'nao_encontrado' });
});

test('Reexecutar falhos: enfileira só os que falharam (e pode filtrar por funcionalidade)', async () => {
  const m = await montar();
  const v = async (id: string, resultado: 'passou' | 'falhou') => {
    const i = await m.item(id);
    await m.repos.planos.alterarItem(m.plano.id, id, i.versao, { status: 'concluido', resultado });
  };
  await v('CT03.1', 'falhou');
  await v('CT03.2', 'passou');
  const r = await m.executor.reexecutarFalhos(m.plano.id);
  assert.deepEqual(r.execucoes.map((e: Run) => e.idCenario), ['CT03.1']);
  assert.deepEqual(r.ignorados, []);
  assert.deepEqual((await m.executor.reexecutarFalhos(m.plano.id, 'Outra')).execucoes, []);
});

test('log: replay do que já saiu, depois ao vivo, e "fim" com o estado', async () => {
  const m = await montar();
  const run = await m.executor.iniciar(m.plano.id, 'CT03.1');
  await esperar(() => m.filhos.length === 1);
  m.filhos[0].stdout.emit('data', Buffer.from('linha um\nmeia'));
  const recebido: string[] = [];
  let fim: string | undefined;
  m.executor.assinar(run.runId, (e) => (e.tipo === 'linha' ? recebido.push(e.texto) : (fim = e.estado)));
  assert.ok(recebido.includes('linha um'));
  m.filhos[0].stdout.emit('data', Buffer.from(' linha\n'));
  assert.ok(recebido.includes('meia linha')); // linha quebrada em dois pedaços volta inteira
  m.filhos[0].emit('close', 0);
  await m.terminarPasso(2);
  await esperar(() => fim === 'passou');
  assert.match(m.executor.logCompleto(run.runId), /\$ rodar CT03\.1/);
});

test('verificarAmbiente: aponta o que falta sem rodar nada', async () => {
  const m = await montar();
  const ex = criarExecutor({
    raiz: join(m.dir, 'nao-existe'),
    dirLogs: m.dir,
    planos: m.repos.planos,
    urlsApp: ['http://127.0.0.1:1'],
    fetch: async () => Promise.reject(new Error('recusou')),
  });
  const c = await ex.verificarAmbiente();
  const por = Object.fromEntries(c.map((x) => [x.chave, x.ok]));
  assert.equal(por.raiz, false);
  assert.equal(por.playwright, false);
  assert.equal(por.planilha, false);
  assert.equal(por.livre, true);
  assert.equal(por['app:http://127.0.0.1:1'], false);
});

// ---------- API ----------

test('API /api/execucoes: valida entrada, lista, para, serve log e só entrega arquivo registrado', async () => {
  const m = await montar();
  const server = createApp({ dirDados: m.dir, executor: m.executor, raiz: m.dir }).listen(0, '127.0.0.1');
  await new Promise<void>((r) => server.once('listening', () => r()));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const chamar = (metodo: string, caminho: string, corpo?: unknown) =>
    fetch(`${base}${caminho}`, {
      method: metodo,
      headers: { 'content-type': 'application/json' },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
  try {
    assert.equal((await chamar('POST', '/api/execucoes', { planoId: m.plano.id, idCenario: 'CT03.2; calc' })).status, 400);
    assert.equal((await chamar('POST', '/api/execucoes', { idCenario: 'CT03.2' })).status, 400);
    assert.equal((await chamar('GET', '/api/execucoes/ex_inexistente')).status, 404);

    const criada = await chamar('POST', '/api/execucoes', { planoId: m.plano.id, idCenario: 'CT03.1' });
    assert.equal(criada.status, 202);
    const { execucao } = (await criada.json()) as { execucao: Run };
    assert.equal((await chamar('POST', '/api/execucoes', { planoId: m.plano.id, idCenario: 'CT03.1' })).status, 409);
    assert.equal(((await (await chamar('GET', '/api/execucoes')).json()) as { execucoes: Run[] }).execucoes.length, 1);

    await esperar(() => m.filhos.length === 1);
    const parada = await chamar('POST', `/api/execucoes/${execucao.runId}/parar`);
    assert.equal(parada.status, 200);
    await esperar(() => m.executor.obter(execucao.runId).estado === 'interrompida');
    assert.match(await (await chamar('GET', `/api/execucoes/${execucao.runId}/log.txt`)).text(), /Stop pedido/);

    const sse = await (await chamar('GET', `/api/execucoes/${execucao.runId}/log`)).text(); // run encerrada: replay + fim e fecha
    assert.match(sse, /event: linha/);
    assert.match(sse, /event: fim/);

    assert.equal((await chamar('GET', `/api/execucoes/${execucao.runId}/arquivo?caminho=../../etc/passwd`)).status, 404);
    assert.equal((await chamar('GET', '/api/execucoes/ambiente')).status, 200);
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
});
