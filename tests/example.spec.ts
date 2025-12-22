import { test, expect } from '@playwright/test';

test('Abrir site', async ({ page }) => {
  await page.goto('/');

  const titulo = {
    title: 'Olá!'
  }
  const loggedUsed = page.locator('.text-2xl')
  await expect(loggedUsed).toHaveText('Olá!');
  const msgNaoECliente = page.locator('.py-3')
  await expect(msgNaoECliente).toHaveText('Não é cliente? Abra uma conta')

});