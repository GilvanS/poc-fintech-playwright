import { rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Router } from 'express';
import { DADOS_PADRAO, type Repos } from '../repos.ts';
import { semear } from '../semente/semente.ts';

const ARQUIVOS = ['cenarios.json', 'pessoas.json', 'planos.json', 'visoes.json', 'config.json', 'incidentes.json', 'retros.json', 'lembretes.json'].flatMap((a) => [a, `${a}.bak`]);

/**
 * /api/teste — só existe com o servidor em modo de teste (E2E). `POST /reset` apaga os dados da pasta
 * temporária do teste e, se pedido, recarrega a semente, para cada teste partir sempre do mesmo estado.
 * Recusa a pasta real `dados/` de qualquer jeito.
 */
export function rotasTeste(dirDados: string, repos: Repos): Router {
  const rotas = Router();

  rotas.post('/reset', async (req, res) => {
    if (resolve(dirDados) === resolve(DADOS_PADRAO)) {
      res.status(403).json({ erro: 'reset_proibido', mensagem: 'O reset não funciona na pasta real de dados.' });
      return;
    }
    for (const arquivo of ARQUIVOS) await rm(join(dirDados, arquivo), { force: true });
    const semente = (req.body as { semente?: unknown } | undefined)?.semente === true;
    if (semente) await semear(repos);
    res.json({ ok: true, semente });
  });

  return rotas;
}
