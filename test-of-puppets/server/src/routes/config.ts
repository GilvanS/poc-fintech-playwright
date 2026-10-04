import { Router } from 'express';
import { validarWip } from '../config/modelo.ts';
import type { RepoConfig } from '../config/repo.ts';

/** /api/config — limites de WIP do Kanban, valem para todos os planos. */
export function rotasConfig(repo: RepoConfig): Router {
  const rotas = Router();

  rotas.get('/', async (_req, res) => {
    res.json(await repo.obter());
  });

  rotas.put('/', async (req, res) => {
    const validado = validarWip(req.body);
    if (!validado.ok) {
      res.status(400).json({ erro: 'validacao', mensagens: validado.mensagens });
      return;
    }
    res.json(await repo.salvarWip(validado.valor));
  });

  return rotas;
}
