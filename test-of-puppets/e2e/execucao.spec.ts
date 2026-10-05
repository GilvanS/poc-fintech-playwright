import { expect, test } from '@playwright/test';
import { URL_API } from './ambiente.ts';
import { abrirApp, abrirPlano, resetar } from './ajudantes.ts';

// Play/Stop de ponta a ponta com comandos FALSOS (e2e/falso/executar.cjs) numa raiz temporária:
// CT03.1 passa, CT05.1 falha (com anexo), CT04.1 fica rodando até o Stop. Nenhum teste real roda.

test('Play grava passou/falhou no plano, Stop volta a Refinamento e o ambiente é verificado', async ({ page, request }) => {
  await resetar(request, true);
  const criado = await request.post(`${URL_API}/api/planos`, { data: { nome: 'E2E execução', idCenarios: ['CT03.1', 'CT05.1', 'CT04.1'] } });
  expect(criado.ok()).toBeTruthy();
  await abrirApp(page);
  const detalhe = await abrirPlano(page, 'E2E execução');

  // passa: Rodando -> Concluído / Passou, com evidência baixável e o log da execução
  await detalhe.getByRole('button', { name: 'Executar CT03.1' }).click();
  await expect(detalhe.getByTestId('exec-CT03.1')).toBeVisible();
  await expect(detalhe.getByLabel('Status de CT03.1')).toHaveValue('concluido', { timeout: 40_000 });
  await expect(detalhe.getByLabel('Resultado de CT03.1')).toHaveValue('passou');
  await expect(detalhe.getByRole('log')).toContainText('CT03.1 passou');
  const evidencia = detalhe.getByRole('link', { name: 'Evidência de CT03.1' });
  const baixada = await page.request.get((await evidencia.getAttribute('href'))!);
  expect(baixada.ok()).toBeTruthy();
  expect(await baixada.text()).toBe('evidência falsa');

  // falha: Concluído / Falhou + pacote de falha + "Reexecutar falhos"
  await detalhe.getByRole('button', { name: 'Executar CT05.1' }).click();
  await expect(detalhe.getByLabel('Resultado de CT05.1')).toHaveValue('falhou', { timeout: 40_000 });
  await expect(detalhe.getByRole('link', { name: 'anexo 1' })).toBeVisible();
  await expect(detalhe.getByRole('button', { name: 'Reexecutar falhos (1)' })).toBeEnabled();

  // Stop: o teste que ficou rodando volta para Refinamento
  await detalhe.getByRole('button', { name: 'Executar CT04.1' }).click();
  await expect(detalhe.getByTestId('exec-CT04.1')).toHaveText('Rodando', { timeout: 20_000 });
  await detalhe.getByRole('button', { name: 'Parar CT04.1' }).click();
  await expect(detalhe.getByLabel('Status de CT04.1')).toHaveValue('refinamento', { timeout: 30_000 });
  await expect(detalhe.getByRole('button', { name: 'Executar CT04.1' })).toBeVisible();

  // ambiente
  await detalhe.getByRole('button', { name: 'Verificar ambiente' }).click();
  const ambiente = detalhe.getByRole('list', { name: 'Ambiente' });
  await expect(ambiente.getByLabel('ok')).toHaveCount(6);
  await expect(ambiente.getByLabel('problema')).toHaveCount(0);
});
