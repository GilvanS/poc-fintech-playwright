import { vi } from 'vitest';
import type { CenarioVisao } from '../src/pages/cenarios/clienteApi';
import type { DetalhePlano, ItemPlano, PlanoResumido, ResumoPlano, TipoDecisao } from '../src/pages/planos/clientePlanos';
import type { Pessoa } from '../src/pessoas/clientePessoas';
import type { Visao } from '../src/visoes/clienteVisoes';
import { SEM_LIMITES, type Wip } from '../src/config/clienteConfig';
import type { Incidente } from '../src/incidentes/clienteIncidentes';
import type { Retro } from '../src/retros/clienteRetros';
import type { Lembrete } from '../src/lembretes/clienteLembretes';

export const CRIADO = '2026-09-24T12:00:00.000Z';

export function item(idCenario: string, extra: Partial<ItemPlano> = {}): ItemPlano {
  return {
    idCenario,
    nome: `Nome de ${idCenario}`,
    funcionalidade: 'Faturas',
    status: 'agendado',
    posicao: 1,
    versao: 1,
    dependeDe: [],
    massaCompartilhadaCom: [],
    bloqueadoPor: [],
    ...extra,
  };
}

export function cenario(idCenario: string, extra: Partial<CenarioVisao> = {}): CenarioVisao {
  return {
    idCenario,
    nome: `Nome de ${idCenario}`,
    funcionalidade: 'Faturas',
    versao: 1,
    criadoEm: CRIADO,
    atualizadoEm: CRIADO,
    dependeDe: [],
    massaCompartilhadaCom: [],
    ...extra,
  };
}

export function pessoa(id: string, extra: Partial<Pessoa> = {}): Pessoa {
  return {
    id,
    nome: id.charAt(0).toUpperCase() + id.slice(1),
    capacidadeMinSemana: 0,
    cor: 'azul',
    ativa: true,
    versao: 1,
    criadoEm: CRIADO,
    atualizadoEm: CRIADO,
    ...extra,
  };
}

export function resumir(itens: ItemPlano[]): ResumoPlano {
  const porStatus = { agendado: 0, em_andamento: 0, refinamento: 0, concluido: 0 };
  for (const i of itens) porStatus[i.status] += 1;
  const total = itens.length;
  return {
    total,
    concluidos: porStatus.concluido,
    pendentes: total - porStatus.concluido,
    percentual: total ? Math.round((porStatus.concluido / total) * 100) : 0,
    porStatus,
    passou: itens.filter((i) => i.resultado === 'passou').length,
    falhou: itens.filter((i) => i.resultado === 'falhou').length,
    executado: total > 0 && porStatus.concluido === total,
  };
}

/** Monta um plano completo; as posições seguem a ordem em que os itens foram passados. */
export function plano(id: string, nome: string, itens: ItemPlano[] = [], extra: Partial<DetalhePlano['plano']> = {}): DetalhePlano {
  const comPosicao = itens.map((i, p) => ({ ...i, posicao: p + 1 }));
  return { plano: { id, nome, criadoEm: CRIADO, versao: 1, ...extra }, itens: comPosicao, resumo: resumir(comPosicao) };
}

export interface Chamada {
  metodo: string;
  caminho: string;
  corpo?: Record<string, unknown>;
}

interface Opcoes {
  planos?: DetalhePlano[];
  cenarios?: CenarioVisao[];
  /** Faz o PUT da ordem responder 409 ordem_invalida. */
  recusarOrdem?: boolean;
  /** Faz o POST de "incluir testes" responder 409 data_antes_da_dependencia. */
  recusarInclusao?: boolean;
  /** Planos que o POST /api/semente cria (o servidor falso começa vazio e "carrega" estes). */
  semente?: DetalhePlano[];
  /** Faz o POST /api/semente responder 409 ja_tem_dados. */
  sementeRecusada?: boolean;
  pessoas?: Pessoa[];
  /** Ids de pessoas que o DELETE deve recusar com 409 pessoa_em_uso. */
  pessoasEmUso?: string[];
  /** Visões salvas que já existem no servidor falso. */
  visoes?: Visao[];
  /** Limites de WIP do servidor falso; sem isto o servidor falso não tem /api/config (o Kanban fica sem limites). */
  wip?: Partial<Wip>;
  /** INC que já existem no servidor falso. */
  incidentes?: Incidente[];
  /** Retros que já existem no servidor falso (uma por plano). */
  retros?: Retro[];
  /** Lembretes do sino que o servidor falso devolve (a conta de "lida" ele faz sozinho). */
  lembretes?: Lembrete[];
  /** Faz o POST de "marcar como lida" responder 500. */
  lembretesRecusados?: boolean;
}

function json(status: number, corpo: unknown) {
  return new Response(status === 204 ? null : JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json' } });
}

/** Servidor em memória: responde como a API real nas rotas de planos e cenários. */
export function criarApiFalsa(opcoes: Opcoes = {}) {
  let planos = structuredClone(opcoes.planos ?? []);
  let pessoas = structuredClone(opcoes.pessoas ?? []);
  let visoes = structuredClone(opcoes.visoes ?? []);
  let wip: Wip = { ...SEM_LIMITES, ...opcoes.wip };
  let incidentes = structuredClone(opcoes.incidentes ?? []);
  let retros = structuredClone(opcoes.retros ?? []);
  const lembretes = structuredClone(opcoes.lembretes ?? []);
  const lidas = new Set(lembretes.filter((l) => l.lida).map((l) => l.chave));
  const cenarios = opcoes.cenarios ?? [];
  const chamadas: Chamada[] = [];
  let sequencia = 1;

  const refazer = (p: DetalhePlano): DetalhePlano => {
    const itens = p.itens.map((i) => ({
      ...i,
      bloqueadoPor:
        i.status === 'concluido' ? [] : i.dependeDe.filter((d) => p.itens.some((o) => o.idCenario === d && o.resultado !== 'passou')),
    }));
    return { ...p, itens, resumo: resumir(itens) };
  };
  planos = planos.map(refazer);

  const achar = (id: string) => planos.find((p) => p.plano.id === id);
  const salvar = (novo: DetalhePlano) => {
    const pronto = refazer(novo);
    planos = planos.map((p) => (p.plano.id === pronto.plano.id ? pronto : p));
    return pronto;
  };

  const falso = vi.fn(async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(entrada), 'http://local');
    const metodo = init?.method ?? 'GET';
    const corpo = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined;
    chamadas.push({ metodo, caminho: url.pathname + url.search, corpo });
    const partes = url.pathname.split('/').filter(Boolean).map(decodeURIComponent); // api, planos, :id, testes|ordem, :cenario

    if (partes[1] === 'semente' && metodo === 'POST') {
      if (opcoes.sementeRecusada) {
        return json(409, { erro: 'ja_tem_dados', mensagem: 'Já existem cenários, pessoas ou planos. Os dados de exemplo só entram com tudo vazio.' });
      }
      planos = (opcoes.semente ?? []).map(refazer);
      return json(201, { cenarios: 8, pessoas: 3, planos: planos.length });
    }

    if (partes[1] === 'config' && opcoes.wip) {
      if (metodo === 'PUT') {
        const pedido = (corpo?.wip ?? {}) as Partial<Wip>;
        if (Object.values(pedido).some((v) => v !== null && (!Number.isInteger(v) || (v as number) < 1 || (v as number) > 99))) {
          return json(400, { erro: 'validacao', mensagens: ['Limite de Em andamento deve ser um inteiro de 1 a 99, ou vazio para não ter limite.'] });
        }
        wip = { ...wip, ...pedido };
      }
      return json(200, { wip });
    }

    if (partes[1] === 'lembretes') {
      const resposta = () => {
        const lista = lembretes.map((l) => ({ ...l, lida: lidas.has(l.chave) }));
        return json(200, { lembretes: lista, naoLidas: lista.filter((l) => !l.lida).length });
      };
      if (metodo === 'POST' && partes[2] === 'lidas') {
        const chaves = (corpo?.chaves as string[] | undefined) ?? [];
        if (opcoes.lembretesRecusados) return json(500, { erro: 'interno' });
        for (const c of chaves.filter((x) => lembretes.some((l) => l.chave === x))) {
          if (corpo?.lida === false) lidas.delete(c);
          else lidas.add(c);
        }
      }
      return resposta();
    }

    if (partes[1] === 'retros') {
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
          const nota = { id: `nt_fake${sequencia++}`, coluna: corpo?.coluna as 'bem' | 'melhorar', texto: String(corpo?.texto).trim(), autor: String(corpo?.autor ?? ''), em: new Date().toISOString(), votos: [] as string[] };
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
            id: `ac_fake${sequencia++}`,
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
    }

    if (partes[1] === 'incidentes') {
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
    }

    if (partes[1] === 'visoes') {
      const voce = url.searchParams.get('voce');
      const enxerga = (v: Visao) => v.compartilhada || (voce !== null && v.dono === voce);
      if (!partes[2] && metodo === 'GET') return json(200, { visoes: visoes.filter(enxerga) });
      if (!partes[2] && metodo === 'POST') {
        const nome = String(corpo?.nome ?? '').trim();
        if (!nome) return json(400, { erro: 'validacao', mensagens: ['Nome é obrigatório.'] });
        if (visoes.some((v) => v.nome.toLowerCase() === nome.toLowerCase())) {
          return json(409, { erro: 'nome_duplicado', mensagem: `Já existe uma visão chamada ${nome}.` });
        }
        const nova: Visao = {
          id: nome.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          nome,
          tipo: corpo?.tipo as Visao['tipo'],
          dono: (corpo?.dono as string | null) ?? null,
          compartilhada: Boolean(corpo?.compartilhada),
          filtros: { funcionalidade: '', responsavel: '', prioridade: '', ...(corpo?.filtros as object) },
          versao: 1,
          criadoEm: CRIADO,
        };
        visoes = [...visoes, nova];
        return json(201, nova);
      }
      const alvo = visoes.find((v) => v.id === partes[2]);
      if (!alvo || !enxerga(alvo)) return json(404, { erro: 'nao_encontrado', mensagem: `Visão ${partes[2]} não encontrada.` });
      if (metodo === 'DELETE') {
        visoes = visoes.filter((v) => v !== alvo);
        return json(204, null);
      }
    }

    if (partes[1] === 'pessoas') {
      const idPessoa = partes[2];
      if (!idPessoa && metodo === 'GET') return json(200, { pessoas });
      if (!idPessoa && metodo === 'POST') {
        const nome = String(corpo?.nome ?? '').trim();
        if (!nome) return json(400, { erro: 'validacao', mensagens: ['Nome é obrigatório.'] });
        if (pessoas.some((p) => p.nome.toLowerCase() === nome.toLowerCase())) {
          return json(409, { erro: 'nome_duplicado', mensagem: `Já existe uma pessoa chamada ${nome}.` });
        }
        const nova = pessoa(nome.toLowerCase().replace(/[^a-z0-9]+/g, '-'), {
          nome,
          ...(corpo?.capacidadeMinSemana !== undefined ? { capacidadeMinSemana: Number(corpo.capacidadeMinSemana) } : {}),
          ...(corpo?.cor ? { cor: corpo.cor as Pessoa['cor'] } : {}),
          ...(corpo?.ativa !== undefined ? { ativa: Boolean(corpo.ativa) } : {}),
        });
        pessoas = [...pessoas, nova];
        return json(201, nova);
      }
      const atual = pessoas.find((p) => p.id === idPessoa);
      if (!atual) return json(404, { erro: 'nao_encontrado', mensagem: `Pessoa ${idPessoa} não encontrada.` });
      if (metodo === 'PUT') {
        if (atual.versao !== corpo?.versao) return json(409, { erro: 'versao_antiga', mensagem: `${atual.nome} foi alterada por outra pessoa. Recarregue antes de salvar.` });
        const nova: Pessoa = {
          ...atual,
          nome: String(corpo?.nome ?? atual.nome),
          capacidadeMinSemana: corpo?.capacidadeMinSemana !== undefined ? Number(corpo.capacidadeMinSemana) : atual.capacidadeMinSemana,
          cor: (corpo?.cor as Pessoa['cor'] | undefined) ?? atual.cor,
          ativa: corpo?.ativa !== undefined ? Boolean(corpo.ativa) : atual.ativa,
          versao: atual.versao + 1,
        };
        pessoas = pessoas.map((p) => (p === atual ? nova : p));
        return json(200, nova);
      }
      if (metodo === 'DELETE') {
        if (opcoes.pessoasEmUso?.includes(atual.id)) {
          return json(409, { erro: 'pessoa_em_uso', mensagem: `${atual.nome} é responsável por testes nos planos: 28/09/26. Troque o responsável ou apenas desative a pessoa.` });
        }
        pessoas = pessoas.filter((p) => p !== atual);
        return json(204, null);
      }
    }

    if (partes[1] === 'cenarios' && partes[3] === 'planos') {
      const historico = planos.flatMap((p) => {
        const i = p.itens.find((x) => x.idCenario === partes[2]);
        return i
          ? [{
              planoId: p.plano.id,
              planoNome: p.plano.nome,
              criadoEm: p.plano.criadoEm,
              status: i.status,
              ...(i.resultado ? { resultado: i.resultado } : {}),
              ...(i.dataPlanejada ? { dataPlanejada: i.dataPlanejada } : {}),
              ...(i.dataExecucao ? { dataExecucao: i.dataExecucao } : {}),
              ...(i.responsavel ? { responsavel: i.responsavel } : {}),
              ...(i.observacoes ? { observacoes: i.observacoes } : {}),
            }]
          : [];
      });
      return json(200, { planos: historico });
    }

    if (partes[1] === 'cenarios') {
      return json(200, { cenarios, funcionalidades: [...new Set(cenarios.map((c) => c.funcionalidade))].sort() });
    }

    if (partes.length === 2) {
      if (metodo === 'GET') {
        const aba = url.searchParams.get('aba');
        const lista: PlanoResumido[] = planos
          .filter((p) => !aba || p.resumo.executado === (aba === 'executados'))
          .map((p) => ({ ...p.plano, resumo: p.resumo }));
        return json(200, { planos: lista });
      }
      if (metodo === 'POST') {
        if (!String(corpo?.nome ?? '').trim()) return json(400, { erro: 'validacao', mensagens: ['Nome do plano é obrigatório.'] });
        const ids = (corpo?.idCenarios as string[] | undefined) ?? [];
        const itens = ids.map((id, p) => item(id, { posicao: p + 1, dependeDe: cenarios.find((c) => c.idCenario === id)?.dependeDe ?? [] }));
        const novo = refazer({
          plano: { id: `pl_novo${sequencia++}`, nome: String(corpo?.nome).trim(), criadoEm: CRIADO, versao: 1, ...(corpo?.previsao ? { previsao: String(corpo.previsao) } : {}) },
          itens,
          resumo: resumir(itens),
        });
        planos = [...planos, novo];
        return json(201, novo);
      }
    }

    const atual = achar(partes[2]);
    if (!atual) return json(404, { erro: 'nao_encontrado', mensagem: `Plano ${partes[2]} não encontrado.` });

    if (partes.length === 3) {
      if (metodo === 'GET') return json(200, atual);
      if (metodo === 'PATCH') {
        if (corpo?.versao !== atual.plano.versao) return json(409, { erro: 'versao_antiga', mensagem: `${atual.plano.nome} foi alterado por outra pessoa. Recarregue antes de salvar.` });
        const plano = { ...atual.plano, versao: atual.plano.versao + 1 } as DetalhePlano['plano'];
        if (corpo && 'nome' in corpo) plano.nome = String(corpo.nome);
        if (corpo && 'previsao' in corpo) {
          if (corpo.previsao === null) delete plano.previsao;
          else plano.previsao = String(corpo.previsao);
        }
        planos = planos.map((p) => (p === atual ? { ...p, plano } : p));
        return json(200, plano);
      }
      if (metodo === 'DELETE') {
        planos = planos.filter((p) => p !== atual);
        return json(204, null);
      }
    }

    if (partes[3] === 'decisoes' && metodo === 'POST') {
      if (!String(corpo?.justificativa ?? '').trim()) return json(400, { erro: 'validacao', mensagens: ['Justificativa é obrigatória.'] });
      const decisao = {
        id: `dc_fake${sequencia++}`,
        decisao: corpo?.decisao as TipoDecisao,
        justificativa: String(corpo?.justificativa).trim(),
        por: String(corpo?.por ?? ''),
        em: new Date().toISOString(),
        criterios: (corpo?.criterios as number[] | undefined) ?? [],
      };
      const novo = { ...atual, plano: { ...atual.plano, decisoes: [...(atual.plano.decisoes ?? []), decisao] } };
      planos = planos.map((p) => (p === atual ? novo : p));
      return json(201, novo);
    }

    if (partes[3] === 'ordem' && metodo === 'PUT') {
      if (opcoes.recusarOrdem) {
        return json(409, { erro: 'ordem_invalida', mensagem: 'CT03.2 precisa ficar antes de CT03.7: usam a mesma massa e CT03.2 roda primeiro.' });
      }
      const ordem = corpo?.ordem as string[];
      return json(200, salvar({ ...atual, itens: atual.itens.map((i) => ({ ...i, posicao: ordem.indexOf(i.idCenario) + 1 })).sort((a, b) => a.posicao - b.posicao) }));
    }

    if (partes[3] === 'testes' && !partes[4] && metodo === 'PATCH') {
      const escolhidos = new Set((corpo?.idCenarios as string[] | undefined) ?? []);
      const campos: Partial<ItemPlano> = {};
      if (corpo && 'responsavel' in corpo) campos.responsavel = (corpo.responsavel as string | null) ?? undefined;
      if (corpo && 'prioridade' in corpo) campos.prioridade = (corpo.prioridade as ItemPlano['prioridade'] | null) ?? undefined;
      const itens = atual.itens.map((i) => (escolhidos.has(i.idCenario) ? { ...i, ...campos, versao: i.versao + 1 } : i));
      for (const i of itens) {
        if (i.responsavel === undefined) delete i.responsavel;
        if (i.prioridade === undefined) delete i.prioridade;
      }
      return json(200, salvar({ ...atual, itens }));
    }

    if (partes[3] === 'testes' && !partes[4] && metodo === 'POST') {
      if (opcoes.recusarInclusao) {
        return json(409, { erro: 'data_antes_da_dependencia', mensagem: 'CT03.7 não pode ser planejado em 01/10/2026, antes de CT03.2 (05/10/2026).' });
      }
      const novos = ((corpo?.idCenarios as string[] | undefined) ?? []).filter((id) => !atual.itens.some((i) => i.idCenario === id));
      const base = atual.itens.reduce((maior, i) => Math.max(maior, i.posicao), 0);
      const adicionados = novos.map((id, k) => {
        const c = cenarios.find((x) => x.idCenario === id);
        return item(id, {
          nome: c?.nome,
          funcionalidade: c?.funcionalidade,
          idMassa: c?.idMassa,
          dependeDe: c?.dependeDe ?? [],
          massaCompartilhadaCom: c?.massaCompartilhadaCom ?? [],
          posicao: base + k + 1,
          ...(corpo?.dataPlanejada ? { dataPlanejada: String(corpo.dataPlanejada) } : {}),
        });
      });
      return json(200, { ...salvar({ ...atual, itens: [...atual.itens, ...adicionados] }), incluidos: novos });
    }

    if (partes[3] === 'testes' && partes[4]) {
      const alvo = atual.itens.find((i) => i.idCenario === partes[4]);
      if (!alvo) return json(404, { erro: 'nao_encontrado', mensagem: 'Teste não está no plano.' });
      if (metodo === 'DELETE') {
        salvar({ ...atual, itens: atual.itens.filter((i) => i !== alvo) });
        return json(204, null);
      }
      if (metodo === 'PATCH') {
        const { versao: _v, ...campos } = corpo ?? {};
        const novoStatus = campos.status as ItemPlano['status'] | undefined;
        if (novoStatus === 'em_andamento' || novoStatus === 'concluido') {
          const pendentes = alvo.bloqueadoPor;
          if (pendentes.length > 0) {
            return json(409, { erro: 'dependencia_pendente', mensagem: `Aguardando ${pendentes.join(', ')} passar: ${alvo.idCenario} usa a mesma massa e só pode andar depois.` });
          }
        }
        const novo: ItemPlano = { ...alvo, ...(campos as Partial<ItemPlano>), versao: alvo.versao + 1 };
        for (const [k, v] of Object.entries(campos)) if (v === null) delete (novo as unknown as Record<string, unknown>)[k];
        if (novo.status !== 'concluido') delete novo.resultado;
        const salvo = salvar({ ...atual, itens: atual.itens.map((i) => (i === alvo ? novo : i)) });
        return json(200, salvo.itens.find((i) => i.idCenario === alvo.idCenario));
      }
    }
    return json(404, { erro: 'nao_encontrado' });
  });

  return {
    falso,
    chamadas,
    escritas: () => chamadas.filter((c) => c.metodo !== 'GET'),
    estado: () => planos,
  };
}
