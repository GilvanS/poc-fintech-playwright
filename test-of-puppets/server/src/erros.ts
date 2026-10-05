export type CodigoErro =
  | 'id_duplicado'
  | 'nao_encontrado'
  | 'versao_antiga'
  | 'dependencia_pendente'
  | 'data_antes_da_dependencia'
  | 'cenario_em_uso'
  | 'cenario_inexistente'
  | 'resultado_sem_conclusao'
  | 'ordem_invalida'
  | 'ordem_desatualizada'
  | 'nome_duplicado'
  | 'pessoa_em_uso'
  | 'ja_tem_dados'
  | 'retro_fechada'
  | 'retro_indisponivel'
  | 'teste_iniciado'
  | 'ja_no_plano'
  | 'plano_concluido';

/** Status HTTP de cada erro esperado do dia a dia. Qualquer outro erro vira 500. */
export const STATUS_POR_ERRO: Record<CodigoErro, number> = {
  nao_encontrado: 404,
  id_duplicado: 409,
  versao_antiga: 409,
  dependencia_pendente: 409,
  data_antes_da_dependencia: 409,
  cenario_em_uso: 409,
  cenario_inexistente: 400,
  resultado_sem_conclusao: 400,
  ordem_invalida: 409,
  ordem_desatualizada: 409,
  nome_duplicado: 409,
  pessoa_em_uso: 409,
  ja_tem_dados: 409,
  retro_fechada: 409,
  retro_indisponivel: 409,
  teste_iniciado: 409,
  ja_no_plano: 409,
  plano_concluido: 409,
};

export class ErroNegocio extends Error {
  constructor(
    readonly codigo: CodigoErro,
    mensagem: string,
  ) {
    super(mensagem);
  }
}
