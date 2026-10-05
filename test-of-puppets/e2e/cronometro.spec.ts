import { expect, test } from '@playwright/test';
import { URL_API } from './ambiente.ts';
import { abrirApp, abrirPlano, resetar } from './ajudantes.ts';

// Cronômetro de ponta a ponta: a ferramenta não roda teste nenhum. ▶ marca o início, ⏸ pausa, ■ registra o resultado.

test('▶ inicia, ⏸ pausa e retoma, ■ registra passou/falhou com tempo e observação; tudo sobrevive a recarregar', async ({ page, request }) => {
  await resetar(request, true);
  const criado = await request.post(`${URL_API}/api/planos`, { data: { nome: 'E2E cronômetro', idCenarios: ['CT04.1', 'CT05.1'] } });
  expect(criado.ok()).toBeTruthy();
  const plano = (await criado.json()) as { plano: { id: string } };

  await abrirApp(page);
  const detalhe = await abrirPlano(page, 'E2E cronômetro');

  // ▶ marca o início e o relógio anda
  await detalhe.getByRole('button', { name: 'Iniciar CT04.1' }).click();
  await expect(detalhe.getByTestId('cron-CT04.1')).toHaveText(/^\d{2}:\d{2}$/);
  await expect(detalhe.getByLabel('Status de CT04.1')).toHaveValue('em_andamento');
  await expect(detalhe.getByTestId('cron-CT04.1')).not.toHaveText('00:00', { timeout: 10_000 }); // andou de verdade

  // ⏸ pausa: o relógio para; Retomar volta
  await detalhe.getByRole('button', { name: 'Pausar CT04.1' }).click();
  const relogio = detalhe.getByTestId('cron-CT04.1');
  await expect(relogio).toHaveText(/^Pausado /);
  const parado = await relogio.textContent();
  await page.waitForTimeout(2_200);
  expect(await relogio.textContent()).toBe(parado);
  await detalhe.getByRole('button', { name: 'Retomar CT04.1' }).click();
  await expect(relogio).not.toHaveText(/Pausado/);

  // ■ pede o resultado; registra Falhou com tempo corrigido e observação
  await detalhe.getByRole('button', { name: 'Finalizar CT04.1' }).click();
  const modal = page.getByRole('dialog', { name: 'Registrar resultado' });
  await modal.getByRole('button', { name: 'Registrar' }).click();
  await expect(modal.getByRole('alert')).toContainText('Escolha o resultado');
  await modal.getByRole('radio', { name: 'Falhou' }).click();
  await modal.getByLabel('Tempo gasto (minutos)').fill('7');
  await modal.getByLabel('Observações').fill('Pix recusado no passo 4');
  await modal.getByRole('button', { name: 'Registrar' }).click();
  await expect(modal).toHaveCount(0);

  await expect(detalhe.getByLabel('Status de CT04.1')).toHaveValue('concluido');
  await expect(detalhe.getByLabel('Resultado de CT04.1')).toHaveValue('falhou');

  // gravado no servidor (não só na tela)
  const gravado = (await (await request.get(`${URL_API}/api/planos/${plano.plano.id}`)).json()) as { itens: Record<string, unknown>[] };
  const ct041 = gravado.itens.find((i) => i.idCenario === 'CT04.1')!;
  expect([ct041.status, ct041.resultado, ct041.tempoRealMin, ct041.observacoes]).toEqual(['concluido', 'falhou', 7, 'Pix recusado no passo 4']);
  expect(ct041.dataExecucao).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(ct041.iniciadoEm).toBeUndefined();

  // sobrevive a recarregar; o outro teste segue agendado, com ▶
  await page.reload(); // a entrada fica lembrada: volta direto para a ferramenta
  const depois = await abrirPlano(page, 'E2E cronômetro');
  await expect(depois.getByLabel('Resultado de CT04.1')).toHaveValue('falhou');
  await expect(depois.getByRole('button', { name: 'Iniciar CT05.1' })).toBeVisible();
});
