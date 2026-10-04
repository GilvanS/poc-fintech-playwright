import { gravarJson, lerJson } from '../store/json.ts';

interface Lido {
  /** Id da pessoa ("Você"); vazio quando ninguém estava escolhido. */
  pessoa: string;
  chave: string;
  em: string;
}

interface Arquivo {
  lidos: Lido[];
}

export interface RepoLembretes {
  /** As chaves que a pessoa já marcou como lidas. */
  lidasDe(pessoa: string | null): Promise<Set<string>>;
  /**
   * Marca (ou desmarca) lembretes como lidos para a pessoa. Só vale para chaves que ainda existem (`ativas`) e,
   * de passagem, apaga as marcas dela que não existem mais (o motivo acabou), para o arquivo não crescer sem fim.
   */
  marcar(pessoa: string | null, chaves: string[], lida: boolean, ativas: Set<string>): Promise<void>;
}

interface Opcoes {
  agora?: () => Date;
}

export function criarRepoLembretes(caminho: string, { agora = () => new Date() }: Opcoes = {}): RepoLembretes {
  let fila: Promise<unknown> = Promise.resolve();
  function emFila<T>(tarefa: () => Promise<T>): Promise<T> {
    const resultado = fila.then(tarefa);
    fila = resultado.catch(() => undefined);
    return resultado;
  }
  const ler = async () => (await lerJson<Arquivo>(caminho, { lidos: [] })).lidos;

  return {
    async lidasDe(pessoa) {
      const dono = pessoa ?? '';
      return new Set((await ler()).filter((l) => l.pessoa === dono).map((l) => l.chave));
    },

    marcar(pessoa, chaves, lida, ativas) {
      return emFila(async () => {
        const dono = pessoa ?? '';
        const todos = await ler();
        const validas = new Set(chaves.filter((c) => ativas.has(c)));
        // Marcas das outras pessoas ficam como estão; as desta pessoa perdem as que não existem mais e as desmarcadas.
        const outros = todos.filter((l) => l.pessoa !== dono);
        const dela = todos.filter((l) => l.pessoa === dono && ativas.has(l.chave) && !(!lida && validas.has(l.chave)));
        if (lida) {
          const ja = new Set(dela.map((l) => l.chave));
          for (const chave of validas) if (!ja.has(chave)) dela.push({ pessoa: dono, chave, em: agora().toISOString() });
        }
        await gravarJson(caminho, { lidos: [...outros, ...dela] });
      });
    },
  };
}
