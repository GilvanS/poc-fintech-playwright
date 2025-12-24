import { createBdd } from 'playwright-bdd';
import { test } from '../fixtures';
import { expect } from '@playwright/test';

const { Given, When, Then } = createBdd(test);

Given('que acesso a página inicial', async ({ landingPage }) => {
    await landingPage.visit();
});

When('inicio o login', async ({ landingPage }) => {
    await landingPage.openLoginModal();
});

When('preencho o CPF {string} e senha {string}', async ({ landingPage }, cpf, senha) => {
    await landingPage.submitLoginForm(cpf, senha);
});

Then('devo ver a área logada', async ({ page }) => {
    await page.waitForTimeout(1000); 
});

Then('devo ver a mensagem de alerta {string}', async ({ landingPage, page }, mensagem) => {
    const alertLocator = page.locator('.alert');
    
    // Espera aparecer pelo menos um alerta
    await expect(alertLocator.first()).toBeVisible();
    
    // Conta quantos alertas apareceram
    const count = await alertLocator.count();
    
    // Cria um array com a regex repetida 'count' vezes
    // Ex: se tiver 2 alertas, cria [/mensagem/, /mensagem/]
    const regex = new RegExp(mensagem);
    const expectedMessages = Array(count).fill(regex);
    
    await landingPage.alertHaveText(expectedMessages);
});
