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

  const loggedUsed = page.locator('.text-2xl')
  await expect(loggedUsed).toHaveText('Olá!');
  // await page.click('//*[text() = "Acessar minha conta"]');
  // await page.click('//*[@placeholder= "000.000.000-00"]')
  await page.getByRole('button', { name: 'Acessar minha conta' }).click();
  await page.getByPlaceholder('000.000.000-00').fill('11111111111')
  await page.locator('#password-login').fill('admin999')
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForTimeout(10000)
})

test('CT01.3 - Fazer login como Cliente', async ({ page}) => {
  await page.goto('/');

  const loggedUsed = page.locator('.text-2xl')
  await expect(loggedUsed).toHaveText('Olá!');

  await page.getByRole('button', { name: 'Acessar minha conta' }).click();
  await page.getByPlaceholder('000.000.000-00').fill('999.999.999-99')
  await page.locator('#password-login').fill('admin999')
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForTimeout(10000)
})

test('CT01.4 - Validar campo obrigatório', async ({ page}) => {
  await page.goto('/');

  await expect(
      page.locator('.text-2xl')
  ).toHaveText('Olá!')

  await page.getByRole('button', { name: 'Acessar minha conta' }).click();
  await page.getByRole('button', { name: 'Entrar' }).click();

  await expect(page.locator('.alert')).toHaveText([
    /Campo obrigatório/,
    /Campo obrigatório/
  ])

  await page.waitForTimeout(10000)
})

test('CT01.5 - Validar campo obrigatório senha', async ({ page}) => {
  await page.goto('/');

  await expect(
      page.locator('.text-2xl')
  ).toHaveText('Olá!')

  await page.getByRole('button', { name: 'Acessar minha conta' }).click();
  await page.getByPlaceholder('000.000.000-00').fill('999.999.999-99')
  await page.getByRole('button', { name: 'Entrar' }).click();

  await expect(page.locator('.alert')).toHaveText([
    /Campo obrigatório/
  ])

  await page.waitForTimeout(10000)
})

test('CT01.6 - Validar campo obrigatório CPF', async ({ page}) => {
  await page.goto('/');

  await expect(
      page.locator('.text-2xl')
  ).toHaveText('Olá!')

  await page.getByRole('button', { name: 'Acessar minha conta' }).click();
  await page.locator('#password-login').fill('admin999')
  await page.getByRole('button', { name: 'Entrar' }).click();

  await expect(page.locator('.alert')).toHaveText([
    /Campo obrigatório/
  ])

  await page.waitForTimeout(10000)
})