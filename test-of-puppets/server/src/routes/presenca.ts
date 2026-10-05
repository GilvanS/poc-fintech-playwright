import { Router } from 'express';
import type { Presenca } from '../presenca/presenca.ts';

/** /api/presenca — quem está com a ferramenta aberta (batimento a cada poucos segundos; só na memória). */
export function rotasPresenca(presenca: Presenca): Router {
  const rotas = Router();

  rotas.get('/', (_req, res) => {
    res.json({ online: presenca.online() });
  });

  rotas.post('/', (req, res) => {
    const corpo = (typeof req.body === 'object' && req.body !== null ? req.body : {}) as Record<string, unknown>;
    const pessoa = typeof corpo.pessoa === 'string' ? corpo.pessoa.trim() : '';
    if (!pessoa || pessoa.length > 40) {
      res.status(400).json({ erro: 'validacao', mensagens: ['Informe quem está online (pessoa), com até 40 caracteres.'] });
      return;
    }
    presenca.bater(pessoa);
    res.json({ online: presenca.online() });
  });

  return rotas;
}
