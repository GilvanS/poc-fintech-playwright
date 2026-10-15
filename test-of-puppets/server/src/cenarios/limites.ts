/**
 * Tetos do cadastro de cenários, bem abaixo do que incomoda o GitHub (aviso em arquivo de 50 MB, bloqueio em 100 MB).
 * Uma linha pesa no máximo uns 3,5 KB (os textos têm tamanho máximo: passos 2.000, resultado esperado 1.000), então 5.000
 * cenários ficam abaixo de 18 MB no pior caso e perto de 3 MB com cenários reais (uns 600 bytes cada).
 * O `.db` não vai para o git (pasta `dados/`); o que vai é o CSV de controle, que é texto e mostra diferenças linha a linha.
 */
export const LIMITES = {
  maxCenarios: 5000,
  avisoCenarios: 4000,
  maxBytesBanco: 25 * 1024 * 1024,
  avisoBytesBanco: 20 * 1024 * 1024,
  maxBytesCsv: 10 * 1024 * 1024,
  maxLinhasCsv: 5000,
} as const;

/** Quanto o cadastro já usa do que é permitido; a tela mostra e avisa quando chega perto. */
export interface Armazenamento {
  cenarios: number;
  maxCenarios: number;
  bytes: number;
  maxBytes: number;
  /** Passou do ponto de aviso (80% dos cenários ou 20 MB). */
  perto: boolean;
}
