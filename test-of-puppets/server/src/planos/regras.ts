import { ErroNegocio } from '../erros.ts';
import type { CamposItem, EntradaCronometro, ItemPlano } from './modelo.ts';

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
  // Cronômetro: sair de "Em andamento" zera o relógio; entrar nele (arrastar no Kanban, por exemplo) começa a contar.
  if (novo.status !== 'em_andamento') {
    delete novo.iniciadoEm;
    delete novo.acumuladoMs;
  } else if (item.status !== 'em_andamento') {
    novo.iniciadoEm = agora;
    novo.acumuladoMs = 0;
  }
  return novo;
}

const dataLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** O teste está contando agora (não parado, não pausado). */
export const estaRodando = (item: ItemPlano) => item.status === 'em_andamento' && item.iniciadoEm !== undefined;

const invalido = (mensagem: string) => new ErroNegocio('cronometro_invalido', mensagem);

/**
 * Cronômetro de um teste: iniciar (▶), pausar (⏸), retomar e finalizar (■ com o resultado). O servidor é quem carimba a
 * hora. Finalizar conclui o teste com resultado, data de hoje e o tempo medido (descontadas as pausas), que a pessoa
 * pode corrigir. Não executa nada: a pessoa roda o teste por fora.
 */
export function aplicarCronometro(item: ItemPlano, entrada: EntradaCronometro, agora: Date): ItemPlano {
  const instante = agora.toISOString();
  const base: ItemPlano = { ...item, versao: item.versao + 1, atualizadoEm: instante };
  const rodando = estaRodando(item);
  const pausado = item.status === 'em_andamento' && !rodando;
  const ate = rodando ? agora.getTime() - Date.parse(item.iniciadoEm!) : 0;

  if (entrada.acao === 'iniciar') {
    if (item.status === 'em_andamento') throw invalido(`${item.idCenario} já está em andamento${pausado ? ' (pausado: use Retomar)' : ''}.`);
    delete base.resultado; // refazer um teste concluído reabre o resultado
    return { ...base, status: 'em_andamento', iniciadoEm: instante, acumuladoMs: 0 };
  }
  if (entrada.acao === 'pausar') {
    if (!rodando) throw invalido(`${item.idCenario} não está contando: só dá para pausar um teste em andamento.`);
    const { iniciadoEm: _fim, ...semInicio } = base;
    return { ...semInicio, acumuladoMs: (item.acumuladoMs ?? 0) + Math.max(0, ate) };
  }
  if (entrada.acao === 'retomar') {
    if (!pausado) throw invalido(`${item.idCenario} não está pausado.`);
    return { ...base, iniciadoEm: instante };
  }

  // finalizar
  if (item.status !== 'em_andamento') throw invalido(`${item.idCenario} não está em andamento: inicie o teste antes de finalizar.`);
  const medido = rodando || item.acumuladoMs !== undefined ? (item.acumuladoMs ?? 0) + Math.max(0, ate) : undefined;
  const { iniciadoEm: _i, acumuladoMs: _a, ...limpo } = base;
  const tempoRealMin = entrada.tempoRealMin ?? (medido === undefined ? limpo.tempoRealMin : Math.max(1, Math.round(medido / 60_000)));
  return {
    ...limpo,
    status: 'concluido',
    resultado: entrada.resultado,
    dataExecucao: dataLocal(agora),
    ...(tempoRealMin === undefined ? {} : { tempoRealMin }),
    ...(entrada.observacoes === undefined ? {} : { observacoes: entrada.observacoes }),
  };
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
