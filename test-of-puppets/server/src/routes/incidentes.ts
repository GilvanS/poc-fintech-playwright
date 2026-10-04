import { Router, type Response } from 'express';
import { autorDe, normalizarNumero, validarComentario, validarEdicaoIncidente, validarNovoIncidente, validarVinculo } from '../incidentes/modelo.ts';
import type { RepoIncidentes } from '../incidentes/repo.ts';

const recusar = (res: Response, mensagens: string[]): void => {
  res.status(400).json({ erro: 'validacao', mensagens });
};

/** /api/incidentes — INC acompanhados aqui (global, ligados a cenários). Os erros de negócio sobem para o tratador do app. */
export function rotasIncidentes(repo: RepoIncidentes): Router {
  const rotas = Router();
  const numeroDe = (valor: unknown) => normalizarNumero(String(valor));

  rotas.get('/', async (_req, res) => {
    res.json({ incidentes: await repo.listar() });
  });

  rotas.post('/', async (req, res) => {
    const validado = validarNovoIncidente(req.body);
    if (!validado.ok) {
      recusar(res, validado.mensagens);
      return;
    }
    // abertoEm e resolvidoEm são só da semente: o corpo da API não escolhe essas datas (o validador nem as lê).
    const { abertoEm: _a, resolvidoEm: _r, ...dados } = validado.valor;
    res.status(201).json(await repo.criar(dados));
  });

  rotas.get('/:numero', async (req, res) => {
    res.json(await repo.obter(numeroDe(req.params.numero)));
  });

  rotas.put('/:numero', async (req, res) => {
    const validado = validarEdicaoIncidente(req.body);
    if (!validado.ok) {
      recusar(res, validado.mensagens);
      return;
    }
    res.json(await repo.editar(numeroDe(req.params.numero), validado.valor.versao, validado.valor.campos, validado.valor.autor));
  });

  rotas.delete('/:numero', async (req, res) => {
    await repo.excluir(numeroDe(req.params.numero));
    res.status(204).end();
  });

  rotas.post('/:numero/vincular', async (req, res) => {
    const validado = validarVinculo(req.body);
    if (!validado.ok) {
      recusar(res, validado.mensagens);
      return;
    }
    res.json(await repo.vincular(numeroDe(req.params.numero), validado.valor.idCenarios, validado.valor.autor));
  });

  rotas.delete('/:numero/vinculo/:cenario', async (req, res) => {
    const autor = autorDe({ autor: req.query.autor });
    res.json(await repo.desvincular(numeroDe(req.params.numero), String(req.params.cenario), autor));
  });

  rotas.post('/:numero/comentarios', async (req, res) => {
    const validado = validarComentario(req.body);
    if (!validado.ok) {
      recusar(res, validado.mensagens);
      return;
    }
    res.status(201).json(await repo.comentar(numeroDe(req.params.numero), validado.valor.texto, validado.valor.autor));
  });

  return rotas;
}
