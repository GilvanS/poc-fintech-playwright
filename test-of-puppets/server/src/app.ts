import express, { type ErrorRequestHandler, type Express } from 'express';
import { ErroNegocio, STATUS_POR_ERRO } from './erros.ts';
import { criarRepos, DADOS_PADRAO } from './repos.ts';
import { rotasCenarios } from './routes/cenarios.ts';
import { rotasConfig } from './routes/config.ts';
import { rotasIncidentes } from './routes/incidentes.ts';
import { criarPresenca } from './presenca/presenca.ts';
import { rotasLembretes } from './routes/lembretes.ts';
import { rotasPresenca } from './routes/presenca.ts';
import { rotasRetros } from './routes/retros.ts';
import { rotasPessoas } from './routes/pessoas.ts';
import { rotasPlanos } from './routes/planos.ts';
import { rotasSemente } from './routes/semente.ts';
import { rotasTeste } from './routes/teste.ts';
import { rotasVisoes } from './routes/visoes.ts';

export interface OpcoesApp {
  /** Onde ficam os JSON. Os testes passam uma pasta temporária. */
  dirDados?: string;
  /** Liga a rota de reset usada só pelo E2E (nunca em uso normal). */
  modoTeste?: boolean;
}

const tratarErros: ErrorRequestHandler = (erro, _req, res, _next) => {
  if (erro instanceof ErroNegocio) {
    res.status(STATUS_POR_ERRO[erro.codigo]).json({ erro: erro.codigo, mensagem: erro.message });
    return;
  }
  if ((erro as { type?: string })?.type === 'entity.parse.failed') {
    res.status(400).json({ erro: 'json_invalido', mensagem: 'O corpo da requisição não é um JSON válido.' });
    return;
  }
  console.error('[server] erro inesperado:', erro);
  res.status(500).json({ erro: 'erro_interno', mensagem: 'Erro interno no servidor.' });
};

/**
 * Monta o app Express da ferramenta. Fica separado de `index.ts` para os testes
 * subirem o servidor numa porta aleatória, sem depender de porta fixa.
 */
export function createApp({ dirDados = DADOS_PADRAO, modoTeste = false }: OpcoesApp = {}): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json());

  app.get('/api/saude', (_req, res) => {
    res.json({ ok: true });
  });

  const repos = criarRepos(dirDados);

  app.use('/api/pessoas', rotasPessoas(repos.pessoas));
  app.use(
    '/api/cenarios',
    rotasCenarios(repos.cenarios, (id) => repos.planos.planosQueUsam(id), (id) => repos.planos.historicoDoCenario(id)),
  );
  app.use('/api/planos', rotasPlanos(repos.planos));
  app.use('/api/visoes', rotasVisoes(repos.visoes));
  app.use('/api/config', rotasConfig(repos.config));
  app.use('/api/incidentes', rotasIncidentes(repos.incidentes));
  app.use('/api/retros', rotasRetros(repos.retros));
  app.use('/api/lembretes', rotasLembretes(repos));
  app.use('/api/presenca', rotasPresenca(criarPresenca()));
  app.use('/api/semente', rotasSemente(repos));
  if (modoTeste) app.use('/api/teste', rotasTeste(dirDados, repos));

  app.use((_req, res) => {
    res.status(404).json({ erro: 'nao_encontrado' });
  });
  app.use(tratarErros);

  return app;
}
