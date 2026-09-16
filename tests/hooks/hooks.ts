import { createBdd } from 'playwright-bdd';
import { test } from '../../fixtures/testFixture';
import { logger } from '../utils/logger';
import { EvidenceHelper } from '../utils/EvidenceHelper';

const { BeforeStep, AfterStep } = createBdd(test);

/**
 * Loga o texto de CADA step Gherkin antes de executar — padrão automático pra
 * qualquer feature (login, cadastro, ou futuras), sem precisar de logger.info
 * manual em cada função de step. $step é fixture auto-injetado pelo playwright-bdd
 * com o texto do step atual (sem a palavra-chave Given/When/Then).
 */
BeforeStep(async ({ $step }) => {
    logger.info(`▶️  ${$step.title}`);
});

/**
 * Print automático DEPOIS de cada step Gherkin, pra evidência (DOCX gerado no fim do
 * cenário por EvidenceHelper/testLogger) — mesmo padrão do log acima: um hook global,
 * zero captureStep manual por step de feature nova. Roda mesmo se o step falhar
 * ($step.error setado), pra evidência mostrar o estado real da tela na falha.
 */
AfterStep(async ({ $step, page }) => {
    await EvidenceHelper.captureStep(page, $step.title);
});
