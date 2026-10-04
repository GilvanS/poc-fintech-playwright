import { Router } from 'express';
import { validarPessoa } from '../pessoas/modelo.ts';
import type { RepoPessoas } from '../pessoas/repo.ts';

/** /api/pessoas — cadastro da Equipe. Os erros de negócio sobem para o tratador do app. */
export function rotasPessoas(repo: RepoPessoas): Router {
  const rotas = Router();

  rotas.get('/', async (_req, res) => {
    res.json({ pessoas: await repo.listar() });
  });

  rotas.post('/', async (req, res) => {
    const validado = validarPessoa(req.body);
    if (!validado.ok) {
      res.status(400).json({ erro: 'validacao', mensagens: validado.mensagens });
      return;
    }
    res.status(201).json(await repo.criar(validado.valor));
  });

  rotas.put('/:id', async (req, res) => {
    const corpo: unknown = req.body;
    const versao = typeof corpo === 'object' && corpo !== null ? (corpo as Record<string, unknown>).versao : undefined;
    const validado = validarPessoa(corpo);
    const versaoOk = typeof versao === 'number' && Number.isInteger(versao) && versao >= 1;
    if (!validado.ok || !versaoOk) {
      const mensagens = validado.ok ? [] : validado.mensagens;
      if (!versaoOk) mensagens.push('Versão deve ser um número inteiro (a que você viu ao abrir o cadastro).');
      res.status(400).json({ erro: 'validacao', mensagens });
      return;
    }
    res.json(await repo.atualizar(String(req.params.id), validado.valor, versao));
  });

  rotas.delete('/:id', async (req, res) => {
    await repo.excluir(String(req.params.id));
    res.status(204).end();
  });

  return rotas;
}
