import { randomBytes } from 'node:crypto';
import { ErroNegocio } from '../erros.ts';
import { gravarJson, lerJson } from '../store/json.ts';
import type { Acao, EdicaoAcao, MudancaEstado, NovaAcao, NovaNota, Nota, Retro } from './modelo.ts';

interface Arquivo {
  retros: Retro[];
}

export interface RepoRetros {
  /** A retro do plano; plano sem registro devolve uma retro vazia e aberta (nada é gravado). */
  obter(planoId: string): Promise<Retro>;
  /** Todas as retros que já têm algum registro (para lembrar ações pendentes de planos anteriores). */
  listar(): Promise<Retro[]>;
  adicionarNota(planoId: string, nota: NovaNota): Promise<Retro>;
  excluirNota(planoId: string, notaId: string): Promise<Retro>;
  /** Liga/desliga o voto da pessoa na nota. */
  votar(planoId: string, notaId: string, pessoa: string): Promise<Retro>;
  /** Fecha/reabre a retro e liga/desliga as notas anônimas. */
  mudarEstado(planoId: string, mudanca: MudancaEstado): Promise<Retro>;
  adicionarAcao(planoId: string, acao: NovaAcao): Promise<Retro>;
  editarAcao(planoId: string, acaoId: string, campos: EdicaoAcao): Promise<Retro>;
  excluirAcao(planoId: string, acaoId: string): Promise<Retro>;
}

interface Opcoes {
  /** Diz se o plano existe (lança nao_encontrado se não) e se já terminou. A retro só abre com o plano concluído. */
  plano: (planoId: string) => Promise<{ executado: boolean; nome: string }>;
  agora?: () => Date;
}

const novoId = (prefixo: string) => `${prefixo}_${randomBytes(4).toString('hex')}`;

const vazia = (planoId: string): Retro => ({ planoId, status: 'aberta', anonimas: false, fechadaEm: null, fechadaPor: null, notas: [], acoes: [], atualizadoEm: null });

export function criarRepoRetros(caminho: string, { plano, agora = () => new Date() }: Opcoes): RepoRetros {
  let fila: Promise<unknown> = Promise.resolve();
  function emFila<T>(tarefa: () => Promise<T>): Promise<T> {
    const resultado = fila.then(tarefa);
    fila = resultado.catch(() => undefined);
    return resultado;
  }
  const ler = async () => (await lerJson<Arquivo>(caminho, { retros: [] })).retros;

  async function gravarRetro(lista: Retro[], retro: Retro): Promise<Retro> {
    const pronta: Retro = { ...retro, atualizadoEm: agora().toISOString() };
    const existe = lista.some((r) => r.planoId === retro.planoId);
    await gravarJson(caminho, { retros: existe ? lista.map((r) => (r.planoId === retro.planoId ? pronta : r)) : [...lista, pronta] });
    return pronta;
  }

  /** Plano existe? (404 se não). Notas, votos e fechamento exigem plano concluído; ações não. */
  async function carregar(planoId: string, exigirConcluido: boolean): Promise<{ lista: Retro[]; retro: Retro }> {
    const info = await plano(planoId);
    if (exigirConcluido && !info.executado) {
      throw new ErroNegocio('retro_indisponivel', `O plano ${info.nome} ainda está em andamento. A retrospectiva abre quando todos os testes estiverem concluídos.`);
    }
    const lista = await ler();
    return { lista, retro: lista.find((r) => r.planoId === planoId) ?? vazia(planoId) };
  }

  function exigirAberta(retro: Retro): void {
    if (retro.status === 'fechada') throw new ErroNegocio('retro_fechada', 'A retrospectiva está fechada: reabra para mexer em notas e votos.');
  }

  function achar<T extends { id: string }>(itens: T[], id: string, rotulo: string): T {
    const item = itens.find((i) => i.id === id);
    if (!item) throw new ErroNegocio('nao_encontrado', `${rotulo} ${id} não encontrada.`);
    return item;
  }

  return {
    async obter(planoId) {
      return (await carregar(planoId, false)).retro;
    },

    listar: ler,

    adicionarNota(planoId, entrada) {
      return emFila(async () => {
        const { lista, retro } = await carregar(planoId, true);
        exigirAberta(retro);
        const nota: Nota = { id: novoId('nt'), coluna: entrada.coluna, texto: entrada.texto, autor: entrada.autor, em: agora().toISOString(), votos: [] };
        return gravarRetro(lista, { ...retro, notas: [...retro.notas, nota] });
      });
    },

    excluirNota(planoId, notaId) {
      return emFila(async () => {
        const { lista, retro } = await carregar(planoId, true);
        exigirAberta(retro);
        achar(retro.notas, notaId, 'Nota');
        return gravarRetro(lista, { ...retro, notas: retro.notas.filter((n) => n.id !== notaId) });
      });
    },

    votar(planoId, notaId, pessoa) {
      return emFila(async () => {
        const { lista, retro } = await carregar(planoId, true);
        exigirAberta(retro);
        const nota = achar(retro.notas, notaId, 'Nota');
        const votos = nota.votos.includes(pessoa) ? nota.votos.filter((v) => v !== pessoa) : [...nota.votos, pessoa];
        return gravarRetro(lista, { ...retro, notas: retro.notas.map((n) => (n.id === notaId ? { ...n, votos } : n)) });
      });
    },

    mudarEstado(planoId, mudanca) {
      return emFila(async () => {
        // Reabrir não exige plano concluído (o plano pode ter voltado a andar depois); fechar e mexer em anonimato exigem.
        const reabrindo = mudanca.status === 'aberta';
        const { lista, retro } = await carregar(planoId, !reabrindo);
        let novo: Retro = { ...retro };
        if (mudanca.anonimas !== undefined) {
          exigirAberta(retro);
          novo = { ...novo, anonimas: mudanca.anonimas };
        }
        if (mudanca.status === 'fechada' && retro.status === 'aberta') {
          novo = { ...novo, status: 'fechada', fechadaEm: agora().toISOString(), fechadaPor: mudanca.autor };
        } else if (mudanca.status === 'aberta' && retro.status === 'fechada') {
          novo = { ...novo, status: 'aberta', fechadaEm: null, fechadaPor: null };
        }
        return gravarRetro(lista, novo);
      });
    },

    adicionarAcao(planoId, entrada) {
      return emFila(async () => {
        const { lista, retro } = await carregar(planoId, false);
        const acao: Acao = {
          id: novoId('ac'),
          texto: entrada.texto,
          responsavel: entrada.responsavel,
          prazo: entrada.prazo,
          feito: false,
          feitoEm: null,
          feitoPor: null,
          origem: entrada.origem,
          incId: entrada.incId,
          criadaEm: agora().toISOString(),
          criadaPor: entrada.autor,
        };
        return gravarRetro(lista, { ...retro, acoes: [...retro.acoes, acao] });
      });
    },

    editarAcao(planoId, acaoId, campos) {
      return emFila(async () => {
        const { lista, retro } = await carregar(planoId, false);
        const atual = achar(retro.acoes, acaoId, 'Ação');
        const nova: Acao = { ...atual };
        if (campos.texto !== undefined) nova.texto = campos.texto;
        if (campos.responsavel !== undefined) nova.responsavel = campos.responsavel;
        if (campos.prazo !== undefined) nova.prazo = campos.prazo;
        if (campos.feito !== undefined && campos.feito !== atual.feito) {
          nova.feito = campos.feito;
          nova.feitoEm = campos.feito ? agora().toISOString() : null;
          nova.feitoPor = campos.feito ? campos.autor : null;
        }
        return gravarRetro(lista, { ...retro, acoes: retro.acoes.map((a) => (a.id === acaoId ? nova : a)) });
      });
    },

    excluirAcao(planoId, acaoId) {
      return emFila(async () => {
        const { lista, retro } = await carregar(planoId, false);
        achar(retro.acoes, acaoId, 'Ação');
        return gravarRetro(lista, { ...retro, acoes: retro.acoes.filter((a) => a.id !== acaoId) });
      });
    },
  };
}
