import { gravarJson, lerJson } from '../store/json.ts';
import { WIP_PADRAO, type Config, type Wip } from './modelo.ts';

export interface RepoConfig {
  /** A configuração gravada; o que falta no arquivo vem do padrão. */
  obter(): Promise<Config>;
  /** Muda só as colunas informadas e devolve a configuração completa. */
  salvarWip(parcial: Partial<Wip>): Promise<Config>;
}

interface Arquivo {
  wip?: Partial<Wip>;
}

export function criarRepoConfig(caminho: string): RepoConfig {
  let fila: Promise<unknown> = Promise.resolve();
  function emFila<T>(tarefa: () => Promise<T>): Promise<T> {
    const resultado = fila.then(tarefa);
    fila = resultado.catch(() => undefined);
    return resultado;
  }
  const ler = async (): Promise<Config> => {
    const arquivo = await lerJson<Arquivo>(caminho, {});
    return { wip: { ...WIP_PADRAO, ...arquivo.wip } };
  };

  return {
    obter: ler,
    salvarWip(parcial) {
      return emFila(async () => {
        const atual = await ler();
        const nova: Config = { wip: { ...atual.wip, ...parcial } };
        await gravarJson(caminho, nova);
        return nova;
      });
    },
  };
}
