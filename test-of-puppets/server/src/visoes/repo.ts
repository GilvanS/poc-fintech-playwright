import { ErroNegocio } from '../erros.ts';
import { gravarJson, lerJson } from '../store/json.ts';
import { gerarIdVisao, type CamposVisao, type Visao } from './modelo.ts';

interface Arquivo {
  visoes: Visao[];
}

export interface RepoVisoes {
  /** Todas as visões gravadas; quem filtra por pessoa é a rota (`visiveisPara`). */
  listar(): Promise<Visao[]>;
  criar(campos: CamposVisao): Promise<Visao>;
  /** Visão pessoal só some pela mão do dono; para os outros ela nem existe. Compartilhada qualquer pessoa apaga. */
  excluir(id: string, quem: string | null): Promise<void>;
}

interface Opcoes {
  agora?: () => Date;
}

const mesmoNome = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export function criarRepoVisoes(caminho: string, { agora = () => new Date() }: Opcoes = {}): RepoVisoes {
  let fila: Promise<unknown> = Promise.resolve();
  function emFila<T>(tarefa: () => Promise<T>): Promise<T> {
    const resultado = fila.then(tarefa);
    fila = resultado.catch(() => undefined);
    return resultado;
  }
  const ler = () => lerJson<Arquivo>(caminho, { visoes: [] });
  const gravar = (visoes: Visao[]) => gravarJson(caminho, { visoes });

  return {
    async listar() {
      return (await ler()).visoes;
    },

    criar(campos) {
      return emFila(async () => {
        const { visoes } = await ler();
        // Nome repetido só incomoda dentro do que a mesma pessoa enxerga.
        const repetida = visoes.some(
          (v) => mesmoNome(v.nome, campos.nome) && (v.compartilhada || campos.compartilhada || v.dono === campos.dono),
        );
        if (repetida) throw new ErroNegocio('nome_duplicado', `Já existe uma visão chamada ${campos.nome}.`);
        const nova: Visao = {
          id: gerarIdVisao(campos.nome, visoes.map((v) => v.id)),
          nome: campos.nome,
          tipo: campos.tipo,
          dono: campos.dono,
          compartilhada: campos.compartilhada,
          filtros: campos.filtros,
          versao: 1,
          criadoEm: agora().toISOString(),
        };
        await gravar([...visoes, nova]);
        return nova;
      });
    },

    excluir(id, quem) {
      return emFila(async () => {
        const { visoes } = await ler();
        const atual = visoes.find((v) => v.id === id);
        if (!atual || (!atual.compartilhada && atual.dono !== quem)) {
          throw new ErroNegocio('nao_encontrado', `Visão ${id} não encontrada.`);
        }
        await gravar(visoes.filter((v) => v.id !== id));
      });
    },
  };
}
