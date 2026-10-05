import { Router } from 'express';
import type { ServicoMassa } from '../massa/servico.ts';

const corpoDe = (req: { body?: unknown }): Record<string, unknown> =>
  typeof req.body === 'object' && req.body !== null ? (req.body as Record<string, unknown>) : {};

/**
 * /api/massa — atualizar a massa depois do teste, em duas etapas: `proposta` só lê e mostra o diff;
 * `confirmar` é o único que grava, e só o que a proposta mostrou.
 */
export function rotasMassa(servico: ServicoMassa): Router {
  const rotas = Router();

  rotas.post('/proposta', async (req, res) => {
    const { cpf } = corpoDe(req);
    const digitos = typeof cpf === 'string' ? cpf.replace(/\D/g, '') : '';
    if (digitos.length !== 11) {
      res.status(400).json({ erro: 'validacao', mensagens: ['Informe o CPF da massa (11 dígitos).'] });
      return;
    }
    res.json({ proposta: await servico.propor(digitos) });
  });

  rotas.post('/confirmar', async (req, res) => {
    const { propostaId } = corpoDe(req);
    if (typeof propostaId !== 'string' || !propostaId) {
      res.status(400).json({ erro: 'validacao', mensagens: ['Informe a proposta (propostaId) que será gravada.'] });
      return;
    }
    res.json({ resultado: await servico.confirmar(propostaId) });
  });

  return rotas;
}
