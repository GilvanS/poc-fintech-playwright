import { ErroNegocio } from '../erros.ts';
import { gravarJson, lerJson } from '../store/json.ts';
import { gerarId, type CamposPessoa, type Pessoa } from './modelo.ts';

interface Arquivo {
  pessoas: Pessoa[];
}

export interface RepoPessoas {
  listar(): Promise<Pessoa[]>;
  criar(campos: CamposPessoa): Promise<Pessoa>;
  /** O id não muda; `versao` é a que a pessoa viu ao abrir o cadastro. Campo ausente mantém o valor atual. */
  atualizar(id: string, campos: CamposPessoa, versao: number): Promise<Pessoa>;
  excluir(id: string): Promise<void>;
}

interface Opcoes {
  agora?: () => Date;
  /** Nomes dos planos em que a pessoa é responsável por algum teste (impede a exclusão). */
  planosComResponsavel?: (id: string) => Promise<string[]>;
}

const mesmoNome = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export function criarRepoPessoas(caminho: string, { agora = () => new Date(), planosComResponsavel = async () => [] }: Opcoes = {}): RepoPessoas {
  let fila: Promise<unknown> = Promise.resolve();
  function emFila<T>(tarefa: () => Promise<T>): Promise<T> {
    const resultado = fila.then(tarefa);
    fila = resultado.catch(() => undefined);
    return resultado;
  }
  const ler = () => lerJson<Arquivo>(caminho, { pessoas: [] });
  const gravar = (pessoas: Pessoa[]) => gravarJson(caminho, { pessoas });

  return {
    async listar() {
      return (await ler()).pessoas;
    },

    criar(campos) {
      return emFila(async () => {
        const { pessoas } = await ler();
        if (pessoas.some((p) => mesmoNome(p.nome, campos.nome))) {
          throw new ErroNegocio('nome_duplicado', `Já existe uma pessoa chamada ${campos.nome}.`);
        }
        const instante = agora().toISOString();
        const nova: Pessoa = {
          id: gerarId(campos.nome, pessoas.map((p) => p.id)),
          nome: campos.nome,
          capacidadeMinSemana: campos.capacidadeMinSemana ?? 0,
          cor: campos.cor ?? 'azul',
          ativa: campos.ativa ?? true,
          versao: 1,
          criadoEm: instante,
          atualizadoEm: instante,
        };
        await gravar([...pessoas, nova]);
        return nova;
      });
    },

    atualizar(id, campos, versao) {
      return emFila(async () => {
        const { pessoas } = await ler();
        const atual = pessoas.find((p) => p.id === id);
        if (!atual) throw new ErroNegocio('nao_encontrado', `Pessoa ${id} não encontrada.`);
        if (atual.versao !== versao) {
          throw new ErroNegocio('versao_antiga', `${atual.nome} foi alterada por outra pessoa. Recarregue antes de salvar.`);
        }
        if (pessoas.some((p) => p.id !== id && mesmoNome(p.nome, campos.nome))) {
          throw new ErroNegocio('nome_duplicado', `Já existe uma pessoa chamada ${campos.nome}.`);
        }
        const nova: Pessoa = {
          ...atual,
          nome: campos.nome,
          capacidadeMinSemana: campos.capacidadeMinSemana ?? atual.capacidadeMinSemana,
          cor: campos.cor ?? atual.cor,
          ativa: campos.ativa ?? atual.ativa,
          versao: atual.versao + 1,
          atualizadoEm: agora().toISOString(),
        };
        await gravar(pessoas.map((p) => (p.id === id ? nova : p)));
        return nova;
      });
    },

    excluir(id) {
      return emFila(async () => {
        const { pessoas } = await ler();
        const atual = pessoas.find((p) => p.id === id);
        if (!atual) throw new ErroNegocio('nao_encontrado', `Pessoa ${id} não encontrada.`);
        const planos = [...new Set(await planosComResponsavel(id))];
        if (planos.length > 0) {
          throw new ErroNegocio(
            'pessoa_em_uso',
            `${atual.nome} é responsável por testes nos planos: ${planos.join(', ')}. Troque o responsável ou apenas desative a pessoa.`,
          );
        }
        await gravar(pessoas.filter((p) => p.id !== id));
      });
    },
  };
}
