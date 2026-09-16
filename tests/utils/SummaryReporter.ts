import type { Reporter, TestCase, TestResult, FullResult } from '@playwright/test/reporter';
import { logger, formatarDuracao } from './logger';

/**
 * Reporter customizado: só acrescenta um bloco de resumo agregado no final da
 * execução inteira (Duration/Passed/Failed), rodando junto com o reporter 'html'
 * já configurado. Registrado em playwright.config.ts.
 */
export default class SummaryReporter implements Reporter {
    private startTime = 0;
    private startedAt = '';
    private passed = 0;
    private failed = 0;

    onBegin(): void {
        this.startTime = Date.now();
        this.startedAt = new Date().toLocaleString('pt-BR');
    }

    onTestEnd(test: TestCase, result: TestResult): void {
        if (result.status === 'passed') {
            this.passed++;
        } else if (result.status === 'failed' || result.status === 'timedOut' || result.status === 'interrupted') {
            this.failed++;
        }
    }

    onEnd(result: FullResult): void {
        const encerradoEm = new Date();
        const duracaoMs = Date.now() - this.startTime;
        // Rótulos alinhados por pontos + início/fim/duração — mesmo estilo de leitura do
        // resumo por cenário (testFixture.ts) e do Hooks.java dos projetos mobile (Digio/Uber).
        // Em português, consistente com o resto do log (antes era o único bloco em inglês).
        logger.info('==========================================');
        logger.info('Execução finalizada.');
        logger.info(`Início.....: ${this.startedAt}`);
        logger.info(`Fim........: ${encerradoEm.toLocaleString('pt-BR')}`);
        logger.info(`Duração....: ${formatarDuracao(duracaoMs)}`);
        logger.info(`Passou.....: ${this.passed}`);
        logger.info(`Falhou.....: ${this.failed}`);
        logger.info('==========================================');
    }
}
