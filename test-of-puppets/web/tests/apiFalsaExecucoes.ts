import type { ChecagemAmbiente, Run } from '../src/execucao/clienteExecucoes';
import { json, type Rota } from './apiFalsaBase';

/** Rotas /api/execucoes do servidor falso: Play cria uma execução "rodando", Stop a interrompe; nada roda de verdade. */
export function criarRotaExecucoes(inicial: Run[], ambiente: ChecagemAmbiente[] = []) {
  const runs = structuredClone(inicial);
  let n = 1;
  return ({ partes, metodo, corpo }: Rota): Response => {
    if (partes[2] === 'ambiente') return json(200, { checagens: ambiente, ok: ambiente.every((c) => c.ok) });
    if (partes[2] === 'falhos' && metodo === 'POST') return json(202, { execucoes: [], ignorados: [] });
    if (!partes[2]) {
      if (metodo === 'POST') {
        const run: Run = {
          runId: `ex_falso${n++}`,
          planoId: String(corpo?.planoId ?? ''),
          idCenario: String(corpo?.idCenario ?? ''),
          estado: 'rodando',
          enfileiradoEm: '2026-10-04T10:00:00.000Z',
          anexos: [],
        };
        runs.unshift(run);
        return json(202, { execucao: run });
      }
      return json(200, { execucoes: runs });
    }
    const run = runs.find((r) => r.runId === partes[2]);
    if (!run) return json(404, { erro: 'nao_encontrado', mensagem: 'Execução não encontrada.' });
    if (partes[3] === 'parar') run.estado = 'interrompida';
    if (partes[3] === 'log.txt') return new Response('$ gerar\nlinha de log', { status: 200 });
    return json(200, { execucao: run });
  };
}
