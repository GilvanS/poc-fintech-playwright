import { ErroNegocio } from '../erros.ts';
import { gravarJson, lerJson } from '../store/json.ts';
import type { EdicaoIncidente, EntradaHistorico, Incidente, NovoIncidente, TipoHistorico } from './modelo.ts';

interface Arquivo {
  incidentes: Incidente[];
}

export interface RepoIncidentes {
  listar(): Promise<Incidente[]>;
  obter(numero: string): Promise<Incidente>;
  criar(entrada: NovoIncidente): Promise<Incidente>;
  /** `versao` é a que a pessoa viu ao abrir o INC. Campo que não veio fica como está. */
  editar(numero: string, versao: number, campos: EdicaoIncidente, autor: string | null): Promise<Incidente>;
  /** Liga o INC a mais testes (os que já estavam ligados são ignorados). */
  vincular(numero: string, idCenarios: string[], autor: string | null): Promise<Incidente>;
  desvincular(numero: string, idCenario: string, autor: string | null): Promise<Incidente>;
  comentar(numero: string, texto: string, autor: string | null): Promise<Incidente>;
  excluir(numero: string): Promise<void>;
}

interface Opcoes {
  agora?: () => Date;
  /** Cadastro de cenários, para recusar INC ligado a teste que não existe. */
  catalogo?: () => Promise<{ idCenario: string }[]>;
}

export function criarRepoIncidentes(caminho: string, { agora = () => new Date(), catalogo }: Opcoes = {}): RepoIncidentes {
  let fila: Promise<unknown> = Promise.resolve();
  function emFila<T>(tarefa: () => Promise<T>): Promise<T> {
    const resultado = fila.then(tarefa);
    fila = resultado.catch(() => undefined);
    return resultado;
  }
  const ler = async () => (await lerJson<Arquivo>(caminho, { incidentes: [] })).incidentes;
  const gravar = (incidentes: Incidente[]) => gravarJson(caminho, { incidentes });

  const achar = (lista: Incidente[], numero: string): Incidente => {
    const inc = lista.find((i) => i.numero === numero);
    if (!inc) throw new ErroNegocio('nao_encontrado', `INC ${numero} não encontrado.`);
    return inc;
  };

  async function exigirCenarios(ids: string[]): Promise<void> {
    if (!catalogo || ids.length === 0) return;
    const existentes = new Set((await catalogo()).map((c) => c.idCenario));
    const faltam = ids.filter((id) => !existentes.has(id));
    if (faltam.length > 0) throw new ErroNegocio('cenario_inexistente', `Cenário(s) que não existem no cadastro: ${faltam.join(', ')}.`);
  }

  const entrada = (em: string, autor: string | null, tipo: TipoHistorico, de?: string | null, para?: string | null): EntradaHistorico => ({
    em,
    autor,
    tipo,
    ...(de !== undefined ? { de } : {}),
    ...(para !== undefined ? { para } : {}),
  });

  /** Grava o INC alterado: sobe a versão e a data só se houve mudança de verdade. */
  async function salvar(lista: Incidente[], atual: Incidente, novo: Incidente, historico: EntradaHistorico[]): Promise<Incidente> {
    if (historico.length === 0 && novo.comentarios.length === atual.comentarios.length) return atual;
    const pronto: Incidente = { ...novo, historico: [...novo.historico, ...historico], atualizadoEm: agora().toISOString(), versao: atual.versao + 1 };
    await gravar(lista.map((i) => (i.numero === atual.numero ? pronto : i)));
    return pronto;
  }

  return {
    listar: ler,

    async obter(numero) {
      return achar(await ler(), numero);
    },

    criar(dados) {
      return emFila(async () => {
        const lista = await ler();
        if (lista.some((i) => i.numero === dados.numero)) throw new ErroNegocio('id_duplicado', `Já existe o INC ${dados.numero}.`);
        const testes = dados.testesAfetados ?? [];
        await exigirCenarios(testes);
        const instante = dados.abertoEm ?? agora().toISOString();
        const status = dados.status ?? 'novo';
        const autor = dados.autor ?? null;
        const novo: Incidente = {
          numero: dados.numero,
          titulo: dados.titulo,
          descricao: dados.descricao ?? '',
          status,
          severidade: dados.severidade ?? 'media',
          responsavel: dados.responsavel ?? null,
          testesAfetados: testes,
          comentarios: [],
          historico: [entrada(instante, autor, 'registro'), ...testes.map((t) => entrada(instante, autor, 'vinculo', null, t))],
          abertoEm: instante,
          resolvidoEm: status === 'resolvido' ? (dados.resolvidoEm ?? instante) : null,
          atualizadoEm: instante,
          versao: 1,
        };
        await gravar([...lista, novo]);
        return novo;
      });
    },

    editar(numero, versao, campos, autor) {
      return emFila(async () => {
        const lista = await ler();
        const atual = achar(lista, numero);
        if (atual.versao !== versao) {
          throw new ErroNegocio('versao_antiga', `${numero} foi alterado por outra pessoa. Recarregue antes de salvar.`);
        }
        const agoraISO = agora().toISOString();
        const historico: EntradaHistorico[] = [];
        const novo: Incidente = { ...atual };

        if (campos.titulo !== undefined && campos.titulo !== atual.titulo) {
          novo.titulo = campos.titulo;
          historico.push(entrada(agoraISO, autor, 'titulo', atual.titulo, campos.titulo));
        }
        if (campos.descricao !== undefined && campos.descricao !== atual.descricao) {
          novo.descricao = campos.descricao;
          historico.push(entrada(agoraISO, autor, 'descricao'));
        }
        if (campos.status !== undefined && campos.status !== atual.status) {
          novo.status = campos.status;
          novo.resolvidoEm = campos.status === 'resolvido' ? agoraISO : null;
          historico.push(entrada(agoraISO, autor, 'status', atual.status, campos.status));
        }
        if (campos.severidade !== undefined && campos.severidade !== atual.severidade) {
          novo.severidade = campos.severidade;
          historico.push(entrada(agoraISO, autor, 'severidade', atual.severidade, campos.severidade));
        }
        if (campos.responsavel !== undefined && campos.responsavel !== atual.responsavel) {
          novo.responsavel = campos.responsavel;
          historico.push(entrada(agoraISO, autor, 'responsavel', atual.responsavel, campos.responsavel));
        }
        if (campos.testesAfetados !== undefined) {
          const queroter = campos.testesAfetados;
          const entram = queroter.filter((t) => !atual.testesAfetados.includes(t));
          const saem = atual.testesAfetados.filter((t) => !queroter.includes(t));
          await exigirCenarios(entram);
          novo.testesAfetados = [...atual.testesAfetados.filter((t) => !saem.includes(t)), ...entram];
          historico.push(...entram.map((t) => entrada(agoraISO, autor, 'vinculo', null, t)), ...saem.map((t) => entrada(agoraISO, autor, 'desvinculo', t, null)));
        }
        return salvar(lista, atual, novo, historico);
      });
    },

    vincular(numero, idCenarios, autor) {
      return emFila(async () => {
        const lista = await ler();
        const atual = achar(lista, numero);
        const novos = idCenarios.filter((t) => !atual.testesAfetados.includes(t));
        await exigirCenarios(novos);
        const agoraISO = agora().toISOString();
        return salvar(lista, atual, { ...atual, testesAfetados: [...atual.testesAfetados, ...novos] }, novos.map((t) => entrada(agoraISO, autor, 'vinculo', null, t)));
      });
    },

    desvincular(numero, idCenario, autor) {
      return emFila(async () => {
        const lista = await ler();
        const atual = achar(lista, numero);
        if (!atual.testesAfetados.includes(idCenario)) throw new ErroNegocio('nao_encontrado', `${idCenario} não está ligado ao ${numero}.`);
        const agoraISO = agora().toISOString();
        return salvar(lista, atual, { ...atual, testesAfetados: atual.testesAfetados.filter((t) => t !== idCenario) }, [entrada(agoraISO, autor, 'desvinculo', idCenario, null)]);
      });
    },

    comentar(numero, texto, autor) {
      return emFila(async () => {
        const lista = await ler();
        const atual = achar(lista, numero);
        const comentario = { id: `cm_${atual.comentarios.length + 1}`, autor, texto, em: agora().toISOString() };
        return salvar(lista, atual, { ...atual, comentarios: [...atual.comentarios, comentario] }, []);
      });
    },

    excluir(numero) {
      return emFila(async () => {
        const lista = await ler();
        achar(lista, numero);
        await gravar(lista.filter((i) => i.numero !== numero));
      });
    },
  };
}
