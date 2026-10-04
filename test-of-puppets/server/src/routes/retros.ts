import { Router, type Response } from 'express';
import { validarEdicaoAcao, validarEstado, validarNota, validarNovaAcao, validarVoto } from '../retros/modelo.ts';
import type { RepoRetros } from '../retros/repo.ts';

const recusar = (res: Response, mensagens: string[]): void => {
  res.status(400).json({ erro: 'validacao', mensagens });
};

/** /api/retros — a retrospectiva de cada plano (notas, votos, ações). Sempre devolve a retro inteira. */
export function rotasRetros(repo: RepoRetros): Router {
  const rotas = Router();
  const planoDe = (valor: unknown) => String(valor);

  rotas.get('/', async (_req, res) => {
    res.json({ retros: await repo.listar() });
  });

  rotas.get('/:planoId', async (req, res) => {
    res.json(await repo.obter(planoDe(req.params.planoId)));
  });

  rotas.put('/:planoId', async (req, res) => {
    const validado = validarEstado(req.body);
    if (!validado.ok) return recusar(res, validado.mensagens);
    res.json(await repo.mudarEstado(planoDe(req.params.planoId), validado.valor));
  });

  rotas.post('/:planoId/notas', async (req, res) => {
    const validado = validarNota(req.body);
    if (!validado.ok) return recusar(res, validado.mensagens);
    res.status(201).json(await repo.adicionarNota(planoDe(req.params.planoId), validado.valor));
  });

  rotas.delete('/:planoId/notas/:id', async (req, res) => {
    res.json(await repo.excluirNota(planoDe(req.params.planoId), String(req.params.id)));
  });

  rotas.post('/:planoId/notas/:id/votos', async (req, res) => {
    const validado = validarVoto(req.body);
    if (!validado.ok) return recusar(res, validado.mensagens);
    res.json(await repo.votar(planoDe(req.params.planoId), String(req.params.id), validado.valor.pessoa));
  });

  rotas.post('/:planoId/acoes', async (req, res) => {
    const validado = validarNovaAcao(req.body);
    if (!validado.ok) return recusar(res, validado.mensagens);
    res.status(201).json(await repo.adicionarAcao(planoDe(req.params.planoId), validado.valor));
  });

  rotas.patch('/:planoId/acoes/:id', async (req, res) => {
    const validado = validarEdicaoAcao(req.body);
    if (!validado.ok) return recusar(res, validado.mensagens);
    res.json(await repo.editarAcao(planoDe(req.params.planoId), String(req.params.id), validado.valor));
  });

  rotas.delete('/:planoId/acoes/:id', async (req, res) => {
    res.json(await repo.excluirAcao(planoDe(req.params.planoId), String(req.params.id)));
  });

  return rotas;
}
