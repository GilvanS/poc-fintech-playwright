import { spawn as spawnReal, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createWriteStream, mkdirSync, type WriteStream } from 'node:fs';
import { access, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { ErroNegocio } from '../erros.ts';
import { mensagemDependencia } from '../planos/regras.ts';
import type { ItemVisao, RepoPlanos } from '../planos/repo.ts';
import { comandosDe, type Comandos } from './comando.ts';
import { lerResultado, type ResultadoDoRun } from './resultado.ts';

export type EstadoRun = 'na_fila' | 'rodando' | 'passou' | 'falhou' | 'interrompida' | 'cancelada';

/** Uma execução (Play) de um teste de um plano. Vive no servidor: fechar a tela não a interrompe. */
export interface Run {
  runId: string;
  planoId: string;
  idCenario: string;
  estado: EstadoRun;
  enfileiradoEm: string;
  iniciadoEm?: string;
  terminouEm?: string;
  duracaoMs?: number;
  /** .docx de evidência, relativo à raiz do projeto de testes. */
  evidencia?: string;
  anexos: string[];
  observacao?: string;
}

export type EventoLog = { tipo: 'linha'; texto: string } | { tipo: 'fim'; estado: EstadoRun };
export type Spawn = (comando: string, opcoes: { cwd: string }) => ChildProcess;

export interface ChecagemAmbiente {
  chave: string;
  titulo: string;
  ok: boolean;
  detalhe: string;
}

export interface Executor {
  /** Põe o teste na fila (ou já roda, se nada estiver rodando). Recusa o que não pode rodar. */
  iniciar(planoId: string, idCenario: string): Promise<Run>;
  /** Stop: mata o processo se está rodando; se está na fila, tira da fila. */
  parar(runId: string): Run;
  /** "Reexecutar falhos": um por vez, pela fila. */
  reexecutarFalhos(planoId: string, funcionalidade?: string): Promise<{ execucoes: Run[]; ignorados: { idCenario: string; motivo: string }[] }>;
  listar(): Run[];
  obter(runId: string): Run;
  /** Recebe o log desde o começo e depois ao vivo; devolve o cancelamento da assinatura. */
  assinar(runId: string, ouvinte: (evento: EventoLog) => void): () => void;
  /** O texto completo do log (o que ainda está em memória). */
  logCompleto(runId: string): string;
  verificarAmbiente(): Promise<ChecagemAmbiente[]>;
}

export interface DepsExecutor {
  /** Raiz do projeto de testes (onde estão `package.json`, `output/` e `evidences/`). */
  raiz: string;
  /** Pasta dos arquivos de log (`dados/execucoes`). */
  dirLogs: string;
  planos: RepoPlanos;
  spawn?: Spawn;
  matar?: (processo: ChildProcess) => void;
  agora?: () => Date;
  lerResultado?: (raiz: string, idCenario: string, desdeMs: number) => Promise<ResultadoDoRun | null>;
  comandos?: (idCenario: string) => Comandos;
  /** Endereços do app testado, para "Verificar ambiente". */
  urlsApp?: string[];
  fetch?: typeof fetch;
}

const LINHAS_MAX = 5_000;
const RUNS_MAX = 50;
const OBS_MAX = 1_000;

const emAberto = (r: Run) => r.estado === 'na_fila' || r.estado === 'rodando';
const hojeLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const mensagemDe = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Acrescenta uma linha às observações do teste sem estourar o limite (fica o final, que é o mais novo). */
function acrescentar(atual: string | undefined, linha: string): string {
  const junto = atual ? `${atual}\n${linha}` : linha;
  return junto.length > OBS_MAX ? junto.slice(-OBS_MAX) : junto;
}

/** Mata o processo e os filhos dele (o navegador do teste); no Windows o `kill` simples deixaria tudo aberto. */
export function matarArvore(processo: ChildProcess): void {
  if (process.platform === 'win32' && processo.pid) {
    spawnReal('taskkill', ['/pid', String(processo.pid), '/T', '/F'], { stdio: 'ignore' });
  } else processo.kill('SIGTERM');
}

export function criarExecutor(deps: DepsExecutor): Executor {
  const agora = deps.agora ?? (() => new Date());
  const iniciarProcesso: Spawn = deps.spawn ?? ((comando, { cwd }) => spawnReal(comando, { cwd, shell: true, windowsHide: false }));
  const matar = deps.matar ?? matarArvore;
  const lerDoAllure = deps.lerResultado ?? lerResultado;
  const comandos = deps.comandos ?? ((id: string) => comandosDe(id));
  const chamar = deps.fetch ?? fetch;
  const urlsApp = deps.urlsApp ?? ['http://127.0.0.1:3000', 'http://127.0.0.1:3001'];

  const runs = new Map<string, Run>();
  const logs = new Map<string, string[]>();
  const ouvintes = new Map<string, Set<(e: EventoLog) => void>>();
  const arquivos = new Map<string, WriteStream>();
  const fila: string[] = [];
  let atual: { runId: string; parar: boolean; processo?: ChildProcess } | null = null;

  const achar = (runId: string): Run => {
    const run = runs.get(runId);
    if (!run) throw new ErroNegocio('nao_encontrado', `Execução ${runId} não encontrada.`);
    return run;
  };

  function emitir(runId: string, evento: EventoLog): void {
    for (const ouvinte of ouvintes.get(runId) ?? []) ouvinte(evento);
  }

  function linha(run: Run, texto: string): void {
    const lista = logs.get(run.runId) ?? [];
    lista.push(texto);
    if (lista.length > LINHAS_MAX) lista.shift();
    logs.set(run.runId, lista);
    arquivos.get(run.runId)?.write(`${texto}\n`);
    emitir(run.runId, { tipo: 'linha', texto });
  }

  function podar(): void {
    const encerradas = [...runs.values()].filter((r) => !emAberto(r));
    for (const velha of encerradas.slice(0, Math.max(0, encerradas.length - RUNS_MAX))) {
      runs.delete(velha.runId);
      logs.delete(velha.runId);
      ouvintes.delete(velha.runId);
    }
  }

  function terminar(run: Run, estado: EstadoRun, observacao?: string): void {
    run.estado = estado;
    run.terminouEm = agora().toISOString();
    if (run.iniciadoEm) run.duracaoMs = Date.parse(run.terminouEm) - Date.parse(run.iniciadoEm);
    if (observacao) run.observacao = observacao;
    emitir(run.runId, { tipo: 'fim', estado });
    arquivos.get(run.runId)?.end();
    arquivos.delete(run.runId);
    if (atual?.runId === run.runId) atual = null;
    podar();
    void processar();
  }

  async function atualizarItem(run: Run, campos: (item: ItemVisao) => Parameters<RepoPlanos['alterarItem']>[3]): Promise<void> {
    const detalhe = await deps.planos.obter(run.planoId);
    const item = detalhe.itens.find((i) => i.idCenario === run.idCenario);
    if (!item) throw new ErroNegocio('nao_encontrado', `O teste ${run.idCenario} não está mais no plano.`);
    await deps.planos.alterarItem(run.planoId, run.idCenario, item.versao, campos(item));
  }

  /** O teste voltou para "Refinamento" com a observação do que houve (Stop, queda do processo, falta de resultado). */
  async function interromper(run: Run, motivo: string): Promise<void> {
    linha(run, `■ ${motivo}`);
    try {
      await atualizarItem(run, (item) => ({ status: 'refinamento', observacoes: acrescentar(item.observacoes, motivo) }));
    } catch (e) {
      linha(run, `⚠ Não foi possível atualizar o plano: ${mensagemDe(e)}`);
    }
    terminar(run, 'interrompida', motivo);
  }

  function passo(run: Run, ctx: NonNullable<typeof atual>, comando: string): Promise<number> {
    return new Promise((resolve) => {
      if (ctx.parar) return resolve(-1); // Stop chegou antes de o processo existir
      linha(run, `$ ${comando}`);
      let filho: ChildProcess;
      try {
        filho = iniciarProcesso(comando, { cwd: deps.raiz });
      } catch (e) {
        linha(run, `✖ ${mensagemDe(e)}`);
        resolve(-1);
        return;
      }
      ctx.processo = filho;
      const resto = { out: '', err: '' };
      const receber = (canal: 'out' | 'err') => (pedaco: Buffer | string) => {
        const partes = (resto[canal] + pedaco.toString()).split(/\r?\n/);
        resto[canal] = partes.pop() ?? '';
        for (const l of partes) linha(run, l);
      };
      filho.stdout?.on('data', receber('out'));
      filho.stderr?.on('data', receber('err'));
      let acabou = false;
      const encerrar = (codigo: number) => {
        if (acabou) return;
        acabou = true;
        for (const canal of ['out', 'err'] as const) if (resto[canal]) linha(run, resto[canal]);
        ctx.processo = undefined;
        resolve(codigo);
      };
      filho.on('error', (e) => {
        linha(run, `✖ ${e.message}`);
        encerrar(-1);
      });
      filho.on('close', (codigo) => encerrar(codigo ?? -1));
    });
  }

  async function executar(run: Run): Promise<void> {
    const ctx = { runId: run.runId, parar: false, processo: undefined as ChildProcess | undefined };
    atual = ctx;
    run.estado = 'rodando';
    run.iniciadoEm = agora().toISOString();
    const inicioMs = agora().getTime();
    linha(run, `▶ ${run.idCenario} (plano ${run.planoId})`);

    try {
      await atualizarItem(run, () => ({ status: 'em_andamento' }));
    } catch (e) {
      linha(run, `✖ Não foi possível iniciar: ${mensagemDe(e)}`);
      terminar(run, 'interrompida', `Execução interrompida: ${mensagemDe(e)}`);
      return;
    }

    const cmds = comandos(run.idCenario);
    const codigoGerar = await passo(run, ctx, cmds.gerar);
    if (ctx.parar) return interromper(run, 'Execução interrompida (Stop).');
    if (codigoGerar !== 0) return interromper(run, `Execução interrompida: a geração dos specs falhou (código ${codigoGerar}).`);

    const codigoRodar = await passo(run, ctx, cmds.rodar);
    if (ctx.parar) return interromper(run, 'Execução interrompida (Stop).');

    const res = await lerDoAllure(deps.raiz, run.idCenario, inicioMs);
    if (!res) return interromper(run, `Execução interrompida: o teste não deixou resultado do Allure (código ${codigoRodar}).`);

    run.evidencia = res.evidencia;
    run.anexos = res.anexos;
    const minutos = Math.max(1, Math.round(res.duracaoMs / 60_000));
    const nota = `Execução ${run.runId}: ${res.resultado} em ${Math.round(res.duracaoMs / 1000)} s${res.evidencia ? `. Evidência: ${res.evidencia}` : ''}`;
    try {
      await atualizarItem(run, (item) => ({
        status: 'concluido',
        resultado: res.resultado,
        dataExecucao: hojeLocal(agora()),
        tempoRealMin: minutos,
        observacoes: acrescentar(item.observacoes, nota),
      }));
    } catch (e) {
      linha(run, `⚠ O resultado não foi gravado no plano: ${mensagemDe(e)}`);
      run.observacao = `Resultado não gravado no plano: ${mensagemDe(e)}`;
    }
    linha(run, `${res.resultado === 'passou' ? '✔' : '✖'} ${run.idCenario} ${res.resultado}${res.evidencia ? ` — ${res.evidencia}` : ''}`);
    terminar(run, res.resultado);
  }

  async function processar(): Promise<void> {
    if (atual) return;
    const proximo = fila.shift();
    if (!proximo) return;
    const run = runs.get(proximo);
    if (!run || run.estado !== 'na_fila') return void processar();
    try {
      mkdirSync(deps.dirLogs, { recursive: true });
      arquivos.set(run.runId, createWriteStream(join(deps.dirLogs, `${run.runId}.log`), { flags: 'a' }));
    } catch {
      // sem pasta de log o run segue só com o log em memória
    }
    await executar(run);
  }

  return {
    async iniciar(planoId, idCenario) {
      const detalhe = await deps.planos.obter(planoId);
      const item = detalhe.itens.find((i) => i.idCenario === idCenario);
      if (!item) throw new ErroNegocio('nao_encontrado', `O teste ${idCenario} não está no plano ${detalhe.plano.nome}.`);
      if ([...runs.values()].some((r) => emAberto(r) && r.planoId === planoId && r.idCenario === idCenario)) {
        throw new ErroNegocio('execucao_em_andamento', `${idCenario} já está rodando ou na fila.`);
      }
      // Só roda se quem ele espera já passou — ou se esse alguém está na fila na frente dele.
      const naFrente = (dep: string) => [...runs.values()].some((r) => emAberto(r) && r.planoId === planoId && r.idCenario === dep);
      const esperando = item.bloqueadoPor.filter((dep) => !naFrente(dep));
      if (esperando.length > 0) throw new ErroNegocio('dependencia_pendente', mensagemDependencia(idCenario, esperando));

      const run: Run = {
        runId: `ex_${randomBytes(4).toString('hex')}`,
        planoId,
        idCenario,
        estado: 'na_fila',
        enfileiradoEm: agora().toISOString(),
        anexos: [],
      };
      runs.set(run.runId, run);
      logs.set(run.runId, []);
      fila.push(run.runId);
      if (atual) linha(run, `⏳ Na fila: ${atual.runId} está rodando.`);
      void processar();
      return run;
    },

    parar(runId) {
      const run = achar(runId);
      if (run.estado === 'na_fila') {
        fila.splice(fila.indexOf(runId), 1);
        linha(run, '■ Tirado da fila.');
        terminar(run, 'cancelada', 'Tirado da fila.');
      } else if (run.estado === 'rodando' && atual?.runId === runId) {
        atual.parar = true;
        linha(run, '■ Stop pedido: encerrando o processo…');
        if (atual.processo) matar(atual.processo);
      }
      return run;
    },

    async reexecutarFalhos(planoId, funcionalidade) {
      const detalhe = await deps.planos.obter(planoId);
      const alvo = detalhe.itens.filter((i) => i.resultado === 'falhou' && (!funcionalidade || i.funcionalidade === funcionalidade));
      const execucoes: Run[] = [];
      const ignorados: { idCenario: string; motivo: string }[] = [];
      for (const item of alvo) {
        try {
          execucoes.push(await this.iniciar(planoId, item.idCenario));
        } catch (e) {
          ignorados.push({ idCenario: item.idCenario, motivo: mensagemDe(e) });
        }
      }
      return { execucoes, ignorados };
    },

    listar: () => [...runs.values()].sort((a, b) => b.enfileiradoEm.localeCompare(a.enfileiradoEm)),

    obter: achar,

    assinar(runId, ouvinte) {
      const run = achar(runId);
      for (const texto of logs.get(runId) ?? []) ouvinte({ tipo: 'linha', texto });
      if (!emAberto(run)) {
        ouvinte({ tipo: 'fim', estado: run.estado });
        return () => undefined;
      }
      const conjunto = ouvintes.get(runId) ?? new Set();
      conjunto.add(ouvinte);
      ouvintes.set(runId, conjunto);
      return () => void conjunto.delete(ouvinte);
    },

    logCompleto: (runId) => (logs.get(achar(runId).runId) ?? []).join('\n'),

    async verificarAmbiente() {
      const checagens: ChecagemAmbiente[] = [];
      const ver = async (chave: string, titulo: string, teste: () => Promise<string>) => {
        try {
          checagens.push({ chave, titulo, ok: true, detalhe: await teste() });
        } catch (e) {
          checagens.push({ chave, titulo, ok: false, detalhe: mensagemDe(e) });
        }
      };
      await ver('raiz', 'Projeto de testes encontrado', async () => {
        if (!(await stat(deps.raiz)).isDirectory()) throw new Error('não é uma pasta');
        return deps.raiz;
      });
      await ver('playwright', 'Playwright instalado', async () => {
        await access(join(deps.raiz, 'node_modules', '@playwright', 'test', 'package.json'));
        return 'node_modules/@playwright/test';
      });
      await ver('scripts', 'Script bdd:gen no package.json', async () => {
        const pacote = JSON.parse(await readFile(join(deps.raiz, 'package.json'), 'utf8')) as { scripts?: Record<string, string> };
        if (!pacote.scripts?.['bdd:gen']) throw new Error('o package.json não tem o script bdd:gen');
        return pacote.scripts['bdd:gen'];
      });
      await ver('planilha', 'Planilha de massa legível', async () => {
        await access(join(deps.raiz, 'data', 'MassaDados.xlsx')); // só confere que existe; a ferramenta não lê nem grava a planilha
        return 'data/MassaDados.xlsx';
      });
      await ver('livre', 'Nenhuma execução em andamento', async () => {
        if (atual) throw new Error(`${atual.runId} está rodando`);
        return 'livre';
      });
      for (const url of urlsApp) {
        await ver(`app:${url}`, `FintechBankApp respondendo (${url.replace(/^https?:\/\//, '')})`, async () => {
          const r = await chamar(url, { signal: AbortSignal.timeout(2_000) });
          return `HTTP ${r.status}`;
        });
      }
      return checagens;
    },
  };
}
