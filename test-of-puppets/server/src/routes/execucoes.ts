import { basename, join } from 'node:path';
import { Router } from 'express';
import type { Executor } from '../runner/executor.ts';
import { FORMATO_ID } from '../runner/comando.ts';

const corpoDe = (req: { body?: unknown }): Record<string, unknown> =>
  typeof req.body === 'object' && req.body !== null ? (req.body as Record<string, unknown>) : {};

/**
 * /api/execucoes — Play/Stop dos testes. O processo vive no servidor: a tela só pede e acompanha.
 * `raiz` é a pasta do projeto de testes, de onde saem evidências e anexos do Allure.
 */
export function rotasExecucoes(executor: Executor, raiz: string): Router {
  const rotas = Router();

  rotas.get('/', (_req, res) => {
    res.json({ execucoes: executor.listar() });
  });

  rotas.post('/', async (req, res) => {
    const { planoId, idCenario } = corpoDe(req);
    if (typeof planoId !== 'string' || !planoId || typeof idCenario !== 'string' || !FORMATO_ID.test(idCenario)) {
      res.status(400).json({ erro: 'validacao', mensagens: ['Informe o plano (planoId) e o teste (idCenario, ex.: CT03.2).'] });
      return;
    }
    res.status(202).json({ execucao: await executor.iniciar(planoId, idCenario) });
  });

  rotas.post('/falhos', async (req, res) => {
    const { planoId, funcionalidade } = corpoDe(req);
    if (typeof planoId !== 'string' || !planoId || (funcionalidade !== undefined && typeof funcionalidade !== 'string')) {
      res.status(400).json({ erro: 'validacao', mensagens: ['Informe o plano (planoId) e, se quiser, a funcionalidade.'] });
      return;
    }
    res.status(202).json(await executor.reexecutarFalhos(planoId, funcionalidade));
  });

  rotas.get('/ambiente', async (_req, res) => {
    const checagens = await executor.verificarAmbiente();
    res.json({ checagens, ok: checagens.every((c) => c.ok) });
  });

  rotas.get('/:runId', (req, res) => {
    res.json({ execucao: executor.obter(req.params.runId) });
  });

  rotas.get('/:runId/log.txt', (req, res) => {
    res.type('text/plain; charset=utf-8').send(executor.logCompleto(req.params.runId));
  });

  /** Log ao vivo (SSE): reenvia o que já saiu e segue com as linhas novas até o fim da execução. */
  rotas.get('/:runId/log', (req, res) => {
    executor.obter(req.params.runId);
    res.set({ 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.flushHeaders();
    let cancelar = () => {};
    cancelar = executor.assinar(req.params.runId, (evento) => {
      res.write(`event: ${evento.tipo}\ndata: ${JSON.stringify(evento)}\n\n`);
      if (evento.tipo === 'fim') {
        cancelar(); // pode rodar já na assinatura (execução encerrada): por isso o `let` acima
        res.end();
      }
    });
    req.on('close', () => cancelar());
  });

  rotas.post('/:runId/parar', (req, res) => {
    res.json({ execucao: executor.parar(req.params.runId) });
  });

  /** Evidência (.docx) e anexos do Allure da execução. Só serve o que o próprio run registrou. */
  rotas.get('/:runId/arquivo', (req, res) => {
    const run = executor.obter(req.params.runId);
    const caminho = typeof req.query.caminho === 'string' ? req.query.caminho : '';
    const permitidos = [run.evidencia, ...run.anexos].filter((c): c is string => Boolean(c));
    if (!caminho || !permitidos.includes(caminho)) {
      res.status(404).json({ erro: 'nao_encontrado', mensagem: 'Arquivo não registrado nesta execução.' });
      return;
    }
    res.download(join(raiz, caminho), basename(caminho));
  });

  return rotas;
}
