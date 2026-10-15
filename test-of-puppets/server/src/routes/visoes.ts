import { Router } from 'express';
import { validarVisao, visiveisPara } from '../visoes/modelo.ts';
import type { RepoPessoas } from '../pessoas/repo.ts';
import type { RepoVisoes } from '../visoes/repo.ts';

/** `?voce=ana` vem do seletor "Você" da tela; sem ele, vale "ninguém escolhido". */
function quemPediu(consulta: unknown): string | null {
  return typeof consulta === 'string' && consulta.trim() ? consulta.trim() : null;
}

/** /api/visoes — visões salvas (menu "Minhas visões"). Os erros de negócio sobem para o tratador do app. */
export function rotasVisoes(repo: RepoVisoes, pessoas: RepoPessoas): Router {
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
    const quem = quemPediu(req.query.voce);
    // Sem login, "quem" é o que o seletor "Você" mandou. Ninguém escolhido = o dono da máquina, que conta como admin;
    // senão só vale quem está marcado como Admin na Equipe (e ativo).
    const admin = quem === null || (await pessoas.listar()).some((p) => p.id === quem && p.admin && p.ativa);
    await repo.excluir(String(req.params.id), quem, admin);
    res.status(204).end();
  });

  return rotas;
}
