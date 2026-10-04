import { gravarJson, lerJson } from '../store/json.ts';
import { LEMBRETES_PADRAO, WIP_PADRAO, type Config, type Lembretes, type ParcialConfig, type Wip } from './modelo.ts';

export interface RepoConfig {
  /** A configuração gravada; o que falta no arquivo vem do padrão. */
  obter(): Promise<Config>;
  /** Muda só o que veio (colunas do WIP e/ou tipos de lembrete) e devolve a configuração completa. */
  salvar(parcial: ParcialConfig): Promise<Config>;
}

interface Arquivo {
  wip?: Partial<Wip>;
  lembretes?: Partial<Lembretes>;
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
    return { wip: { ...WIP_PADRAO, ...arquivo.wip }, lembretes: { ...LEMBRETES_PADRAO, ...arquivo.lembretes } };
  };

  return {
    obter: ler,
    salvar(parcial) {
      return emFila(async () => {
        const atual = await ler();
        const nova: Config = { wip: { ...atual.wip, ...parcial.wip }, lembretes: { ...atual.lembretes, ...parcial.lembretes } };
        await gravarJson(caminho, nova);
        return nova;
      });
    },
  };
}
