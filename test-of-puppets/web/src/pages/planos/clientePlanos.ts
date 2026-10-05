import { pedir } from '../cenarios/clienteApi.ts';

export type Status = 'agendado' | 'em_andamento' | 'refinamento' | 'concluido';
export type Resultado = 'passou' | 'falhou';
export type Prioridade = 'P1' | 'P2' | 'P3';

export const STATUS: Status[] = ['agendado', 'em_andamento', 'refinamento', 'concluido'];
export const ROTULO_STATUS: Record<Status, string> = {
  agendado: 'Agendado',
  em_andamento: 'Em andamento',
  refinamento: 'Refinamento',
  concluido: 'Concluído',
};

export interface ResumoPlano {
  total: number;
  concluidos: number;
  pendentes: number;
  percentual: number;
  porStatus: Record<Status, number>;
  passou: number;
  falhou: number;
  executado: boolean;
}

export type TipoDecisao = 'go' | 'no_go' | 'go_excecao';

/** Decisão go/no-go do Release; só se acrescenta ao histórico do plano. */
export interface Decisao {
  id: string;
  decisao: TipoDecisao;
  justificativa: string;
  /** Id da pessoa que decidiu. */
  por: string;
  /** Instante ISO do registro. */
  em: string;
  /** Critérios (1 a 7) não cumpridos na hora da decisão. */
  criterios: number[];
}

export interface PlanoMeta {
  id: string;
  nome: string;
  criadoEm: string;
  previsao?: string;
  versao: number;
  /** Da mais antiga para a mais nova; ausente até alguém decidir. */
  decisoes?: Decisao[];
}

export interface PlanoResumido extends PlanoMeta {
  resumo: ResumoPlano;
}

export interface ItemPlano {
  idCenario: string;
  nome?: string;
  funcionalidade?: string;
  idMassa?: string;
  /** CPF fictício de massa de teste (só dígitos); a ferramenta é local e mostra sem máscara. */
  cpf?: string;
  passos?: string;
  resultadoEsperado?: string;
  status: Status;
  resultado?: Resultado;
  prioridade?: Prioridade;
  responsavel?: string;
  estimativaMin?: number;
  tempoRealMin?: number;
  dataPlanejada?: string;
  dataExecucao?: string;
  observacoes?: string;
  posicao: number;
  versao: number;
  /** Instante ISO da última alteração do teste (o Release usa para avisar "mudou depois do GO"). */
  atualizadoEm?: string;
  dependeDe: string[];
  massaCompartilhadaCom: string[];
  /** Dependências deste plano que ainda não passaram. */
  bloqueadoPor: string[];
}

export interface DetalhePlano {
  plano: PlanoMeta;
  itens: ItemPlano[];
  resumo: ResumoPlano;
}

export type Aba = 'em_execucao' | 'executados';

export interface NovoPlano {
  nome: string;
  previsao?: string;
  idCenarios?: string[];
}

export interface CamposItem {
  status?: Status;
  resultado?: Resultado | null;
  dataPlanejada?: string | null;
  dataExecucao?: string | null;
  prioridade?: Prioridade | null;
  responsavel?: string | null;
  estimativaMin?: number | null;
  tempoRealMin?: number | null;
  observacoes?: string | null;
}

/** O mesmo teste em cada plano onde aparece (aba "Histórico" do detalhe do teste). */
export interface HistoricoDoTeste {
  planoId: string;
  planoNome: string;
  criadoEm: string;
  status: Status;
  resultado?: Resultado;
  dataPlanejada?: string;
  dataExecucao?: string;
  responsavel?: string;
  observacoes?: string;
}

const base = (id: string) => `/api/planos/${encodeURIComponent(id)}`;

export const listarPlanos = (aba?: Aba) =>
  pedir<{ planos: PlanoResumido[] }>('GET', aba ? `/api/planos?aba=${aba}` : '/api/planos').then((r) => r.planos);
export const criarPlano = (entrada: NovoPlano) => pedir<DetalhePlano>('POST', '/api/planos', entrada);
export const obterPlano = (id: string) => pedir<DetalhePlano>('GET', base(id));
export const excluirPlano = (id: string) => pedir<void>('DELETE', base(id));
/** Muda o nome e/ou a previsão do plano (`null` tira a previsão). `versao` é a que a tela viu. */
export const editarPlano = (id: string, versao: number, campos: { nome?: string; previsao?: string | null }) =>
  pedir<PlanoMeta>('PATCH', base(id), { versao, ...campos });
export const removerTeste = (id: string, idCenario: string) =>
  pedir<void>('DELETE', `${base(id)}/testes/${encodeURIComponent(idCenario)}`);
export const alterarTeste = (id: string, idCenario: string, versao: number, campos: CamposItem) =>
  pedir<ItemPlano>('PATCH', `${base(id)}/testes/${encodeURIComponent(idCenario)}`, { ...campos, versao });
export const incluirTestes = (id: string, idCenarios: string[], dataPlanejada?: string) =>
  pedir<DetalhePlano & { incluidos: string[] }>('POST', `${base(id)}/testes`, { idCenarios, ...(dataPlanejada ? { dataPlanejada } : {}) });
/** Carrega os dados de exemplo (fictícios). Só funciona com tudo vazio; senão o servidor responde 409. */
export const carregarSemente = () => pedir<{ cenarios: number; pessoas: number; planos: number }>('POST', '/api/semente');

/** Atribui responsável e/ou prioridade a vários testes de uma vez; `null` limpa, campo ausente mantém. */
export const alterarLote = (id: string, idCenarios: string[], campos: Pick<CamposItem, 'responsavel' | 'prioridade'>) =>
  pedir<DetalhePlano>('PATCH', `${base(id)}/testes`, { idCenarios, ...campos });
/** Registra a decisão do Release; `criterios` são os não cumpridos agora. Devolve o plano com o histórico atualizado. */
export const registrarDecisao = (id: string, entrada: { decisao: TipoDecisao; justificativa: string; por: string; criterios: number[] }) =>
  pedir<DetalhePlano>('POST', `${base(id)}/decisoes`, entrada);
/** Tira os testes (ainda não iniciados) deste plano e põe no plano de destino; tudo ou nada. */
export const moverTestes = (id: string, idCenarios: string[], paraPlano: string) =>
  pedir<{ origem: DetalhePlano; movidos: string[] }>('POST', `${base(id)}/mover`, { idCenarios, paraPlano });
export const definirOrdem =(id: string, ordem: string[]) => pedir<DetalhePlano>('PUT', `${base(id)}/ordem`, { ordem });
export const historicoDoTeste = (idCenario: string) =>
  pedir<{ planos: HistoricoDoTeste[] }>('GET', `/api/cenarios/${encodeURIComponent(idCenario)}/planos`).then((r) => r.planos);
