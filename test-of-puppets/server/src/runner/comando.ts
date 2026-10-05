/** O ID de cenário que pode virar comando (nada além disto chega ao shell). */
export const FORMATO_ID = /^CT\d{2}\.\d{1,2}$/;

export interface Comandos {
  /** Gera os specs a partir das features (bddgen). */
  gerar: string;
  /** Roda só o cenário. */
  rodar: string;
}

/**
 * Os mesmos comandos dos scripts do projeto de testes (`npm run bdd:gen` e `playwright test --project=bdd-headed
 * --headed --workers=1 --grep "@CT03.2"`), com o ID exato: "@CT03.1" não pega o "@CT03.10".
 * Dá para trocar por variáveis de ambiente (`PUPPETS_CMD_GERAR`, `PUPPETS_CMD_RODAR`; `{id}` vira o ID).
 */
export function comandosDe(idCenario: string, ambiente: NodeJS.ProcessEnv = process.env): Comandos {
  if (!FORMATO_ID.test(idCenario)) throw new Error(`ID de cenário inválido: ${idCenario}`);
  const trocar = (modelo: string) => modelo.replaceAll('{id}', idCenario);
  const exato = `@${idCenario.replace('.', '\\.')}( |$)`;
  return {
    gerar: trocar(ambiente.PUPPETS_CMD_GERAR || 'npm run bdd:gen'),
    rodar: trocar(ambiente.PUPPETS_CMD_RODAR || `npx playwright test --project=bdd-headed --headed --workers=1 --grep "${exato}"`),
  };
}
