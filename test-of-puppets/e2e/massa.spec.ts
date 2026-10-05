import { existsSync, statSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { URL_API } from './ambiente.ts';
import { abrirApp, abrirPlano, resetar } from './ajudantes.ts';

// Atualizar massa de ponta a ponta contra uma planilha SINTÉTICA (playwright.config.ts) e um FintechBankApp FALSO
// (e2e/falso/app-falso.cjs). O MassaDados.xlsx de verdade nunca é aberto.

test('Atualizar massa: diff com fatura_fechada travada, cancelar não grava, confirmar grava com backup e depois não há mais diferença', async ({ page, request }) => {
  await resetar(request, true);
  // CT04.1 fica agendado para o plano seguir "Em execução" (plano todo concluído vai para a aba Executados).
  const criado = await request.post(`${URL_API}/api/planos`, { data: { nome: 'E2E massa', idCenarios: ['CT03.1', 'CT04.1'] } });
  expect(criado.ok()).toBeTruthy();
  const plano = (await criado.json()) as { plano: { id: string }; itens: { idCenario: string; versao: number }[] };
  const ct031 = plano.itens.find((i) => i.idCenario === 'CT03.1')!;
  const concluido = await request.patch(`${URL_API}/api/planos/${plano.plano.id}/testes/CT03.1`, { data: { versao: ct031.versao, status: 'concluido', resultado: 'passou' } });
  expect(concluido.ok()).toBeTruthy();

  await abrirApp(page);
  const detalhe = await abrirPlano(page, 'E2E massa');
  await detalhe.getByRole('button', { name: 'Ver detalhes de CT03.1' }).click();
  await page.getByRole('tab', { name: 'Cenário e Datas' }).click();
  const abrirModal = async () => {
    await page.getByRole('button', { name: 'Atualizar massa' }).click();
    return page.getByRole('dialog', { name: 'Atualizar massa' });
  };

  // 1) o diff: só lê, mostra antes/depois e trava a fatura fechada
  let modal = await abrirModal();
  await expect(modal.getByTestId('massa-saldo_conta')).toContainText('25000,00');
  await expect(modal.getByTestId('massa-saldo_conta')).toContainText('24615,07');
  await expect(modal.getByTestId('massa-status_fatura_fechada')).toContainText('PAGO_PARCIAL');
  await expect(modal.getByTestId('massa-parcelas_a_vencer')).toContainText('898,17'); // a célula nem existia na linha
  await expect(modal.getByTestId('massa-fatura_fechada')).toContainText('153,42');
  await expect(modal.getByTestId('massa-fatura_fechada')).toContainText('imutável');
  await expect(modal).toContainText('Isto altera');

  // 2) cancelar: nada gravado (a proposta seguinte ainda mostra o mesmo "antes")
  await modal.getByRole('button', { name: 'Cancelar' }).click();
  await expect(modal).toHaveCount(0);
  modal = await abrirModal();
  await expect(modal.getByTestId('massa-saldo_conta')).toContainText('25000,00');

  // 3) confirmar: grava, faz backup e o arquivo de backup existe
  await modal.getByRole('button', { name: 'Confirmar e gravar' }).click();
  const aviso = modal.getByRole('status');
  await expect(aviso).toContainText('Massa atualizada (6 colunas)');
  const backup = ((await aviso.textContent()) ?? '').split('Backup em ')[1].trim();
  expect(existsSync(backup), `backup em ${backup}`).toBeTruthy();
  expect(statSync(backup).size).toBeGreaterThan(0);
  await modal.getByRole('button', { name: 'Fechar' }).first().click();

  // 4) agora a planilha já está igual à fonte: antes = depois e o Confirmar desliga
  modal = await abrirModal();
  await expect(modal.getByTestId('massa-saldo_conta')).toContainText('24615,07');
  await expect(modal).toContainText('não há o que gravar');
  await expect(modal.getByRole('button', { name: 'Confirmar e gravar' })).toBeDisabled();
});
