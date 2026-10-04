import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app.ts';
import { executarSemente } from '../src/semente/executar.ts';

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

async function iniciar(dirDados?: string) {
  const dir = dirDados ?? (await mkdtemp(join(tmpdir(), 'puppets-semente-')));
  const server = createApp({ dirDados: dir }).listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', () => resolve()));
  const { port } = server.address() as AddressInfo;
  const base = `http://127.0.0.1:${port}`;
  const json = async (metodo: string, caminho: string, corpo?: unknown): Promise<{ status: number; corpo: Json }> => {
    const res = await fetch(`${base}${caminho}`, {
      method: metodo,
      headers: corpo === undefined ? undefined : { 'content-type': 'application/json' },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
    return { status: res.status, corpo: res.status === 204 ? {} : ((await res.json()) as Json) };
  };
  return { dir, json, fechar: () => new Promise<void>((r) => server.close(() => r())) };
}

async function planoPorNome(s: Awaited<ReturnType<typeof iniciar>>, nome: string): Promise<Json> {
  const lista = (await s.json('GET', '/api/planos')).corpo.planos as Json[];
  const achado = lista.find((p) => p.nome === nome);
  assert.ok(achado, `plano ${nome} não existe`);
  return (await s.json('GET', `/api/planos/${achado.id}`)).corpo;
}

test('POST /api/semente com tudo vazio cria 8 cenários, 3 pessoas, 3 planos, 3 INC, 1 retro e 1 decisão', async () => {
  const s = await iniciar();
  try {
    const r = await s.json('POST', '/api/semente');
    assert.equal(r.status, 201);
    assert.deepEqual(r.corpo, { cenarios: 8, pessoas: 3, planos: 3, incidentes: 3, retros: 1, decisoes: 1 });
    assert.equal((await s.json('GET', '/api/cenarios')).corpo.cenarios.length, 8);
    assert.deepEqual((await s.json('GET', '/api/pessoas')).corpo.pessoas.map((p: Json) => [p.id, p.capacidadeMinSemana]), [
      ['ana', 120],
      ['bia', 90],
      ['carlos', 60],
    ]);
    assert.equal((await s.json('GET', '/api/planos')).corpo.planos.length, 3);
  } finally {
    await s.fechar();
  }
});

test('o plano de exemplo bate com o desenho: 3 de 8 executados (38%), uma falha, CT03.2 em andamento, CT04.2 em refinamento', async () => {
  const s = await iniciar();
  try {
    await s.json('POST', '/api/semente');
    const p = await planoPorNome(s, '28/09/26');
    assert.deepEqual(p.itens.map((i: Json) => i.idCenario), ['CT03.1', 'CT03.2', 'CT03.3', 'CT03.7', 'CT04.1', 'CT04.2', 'CT05.1', 'CT05.2']);
    assert.equal(p.resumo.total, 8);
    assert.equal(p.resumo.concluidos, 3);
    assert.equal(p.resumo.percentual, 38);
    assert.deepEqual([p.resumo.passou, p.resumo.falhou], [2, 1]);
    const por = (id: string) => p.itens.find((i: Json) => i.idCenario === id);
    assert.deepEqual([por('CT03.1').status, por('CT03.1').resultado], ['concluido', 'passou']);
    assert.deepEqual([por('CT05.2').status, por('CT05.2').resultado], ['concluido', 'falhou']);
    assert.equal(por('CT03.2').status, 'em_andamento');
    assert.equal(por('CT04.2').status, 'refinamento');
    assert.deepEqual([por('CT03.2').responsavel, por('CT03.2').prioridade, por('CT03.2').estimativaMin], ['ana', 'P1', 30]);
    assert.equal(p.plano.previsao, '2026-10-13');
  } finally {
    await s.fechar();
  }
});

test('massa repetida de propósito: CT03.7 usa a massa 0483 do CT03.2 e depende dele (sem alerta de erro)', async () => {
  const s = await iniciar();
  try {
    await s.json('POST', '/api/semente');
    const p = await planoPorNome(s, '28/09/26');
    const ct37 = p.itens.find((i: Json) => i.idCenario === 'CT03.7');
    assert.equal(ct37.idMassa, '0483');
    assert.deepEqual(ct37.dependeDe, ['CT03.2']);
    assert.deepEqual(ct37.massaCompartilhadaCom, ['CT03.2']);
    assert.deepEqual(ct37.bloqueadoPor, ['CT03.2']); // CT03.2 ainda não passou
    assert.ok(ct37.dataPlanejada >= p.itens.find((i: Json) => i.idCenario === 'CT03.2').dataPlanejada);
  } finally {
    await s.fechar();
  }
});

test('os cenários trazem massa, CPF fictício sem máscara (só dígitos), passos e resultado esperado', async () => {
  const s = await iniciar();
  try {
    await s.json('POST', '/api/semente');
    const lista = (await s.json('GET', '/api/cenarios')).corpo.cenarios as Json[];
    for (const c of lista) {
      assert.match(c.cpf, /^\d{11}$/, c.idCenario);
      assert.ok(c.idMassa, c.idCenario);
      assert.match(c.passos, /^tests\/features\/.+\.feature#CT\d{2}\.\d+$/, c.idCenario);
      assert.ok(c.resultadoEsperado, c.idCenario);
    }
    const cpfs = new Map(lista.map((c) => [c.idCenario, c.cpf]));
    assert.equal(cpfs.get('CT03.2'), cpfs.get('CT03.7')); // mesma massa = mesmo CPF
    assert.equal(new Set(lista.map((c) => c.cpf)).size, 7);
  } finally {
    await s.fechar();
  }
});

test('abas: o plano 14/09/26 já está executado, o 28/09/26 e o 05/10/26 estão em execução', async () => {
  const s = await iniciar();
  try {
    await s.json('POST', '/api/semente');
    const executados = (await s.json('GET', '/api/planos?aba=executados')).corpo.planos as Json[];
    const emExecucao = (await s.json('GET', '/api/planos?aba=em_execucao')).corpo.planos as Json[];
    assert.deepEqual(executados.map((p) => p.nome), ['14/09/26']);
    assert.deepEqual(emExecucao.map((p) => p.nome), ['28/09/26', '05/10/26']);
    assert.equal((await planoPorNome(s, '05/10/26')).itens.length, 0);
  } finally {
    await s.fechar();
  }
});

test('a retro de exemplo está no plano concluído: 4 notas votadas, 1 ação feita e 1 pendente da Ana', async () => {
  const s = await iniciar();
  try {
    await s.json('POST', '/api/semente');
    const concluido = await planoPorNome(s, '14/09/26');
    const retro = (await s.json('GET', `/api/retros/${concluido.plano.id}`)).corpo;
    assert.equal(retro.status, 'aberta');
    assert.equal(retro.anonimas, false);
    assert.deepEqual(retro.notas.map((n: Json) => [n.coluna, n.autor, n.votos]), [
      ['bem', 'ana', ['bia', 'carlos']],
      ['bem', 'carlos', ['ana']],
      ['melhorar', 'bia', ['ana', 'bia', 'carlos']],
      ['melhorar', 'carlos', ['bia']],
    ]);
    const [pendente, feita] = retro.acoes as Json[];
    assert.deepEqual([pendente.responsavel, pendente.prazo, pendente.feito, pendente.incId], ['ana', '2026-10-20', false, null]);
    assert.equal(pendente.origem, 'Reuso de massa sem ordem gerou reexecuções.');
    assert.deepEqual([feita.responsavel, feita.feito, feita.feitoPor], ['carlos', true, 'carlos']);

    const emAndamento = await planoPorNome(s, '28/09/26');
    assert.equal((await s.json('GET', `/api/retros/${emAndamento.plano.id}`)).corpo.notas.length, 0, 'só o plano concluído tem retro');
  } finally {
    await s.fechar();
  }
});

test('a decisão de exemplo é um NO-GO da Ana no plano em andamento, com os critérios 1 a 5 abertos', async () => {
  const s = await iniciar();
  try {
    await s.json('POST', '/api/semente');
    const p = await planoPorNome(s, '28/09/26');
    assert.equal(p.plano.decisoes.length, 1);
    assert.deepEqual(
      { decisao: p.plano.decisoes[0].decisao, por: p.plano.decisoes[0].por, criterios: p.plano.decisoes[0].criterios },
      { decisao: 'no_go', por: 'ana', criterios: [1, 2, 3, 4, 5] },
    );
    assert.match(p.plano.decisoes[0].justificativa, /INC0715802225/);
    assert.equal((await planoPorNome(s, '14/09/26')).plano.decisoes, undefined);
  } finally {
    await s.fechar();
  }
});

test('o sino da Ana com a semente: INC dela, ação pendente da retro e nenhum teste de hoje', async () => {
  const s = await iniciar();
  try {
    await s.json('POST', '/api/semente');
    const r = (await s.json('GET', '/api/lembretes?voce=ana&hoje=2026-10-04')).corpo;
    assert.deepEqual(r.lembretes.map((l: Json) => l.tipo), ['inc_aberto', 'acao_retro']);
    assert.equal(r.lembretes[1].detalhe, 'Ordenar CT03.2 antes do CT03.7 (massa 0483) · até 20/10/2026');
  } finally {
    await s.fechar();
  }
});

test('os responsáveis dos testes existem na Equipe de exemplo', async () => {
  const s = await iniciar();
  try {
    await s.json('POST', '/api/semente');
    const ids = new Set(((await s.json('GET', '/api/pessoas')).corpo.pessoas as Json[]).map((p) => p.id));
    const p = await planoPorNome(s, '28/09/26');
    for (const i of p.itens as Json[]) assert.ok(ids.has(i.responsavel), `${i.idCenario}: ${i.responsavel}`);
  } finally {
    await s.fechar();
  }
});

test('depois de semeado, semear de novo é recusado (409 ja_tem_dados) e nada muda', async () => {
  const s = await iniciar();
  try {
    await s.json('POST', '/api/semente');
    const r = await s.json('POST', '/api/semente');
    assert.equal(r.status, 409);
    assert.equal(r.corpo.erro, 'ja_tem_dados');
    assert.equal((await s.json('GET', '/api/cenarios')).corpo.cenarios.length, 8);
    assert.equal((await s.json('GET', '/api/planos')).corpo.planos.length, 3);
  } finally {
    await s.fechar();
  }
});

test('qualquer dado seu já basta para recusar: um cenário, uma pessoa ou um plano', async () => {
  for (const [rota, corpo] of [
    ['/api/cenarios', { idCenario: 'CT01.1', nome: 'Meu teste', funcionalidade: 'Acesso' }],
    ['/api/pessoas', { nome: 'Zé' }],
    ['/api/planos', { nome: 'Meu plano' }],
  ] as const) {
    const s = await iniciar();
    try {
      await s.json('POST', rota, corpo);
      const r = await s.json('POST', '/api/semente');
      assert.equal(r.status, 409, rota);
      assert.equal(r.corpo.erro, 'ja_tem_dados', rota);
    } finally {
      await s.fechar();
    }
  }
});

// ---------- comando npm run semear ----------

test('executarSemente em pasta vazia semeia e devolve código 0', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'puppets-cli-'));
  const saida: string[] = [];
  const codigo = await executarSemente({ dirDados: dir, forcar: false, escrever: (t) => saida.push(t) });
  assert.equal(codigo, 0);
  assert.match(saida.join('\n'), /8 cenários, 3 pessoas, 3 planos, 3 incidentes, 1 retro e 1 decisão de release/);
  const nomes = (await readdir(dir)).sort();
  assert.ok(nomes.includes('cenarios.json') && nomes.includes('pessoas.json') && nomes.includes('planos.json'));
});

test('executarSemente com dados existentes recusa (código 1), explica o --forcar e não mexe em nada', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'puppets-cli-'));
  const meu = JSON.stringify({ cenarios: [{ idCenario: 'CT01.1', nome: 'Meu', funcionalidade: 'X', versao: 1, criadoEm: 'a', atualizadoEm: 'a' }] });
  await writeFile(join(dir, 'cenarios.json'), meu, 'utf8');
  const saida: string[] = [];
  const codigo = await executarSemente({ dirDados: dir, forcar: false, escrever: (t) => saida.push(t) });
  assert.equal(codigo, 1);
  assert.match(saida.join('\n'), /--forcar/);
  assert.equal(await readFile(join(dir, 'cenarios.json'), 'utf8'), meu);
  assert.equal((await readdir(dir)).length, 1);
});

test('executarSemente --forcar sobre uma semente antiga guarda também a retro e semeia uma nova', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'puppets-cli-'));
  await executarSemente({ dirDados: dir, forcar: false, escrever: () => undefined });
  const antiga = await readFile(join(dir, 'retros.json'), 'utf8');
  const codigo = await executarSemente({ dirDados: dir, forcar: true, escrever: () => undefined, agora: () => new Date(2026, 9, 4, 9, 0, 0) });
  assert.equal(codigo, 0);
  assert.equal(await readFile(join(dir, 'antes-da-semente-20261004-090000', 'retros.json'), 'utf8'), antiga);
  const nova = JSON.parse(await readFile(join(dir, 'retros.json'), 'utf8')) as Json;
  assert.equal(nova.retros.length, 1);
  assert.equal(nova.retros[0].notas.length, 4);
});

test('executarSemente --forcar guarda uma cópia dos arquivos antigos numa subpasta e semeia', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'puppets-cli-'));
  const meu = JSON.stringify({ cenarios: [{ idCenario: 'CT01.1', nome: 'Meu', funcionalidade: 'X', versao: 1, criadoEm: 'a', atualizadoEm: 'a' }] });
  await writeFile(join(dir, 'cenarios.json'), meu, 'utf8');
  const saida: string[] = [];
  const codigo = await executarSemente({ dirDados: dir, forcar: true, escrever: (t) => saida.push(t), agora: () => new Date(2026, 9, 3, 14, 5, 9) });
  assert.equal(codigo, 0);
  const copia = join(dir, 'antes-da-semente-20261003-140509');
  assert.equal(await readFile(join(copia, 'cenarios.json'), 'utf8'), meu);
  const novo = JSON.parse(await readFile(join(dir, 'cenarios.json'), 'utf8')) as Json;
  assert.equal(novo.cenarios.length, 8);
  assert.match(saida.join('\n'), /antes-da-semente-20261003-140509/);
});
