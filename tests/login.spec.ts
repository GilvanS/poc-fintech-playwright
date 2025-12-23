import { test, expect } from '@playwright/test';
import { LandingPage } from './pages/LandingPage';

let landingPage;

test.beforeEach(async ({ page }) => {
    landingPage = new LandingPage(page);
});

test('CT01.1 -Abrir site', async () => {
    await landingPage.visit();
    await landingPage.validMsg();
});

test('CT01.2 - Fazer login como Admin', async ({ page }) => {
    await landingPage.visit();
    await landingPage.openLoginModal();
    // CPF Admin: 11111111111 (conforme sua mensagem anterior)
    await landingPage.submitLoginForm('11111111111', 'admin999');
    await page.waitForTimeout(10000);
});

test('CT01.3 - Fazer login como Cliente', async ({ page }) => {
    await landingPage.visit();
    await landingPage.openLoginModal();
    // CPF Cliente: 999.999.999-99
    await landingPage.submitLoginForm('999.999.999-99', 'admin999');
    await page.waitForTimeout(10000);
});

test('CT01.4 - Validar campo obrigatório', async ({ page }) => {
    await landingPage.visit();
    await landingPage.openLoginModal();
    await landingPage.submitLoginForm('', ''); // Envia vazio

    await landingPage.alertHaveText([
        /Campo obrigatório/,
        /Campo obrigatório/
    ]);

    await page.waitForTimeout(10000);
});

test('CT01.5 - Validar campo obrigatório senha', async ({ page }) => {
    await landingPage.visit();
    await landingPage.openLoginModal();
    await landingPage.submitLoginForm('999.999.999-99', ''); // Senha vazia

    await landingPage.alertHaveText([
        /Campo obrigatório/
    ]);

    await page.waitForTimeout(10000);
});

test('CT01.6 - Validar campo obrigatório CPF', async ({ page }) => {
    await landingPage.visit();
    await landingPage.openLoginModal();
    await landingPage.submitLoginForm('', 'admin999'); // CPF vazio

    await landingPage.alertHaveText([
        /Campo obrigatório/
    ]);

    await page.waitForTimeout(10000);
});
