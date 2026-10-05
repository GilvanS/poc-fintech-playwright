import { pedir } from '../pages/cenarios/clienteApi.ts';

export interface RespostaPresenca {
  /** Ids das pessoas com a ferramenta aberta, na ordem em que apareceram. */
  online: string[];
}

/** Diz ao servidor que a pessoa está com a tela aberta e devolve quem está online. */
export const baterPresenca = (pessoa: string) => pedir<RespostaPresenca>('POST', '/api/presenca', { pessoa });
/** Só olha quem está online (sem dar sinal: usado quando ninguém foi escolhido em "Você" ou a aba está escondida). */
export const verPresenca = () => pedir<RespostaPresenca>('GET', '/api/presenca');
