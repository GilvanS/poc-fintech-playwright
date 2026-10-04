import { Router } from 'express';
import { validarEntrada } from '../cenarios/modelo.ts';
import type { RepoCenarios } from '../cenarios/repo.ts';
import { ErroNegocio } from '../erros.ts';

function recusar(mensagens: string[]) {
  return { erro: 'validacao', mensagens };
}

/** /api/cenarios — cadastro de cenários (modal M16). Os erros de negócio sobem para o tratador do app. */
export function rotasCenarios(
  repo: RepoCenarios,
  planosQueUsam: (idCenario: string) => Promise<string[]> = async () => [],
  historico: (idCenario: string) => Promise<unknown[]> = async () => [],
): Router {
  const rotas = Router();

  rotas.get('/:id/planos', async (req, res) => {
    const id = String(req.params.id);
    if (!(await repo.listar()).some((c) => c.idCenario === id)) throw new ErroNegocio('nao_encontrado', `Cenário ${id} não encontrado.`);
    res.json({ planos: await historico(id) });
  });

  rotas.get('/', async (_req, res) => {
    const cenarios = await repo.listar();
    const funcionalidades = [...new Set(cenarios.map((c) => c.funcionalidade))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    res.json({ cenarios, funcionalidades });
  });

  rotas.post('/', async (req, res) => {
    const validado = validarEntrada(req.body);
    if (!validado.ok) {
      res.status(400).json(recusar(validado.mensagens));
      return;
    }
    res.status(201).json(await repo.criar(validado.valor));
  });

  rotas.put('/:id', async (req, res) => {
    const id = String(req.params.id);
    const corpo: unknown = req.body;
    const objeto = typeof corpo === 'object' && corpo !== null && !Array.isArray(corpo) ? (corpo as Record<string, unknown>) : undefined;

    // O ID vem da URL e não muda; o que veio no corpo é ignorado.
    const validado = validarEntrada(objeto ? { ...objeto, idCenario: id } : corpo);
    const versao = objeto?.versao;
    const versaoOk = typeof versao === 'number' && Number.isInteger(versao) && versao >= 1;

    if (!validado.ok || !versaoOk) {
      const mensagens = validado.ok ? [] : validado.mensagens;
      if (!versaoOk) mensagens.push('Versão deve ser um número inteiro (a que você viu ao abrir o cadastro).');
      res.status(400).json(recusar(mensagens));
      return;
    }
    res.json(await repo.atualizar(id, validado.valor, versao));
  });

  rotas.delete('/:id', async (req, res) => {
    const id = String(req.params.id);
    const nomes = [...new Set(await planosQueUsam(id))];
    if (nomes.length > 0) {
      throw new ErroNegocio('cenario_em_uso', `O cenário ${id} está nos planos: ${nomes.join(', ')}. Tire-o dos planos antes de excluir.`);
    }
    await repo.excluir(id);
    res.status(204).end();
  });

  return rotas;
}
