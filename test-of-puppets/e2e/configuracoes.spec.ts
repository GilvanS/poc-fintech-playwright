import { expect, test } from '@playwright/test';
import { URL_API } from './ambiente.ts';
import { abrirApp, irPara, resetar } from './ajudantes.ts';

// Configurações: limites de WIP e tipos de lembrete do sino ficam em dados/config.json e valem para todo mundo.

test('Configurações: desligar um tipo de lembrete tira do sino, o WIP é editado pelo M13 e tudo sobrevive a recarregar', async ({ page, request }) => {
  await resetar(request, true);
  type ConfigApi = { wip: { em_andamento: number | null; refinamento: number | null }; lembretes: Record<string, boolean> };
  const config = async () => (await (await request.get(`${URL_API}/api/config`)).json()) as ConfigApi;

  await abrirApp(page);
  await page.getByRole('combobox', { name: 'Você' }).selectOption('ana');
  // Na semente a Ana tem o INC dela e a ação pendente da retro.
  await expect(page.getByRole('button', { name: 'Lembretes (2)' })).toBeVisible();

  await irPara(page, 'Configurações');
  await expect(page.getByRole('heading', { level: 2, name: 'Configurações' })).toBeVisible();
  await expect(page.getByTestId('wip-resumo')).toContainText('Em andamento: 3 · Refinamento: 3');
  await expect(page.getByRole('button', { name: 'Salvar' })).toBeDisabled();

  // Desliga "INC aberto": o sino da Ana perde esse lembrete.
  await page.getByRole('checkbox', { name: /^INC aberto/ }).uncheck();
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByRole('status')).toContainText('Configurações salvas.');
  await expect(page.getByRole('button', { name: 'Lembretes (1)' })).toBeVisible();
  expect((await config()).lembretes).toEqual({ teste_hoje: true, plano_vencido: true, inc_aberto: false, acao_retro: true });

  // Limite de WIP pelo mesmo modal M13 do Kanban.
  await page.getByRole('button', { name: 'Editar limites' }).click();
  const modal = page.getByRole('dialog', { name: 'Limites de WIP' });
  await modal.getByLabel('Em andamento').fill('4');
  await modal.getByLabel('Refinamento').fill('');
  await modal.getByRole('button', { name: 'Salvar' }).click();
  await expect(modal).toHaveCount(0);
  await expect(page.getByTestId('wip-resumo')).toContainText('Em andamento: 4 · Refinamento: sem limite');
  expect((await config()).wip).toMatchObject({ em_andamento: 4, refinamento: null });

  // Depois de recarregar a página, continua tudo como foi salvo.
  await page.reload();
  await expect(page.getByRole('button', { name: 'Lembretes (1)' })).toBeVisible();
  await irPara(page, 'Configurações');
  await expect(page.getByRole('checkbox', { name: /^INC aberto/ })).not.toBeChecked();
  await expect(page.getByRole('checkbox', { name: /^Ação da retro/ })).toBeChecked();
  await expect(page.getByTestId('wip-resumo')).toContainText('Em andamento: 4 · Refinamento: sem limite');

  // Liga de volta: o INC reaparece no sino.
  await page.getByRole('checkbox', { name: /^INC aberto/ }).check();
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByRole('button', { name: 'Lembretes (2)' })).toBeVisible();
  expect((await config()).lembretes.inc_aberto).toBe(true);
});
