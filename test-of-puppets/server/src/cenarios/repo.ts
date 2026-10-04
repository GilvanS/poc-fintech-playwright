import { ErroNegocio } from '../erros.ts';
import { gravarJson, lerJson } from '../store/json.ts';
import { derivarMassa, type Cenario, type CenarioEntrada, type CenarioVisao } from './modelo.ts';

interface Arquivo {
  cenarios: Cenario[];
}

export interface RepoCenarios {
  listar(): Promise<CenarioVisao[]>;
  criar(entrada: CenarioEntrada): Promise<Cenario>;
  /** O ID não muda; `versao` é a que a pessoa viu ao abrir o cadastro. */
  atualizar(idCenario: string, entrada: CenarioEntrada, versao: number): Promise<Cenario>;
  excluir(idCenario: string): Promise<void>;
}

export function criarRepoCenarios(caminho: string, agora: () => Date = () => new Date()): RepoCenarios {
  // Várias pessoas usam o mesmo servidor: ler-alterar-gravar entra numa fila para ninguém perder cadastro.
  let fila: Promise<unknown> = Promise.resolve();
  function emFila<T>(tarefa: () => Promise<T>): Promise<T> {
    const resultado = fila.then(tarefa);
    fila = resultado.catch(() => undefined);
    return resultado;
  }

  const ler = () => lerJson<Arquivo>(caminho, { cenarios: [] });

  return {
    async listar() {
      return derivarMassa((await ler()).cenarios);
    },

    criar(entrada) {
      return emFila(async () => {
        const arquivo = await ler();
        if (arquivo.cenarios.some((c) => c.idCenario === entrada.idCenario)) {
          throw new ErroNegocio('id_duplicado', `Já existe um cenário ${entrada.idCenario}.`);
        }
        const instante = agora().toISOString();
        const novo: Cenario = { ...entrada, versao: 1, criadoEm: instante, atualizadoEm: instante };
        await gravarJson(caminho, { cenarios: [...arquivo.cenarios, novo] });
        return novo;
      });
    },

    atualizar(idCenario, entrada, versao) {
      return emFila(async () => {
        const arquivo = await ler();
        const atual = arquivo.cenarios.find((c) => c.idCenario === idCenario);
        if (!atual) throw new ErroNegocio('nao_encontrado', `Cenário ${idCenario} não encontrado.`);
        if (atual.versao !== versao) {
          throw new ErroNegocio('versao_antiga', `O cenário ${idCenario} foi alterado por outra pessoa. Recarregue antes de salvar.`);
        }
        const novo: Cenario = {
          ...entrada,
          idCenario,
          versao: atual.versao + 1,
          criadoEm: atual.criadoEm,
          atualizadoEm: agora().toISOString(),
        };
        await gravarJson(caminho, { cenarios: arquivo.cenarios.map((c) => (c.idCenario === idCenario ? novo : c)) });
        return novo;
      });
    },

    excluir(idCenario) {
      return emFila(async () => {
        const arquivo = await ler();
        if (!arquivo.cenarios.some((c) => c.idCenario === idCenario)) {
          throw new ErroNegocio('nao_encontrado', `Cenário ${idCenario} não encontrado.`);
        }
        await gravarJson(caminho, { cenarios: arquivo.cenarios.filter((c) => c.idCenario !== idCenario) });
      });
    },
  };
}
