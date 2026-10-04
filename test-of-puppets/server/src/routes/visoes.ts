import { Router } from 'express';
import { validarVisao, visiveisPara } from '../visoes/modelo.ts';
import type { RepoVisoes } from '../visoes/repo.ts';

/** `?voce=ana` vem do seletor "Você" da tela; sem ele, vale "ninguém escolhido". */
function quemPediu(consulta: unknown): string | null {
  return typeof consulta === 'string' && consulta.trim() ? consulta.trim() : null;
}

/** /api/visoes — visões salvas (menu "Minhas visões"). Os erros de negócio sobem para o tratador do app. */
export function rotasVisoes(repo: RepoVisoes): Router {
  const rotas = Router();

  rotas.get('/', async (req, res) => {
    res.json({ visoes: visiveisPara(await repo.listar(), quemPediu(req.query.voce)) });
  });

  rotas.post('/', async (req, res) => {
    const validado = validarVisao(req.body);
    if (!validado.ok) {
      res.status(400).json({ erro: 'validacao', mensagens: validado.mensagens });
      return;
    }
    res.status(201).json(await repo.criar(validado.valor));
  });

  rotas.delete('/:id', async (req, res) => {
    await repo.excluir(String(req.params.id), quemPediu(req.query.voce));
    res.status(204).end();
  });

  return rotas;
}
