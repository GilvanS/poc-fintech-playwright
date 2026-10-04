import type { Incidente } from '../src/incidentes/clienteIncidentes';
import { CRIADO, json, type Rota } from './apiFalsaBase';

/** Rotas /api/incidentes do servidor falso, com os INC em memória. Devolve undefined quando nenhuma rota casa. */
export function criarRotaIncidentes(inicial: Incidente[]) {
  let incidentes = structuredClone(inicial);
  return ({ partes, metodo, corpo }: Rota): Response | undefined => {
    const numero = partes[2]?.toUpperCase();
    if (!numero && metodo === 'GET') return json(200, { incidentes });
    if (!numero && metodo === 'POST') {
      const novoNumero = String(corpo?.numero ?? '').trim().toUpperCase();
      if (!novoNumero || !String(corpo?.titulo ?? '').trim()) return json(400, { erro: 'validacao', mensagens: ['Número e título são obrigatórios.'] });
      if (incidentes.some((i) => i.numero === novoNumero)) return json(409, { erro: 'id_duplicado', mensagem: `Já existe o INC ${novoNumero}.` });
      const criado: Incidente = {
        numero: novoNumero,
        titulo: String(corpo?.titulo).trim(),
        descricao: String(corpo?.descricao ?? ''),
        status: 'novo',
        severidade: (corpo?.severidade as Incidente['severidade'] | undefined) ?? 'media',
        responsavel: (corpo?.responsavel as string | null | undefined) ?? null,
        testesAfetados: (corpo?.testesAfetados as string[] | undefined) ?? [],
        comentarios: [],
        historico: [],
        abertoEm: CRIADO,
        resolvidoEm: null,
        atualizadoEm: CRIADO,
        versao: 1,
      };
      incidentes = [...incidentes, criado];
      return json(201, criado);
    }
    const alvo = incidentes.find((i) => i.numero === numero);
    if (!alvo) return json(404, { erro: 'nao_encontrado', mensagem: `INC ${numero} não encontrado.` });
    if (!partes[3] && metodo === 'PUT') {
      if (corpo?.versao !== alvo.versao) return json(409, { erro: 'versao_antiga', mensagem: `${numero} foi alterado por outra pessoa. Recarregue antes de salvar.` });
      const { versao: _v, autor, ...campos } = (corpo ?? {}) as Record<string, unknown>;
      const novoStatus = campos.status as Incidente['status'] | undefined;
      const atualizado = {
        ...alvo,
        ...campos,
        resolvidoEm: novoStatus === undefined ? alvo.resolvidoEm : novoStatus === 'resolvido' ? CRIADO : null,
        historico: [
          ...alvo.historico,
          ...(novoStatus && novoStatus !== alvo.status ? [{ em: CRIADO, autor: (autor as string | null) ?? null, tipo: 'status' as const, de: alvo.status, para: novoStatus }] : []),
        ],
        versao: alvo.versao + 1,
      } as Incidente;
      incidentes = incidentes.map((i) => (i === alvo ? atualizado : i));
      return json(200, atualizado);
    }
    if (!partes[3] && metodo === 'DELETE') {
      incidentes = incidentes.filter((i) => i !== alvo);
      return json(204, null);
    }
    if (partes[3] === 'comentarios' && metodo === 'POST') {
      const comentario = { id: `cm_${alvo.comentarios.length + 1}`, autor: (corpo?.autor as string | null) ?? null, texto: String(corpo?.texto ?? ''), em: CRIADO };
      const atualizado = { ...alvo, comentarios: [...alvo.comentarios, comentario], versao: alvo.versao + 1 };
      incidentes = incidentes.map((i) => (i === alvo ? atualizado : i));
      return json(201, atualizado);
    }
    if (partes[3] === 'vincular' && metodo === 'POST') {
      const novos = ((corpo?.idCenarios as string[] | undefined) ?? []).filter((t) => !alvo.testesAfetados.includes(t));
      const atualizado = { ...alvo, testesAfetados: [...alvo.testesAfetados, ...novos], versao: alvo.versao + 1 };
      incidentes = incidentes.map((i) => (i === alvo ? atualizado : i));
      return json(200, atualizado);
    }
    if (partes[3] === 'vinculo' && metodo === 'DELETE') {
      const atualizado = { ...alvo, testesAfetados: alvo.testesAfetados.filter((t) => t !== partes[4]), versao: alvo.versao + 1 };
      incidentes = incidentes.map((i) => (i === alvo ? atualizado : i));
      return json(200, atualizado);
    }
    return undefined;
  };
}
