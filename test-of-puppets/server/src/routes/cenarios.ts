import { Router } from 'express';
import { analisarCsv, gerarCsv, type LinhaAnalisada } from '../cenarios/csv.ts';
import { LIMITES } from '../cenarios/limites.ts';
import { validarEntrada, type CenarioEntrada } from '../cenarios/modelo.ts';
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

  /** Baixa todos os cenários no formato do CSV de controle (o mesmo que a importação aceita de volta). */
  rotas.get('/exportar.csv', async (_req, res) => {
    res.type('text/csv; charset=utf-8').attachment('cenarios.csv').send(gerarCsv(await repo.listar()));
  });

  /**
   * Importação em duas etapas, as duas conferindo cada linha pelas regras do cadastro:
   * `modo: 'previa'` só analisa; `'ignorar'`/`'atualizar'` grava (linhas com erro ficam de fora e voltam listadas).
   */
  rotas.post('/importar', async (req, res) => {
    const corpo = (typeof req.body === 'object' && req.body !== null ? req.body : {}) as { csv?: unknown; modo?: unknown };
    if (typeof corpo.csv !== 'string' || corpo.csv.trim() === '') throw new ErroNegocio('csv_invalido', 'Envie o conteúdo do CSV no campo "csv".');
    const modo = corpo.modo ?? 'previa';
    if (modo !== 'previa' && modo !== 'ignorar' && modo !== 'atualizar') {
      throw new ErroNegocio('csv_invalido', 'Modo deve ser "previa", "ignorar" ou "atualizar".');
    }
    if (Buffer.byteLength(corpo.csv, 'utf8') > LIMITES.maxBytesCsv) {
      throw new ErroNegocio('csv_invalido', `O arquivo passa de ${Math.round(LIMITES.maxBytesCsv / 1024 / 1024)} MB, o máximo por importação.`);
    }

    const existentes = new Map<string, CenarioEntrada>((await repo.listar()).map((c) => [c.idCenario, c]));
    const { linhas, colunasIgnoradas } = analisarCsv(corpo.csv, existentes);
    const contar = (s: LinhaAnalisada['situacao']) => linhas.filter((l) => l.situacao === s).length;
    const resumo = { total: linhas.length, novos: contar('novo'), existentes: contar('existente'), iguais: contar('igual'), comErro: contar('erro') };
    const problemas = linhas.filter((l) => l.situacao === 'erro').map(({ linha, idCenario, mensagens }) => ({ linha, idCenario, mensagens }));

    if (modo === 'previa') {
      res.json({ resumo, problemas, colunasIgnoradas, armazenamento: await repo.armazenamento() });
      return;
    }
    const entradas = linhas.filter((l) => l.entrada && (l.situacao === 'novo' || l.situacao === 'existente')).map((l) => l.entrada!);
    const resultado = await repo.importar(entradas, modo);
    res.json({ ...resultado, resumo, problemas, colunasIgnoradas, armazenamento: await repo.armazenamento() });
  });

  rotas.get('/:id/planos', async (req, res) => {
    const id = String(req.params.id);
    if (!(await repo.listar()).some((c) => c.idCenario === id)) throw new ErroNegocio('nao_encontrado', `Cenário ${id} não encontrado.`);
    res.json({ planos: await historico(id) });
  });

  rotas.get('/', async (_req, res) => {
    const cenarios = await repo.listar();
    const funcionalidades = [...new Set(cenarios.map((c) => c.funcionalidade))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    const projetos = [...new Set(cenarios.map((c) => c.projeto).filter((p): p is string => !!p))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    res.json({ cenarios, funcionalidades, projetos, armazenamento: await repo.armazenamento() });
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
