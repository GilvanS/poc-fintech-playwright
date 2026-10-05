/**
 * T9 — regra da atualização da massa depois do teste. Só estas colunas da aba `tbl_de_massas` podem mudar;
 * `fatura_fechada` é imutável (a fatura fechada nunca é reescrita depois de gerada).
 */
export const ABA_MASSA = 'tbl_de_massas';
export const COLUNA_CPF = 'cpf';
export const COLUNA_IMUTAVEL = 'fatura_fechada';

export type TipoColuna = 'valor' | 'status';

export interface ColunaGravavel {
  coluna: string;
  tipo: TipoColuna;
}

/** Os nomes são os cabeçalhos reais da aba (no PLANO: lim_utilizado = limite_utilizado, fat_aberta = fatura_aberta…). */
export const COLUNAS_GRAVAVEIS: readonly ColunaGravavel[] = [
  { coluna: 'saldo_conta', tipo: 'valor' },
  { coluna: 'limite_utilizado', tipo: 'valor' },
  { coluna: 'limite_disponivel', tipo: 'valor' },
  { coluna: 'parcelas_a_vencer', tipo: 'valor' },
  { coluna: 'fatura_aberta', tipo: 'valor' },
  { coluna: 'status_fatura_fechada', tipo: 'status' },
];

/** Status que o teste pode gravar sobre uma fatura fechada VIGENTE (os que já existem na massa). */
export const STATUS_PAGOS = ['PAGO_MIN', 'PAGO_PARCIAL', 'PAGO_TOTAL'] as const;
const STATUS_ORIGEM = 'VIGENTE';

export type RegraLinha = 'atualiza' | 'igual' | 'imutavel' | 'ignorado';

export interface LinhaDiff {
  coluna: string;
  antes: string;
  depois: string;
  regra: RegraLinha;
  /** Por que não grava (quando `ignorado`/`imutavel`). */
  motivo?: string;
}

export interface Escrita {
  coluna: string;
  valor: string;
}

export interface Proposta {
  linhas: LinhaDiff[];
  escritas: Escrita[];
}

/** "1.234,56" / "1234,56" / "1234.56" -> 1234.56; vazio ou lixo -> null. */
export function lerNumero(texto: string | undefined): number | null {
  const limpo = (texto ?? '').trim();
  if (limpo === '') return null;
  const normal = /,/.test(limpo) ? limpo.replace(/\./g, '').replace(',', '.') : limpo;
  const n = Number(normal);
  return Number.isFinite(n) ? n : null;
}

/** 24615.07 -> "24615,07" (formato do CSV exportado pelo FintechBankApp). */
export const formatarNumero = (n: number): string => n.toFixed(2).replace('.', ',');

const centavos = (n: number) => Math.round(n * 100);

/**
 * Compara a linha atual da planilha com a que o FintechBankApp devolve e diz, coluna por coluna, o que seria gravado.
 * Nada aqui toca arquivo: é só a regra.
 */
export function calcularProposta(atual: Record<string, string>, fonte: Record<string, string>): Proposta {
  const linhas: LinhaDiff[] = [];
  const escritas: Escrita[] = [];

  for (const { coluna, tipo } of COLUNAS_GRAVAVEIS) {
    const antes = atual[coluna] ?? '';
    const novo = (fonte[coluna] ?? '').trim();

    if (tipo === 'valor') {
      const n = lerNumero(novo);
      if (n === null) {
        linhas.push({ coluna, antes, depois: antes, regra: 'ignorado', motivo: 'a fonte não trouxe um valor numérico' });
        continue;
      }
      const anterior = lerNumero(antes);
      if (anterior !== null && centavos(anterior) === centavos(n)) {
        linhas.push({ coluna, antes, depois: antes, regra: 'igual' });
        continue;
      }
      const depois = formatarNumero(n);
      linhas.push({ coluna, antes, depois, regra: 'atualiza' });
      escritas.push({ coluna, valor: depois });
      continue;
    }

    // status da fatura fechada: só VIGENTE -> PAGO_*; o resto fica como está
    if (novo === antes) linhas.push({ coluna, antes, depois: antes, regra: 'igual' });
    else if (!(STATUS_PAGOS as readonly string[]).includes(novo)) {
      linhas.push({ coluna, antes, depois: antes, regra: 'ignorado', motivo: `status "${novo || '(vazio)'}" não é um dos permitidos (${STATUS_PAGOS.join(', ')})` });
    } else if (antes !== STATUS_ORIGEM) {
      linhas.push({ coluna, antes, depois: antes, regra: 'ignorado', motivo: `só muda de ${STATUS_ORIGEM} para PAGO_*; esta fatura está ${antes || '(vazia)'}` });
    } else {
      linhas.push({ coluna, antes, depois: novo, regra: 'atualiza' });
      escritas.push({ coluna, valor: novo });
    }
  }

  const fechadaAtual = atual[COLUNA_IMUTAVEL] ?? '';
  const fechadaFonte = lerNumero(fonte[COLUNA_IMUTAVEL]);
  const diverge = fechadaFonte !== null && (lerNumero(fechadaAtual) === null || centavos(lerNumero(fechadaAtual)!) !== centavos(fechadaFonte));
  linhas.push({
    coluna: COLUNA_IMUTAVEL,
    antes: fechadaAtual,
    depois: fechadaAtual,
    regra: 'imutavel',
    motivo: diverge ? `imutável — a fonte tem ${formatarNumero(fechadaFonte!)}, não grava` : 'imutável — não grava',
  });

  return { linhas, escritas };
}
