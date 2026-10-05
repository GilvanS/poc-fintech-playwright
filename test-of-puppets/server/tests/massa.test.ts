import { test } from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import PizZip from 'pizzip';
import { createApp } from '../src/app.ts';
import { criarFonteApp, lerCsv } from '../src/massa/fonteApp.ts';
import { calcularProposta, formatarNumero, lerNumero } from '../src/massa/modelo.ts';
import { criarServicoMassa, type ServicoMassa } from '../src/massa/servico.ts';
import { gravarCelulas, hashDoArquivo, lerLinhaPorCpf } from '../src/massa/xlsx.ts';
import { CPF_ANA, CPF_BETO, criarXlsxFalso, FONTE_ANA } from './massa.apoio.ts';

// Tudo numa planilha SINTÉTICA em pasta temporária. O MassaDados.xlsx de verdade nunca é aberto por estes testes.

function montar(fonte: Record<string, string> = FONTE_ANA) {
  const dir = mkdtempSync(join(tmpdir(), 'puppets-massa-'));
  const planilha = join(dir, 'MassaDados.xlsx');
  criarXlsxFalso(planilha);
  const dirBackups = join(dir, 'backups');
  const servico = criarServicoMassa({
    planilha,
    dirBackups,
    fonte: async () => ({ valores: fonte, origem: 'http://app/export', lidoEm: '2026-10-04T10:42:00.000Z' }),
    agora: () => new Date(2026, 9, 4, 10, 42, 0),
  });
  return { dir, planilha, dirBackups, servico };
}

// ---------- a regra ----------

test('números: aceita 1.234,56 / 1234,56 / 1234.56; formata com vírgula e duas casas', () => {
  assert.equal(lerNumero('1.234,56'), 1234.56);
  assert.equal(lerNumero('1234,56'), 1234.56);
  assert.equal(lerNumero('1234.56'), 1234.56);
  assert.equal(lerNumero(''), null);
  assert.equal(lerNumero('abc'), null);
  assert.equal(formatarNumero(24615.07), '24615,07');
  assert.equal(formatarNumero(25000), '25000,00');
});

test('regra: só as 6 colunas mudam; fatura_fechada aparece como imutável mesmo que a fonte divirja', () => {
  const atual = { saldo_conta: '25000,00', limite_utilizado: '721,27', limite_disponivel: '14278,73', fatura_fechada: '153,42', fatura_aberta: '260,58', status_fatura_fechada: 'VIGENTE', parcelas_a_vencer: '' };
  const { linhas, escritas } = calcularProposta(atual, FONTE_ANA);
  assert.deepEqual(escritas.map((e) => e.coluna).sort(), ['fatura_aberta', 'limite_disponivel', 'limite_utilizado', 'parcelas_a_vencer', 'saldo_conta', 'status_fatura_fechada']);
  assert.ok(!escritas.some((e) => e.coluna === 'fatura_fechada'));
  const fechada = linhas.find((l) => l.coluna === 'fatura_fechada')!;
  assert.deepEqual([fechada.regra, fechada.antes, fechada.depois], ['imutavel', '153,42', '153,42']);
  assert.match(fechada.motivo!, /fonte tem 999,99/);
  assert.equal(escritas.find((e) => e.coluna === 'saldo_conta')!.valor, '24615,07');
});

test('regra: valor igual não grava; valor ausente da fonte é ignorado', () => {
  const atual = { saldo_conta: '24615,07', limite_utilizado: '1157,26', limite_disponivel: '13842,74', fatura_fechada: '1', fatura_aberta: '194,19', status_fatura_fechada: 'PAGO_PARCIAL', parcelas_a_vencer: '898,17' };
  const igual = calcularProposta(atual, FONTE_ANA);
  assert.deepEqual(igual.escritas, []);
  assert.ok(igual.linhas.filter((l) => l.regra === 'igual').length === 6);
  const semValor = calcularProposta(atual, { ...FONTE_ANA, saldo_conta: '' });
  assert.equal(semValor.linhas.find((l) => l.coluna === 'saldo_conta')!.regra, 'ignorado');
});

test('regra do status: só VIGENTE vira PAGO_MIN/PAGO_PARCIAL/PAGO_TOTAL; o resto fica como está', () => {
  const base = { saldo_conta: '1,00', limite_utilizado: '1,00', limite_disponivel: '1,00', fatura_fechada: '1', fatura_aberta: '1,00', parcelas_a_vencer: '1,00' };
  const fonte = { ...FONTE_ANA, saldo_conta: '1,00', limite_utilizado: '1,00', limite_disponivel: '1,00', fatura_aberta: '1,00', parcelas_a_vencer: '1,00' };
  const status = (antes: string, novo: string) => calcularProposta({ ...base, status_fatura_fechada: antes }, { ...fonte, status_fatura_fechada: novo }).linhas.find((l) => l.coluna === 'status_fatura_fechada')!;
  assert.equal(status('VIGENTE', 'PAGO_MIN').regra, 'atualiza');
  assert.equal(status('VIGENTE', 'PAGO_TOTAL').depois, 'PAGO_TOTAL');
  assert.equal(status('PAGO_TOTAL', 'VIGENTE').regra, 'ignorado'); // volta atrás: não
  assert.equal(status('PAGO_MIN', 'PAGO_TOTAL').regra, 'ignorado'); // só sai de VIGENTE
  assert.equal(status('VIGENTE', 'ATRASADA').regra, 'ignorado'); // fora da lista
  assert.equal(status('VIGENTE', 'VIGENTE').regra, 'igual');
});

// ---------- a planilha ----------

test('lê a linha pelo CPF: números com vírgula, texto, cabeçalho com espaço, célula ausente vazia', () => {
  const m = montar();
  const ana = lerLinhaPorCpf(m.planilha, CPF_ANA)!;
  assert.equal(ana.numero, 2);
  assert.equal(ana.valores.saldo_conta, '25000,00');
  assert.equal(ana.valores.limite_utilizado, '721,27');
  assert.equal(ana.valores.fatura_fechada, '153,42'); // o cabeçalho era " fatura_fechada "
  assert.equal(ana.valores.status_fatura_fechada, 'VIGENTE');
  assert.equal(ana.valores.parcelas_a_vencer, ''); // a célula nem existe na linha
  assert.equal(lerLinhaPorCpf(m.planilha, '99999999999'), null);
});

test('grava só as células pedidas: estilo mantido, Tabela e outras partes byte a byte iguais, fatura_fechada intacta', () => {
  const m = montar();
  const antesZip = new PizZip(readFileSync(m.planilha));
  gravarCelulas(
    m.planilha,
    CPF_ANA,
    [
      { coluna: 'saldo_conta', valor: '24615,07' },
      { coluna: 'parcelas_a_vencer', valor: '898,17' }, // célula ausente: entra entre G e I
      { coluna: 'status_fatura_fechada', valor: 'PAGO_PARCIAL' },
    ],
    { saldo_conta: 'valor', parcelas_a_vencer: 'valor', status_fatura_fechada: 'status' },
  );
  const depois = lerLinhaPorCpf(m.planilha, CPF_ANA)!;
  assert.equal(depois.valores.saldo_conta, '24615,07');
  assert.equal(depois.valores.parcelas_a_vencer, '898,17');
  assert.equal(depois.valores.status_fatura_fechada, 'PAGO_PARCIAL');
  assert.equal(depois.valores.fatura_fechada, '153,42');
  assert.equal(depois.valores.nome, 'Ana');
  assert.equal(lerLinhaPorCpf(m.planilha, CPF_BETO)!.valores.status_fatura_fechada, 'PAGO_TOTAL'); // outra linha intacta

  const novoZip = new PizZip(readFileSync(m.planilha));
  const sheet = novoZip.file('xl/worksheets/sheet2.xml')!.asText();
  assert.match(sheet, /<c r="B2" s="43"><v>24615\.07<\/v><\/c>/); // estilo da célula preservado
  assert.match(sheet, /<c r="G2" s="48" t="inlineStr">/);
  assert.ok(sheet.indexOf('r="G2"') < sheet.indexOf('r="H2"') && sheet.indexOf('r="H2"') < sheet.indexOf('r="I2"'), 'H2 entra na ordem das colunas');
  for (const parte of ['xl/worksheets/sheet1.xml', 'xl/tables/table1.xml', 'xl/sharedStrings.xml', 'xl/worksheets/_rels/sheet2.xml.rels']) {
    assert.equal(novoZip.file(parte)!.asText(), antesZip.file(parte)!.asText(), `${parte} não podia mudar`);
  }
  assert.ok(sheet.includes('<tableParts'), 'a Tabela continua ligada à aba');
  assert.equal(novoZip.file('xl/calcChain.xml'), null);
  assert.match(novoZip.file('xl/workbook.xml')!.asText(), /fullCalcOnLoad="1"/);
});

// ---------- o serviço: proposta, negar, confirmar ----------

test('propor só lê: o arquivo fica idêntico (hash) e a proposta traz as 7 linhas, a fonte e o backup previsto', async () => {
  const m = montar();
  const antes = hashDoArquivo(m.planilha);
  const p = await m.servico.propor(CPF_ANA);
  assert.equal(hashDoArquivo(m.planilha), antes);
  assert.equal(p.temMudanca, true);
  assert.equal(p.linhas.length, 7);
  assert.deepEqual(p.fonte, { origem: 'http://app/export', lidoEm: '2026-10-04T10:42:00.000Z' });
  assert.equal(p.backup, join(m.dirBackups, 'MassaDados.2026-10-04.xlsx'));
  assert.equal(p.bloqueio, undefined);
  assert.equal(existsSync(m.dirBackups), false); // nem a pasta de backup nasce antes da confirmação
});

test('negar (nunca confirmar) não altera nada; CPF fora da planilha é "não encontrado"', async () => {
  const m = montar();
  const antes = hashDoArquivo(m.planilha);
  await m.servico.propor(CPF_ANA);
  assert.equal(hashDoArquivo(m.planilha), antes);
  await assert.rejects(() => m.servico.propor('99999999999'), { codigo: 'nao_encontrado' });
});

test('confirmar: faz backup idêntico ao original, grava só o combinado e a proposta não vale duas vezes', async () => {
  const m = montar();
  const original = hashDoArquivo(m.planilha);
  const p = await m.servico.propor(CPF_ANA);
  const r = await m.servico.confirmar(p.propostaId);

  assert.equal(r.backup, p.backup);
  assert.equal(hashDoArquivo(r.backup), original, 'o backup é o arquivo como estava');
  assert.notEqual(hashDoArquivo(m.planilha), original);
  const ana = lerLinhaPorCpf(m.planilha, CPF_ANA)!;
  assert.deepEqual([ana.valores.saldo_conta, ana.valores.fatura_aberta, ana.valores.status_fatura_fechada, ana.valores.parcelas_a_vencer], ['24615,07', '194,19', 'PAGO_PARCIAL', '898,17']);
  assert.equal(ana.valores.fatura_fechada, '153,42');
  assert.equal(r.gravadas.length, 6);
  await assert.rejects(() => m.servico.confirmar(p.propostaId), { codigo: 'nao_encontrado' });
});

test('segundo backup no mesmo dia não sobrescreve o primeiro', async () => {
  const m = montar();
  const a = await m.servico.confirmar((await m.servico.propor(CPF_ANA)).propostaId);
  // muda a fonte para a Ana de novo: precisa haver diferença para gravar outra vez
  const m2 = criarServicoMassa({
    planilha: m.planilha,
    dirBackups: m.dirBackups,
    fonte: async () => ({ valores: { ...FONTE_ANA, saldo_conta: '1,00' }, origem: 'x', lidoEm: 'y' }),
    agora: () => new Date(2026, 9, 4, 11, 0, 5),
  });
  const b = await m2.confirmar((await m2.propor(CPF_ANA)).propostaId);
  assert.notEqual(a.backup, b.backup);
  assert.match(b.backup, /MassaDados\.2026-10-04-110005\.xlsx$/);
  assert.ok(existsSync(a.backup) && existsSync(b.backup));
});

test('Excel aberto (~$MassaDados.xlsx): a proposta avisa e confirmar recusa sem mexer no arquivo', async () => {
  const m = montar();
  const p = await m.servico.propor(CPF_ANA);
  writeFileSync(join(m.dir, '~$MassaDados.xlsx'), 'trava do Excel');
  const antes = hashDoArquivo(m.planilha);
  await assert.rejects(() => m.servico.confirmar(p.propostaId), { codigo: 'planilha_bloqueada' });
  assert.equal(hashDoArquivo(m.planilha), antes);
  assert.equal(existsSync(m.dirBackups), false);
  assert.match((await m.servico.propor(CPF_ANA)).bloqueio!, /Excel está com a planilha aberta/);
});

test('planilha mudou depois do diff: recusa e pede para abrir de novo', async () => {
  const m = montar();
  const p = await m.servico.propor(CPF_ANA);
  gravarCelulas(m.planilha, CPF_BETO, [{ coluna: 'saldo_conta', valor: '1,00' }], { saldo_conta: 'valor' }); // alguém mexeu
  await assert.rejects(() => m.servico.confirmar(p.propostaId), { codigo: 'planilha_mudou' });
});

test('sem diferença: confirmar recusa ("sem_mudanca") e nada é gravado', async () => {
  const m = montar();
  await m.servico.confirmar((await m.servico.propor(CPF_ANA)).propostaId);
  const p2 = await m.servico.propor(CPF_ANA); // agora a planilha já está igual à fonte
  assert.equal(p2.temMudanca, false);
  const antes = hashDoArquivo(m.planilha);
  await assert.rejects(() => m.servico.confirmar(p2.propostaId), { codigo: 'sem_mudanca' });
  assert.equal(hashDoArquivo(m.planilha), antes);
});

test('proposta que não existe é "não encontrada"', async () => {
  const m = montar();
  await assert.rejects(() => m.servico.confirmar('pm_inexistente'), { codigo: 'nao_encontrado' });
});

// ---------- a fonte (FintechBankApp por HTTP) ----------

test('lerCsv: separador ;, aspas e linhas vazias', () => {
  assert.deepEqual(lerCsv('a;b;c\r\n1;"x;y";3\r\n\r\n4;5;6\r\n'), [
    { a: '1', b: 'x;y', c: '3' },
    { a: '4', b: '5', c: '6' },
  ]);
});

const csvDaAna = `cpf;saldo_conta;status_fatura_fechada\n${CPF_ANA};24615,07;PAGO_PARCIAL\n`;
const resposta = (status: number, corpo: unknown) => new Response(JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json' } });

test('fonte: entra com cpf/senha, usa o token no export, reaproveita o token e entra de novo se vencer', async () => {
  const chamadas: string[] = [];
  let tokenValido = 'tk1';
  const fetchFalso = (async (url: string, init?: RequestInit) => {
    chamadas.push(`${init?.method ?? 'GET'} ${url.replace('http://app', '')}`);
    if (url.endsWith('/api/auth/login')) {
      assert.deepEqual(JSON.parse(String(init?.body)), { cpf: '99999999999', password: 'segredo-de-teste' });
      return resposta(200, { success: true, token: tokenValido });
    }
    const auth = (init?.headers as Record<string, string>).authorization;
    if (auth !== `Bearer ${tokenValido}`) return resposta(401, { success: false });
    return resposta(200, { success: true, data: { csv: csvDaAna, count: 1 } });
  }) as unknown as typeof fetch;
  const fonte = criarFonteApp({ baseUrl: 'http://app/', cpf: '99999999999', senha: 'segredo-de-teste', fetch: fetchFalso, agora: () => new Date('2026-10-04T10:42:00Z') });

  const d = await fonte(CPF_ANA);
  assert.equal(d.valores.saldo_conta, '24615,07');
  assert.equal(d.lidoEm, '2026-10-04T10:42:00.000Z');
  await fonte(CPF_ANA); // reaproveita o token
  assert.equal(chamadas.filter((c) => c.includes('/auth/login')).length, 1);
  tokenValido = 'tk2'; // o token venceu
  await fonte(CPF_ANA);
  assert.equal(chamadas.filter((c) => c.includes('/auth/login')).length, 2);
});

test('fonte: sem credenciais, sem acesso ou CPF ausente dá erro claro', async () => {
  const semConfig = criarFonteApp({ baseUrl: 'http://app', fetch: (async () => resposta(200, {})) as unknown as typeof fetch, token: undefined, cpf: undefined, senha: undefined });
  const emAmbiente = { ...process.env };
  delete process.env.PUPPETS_APP_TOKEN;
  delete process.env.PUPPETS_APP_CPF;
  delete process.env.PUPPETS_APP_SENHA;
  try {
    await assert.rejects(() => semConfig(CPF_ANA), { codigo: 'fonte_indisponivel', message: /PUPPETS_APP_TOKEN/ });
  } finally {
    Object.assign(process.env, emAmbiente);
  }
  const negado = criarFonteApp({ baseUrl: 'http://app', token: 't', fetch: (async () => resposta(403, {})) as unknown as typeof fetch });
  await assert.rejects(() => negado(CPF_ANA), { codigo: 'fonte_indisponivel', message: /admin/ });
  const semCpf = criarFonteApp({ baseUrl: 'http://app', token: 't', fetch: (async () => resposta(200, { success: true, data: { csv: 'cpf;x\n' } })) as unknown as typeof fetch });
  await assert.rejects(() => semCpf(CPF_ANA), { codigo: 'nao_encontrado' });
  const fora = criarFonteApp({ baseUrl: 'http://app', token: 't', fetch: (async () => Promise.reject(new Error('ECONNREFUSED'))) as unknown as typeof fetch });
  await assert.rejects(() => fora(CPF_ANA), { codigo: 'fonte_indisponivel', message: /está de pé/ });
});

// ---------- a API ----------

test('API /api/massa: valida CPF, mostra o diff, grava só após confirmar e devolve o backup', async () => {
  const m = montar();
  const server = createApp({ dirDados: m.dir, servicoMassa: m.servico as ServicoMassa }).listen(0, '127.0.0.1');
  await new Promise<void>((r) => server.once('listening', () => r()));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const post = (caminho: string, corpo: unknown) => fetch(`${base}${caminho}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo) });
  try {
    assert.equal((await post('/api/massa/proposta', { cpf: '123' })).status, 400);
    assert.equal((await post('/api/massa/proposta', { cpf: '99999999999' })).status, 404);
    assert.equal((await post('/api/massa/confirmar', {})).status, 400);

    const antes = hashDoArquivo(m.planilha);
    const proposta = (await (await post('/api/massa/proposta', { cpf: '111.111.111-11' })).json()) as { proposta: { propostaId: string; linhas: unknown[] } };
    assert.equal(proposta.proposta.linhas.length, 7);
    assert.equal(hashDoArquivo(m.planilha), antes);

    const ok = await post('/api/massa/confirmar', { propostaId: proposta.proposta.propostaId });
    assert.equal(ok.status, 200);
    const { resultado } = (await ok.json()) as { resultado: { backup: string } };
    assert.equal(hashDoArquivo(resultado.backup), antes);
    assert.notEqual(hashDoArquivo(m.planilha), antes);
    copyFileSync(resultado.backup, join(m.dir, 'conferido.xlsx')); // o backup abre como planilha
    assert.equal(lerLinhaPorCpf(join(m.dir, 'conferido.xlsx'), CPF_ANA)!.valores.saldo_conta, '25000,00');
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
});
