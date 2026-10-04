import { Router } from 'express';
import { validarConfig } from '../config/modelo.ts';
import type { RepoConfig } from '../config/repo.ts';

/** /api/config — limites de WIP do Kanban e tipos de lembrete do sino; valem para todos os planos e pessoas. */
export function rotasConfig(repo: RepoConfig): Router {
  const rotas = Router();

  rotas.get('/', async (_req, res) => {
    res.json(await repo.obter());
  });

  rotas.put('/', async (req, res) => {
    const validado = validarConfig(req.body);
    if (!validado.ok) {
      res.status(400).json({ erro: 'validacao', mensagens: validado.mensagens });
      return;
    }
    res.json(await repo.salvar(validado.valor));
  });

  return rotas;
}
