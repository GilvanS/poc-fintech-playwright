import { expect, test } from '@playwright/test';
import { URL_API } from './ambiente.ts';
import { abrirApp, irPara, resetar } from './ajudantes.ts';

// Release (V4): os 7 critérios saem dos dados; a decisão é humana e fica gravada no plano (dados/planos.json).

test('Release: critérios, decisão com exceção gravada no servidor e "Reavaliar" quando um teste muda depois', async ({ page, request }) => {
  await resetar(request, true);
  type PlanoApi = { plano: { id: string; decisoes?: { decisao: string; justificativa: string; por: string; criterios: number[] }[] }; itens: { idCenario: string; versao: number }[] };
  const lista = (await (await request.get(`${URL_API}/api/planos`)).json()) as { planos: { id: string; nome: string }[] };
  const idPlano = lista.planos.find((p) => p.nome === '28/09/26')?.id ?? '';
  expect(idPlano).not.toBe('');
  const plano = async () => (await (await request.get(`${URL_API}/api/planos/${idPlano}`)).json()) as PlanoApi;

  await abrirApp(page);
  await page.getByRole('combobox', { name: 'Você' }).selectOption('ana');
  await irPara(page, 'Release');
  await expect(page.getByRole('heading', { level: 2, name: 'Release' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 3, name: 'Release do plano 28/09/26' })).toBeVisible();
  await expect(page.getByTestId('cumpridos')).toContainText('de 7');
  await expect(page.getByTestId('situacao')).toContainText('Situação: NO-GO');
  await expect(page.getByTestId('criterio-3')).toContainText('2 abertos (Alta 1, Média 1)');
  await expect(page.getByText('(nenhuma ainda)')).toBeVisible();

  // "ver" abre o que falta; o INC leva para a tela de Incidentes.
  await page.getByRole('button', { name: 'Ver critério 3' }).click();
  await expect(page.getByText(/^INC0715802225 · Alta · Em análise/)).toBeVisible();

  // GO está bloqueado com critério pendente; NO-GO sem justificativa é recusado.
  await page.getByRole('button', { name: 'Registrar decisão GO/NO-GO' }).click();
  const modal = page.getByRole('dialog', { name: 'Decisão do release — Plano 28/09/26' });
  await expect(modal.getByRole('radio', { name: 'GO', exact: true })).toBeDisabled();
  await modal.getByRole('button', { name: 'Registrar' }).click();
  await expect(modal.getByRole('alert')).toContainText('Justificativa é obrigatória.');
  expect((await plano()).plano.decisoes).toBeUndefined();

  // GO com exceção: o servidor guarda quem decidiu, a justificativa e os critérios abertos.
  await modal.getByRole('radio', { name: 'GO com exceção' }).check();
  await modal.getByLabel('Justificativa (obrigatória)').fill('Risco aceito: o INC é de baixo impacto.');
  await modal.getByRole('button', { name: 'Registrar' }).click();
  await expect(modal).toHaveCount(0);
  const gravada = (await plano()).plano.decisoes ?? [];
  expect(gravada).toHaveLength(1);
  expect(gravada[0]).toMatchObject({ decisao: 'go_excecao', por: 'ana', justificativa: 'Risco aceito: o INC é de baixo impacto.' });
  expect(gravada[0].criterios.length).toBeGreaterThan(0);
  await expect(page.getByTestId('selo-liberado')).toContainText('por Ana');
  await expect(page.getByTestId('historico-decisoes')).toContainText('GO com exceção');

  // A decisão sobrevive a recarregar a página.
  await page.reload();
  await irPara(page, 'Release');
  await expect(page.getByTestId('historico-decisoes')).toContainText('Risco aceito: o INC é de baixo impacto.');

  // Um teste muda depois do GO: volta para "Reavaliar" e avisa quem decidiu.
  const alvo = (await plano()).itens[0];
  const patch = await request.patch(`${URL_API}/api/planos/${idPlano}/testes/${alvo.idCenario}`, { data: { versao: alvo.versao, observacoes: 'Mudou depois do GO.' } });
  expect(patch.ok()).toBeTruthy();
  await page.getByRole('button', { name: 'Atualizar' }).click();
  await expect(page.getByTestId('situacao')).toContainText('Situação: REAVALIAR');
  await expect(page.getByTestId('aviso-reavaliar')).toContainText('Ana decidiu GO com exceção');
  await expect(page.getByTestId('aviso-reavaliar')).toContainText(`${alvo.idCenario} mudou depois`);
  await expect(page.getByTestId('selo-liberado')).toHaveCount(0);
});
