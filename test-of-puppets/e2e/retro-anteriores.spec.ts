import { expect, test } from '@playwright/test';
import { URL_API } from './ambiente.ts';
import { abrirApp, irPara, resetar } from './ajudantes.ts';

// Ao abrir um plano, aparece o aviso das ações que ficaram pendentes nas retros dos planos anteriores.

test('Aviso na abertura do plano: ação pendente da retro anterior aparece, abre a retro e some quando a ação é feita', async ({ page, request }) => {
  await resetar(request, true);
  await abrirApp(page);
  await page.getByRole('combobox', { name: 'Você' }).selectOption('ana');

  // O plano 28/09/26 é o ativo; a retro do 14/09/26 (anterior) tem uma ação pendente da Ana na semente.
  await irPara(page, 'Lista');
  await expect(page.getByRole('heading', { level: 3, name: 'Plano: 28/09/26' })).toBeVisible();
  const aviso = page.getByTestId('acoes-pendentes-anteriores');
  await expect(aviso).toContainText('Ações pendentes de retros anteriores (1)');
  await expect(aviso).toContainText('Ordenar CT03.2 antes do CT03.7 (massa 0483)');
  await expect(aviso).toContainText('retro do plano 14/09/26');

  // O primeiro plano não tem "anteriores": sem aviso.
  await page.getByRole('combobox', { name: 'Plano' }).selectOption({ label: 'Plano 14/09/26 · concluído' });
  await expect(page.getByRole('heading', { level: 3, name: 'Plano: 14/09/26' })).toBeVisible();
  await expect(page.getByTestId('acoes-pendentes-anteriores')).toHaveCount(0);
  await page.getByRole('combobox', { name: 'Plano' }).selectOption({ label: 'Plano 28/09/26' });
  await expect(aviso).toBeVisible();

  // "abrir retro" leva para a retro daquele plano.
  await aviso.getByRole('button', { name: 'Abrir a retro do plano 14/09/26' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Retro' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 3, name: 'Retrospectiva — Plano 14/09/26' })).toBeVisible();

  // Fazendo a ação, o aviso do plano seguinte desaparece.
  const caixa = page.getByRole('checkbox', { name: 'Marcar como feita: Ordenar CT03.2 antes do CT03.7 (massa 0483)' });
  await caixa.click();
  await expect(caixa).toBeChecked();
  const retro = (await (await request.get(`${URL_API}/api/retros`)).json()) as { retros: { acoes: { feito: boolean }[] }[] };
  expect(retro.retros[0].acoes.every((a) => a.feito)).toBe(true);

  await page.getByRole('combobox', { name: 'Plano' }).selectOption({ label: 'Plano 28/09/26' });
  await irPara(page, 'Lista');
  await expect(page.getByRole('heading', { level: 3, name: 'Plano: 28/09/26' })).toBeVisible();
  await expect(page.getByTestId('acoes-pendentes-anteriores')).toHaveCount(0);
});
