import { Router } from 'express';
import type { RepoPlanos } from '../planos/repo.ts';
import {
  validarDecisao,
  validarEdicaoPlano,
  validarIdCenarios,
  validarLote,
  validarNovoPlano,
  validarOrdem,
  validarPatchItem,
} from '../planos/modelo.ts';

function recusar(mensagens: string[]) {
  return { erro: 'validacao', mensagens };
}

/** /api/planos — planos, testes do plano e alteração de cada teste. Erros de negócio sobem para o tratador do app. */
export function rotasPlanos(repo: RepoPlanos): Router {
  const rotas = Router();

  rotas.get('/', async (req, res) => {
    const { aba, ordem } = req.query;
    const mensagens: string[] = [];
    if (aba !== undefined && aba !== 'em_execucao' && aba !== 'executados') mensagens.push('aba deve ser em_execucao ou executados.');
    if (ordem !== undefined && ordem !== 'asc' && ordem !== 'desc') mensagens.push('ordem deve ser asc ou desc.');
    if (mensagens.length > 0) {
      res.status(400).json(recusar(mensagens));
      return;
    }
    res.json({ planos: await repo.listar(aba as 'em_execucao' | 'executados' | undefined, ordem as 'asc' | 'desc' | undefined) });
  });

  rotas.post('/', async (req, res) => {
    const validado = validarNovoPlano(req.body);
    if (!validado.ok) {
      res.status(400).json(recusar(validado.mensagens));
      return;
    }
    res.status(201).json(await repo.criar(validado.valor));
  });

  rotas.get('/:id', async (req, res) => {
    res.json(await repo.obter(String(req.params.id)));
  });

  rotas.patch('/:id', async (req, res) => {
    const validado = validarEdicaoPlano(req.body);
    if (!validado.ok) {
      res.status(400).json(recusar(validado.mensagens));
      return;
    }
    res.json(await repo.editar(String(req.params.id), validado.valor.versao, validado.valor.campos));
  });

  rotas.delete('/:id', async (req, res) => {
    await repo.excluir(String(req.params.id));
    res.status(204).end();
  });

  rotas.post('/:id/testes', async (req, res) => {
    const validado = validarIdCenarios(req.body);
    if (!validado.ok) {
      res.status(400).json(recusar(validado.mensagens));
      return;
    }
    res.json(await repo.incluirTestes(String(req.params.id), validado.valor.idCenarios, validado.valor.dataPlanejada));
  });

  rotas.patch('/:id/testes', async (req, res) => {
    const validado = validarLote(req.body);
    if (!validado.ok) {
      res.status(400).json(recusar(validado.mensagens));
      return;
    }
    res.json(await repo.alterarLote(String(req.params.id), validado.valor.idCenarios, validado.valor.campos));
  });

  rotas.put('/:id/ordem', async (req, res) => {
    const validado = validarOrdem(req.body);
    if (!validado.ok) {
      res.status(400).json(recusar(validado.mensagens));
      return;
    }
    res.json(await repo.reordenar(String(req.params.id), validado.valor.ordem));
  });

  rotas.post('/:id/decisoes', async (req, res) => {
    const validado = validarDecisao(req.body);
    if (!validado.ok) {
      res.status(400).json(recusar(validado.mensagens));
      return;
    }
    res.status(201).json(await repo.registrarDecisao(String(req.params.id), validado.valor));
  });

  rotas.delete('/:id/testes/:cenario', async (req, res) => {
    await repo.removerTeste(String(req.params.id), String(req.params.cenario));
    res.status(204).end();
  });

  rotas.patch('/:id/testes/:cenario', async (req, res) => {
    const validado = validarPatchItem(req.body);
    if (!validado.ok) {
      res.status(400).json(recusar(validado.mensagens));
      return;
    }
    res.json(await repo.alterarItem(String(req.params.id), String(req.params.cenario), validado.valor.versao, validado.valor.campos));
  });

  return rotas;
}
