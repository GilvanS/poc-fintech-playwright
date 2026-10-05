import { pedir } from '../pages/cenarios/clienteApi.ts';

export type RegraLinha = 'atualiza' | 'igual' | 'imutavel' | 'ignorado';

export interface LinhaDiff {
  coluna: string;
  antes: string;
  depois: string;
  regra: RegraLinha;
  motivo?: string;
}

/** O que o servidor mostraria gravar na planilha de massa (nada foi gravado ainda). */
export interface PropostaMassa {
  propostaId: string;
  cpf: string;
  fonte: { origem: string; lidoEm: string };
  linhas: LinhaDiff[];
  temMudanca: boolean;
  /** Quando preenchido, não dá para gravar agora (ex.: Excel aberto). */
  bloqueio?: string;
  backup: string;
  planilha: string;
}

export interface ResultadoGravacao {
  cpf: string;
  backup: string;
  gravadas: { coluna: string; valor: string }[];
}

/** Só lê (planilha e FintechBankApp) e devolve o diff. */
export const proporAtualizacaoDeMassa = (cpf: string) => pedir<{ proposta: PropostaMassa }>('POST', '/api/massa/proposta', { cpf });
/** O único passo que grava: confirma a proposta que a pessoa viu. */
export const confirmarAtualizacaoDeMassa = (propostaId: string) => pedir<{ resultado: ResultadoGravacao }>('POST', '/api/massa/confirmar', { propostaId });
