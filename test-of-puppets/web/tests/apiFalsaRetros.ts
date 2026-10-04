import type { DetalhePlano } from '../src/pages/planos/clientePlanos';
import type { Retro } from '../src/retros/clienteRetros';
import { json, type Rota } from './apiFalsaBase';

/** Rotas /api/retros do servidor falso: uma retro por plano, com as mesmas travas do servidor de verdade. */
export function criarRotaRetros(inicial: Retro[], achar: (id: string) => DetalhePlano | undefined, proximoId: () => number) {
  let retros = structuredClone(inicial);
  return ({ partes, metodo, corpo }: Rota): Response => {
    const pid = partes[2];
    if (!pid) return json(200, { retros });
    const dono = achar(pid);
    if (!dono) return json(404, { erro: 'nao_encontrado', mensagem: `Plano ${pid} não encontrado.` });
    const atual: Retro = retros.find((r) => r.planoId === pid) ?? { planoId: pid, status: 'aberta', anonimas: false, fechadaEm: null, fechadaPor: null, notas: [], acoes: [], atualizadoEm: null };
    const gravar = (r: Retro) => {
      const pronta = { ...r, atualizadoEm: new Date().toISOString() };
      retros = retros.some((x) => x.planoId === pid) ? retros.map((x) => (x.planoId === pid ? pronta : x)) : [...retros, pronta];
      return pronta;
    };
    const indisponivel = () => json(409, { erro: 'retro_indisponivel', mensagem: `O plano ${dono.plano.nome} ainda está em andamento. A retrospectiva abre quando todos os testes estiverem concluídos.` });
    const travada = () => json(409, { erro: 'retro_fechada', mensagem: 'A retrospectiva está fechada: reabra para mexer em notas e votos.' });
    const bloqueio = () => (!dono.resumo.executado ? indisponivel() : atual.status === 'fechada' ? travada() : null);
    const [, , , sub, id, acao] = partes;

    if (!sub && metodo === 'GET') return json(200, atual);
    if (!sub && metodo === 'PUT') {
      if (corpo?.status !== 'aberta' && !dono.resumo.executado) return indisponivel();
      let novo = { ...atual };
      if (typeof corpo?.anonimas === 'boolean') {
        if (atual.status === 'fechada') return travada();
        novo = { ...novo, anonimas: corpo.anonimas };
      }
      if (corpo?.status === 'fechada') novo = { ...novo, status: 'fechada', fechadaEm: new Date().toISOString(), fechadaPor: (corpo.autor as string | null) ?? null };
      if (corpo?.status === 'aberta') novo = { ...novo, status: 'aberta', fechadaEm: null, fechadaPor: null };
      return json(200, gravar(novo));
    }
    if (sub === 'notas') {
      if (!id && metodo === 'POST') {
        const bloqueada = bloqueio();
        if (bloqueada) return bloqueada;
        if (!String(corpo?.texto ?? '').trim()) return json(400, { erro: 'validacao', mensagens: ['Texto da nota é obrigatório.'] });
        const nota = { id: `nt_fake${proximoId()}`, coluna: corpo?.coluna as 'bem' | 'melhorar', texto: String(corpo?.texto).trim(), autor: String(corpo?.autor ?? ''), em: new Date().toISOString(), votos: [] as string[] };
        return json(201, gravar({ ...atual, notas: [...atual.notas, nota] }));
      }
      if (id && !acao && metodo === 'DELETE') {
        const bloqueada = bloqueio();
        if (bloqueada) return bloqueada;
        return json(200, gravar({ ...atual, notas: atual.notas.filter((n) => n.id !== id) }));
      }
      if (id && acao === 'votos' && metodo === 'POST') {
        const bloqueada = bloqueio();
        if (bloqueada) return bloqueada;
        const pessoaVoto = String(corpo?.pessoa ?? '');
        return json(200, gravar({ ...atual, notas: atual.notas.map((n) => (n.id !== id ? n : { ...n, votos: n.votos.includes(pessoaVoto) ? n.votos.filter((v) => v !== pessoaVoto) : [...n.votos, pessoaVoto] })) }));
      }
    }
    if (sub === 'acoes') {
      if (!id && metodo === 'POST') {
        if (!String(corpo?.texto ?? '').trim()) return json(400, { erro: 'validacao', mensagens: ['Ação é obrigatório.'] });
        const nova = {
          id: `ac_fake${proximoId()}`,
          texto: String(corpo?.texto).trim(),
          responsavel: (corpo?.responsavel as string | null | undefined) ?? null,
          prazo: (corpo?.prazo as string | null | undefined) ?? null,
          feito: false,
          feitoEm: null,
          feitoPor: null,
          origem: (corpo?.origem as string | null | undefined) ?? null,
          incId: (corpo?.incId as string | null | undefined) ?? null,
          criadaEm: new Date().toISOString(),
          criadaPor: (corpo?.autor as string | null | undefined) ?? null,
        };
        return json(201, gravar({ ...atual, acoes: [...atual.acoes, nova] }));
      }
      if (id && metodo === 'PATCH') {
        return json(
          200,
          gravar({
            ...atual,
            acoes: atual.acoes.map((a) => {
              if (a.id !== id) return a;
              const nova = { ...a, ...(corpo?.texto !== undefined ? { texto: String(corpo.texto) } : {}), ...(corpo && 'responsavel' in corpo ? { responsavel: corpo.responsavel as string | null } : {}), ...(corpo && 'prazo' in corpo ? { prazo: (corpo.prazo as string | null) || null } : {}) };
              if (typeof corpo?.feito === 'boolean') {
                nova.feito = corpo.feito;
                nova.feitoEm = corpo.feito ? new Date().toISOString() : null;
                nova.feitoPor = corpo.feito ? ((corpo.autor as string | null | undefined) ?? null) : null;
              }
              return nova;
            }),
          }),
        );
      }
      if (id && metodo === 'DELETE') return json(200, gravar({ ...atual, acoes: atual.acoes.filter((a) => a.id !== id) }));
    }
    return json(404, { erro: 'nao_encontrado' });
  };
}
