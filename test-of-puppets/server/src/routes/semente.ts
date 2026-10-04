import { Router } from 'express';
import type { Repos } from '../repos.ts';
import { semear } from '../semente/semente.ts';

/** POST /api/semente — carrega os dados de exemplo (só com tudo vazio; senão 409 ja_tem_dados). */
export function rotasSemente(repos: Repos): Router {
  const rotas = Router();

  rotas.post('/', async (_req, res) => {
    res.status(201).json(await semear(repos));
  });

  return rotas;
}
