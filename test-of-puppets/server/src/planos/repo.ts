import { randomBytes } from 'node:crypto';
import { compararIds, type CenarioVisao } from '../cenarios/modelo.ts';
import { ErroNegocio } from '../erros.ts';
import { gravarJson, lerJson } from '../store/json.ts';
import {
  resumir,
  type CamposItem,
  type CamposPlano,
  type ItemPlano,
  type NovaDecisao,
  type Plano,
  type ResumoPlano,
} from './modelo.ts';
import { aplicarPatch, conflitoDeData, mensagemDependencia, pendenciasDeDependencia } from './regras.ts';

/** Item do plano + os dados do cenário e o que se calcula a partir da massa. */
export interface ItemVisao extends ItemPlano {
  nome?: string;
  funcionalidade?: string;
  idMassa?: string;
  /** CPF fictício da massa de teste (só dígitos), exibido sem máscara. */
  cpf?: string;
  passos?: string;
  resultadoEsperado?: string;
  dependeDe: string[];
  massaCompartilhadaCom: string[];
  /** Dependências deste plano que ainda não passaram ("Aguardando CT03.2 passar"). Vazio com o teste concluído. */
  bloqueadoPor: string[];
}

export type PlanoMeta = Omit<Plano, 'itens'>;

export interface DetalhePlano {
  plano: PlanoMeta;
  itens: ItemVisao[];
  resumo: ResumoPlano;
}

export interface PlanoResumido extends PlanoMeta {
  resumo: ResumoPlano;
}

export type Aba = 'em_execucao' | 'executados';

export interface RepoPlanos {
  listar(aba?: Aba, ordem?: 'asc' | 'desc'): Promise<PlanoResumido[]>;
  obter(id: string): Promise<DetalhePlano>;
  criar(entrada: { nome: string; previsao?: string; idCenarios: string[] }): Promise<DetalhePlano>;
  editar(id: string, versao: number, campos: CamposPlano): Promise<DetalhePlano>;
  excluir(id: string): Promise<void>;
  incluirTestes(id: string, idCenarios: string[], dataPlanejada?: string): Promise<DetalhePlano & { incluidos: string[] }>;
  removerTeste(id: string, idCenario: string): Promise<void>;
  /** Atribui responsável e/ou prioridade a vários testes do plano de uma vez (tudo ou nada). */
  alterarLote(id: string, idCenarios: string[], campos: Pick<CamposItem, 'responsavel' | 'prioridade'>): Promise<DetalhePlano>;
  /** Nomes dos planos em que a pessoa é responsável por algum teste (impede excluí-la da Equipe). */
  planosComResponsavel(idPessoa: string): Promise<string[]>;
  /**
   * Tira os testes deste plano e põe no plano de destino, numa só gravação (tudo ou nada). Só vale para testes ainda
   * não iniciados (agendados); eles chegam ao fim do destino com responsável, prioridade, estimativa, data e observações.
   */
  moverTestes(idOrigem: string, idCenarios: string[], idDestino: string): Promise<{ origem: DetalhePlano; movidos: string[] }>;
  /** Define a ordem de execução (posição 1..n). Precisa conter exatamente os testes do plano. */
  reordenar(id: string, ordem: string[]): Promise<DetalhePlano>;
  alterarItem(id: string, idCenario: string, versao: number, campos: CamposItem): Promise<ItemVisao>;
  /** Acrescenta uma decisão go/no-go ao histórico do Release. Não muda a versão do plano (não gera falso conflito). */
  registrarDecisao(id: string, entrada: NovaDecisao): Promise<DetalhePlano>;
  /** Nomes dos planos que têm o cenário (para impedir a exclusão do cadastro). */
  planosQueUsam(idCenario: string): Promise<string[]>;
  /** O teste em cada plano onde aparece (aba "Histórico" do detalhe do teste), na ordem de criação dos planos. */
  historicoDoCenario(idCenario: string): Promise<HistoricoDoTeste[]>;
}

export interface HistoricoDoTeste {
  planoId: string;
  planoNome: string;
  criadoEm: string;
  status: ItemPlano['status'];
  resultado?: ItemPlano['resultado'];
  dataPlanejada?: string;
  dataExecucao?: string;
  responsavel?: string;
  observacoes?: string;
}

interface Opcoes {
  /** Catálogo de cenários já com a massa compartilhada e `dependeDe` calculados. */
  catalogo: () => Promise<CenarioVisao[]>;
  agora?: () => Date;
  novoId?: () => string;
}

interface Arquivo {
  planos: Plano[];
}

const idPadrao = () => `pl_${randomBytes(4).toString('hex')}`;

function meta({ itens: _itens, ...resto }: Plano): PlanoMeta {
  return resto;
}

export function criarRepoPlanos(caminho: string, { catalogo, agora = () => new Date(), novoId = idPadrao }: Opcoes): RepoPlanos {
  // Todas as alterações (ler -> mudar -> gravar) entram numa fila: várias pessoas usam o mesmo servidor.
  let fila: Promise<unknown> = Promise.resolve();
  function emFila<T>(tarefa: () => Promise<T>): Promise<T> {
    const resultado = fila.then(tarefa);
    fila = resultado.catch(() => undefined);
    return resultado;
  }

  const ler = () => lerJson<Arquivo>(caminho, { planos: [] });
  const gravar = (planos: Plano[]) => gravarJson(caminho, { planos });

  function achar(arquivo: Arquivo, id: string): Plano {
    const plano = arquivo.planos.find((p) => p.id === id);
    if (!plano) throw new ErroNegocio('nao_encontrado', `Plano ${id} não encontrado.`);
    return plano;
  }

  function substituir(arquivo: Arquivo, novo: Plano): Plano[] {
    return arquivo.planos.map((p) => (p.id === novo.id ? novo : p));
  }

  function dependencias(cenarios: CenarioVisao[]): Map<string, string[]> {
    return new Map(cenarios.map((c) => [c.idCenario, c.dependeDe]));
  }

  function visaoDoItem(item: ItemPlano, plano: Plano, cenarios: Map<string, CenarioVisao>): ItemVisao {
    const c = cenarios.get(item.idCenario);
    const dependeDe = c?.dependeDe ?? [];
    return {
      ...item,
      ...(c ? { nome: c.nome, funcionalidade: c.funcionalidade } : {}),
      ...(c?.idMassa ? { idMassa: c.idMassa } : {}),
      ...(c?.cpf ? { cpf: c.cpf } : {}),
      ...(c?.passos ? { passos: c.passos } : {}),
      ...(c?.resultadoEsperado ? { resultadoEsperado: c.resultadoEsperado } : {}),
      dependeDe,
      massaCompartilhadaCom: c?.massaCompartilhadaCom ?? [],
      bloqueadoPor: item.status === 'concluido' ? [] : pendenciasDeDependencia(dependeDe, plano.itens),
    };
  }

  async function detalhe(plano: Plano): Promise<DetalhePlano> {
    const cenarios = new Map((await catalogo()).map((c) => [c.idCenario, c]));
    const itens = [...plano.itens]
      .sort((a, b) => a.posicao - b.posicao || compararIds(a.idCenario, b.idCenario))
      .map((i) => visaoDoItem(i, plano, cenarios));
    return { plano: meta(plano), itens, resumo: resumir(plano) };
  }

  /** Cenários que não estão no cadastro não entram no plano. */
  function exigirCadastrados(idCenarios: string[], cenarios: CenarioVisao[]): void {
    const conhecidos = new Set(cenarios.map((c) => c.idCenario));
    const faltando = idCenarios.filter((id) => !conhecidos.has(id));
    if (faltando.length > 0) {
      throw new ErroNegocio('cenario_inexistente', `Cenário(s) não cadastrado(s): ${faltando.join(', ')}.`);
    }
  }

  const proximaPosicao = (itens: ItemPlano[]) => itens.reduce((maior, i) => Math.max(maior, i.posicao), 0) + 1;

  return {
    async listar(aba, ordem = 'asc') {
      const planos = (await ler()).planos.map((p) => ({ ...meta(p), resumo: resumir(p) }));
      const filtrados = aba ? planos.filter((p) => p.resumo.executado === (aba === 'executados')) : planos;
      return ordem === 'desc' ? filtrados.reverse() : filtrados;
    },

    async obter(id) {
      return detalhe(achar(await ler(), id));
    },

    criar(entrada) {
      return emFila(async () => {
        const arquivo = await ler();
        const cenarios = await catalogo();
        exigirCadastrados(entrada.idCenarios, cenarios);

        let id = novoId();
        while (arquivo.planos.some((p) => p.id === id)) id = novoId();
        const plano: Plano = {
          id,
          nome: entrada.nome,
          criadoEm: agora().toISOString(),
          ...(entrada.previsao ? { previsao: entrada.previsao } : {}),
          versao: 1,
          itens: entrada.idCenarios.map((idCenario, i) => ({ idCenario, status: 'agendado', posicao: i + 1, versao: 1 })),
        };
        await gravar([...arquivo.planos, plano]);
        return detalhe(plano);
      });
    },

    editar(id, versao, campos) {
      return emFila(async () => {
        const arquivo = await ler();
        const atual = achar(arquivo, id);
        if (atual.versao !== versao) {
          throw new ErroNegocio('versao_antiga', `O plano ${atual.nome} foi alterado por outra pessoa. Recarregue antes de salvar.`);
        }
        const { previsao: _antiga, ...semPrevisao } = atual;
        const previsao = campos.previsao === undefined ? atual.previsao : (campos.previsao ?? undefined);
        const novo: Plano = {
          ...semPrevisao,
          ...(campos.nome !== undefined ? { nome: campos.nome } : {}),
          ...(previsao ? { previsao } : {}),
          versao: atual.versao + 1,
        };
        await gravar(substituir(arquivo, novo));
        return detalhe(novo);
      });
    },

    excluir(id) {
      return emFila(async () => {
        const arquivo = await ler();
        achar(arquivo, id);
        await gravar(arquivo.planos.filter((p) => p.id !== id));
      });
    },

    incluirTestes(id, idCenarios, dataPlanejada) {
      return emFila(async () => {
        const arquivo = await ler();
        const atual = achar(arquivo, id);
        const cenarios = await catalogo();
        exigirCadastrados(idCenarios, cenarios);
        const deps = dependencias(cenarios);

        const itens = [...atual.itens];
        const incluidos: string[] = [];
        for (const idCenario of idCenarios) {
          if (itens.some((i) => i.idCenario === idCenario)) continue;
          const conflito = conflitoDeData(idCenario, dataPlanejada, itens, deps);
          if (conflito) throw new ErroNegocio('data_antes_da_dependencia', conflito);
          itens.push({
            idCenario,
            status: 'agendado',
            ...(dataPlanejada ? { dataPlanejada } : {}),
            posicao: proximaPosicao(itens),
            versao: 1,
          });
          incluidos.push(idCenario);
        }
        const novo: Plano = { ...atual, itens };
        if (incluidos.length > 0) await gravar(substituir(arquivo, novo));
        return { ...(await detalhe(novo)), incluidos };
      });
    },

    removerTeste(id, idCenario) {
      return emFila(async () => {
        const arquivo = await ler();
        const atual = achar(arquivo, id);
        if (!atual.itens.some((i) => i.idCenario === idCenario)) {
          throw new ErroNegocio('nao_encontrado', `O teste ${idCenario} não está no plano ${atual.nome}.`);
        }
        await gravar(substituir(arquivo, { ...atual, itens: atual.itens.filter((i) => i.idCenario !== idCenario) }));
      });
    },

    alterarLote(id, idCenarios, campos) {
      return emFila(async () => {
        const arquivo = await ler();
        const atual = achar(arquivo, id);
        const noPlano = new Set(atual.itens.map((i) => i.idCenario));
        const fora = idCenarios.filter((c) => !noPlano.has(c));
        if (fora.length > 0) throw new ErroNegocio('nao_encontrado', `Teste(s) fora do plano ${atual.nome}: ${fora.join(', ')}.`);

        const instante = agora().toISOString();
        const escolhidos = new Set(idCenarios);
        const novo: Plano = { ...atual, itens: atual.itens.map((i) => (escolhidos.has(i.idCenario) ? aplicarPatch(i, campos, instante) : i)) };
        await gravar(substituir(arquivo, novo));
        return detalhe(novo);
      });
    },

    moverTestes(idOrigem, idCenarios, idDestino) {
      return emFila(async () => {
        const arquivo = await ler();
        const origem = achar(arquivo, idOrigem);
        const destino = achar(arquivo, idDestino);
        if (origem.id === destino.id) throw new ErroNegocio('ja_no_plano', 'O plano de destino é o mesmo plano de origem.');

        const escolhidos = new Set(idCenarios);
        const fora = idCenarios.filter((c) => !origem.itens.some((i) => i.idCenario === c));
        if (fora.length > 0) throw new ErroNegocio('nao_encontrado', `Teste(s) fora do plano ${origem.nome}: ${fora.join(', ')}.`);
        // Na ordem em que estão no plano de origem.
        const movendo = origem.itens.filter((i) => escolhidos.has(i.idCenario)).sort((a, b) => a.posicao - b.posicao);

        const iniciados = movendo.filter((i) => i.status !== 'agendado').map((i) => i.idCenario);
        if (iniciados.length > 0) {
          throw new ErroNegocio('teste_iniciado', `Só testes ainda não iniciados mudam de plano: ${iniciados.join(', ')} já começou.`);
        }
        const repetidos = movendo.filter((i) => destino.itens.some((d) => d.idCenario === i.idCenario)).map((i) => i.idCenario);
        if (repetidos.length > 0) throw new ErroNegocio('ja_no_plano', `Já está no plano ${destino.nome}: ${repetidos.join(', ')}.`);
        if (resumir(destino).executado) {
          throw new ErroNegocio('plano_concluido', `O plano ${destino.nome} já foi concluído: escolha um plano em execução.`);
        }

        const deps = dependencias(await catalogo());
        const instante = agora().toISOString();
        const itensDestino = [...destino.itens];
        for (const original of movendo) {
          const conflito = conflitoDeData(original.idCenario, original.dataPlanejada, itensDestino, deps);
          if (conflito) throw new ErroNegocio('data_antes_da_dependencia', conflito);
          itensDestino.push({ ...original, status: 'agendado', posicao: proximaPosicao(itensDestino), versao: 1, atualizadoEm: instante });
        }

        const novaOrigem: Plano = { ...origem, itens: origem.itens.filter((i) => !escolhidos.has(i.idCenario)) };
        const novoDestino: Plano = { ...destino, itens: itensDestino };
        await gravar(arquivo.planos.map((p) => (p.id === origem.id ? novaOrigem : p.id === destino.id ? novoDestino : p)));
        return { origem: await detalhe(novaOrigem), movidos: movendo.map((i) => i.idCenario) };
      });
    },

    async planosComResponsavel(idPessoa) {
      return (await ler()).planos.filter((p) => p.itens.some((i) => i.responsavel === idPessoa)).map((p) => p.nome);
    },

    reordenar(id, ordem) {
      return emFila(async () => {
        const arquivo = await ler();
        const atual = achar(arquivo, id);
        const noPlano = new Set(atual.itens.map((i) => i.idCenario));
        if (ordem.length !== noPlano.size || new Set(ordem).size !== ordem.length || !ordem.every((c) => noPlano.has(c))) {
          throw new ErroNegocio('ordem_desatualizada', 'Os testes do plano mudaram. Recarregue o plano e ordene de novo.');
        }

        const deps = dependencias(await catalogo());
        ordem.forEach((idCenario, indice) => {
          for (const dep of deps.get(idCenario) ?? []) {
            const posDep = ordem.indexOf(dep);
            if (posDep > indice) {
              throw new ErroNegocio('ordem_invalida', `${dep} precisa ficar antes de ${idCenario}: usam a mesma massa e ${dep} roda primeiro.`);
            }
          }
        });

        // Só a posição muda: a versão de cada teste fica, para não gerar falso conflito com quem edita observações.
        const posicao = new Map(ordem.map((c, i) => [c, i + 1]));
        const novo: Plano = { ...atual, itens: atual.itens.map((i) => ({ ...i, posicao: posicao.get(i.idCenario) ?? i.posicao })) };
        await gravar(substituir(arquivo, novo));
        return detalhe(novo);
      });
    },

    alterarItem(id, idCenario, versao, campos) {
      return emFila(async () => {
        const arquivo = await ler();
        const atual = achar(arquivo, id);
        const item = atual.itens.find((i) => i.idCenario === idCenario);
        if (!item) throw new ErroNegocio('nao_encontrado', `O teste ${idCenario} não está no plano ${atual.nome}.`);
        if (item.versao !== versao) {
          throw new ErroNegocio('versao_antiga', `O teste ${idCenario} foi alterado por outra pessoa. Recarregue antes de salvar.`);
        }

        const novo = aplicarPatch(item, campos, agora().toISOString());
        const cenarios = await catalogo();
        const deps = dependencias(cenarios);

        if (campos.status !== undefined && (novo.status === 'em_andamento' || novo.status === 'concluido')) {
          const pendencias = pendenciasDeDependencia(deps.get(idCenario) ?? [], atual.itens);
          if (pendencias.length > 0) throw new ErroNegocio('dependencia_pendente', mensagemDependencia(idCenario, pendencias));
        }
        if (campos.dataPlanejada !== undefined) {
          const conflito = conflitoDeData(idCenario, novo.dataPlanejada, atual.itens, deps);
          if (conflito) throw new ErroNegocio('data_antes_da_dependencia', conflito);
        }

        const plano: Plano = { ...atual, itens: atual.itens.map((i) => (i.idCenario === idCenario ? novo : i)) };
        await gravar(substituir(arquivo, plano));
        return visaoDoItem(novo, plano, new Map(cenarios.map((c) => [c.idCenario, c])));
      });
    },

    registrarDecisao(id, entrada) {
      return emFila(async () => {
        const arquivo = await ler();
        const atual = achar(arquivo, id);
        const decisoes = atual.decisoes ?? [];
        let idDecisao = `dc_${randomBytes(4).toString('hex')}`;
        while (decisoes.some((d) => d.id === idDecisao)) idDecisao = `dc_${randomBytes(4).toString('hex')}`;
        const novo: Plano = { ...atual, decisoes: [...decisoes, { id: idDecisao, ...entrada, em: agora().toISOString() }] };
        await gravar(substituir(arquivo, novo));
        return detalhe(novo);
      });
    },

    async historicoDoCenario(idCenario) {
      const linhas: HistoricoDoTeste[] = [];
      for (const p of (await ler()).planos) {
        const i = p.itens.find((x) => x.idCenario === idCenario);
        if (!i) continue;
        linhas.push({
          planoId: p.id,
          planoNome: p.nome,
          criadoEm: p.criadoEm,
          status: i.status,
          ...(i.resultado ? { resultado: i.resultado } : {}),
          ...(i.dataPlanejada ? { dataPlanejada: i.dataPlanejada } : {}),
          ...(i.dataExecucao ? { dataExecucao: i.dataExecucao } : {}),
          ...(i.responsavel ? { responsavel: i.responsavel } : {}),
          ...(i.observacoes ? { observacoes: i.observacoes } : {}),
        });
      }
      return linhas;
    },

    async planosQueUsam(idCenario) {
      return (await ler()).planos.filter((p) => p.itens.some((i) => i.idCenario === idCenario)).map((p) => p.nome);
    },
  };
}
