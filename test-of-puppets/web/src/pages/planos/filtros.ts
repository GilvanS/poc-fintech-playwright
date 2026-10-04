import type { Status } from './clientePlanos.ts';

/** Filtros da tela do plano (valem para a lista e para os cards). Vazio = sem filtro. */
export interface Filtros {
  texto: string;
  funcionalidade: string;
  status: Status | '';
  /** aaaa-mm-dd */
  data: string;
  apenasHoje: boolean;
  datasPassadas: boolean;
  /** Id da pessoa, ou SEM_VALOR para os testes sem responsável. */
  responsavel: string;
  /** P1/P2/P3, ou SEM_VALOR para os testes sem prioridade. */
  prioridade: '' | 'P1' | 'P2' | 'P3' | typeof SEM_VALOR;
  /** Só os testes de quem é "Você". */
  somenteMeus: boolean;
  /** passou/falhou, ou SEM_VALOR para os concluídos sem resultado marcado. */
  resultado: '' | 'passou' | 'falhou' | typeof SEM_VALOR;
}

/** Valor especial dos filtros de responsável e prioridade: "sem ninguém" / "sem prioridade". */
export const SEM_VALOR = '__sem';

export const SEM_FILTROS: Filtros = {
  texto: '',
  funcionalidade: '',
  status: '',
  data: '',
  apenasHoje: false,
  datasPassadas: false,
  responsavel: '',
  prioridade: '',
  somenteMeus: false,
  resultado: '',
};

export interface LinhaFiltravel {
  idCenario: string;
  nome?: string;
  funcionalidade?: string;
  status: Status;
  resultado?: string;
  dataPlanejada?: string;
  responsavel?: string;
  prioridade?: string;
}

export function temFiltro(f: Filtros): boolean {
  return (
    f.texto.trim() !== '' ||
    f.funcionalidade !== '' ||
    f.status !== '' ||
    f.data !== '' ||
    f.apenasHoje ||
    f.datasPassadas ||
    f.responsavel !== '' ||
    f.prioridade !== '' ||
    f.somenteMeus ||
    f.resultado !== ''
  );
}

/**
 * Filtra mantendo a ordem. Os filtros se combinam (E); só as duas caixas de data somam entre si
 * (hoje OU passadas). Teste sem data planejada nunca entra num filtro de data.
 */
export function filtrar<T extends LinhaFiltravel>(itens: T[], f: Filtros, hoje: string, voce?: string | null): T[] {
  const texto = f.texto.trim().toLowerCase();
  return itens.filter((i) => {
    if (f.responsavel === SEM_VALOR ? i.responsavel !== undefined : f.responsavel && i.responsavel !== f.responsavel) return false;
    if (f.prioridade === SEM_VALOR ? i.prioridade !== undefined : f.prioridade && i.prioridade !== f.prioridade) return false;
    if (f.somenteMeus && voce && i.responsavel !== voce) return false;
    if (f.resultado === SEM_VALOR ? i.resultado !== undefined : f.resultado && i.resultado !== f.resultado) return false;
    if (texto && !`${i.idCenario} ${i.nome ?? ''}`.toLowerCase().includes(texto)) return false;
    if (f.funcionalidade && i.funcionalidade !== f.funcionalidade) return false;
    if (f.status && i.status !== f.status) return false;
    if (f.data && i.dataPlanejada !== f.data) return false;
    if (f.apenasHoje || f.datasPassadas) {
      const d = i.dataPlanejada;
      const ehHoje = f.apenasHoje && d === hoje;
      const ehPassada = f.datasPassadas && d !== undefined && d < hoje;
      if (!ehHoje && !ehPassada) return false;
    }
    return true;
  });
}
