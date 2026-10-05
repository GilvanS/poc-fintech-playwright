import { vi } from 'vitest';
import type { CenarioVisao } from '../src/pages/cenarios/clienteApi';
import type { DetalhePlano, ItemPlano, PlanoResumido, TipoDecisao } from '../src/pages/planos/clientePlanos';
import type { Pessoa } from '../src/pessoas/clientePessoas';
import type { Visao } from '../src/visoes/clienteVisoes';
import { SEM_LIMITES, TODOS_LIGADOS, type Lembretes, type Wip } from '../src/config/clienteConfig';
import type { Incidente } from '../src/incidentes/clienteIncidentes';
import type { Retro } from '../src/retros/clienteRetros';
import type { Lembrete } from '../src/lembretes/clienteLembretes';
import { CRIADO, item, json, pessoa, resumir, type Chamada, type Rota } from './apiFalsaBase';
import { criarRotaIncidentes } from './apiFalsaIncidentes';
import { criarRotaLembretes } from './apiFalsaLembretes';
import { criarRotaRetros } from './apiFalsaRetros';

// Os dados de exemplo e os tipos continuam saindo daqui, para os testes importarem tudo de um lugar só.
export { CRIADO, cenario, item, pessoa, plano, resumir, type Chamada } from './apiFalsaBase';

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
  /** Ids das pessoas que já estão online no servidor falso (quem dá sinal entra na lista). */
  presenca?: string[];
  /** Faz o POST de "marcar como lida" responder 500. */
  lembretesRecusados?: boolean;
}

/** Servidor em memória: responde como a API real nas rotas de planos e cenários. */
export function criarApiFalsa(opcoes: Opcoes = {}) {
  let planos = structuredClone(opcoes.planos ?? []);
  let pessoas = structuredClone(opcoes.pessoas ?? []);
  let visoes = structuredClone(opcoes.visoes ?? []);
  let wip: Wip = { ...SEM_LIMITES, ...opcoes.wip };
  let lembretesLigados: Lembretes = { ...TODOS_LIGADOS };
  let online: string[] = [...(opcoes.presenca ?? [])];
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

  const rotaIncidentes = criarRotaIncidentes(opcoes.incidentes ?? []);
  const rotaRetros = criarRotaRetros(opcoes.retros ?? [], achar, () => sequencia++);
  const rotaLembretes = criarRotaLembretes(opcoes.lembretes ?? [], opcoes.lembretesRecusados);

  const falso = vi.fn(async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(entrada), 'http://local');
    const metodo = init?.method ?? 'GET';
    const corpo = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined;
    chamadas.push({ metodo, caminho: url.pathname + url.search, corpo });
    const partes = url.pathname.split('/').filter(Boolean).map(decodeURIComponent); // api, planos, :id, testes|ordem, :cenario
    const rota: Rota = { partes, metodo, corpo, url };

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
        if (corpo?.lembretes) lembretesLigados = { ...lembretesLigados, ...(corpo.lembretes as Partial<Lembretes>) };
      }
      return json(200, { wip, lembretes: lembretesLigados });
    }

    if (partes[1] === 'presenca') {
      if (metodo === 'POST') {
        const quem = String(corpo?.pessoa ?? '');
        if (quem && !online.includes(quem)) online = [...online, quem];
      }
      return json(200, { online });
    }

    if (partes[1] === 'lembretes') return rotaLembretes(rota);

    if (partes[1] === 'retros') return rotaRetros(rota);

    if (partes[1] === 'incidentes') {
      const resposta = rotaIncidentes(rota);
      if (resposta) return resposta;
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

    if (partes[3] === 'mover' && metodo === 'POST') {
      const destino = achar(String(corpo?.paraPlano ?? ''));
      if (!destino) return json(404, { erro: 'nao_encontrado', mensagem: `Plano ${String(corpo?.paraPlano)} não encontrado.` });
      const escolhidos = new Set((corpo?.idCenarios as string[] | undefined) ?? []);
      const movendo = atual.itens.filter((i) => escolhidos.has(i.idCenario));
      const iniciados = movendo.filter((i) => i.status !== 'agendado').map((i) => i.idCenario);
      if (iniciados.length > 0) {
        return json(409, { erro: 'teste_iniciado', mensagem: `Só testes ainda não iniciados mudam de plano: ${iniciados.join(', ')} já começou.` });
      }
      const repetidos = movendo.filter((i) => destino.itens.some((d) => d.idCenario === i.idCenario)).map((i) => i.idCenario);
      if (repetidos.length > 0) return json(409, { erro: 'ja_no_plano', mensagem: `Já está no plano ${destino.plano.nome}: ${repetidos.join(', ')}.` });
      const base = destino.itens.reduce((maior, i) => Math.max(maior, i.posicao), 0);
      salvar({ ...destino, itens: [...destino.itens, ...movendo.map((i, k) => ({ ...i, posicao: base + k + 1, versao: 1 }))] });
      const origem = salvar({ ...atual, itens: atual.itens.filter((i) => !escolhidos.has(i.idCenario)) });
      return json(200, { origem, movidos: movendo.map((i) => i.idCenario) });
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
      if (partes[5] === 'cronometro' && metodo === 'POST') {
        // Cronômetro do servidor falso: mesma ideia do real (início carimbado, pausa acumula, finalizar conclui com resultado).
        const agora = Date.now();
        const novo: ItemPlano = { ...alvo, versao: alvo.versao + 1 };
        const rodando = alvo.status === 'em_andamento' && alvo.iniciadoEm !== undefined;
        const acao = corpo?.acao;
        if (acao === 'iniciar') {
          if (alvo.bloqueadoPor.length > 0) {
            return json(409, { erro: 'dependencia_pendente', mensagem: `Aguardando ${alvo.bloqueadoPor.join(', ')} passar: ${alvo.idCenario} usa a mesma massa e só pode andar depois.` });
          }
          Object.assign(novo, { status: 'em_andamento', iniciadoEm: new Date(agora).toISOString(), acumuladoMs: 0 });
          delete novo.resultado;
        } else if (acao === 'pausar') {
          novo.acumuladoMs = (alvo.acumuladoMs ?? 0) + (rodando ? agora - Date.parse(alvo.iniciadoEm!) : 0);
          delete novo.iniciadoEm;
        } else if (acao === 'retomar') {
          novo.iniciadoEm = new Date(agora).toISOString();
        } else {
          Object.assign(novo, { status: 'concluido', resultado: corpo?.resultado, tempoRealMin: corpo?.tempoRealMin ?? 1, dataExecucao: '2026-10-05' });
          if (corpo?.observacoes) novo.observacoes = String(corpo.observacoes);
          delete novo.iniciadoEm;
          delete novo.acumuladoMs;
        }
        const salvo = salvar({ ...atual, itens: atual.itens.map((i) => (i === alvo ? novo : i)) });
        return json(200, salvo.itens.find((i) => i.idCenario === alvo.idCenario));
      }
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
    // O batimento da presença (POST a cada 5 s) não é uma alteração de dados: fica de fora.
    escritas: () => chamadas.filter((c) => c.metodo !== 'GET' && !c.caminho.startsWith('/api/presenca')),
    estado: () => planos,
  };
}
