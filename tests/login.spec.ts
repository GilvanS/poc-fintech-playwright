import { test, expect } from '@playwright/test';

test('CT01.1 -Abrir site', async ({ page }) => {
  await page.goto('/');

  const loggedUsed = page.locator('.text-2xl')
  await expect(loggedUsed).toHaveText('Olá!');
  const msgNaoECliente = page.locator('.py-3')
  await expect(msgNaoECliente).toHaveText('Não é cliente? Abra uma conta')
});

test('CT01.2 - Fazer login como Admin', async ({ page}) => {
  await page.goto('/');

  // await page.click('//*[text() = "Acessar minha conta"]');
  // await page.click('//*[@placeholder= "000.000.000-00"]')

  await page.getByRole('button', { name: 'Acessar minha conta' }).click();
  await page.getByPlaceholder('000.000.000-00').fill('999.999.999-99')
  await page.locator('#password-login').fill('admin999')
  await page.getByRole('button', { name: 'Entrar' }).click();

  await page.waitForTimeout(10000)
})