import { test as baseTest, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { LandingPage, DashboardPage, CadastroPage, FaturasPage } from '../tests/pages';
import { AuthFlow, CadastroFlow, DashboardFlow } from '../flows';
import { TestContext } from '../tests/utils/TestContext';
import { LoginModel } from '../tests/models/LoginModel';
import { CadastroModel } from '../tests/models/CadastroModel';
import { ScenarioData } from '../tests/utils/excelReader';
import { logger } from '../tests/utils/logger';
import { EvidenceHelper } from '../tests/utils/evidenceHelper';

type MyFixtures = {
    landingPage: LandingPage;
    dashboardPage: DashboardPage;
    cadastroPage: CadastroPage;
    faturasPage: FaturasPage;
    authFlow: AuthFlow;
    cadastroFlow: CadastroFlow;
    dashboardFlow: DashboardFlow;
    testData: ScenarioData | null;
    loginModel: LoginModel;
    cadastroModel: CadastroModel | null;
    testLogger: void;
};

export const test = baseTest.extend<MyFixtures>({
    landingPage: async ({ page }, use) => {
        await use(new LandingPage(page));
    },

    dashboardPage: async ({ page }, use) => {
        await use(new DashboardPage(page));
    },

    cadastroPage: async ({ page }, use) => {
        await use(new CadastroPage(page));
    },

    faturasPage: async ({ page }, use) => {
        await use(new FaturasPage(page));
    },

    authFlow: async ({ landingPage, dashboardPage }, use) => {
        await use(new AuthFlow(landingPage, dashboardPage));
    },

    cadastroFlow: async ({ landingPage, cadastroPage }, use) => {
        await use(new CadastroFlow(landingPage, cadastroPage));
    },

    dashboardFlow: async ({ dashboardPage }, use) => {
        await use(new DashboardFlow(dashboardPage));
    },

    testData: async ({}, use, testInfo) => {
        const scenario = TestContext.loadFromTestTitle(testInfo.title);
        await use(scenario);
    },

    loginModel: async ({ testData }, use) => {
        const loginData = TestContext.getLoginModel();
        await use(loginData);
    },

    cadastroModel: async ({ testData }, use) => {
        const cadastroData = TestContext.getCadastroModel();
        await use(cadastroData);
    },

    testLogger: [async ({ testData }, use, testInfo) => {
        // Início do Teste
        logger.info(`=================================================`);
        logger.info(`🔄 Iniciando execução: ${testInfo.title}`);
        EvidenceHelper.clearScreenshots();
        
        const startTime = new Date();

        await use();

        // Fim do Teste
        const endTime = new Date();
        const status = testInfo.status === 'passed' ? 'PASSED' : 'FAILED';
        
        if (status === 'FAILED') {
            logger.error(`⚠️ Falha no cenário: ${testInfo.title}`);
        } else {
            logger.info(`✅ Cenário finalizado com sucesso: ${testInfo.title}`);
        }

        // Anexa o README.md ao relatório do Playwright (Attachments)
        const readmePath = path.resolve(__dirname, '../README.md');
        if (fs.existsSync(readmePath)) {
            await testInfo.attach('README.md', {
                path: readmePath,
                contentType: 'text/markdown',
            });
        }
        
        // Gerar evidência
        const nomesNavegador: Record<string, string> = {
            chromium: 'Chrome',
            firefox: 'Firefox',
            webkit: 'Safari',
        };
        await EvidenceHelper.generateEvidence({
            feature: testInfo.file.split(/[\\/]/).pop() || 'N/A',
            scenario: testInfo.title,
            status: status,
            inicio: startTime.toLocaleString('pt-BR'),
            fim: endTime.toLocaleString('pt-BR'),
            data: new Date().toLocaleDateString('pt-BR'),
            navegador: nomesNavegador[testInfo.project.name] || testInfo.project.name
        }, testInfo.title);
    }, { auto: true }]
});

export { expect };
