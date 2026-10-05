import { join, resolve } from 'node:path';
import express, { type ErrorRequestHandler, type Express } from 'express';
import { criarExecutor, type Executor } from './runner/executor.ts';
import { rotasExecucoes } from './routes/execucoes.ts';
import { criarFonteApp } from './massa/fonteApp.ts';
import { criarServicoMassa, planilhaPadrao, type ServicoMassa } from './massa/servico.ts';
import { rotasMassa } from './routes/massa.ts';
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
  /** Projeto de testes (onde rodam os comandos). Padrão: `PUPPETS_RAIZ` ou a pasta acima de `dados/`. */
  raiz?: string;
  /** Troca o executor real (os testes injetam um com processo falso). */
  executor?: Executor;
  /** Troca o serviço de atualizar a massa (os testes usam uma cópia temporária da planilha e uma fonte falsa). */
  servicoMassa?: ServicoMassa;
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

/** Endereços que "Verificar ambiente" confere; `PUPPETS_URLS_APP` (separados por vírgula) troca o padrão (3000 e 3001). */
const urlsDoApp = () => process.env.PUPPETS_URLS_APP?.split(',').map((u) => u.trim()).filter(Boolean);

/**
 * Monta o app Express da ferramenta. Fica separado de `index.ts` para os testes
 * subirem o servidor numa porta aleatória, sem depender de porta fixa.
 */
export function createApp({ dirDados = DADOS_PADRAO, modoTeste = false, raiz, executor, servicoMassa }: OpcoesApp = {}): Express {
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
  const raizTestes = raiz ?? (process.env.PUPPETS_RAIZ ? resolve(process.env.PUPPETS_RAIZ) : resolve(DADOS_PADRAO, '..', '..'));
  app.use(
    '/api/execucoes',
    rotasExecucoes(executor ?? criarExecutor({ raiz: raizTestes, dirLogs: join(dirDados, 'execucoes'), planos: repos.planos, urlsApp: urlsDoApp() }), raizTestes),
  );
  app.use(
    '/api/massa',
    rotasMassa(servicoMassa ?? criarServicoMassa({ planilha: planilhaPadrao(raizTestes), dirBackups: join(dirDados, 'backups'), fonte: criarFonteApp() })),
  );
  app.use('/api/semente', rotasSemente(repos));
  if (modoTeste) app.use('/api/teste', rotasTeste(dirDados, repos));

  app.use((_req, res) => {
    res.status(404).json({ erro: 'nao_encontrado' });
  });
  app.use(tratarErros);

  return app;
}
