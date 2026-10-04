import { ErroNegocio } from '../erros.ts';
import type { CamposItem, ItemPlano } from './modelo.ts';

const CAMPOS_OPCIONAIS = [
  'resultado',
  'prioridade',
  'responsavel',
  'estimativaMin',
  'tempoRealMin',
  'dataPlanejada',
  'dataExecucao',
  'observacoes',
] as const;

const dataBR = (iso: string) => iso.split('-').reverse().join('/');

/**
 * Aplica as alterações num item (sem mexer no original). `null` apaga o campo. O resultado só existe
 * com o teste concluído: reabrir o teste apaga o resultado; marcar resultado fora de "concluido" é erro.
 */
export function aplicarPatch(item: ItemPlano, campos: CamposItem, agora: string): ItemPlano {
  const novo: ItemPlano = { ...item, versao: item.versao + 1, atualizadoEm: agora };
  const gravavel = novo as unknown as Record<string, unknown>;
  for (const campo of CAMPOS_OPCIONAIS) {
    const valor = campos[campo];
    if (valor === undefined) continue;
    if (valor === null) delete gravavel[campo];
    else gravavel[campo] = valor;
  }
  if (campos.status !== undefined) novo.status = campos.status;
  if (campos.posicao !== undefined) novo.posicao = campos.posicao;

  if (novo.status !== 'concluido') {
    if (campos.resultado) {
      throw new ErroNegocio('resultado_sem_conclusao', 'O resultado (passou/falhou) só vale para teste em "Concluído".');
    }
    delete novo.resultado;
  }
  return novo;
}

/**
 * Dependências (mesma massa, numeração menor) que estão neste plano e ainda não passaram. Dependência
 * que não está no plano não é cobrada: a ferramenta só confere o que foi planejado aqui.
 */
export function pendenciasDeDependencia(dependeDe: string[], itens: ItemPlano[]): string[] {
  return dependeDe.filter((id) => {
    const dependencia = itens.find((i) => i.idCenario === id);
    return dependencia !== undefined && dependencia.resultado !== 'passou';
  });
}

export function mensagemDependencia(idCenario: string, pendencias: string[]): string {
  return `Aguardando ${pendencias.join(', ')} passar: ${idCenario} usa a mesma massa e só pode andar depois.`;
}

/**
 * Confere a regra de datas: quem reaproveita a massa não pode ser planejado antes da dependência
 * (nem a dependência empurrada para depois de quem depende dela). Devolve a mensagem do conflito ou null.
 */
export function conflitoDeData(
  idCenario: string,
  dataNova: string | null | undefined,
  itens: ItemPlano[],
  dependencias: Map<string, string[]>,
): string | null {
  if (!dataNova) return null;

  for (const dep of dependencias.get(idCenario) ?? []) {
    const dataDep = itens.find((i) => i.idCenario === dep)?.dataPlanejada;
    if (dataDep && dataNova < dataDep) {
      return `${idCenario} não pode ser planejado em ${dataBR(dataNova)}, antes de ${dep} (${dataBR(dataDep)}): usam a mesma massa e ${dep} roda primeiro.`;
    }
  }
  for (const outro of itens) {
    if (outro.idCenario === idCenario || !outro.dataPlanejada) continue;
    if ((dependencias.get(outro.idCenario) ?? []).includes(idCenario) && outro.dataPlanejada < dataNova) {
      return `${idCenario} não pode ir para ${dataBR(dataNova)}, depois de ${outro.idCenario} (${dataBR(outro.dataPlanejada)}): ${outro.idCenario} usa a mesma massa e só roda depois dele.`;
    }
  }
  return null;
}
