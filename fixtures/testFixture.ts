import { test as baseTest, expect } from '@playwright/test';
import { LandingPage, DashboardPage, CadastroPage } from '../tests/pages';
import { AuthFlow, CadastroFlow } from '../flows';
import { TestContext } from '../tests/utils/TestContext';
import { LoginModel } from '../tests/models/LoginModel';
import { CadastroModel } from '../tests/models/CadastroModel';
import { ScenarioData } from '../tests/utils/excelReader';

type MyFixtures = {
    landingPage: LandingPage;
    dashboardPage: DashboardPage;
    cadastroPage: CadastroPage;
    authFlow: AuthFlow;
    cadastroFlow: CadastroFlow;
    testData: ScenarioData | null;
    loginModel: LoginModel;
    cadastroModel: CadastroModel | null;
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

    authFlow: async ({ landingPage, dashboardPage }, use) => {
        await use(new AuthFlow(landingPage, dashboardPage));
    },

    cadastroFlow: async ({ landingPage, cadastroPage }, use) => {
        await use(new CadastroFlow(landingPage, cadastroPage));
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
    }
});

export { expect };
