import { ErroNegocio } from '../erros.ts';
import type { Repos } from '../repos.ts';
import { CENARIOS_SEMENTE, DECISAO_SEMENTE, INCIDENTES_SEMENTE, PESSOAS_SEMENTE, PLANOS_SEMENTE, RETRO_SEMENTE } from './dados.ts';

export interface ResumoSemente {
  cenarios: number;
  pessoas: number;
  planos: number;
  incidentes: number;
  retros: number;
  decisoes: number;
}

/** Há qualquer cenário, pessoa, plano, incidente ou retro? Se houver, a semente não entra (nunca mistura com dados de verdade). */
export async function temDados({ cenarios, pessoas, planos, incidentes, retros }: Repos): Promise<boolean> {
  const [c, p, pl, inc, ret] = await Promise.all([cenarios.listar(), pessoas.listar(), planos.listar(), incidentes.listar(), retros.listar()]);
  return c.length + p.length + pl.length + inc.length + ret.length > 0;
}

/**
 * Carrega os dados de exemplo pelos próprios repositórios (valem as mesmas regras do dia a dia: massa
 * compartilhada, dependência, datas). Só roda com tudo vazio.
 */
export async function semear(repos: Repos): Promise<ResumoSemente> {
  if (await temDados(repos)) {
    throw new ErroNegocio('ja_tem_dados', 'Já existem cenários, pessoas ou planos. Os dados de exemplo só entram com tudo vazio.');
  }

  for (const cenario of CENARIOS_SEMENTE) await repos.cenarios.criar(cenario);
  for (const pessoa of PESSOAS_SEMENTE) await repos.pessoas.criar(pessoa);

  const idDoPlano = new Map<string, string>();
  for (const modelo of PLANOS_SEMENTE) {
    const criado = await repos.planos.criar({
      nome: modelo.nome,
      previsao: modelo.previsao,
      idCenarios: modelo.itens.map((i) => i.idCenario),
    });
    idDoPlano.set(modelo.nome, criado.plano.id);
    for (const { idCenario, campos } of modelo.itens) {
      const atual = criado.itens.find((i) => i.idCenario === idCenario);
      if (atual) await repos.planos.alterarItem(criado.plano.id, idCenario, atual.versao, campos);
    }
  }

  for (const { comentarios = [], ...inc } of INCIDENTES_SEMENTE) {
    await repos.incidentes.criar(inc);
    for (const c of comentarios) await repos.incidentes.comentar(inc.numero, c.texto, c.autor);
  }

  // A retro do plano concluído: notas votadas e duas ações (uma feita, uma pendente).
  const planoDaRetro = idDoPlano.get(RETRO_SEMENTE.plano);
  if (planoDaRetro) {
    for (const nota of RETRO_SEMENTE.notas) {
      const depois = await repos.retros.adicionarNota(planoDaRetro, { coluna: nota.coluna, texto: nota.texto, autor: nota.autor });
      const id = depois.notas[depois.notas.length - 1].id;
      for (const pessoa of nota.votos) await repos.retros.votar(planoDaRetro, id, pessoa);
    }
    for (const a of RETRO_SEMENTE.acoes) {
      const depois = await repos.retros.adicionarAcao(planoDaRetro, {
        texto: a.texto,
        responsavel: a.responsavel,
        prazo: a.prazo,
        origem: a.origem,
        incId: null,
        autor: a.responsavel,
      });
      if (a.feitaPor) await repos.retros.editarAcao(planoDaRetro, depois.acoes[depois.acoes.length - 1].id, { feito: true, autor: a.feitaPor });
    }
  }

  // A decisão do Release do plano em andamento.
  const planoDaDecisao = idDoPlano.get(DECISAO_SEMENTE.plano);
  if (planoDaDecisao) {
    const { plano, ...decisao } = DECISAO_SEMENTE;
    void plano;
    await repos.planos.registrarDecisao(planoDaDecisao, decisao);
  }

  return {
    cenarios: CENARIOS_SEMENTE.length,
    pessoas: PESSOAS_SEMENTE.length,
    planos: PLANOS_SEMENTE.length,
    incidentes: INCIDENTES_SEMENTE.length,
    retros: planoDaRetro ? 1 : 0,
    decisoes: planoDaDecisao ? 1 : 0,
  };
}
