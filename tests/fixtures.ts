import { test as base } from 'playwright-bdd';
import { LandingPage } from './pages/LandingPage';

type MyFixtures = {
    landingPage: LandingPage;
};

export const test = base.extend<MyFixtures>({
    landingPage: async ({ page }, use) => {
        await use(new LandingPage(page));
    },
});
