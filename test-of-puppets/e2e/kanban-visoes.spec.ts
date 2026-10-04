import { expect, test } from '@playwright/test';
import { URL_API } from './ambiente.ts';
import { abrirApp, irPara, menu, resetar } from './ajudantes.ts';

// Visões salvas e Kanban (limite de WIP e raias por responsável).

test('visão salva: cria pelo M11, aparece no menu com os filtros, sobrevive a recarregar e só o dono a vê', async ({ page, request }) => {
  await resetar(request, true);
  await abrirApp(page);

  await page.getByRole('combobox', { name: 'Você' }).selectOption('ana');
  await irPara(page, 'Nova visão');
  const modal = page.getByRole('dialog', { name: 'Nova visão' });
  await modal.getByLabel('Nome').fill('Só Faturas P1');
  await expect(modal.getByRole('radio', { name: /Roadmap/ })).toBeDisabled();
  await expect(modal.getByLabel('Funcionalidade').locator('option', { hasText: 'Faturas' })).toHaveCount(1);
  await modal.getByLabel('Funcionalidade').selectOption('Faturas');
  await modal.getByLabel('Prioridade').selectOption('P1');
  await expect(modal.getByRole('checkbox', { name: 'Compartilhar com a equipe' })).not.toBeChecked();
  await modal.getByRole('button', { name: 'Criar visão' }).click();

  await expect(page.getByRole('heading', { level: 2, name: 'Só Faturas P1' })).toBeVisible();
  await expect(page.getByLabel('Funcionalidade')).toHaveValue('Faturas');
  await expect(page.getByLabel('Prioridade')).toHaveValue('P1');
  await expect(page.getByTestId('coluna-agendado')).toBeVisible(); // modelo Kanban

  // Pessoal da Ana: o servidor só a entrega para quem pede como "ana".
  const semVoce = (await (await request.get(`${URL_API}/api/visoes`)).json()) as { visoes: unknown[] };
  const comAna = (await (await request.get(`${URL_API}/api/visoes?voce=ana`)).json()) as { visoes: unknown[] };
  expect(semVoce.visoes).toHaveLength(0);
  expect(comAna.visoes).toHaveLength(1);

  await page.reload();
  await expect(menu(page).getByRole('button', { name: 'Só Faturas P1' })).toBeVisible();
  await irPara(page, 'Só Faturas P1');
  await expect(page.getByLabel('Prioridade')).toHaveValue('P1');

  await page.getByRole('button', { name: 'Excluir visão' }).click();
  await expect(menu(page).getByRole('button', { name: 'Só Faturas P1' })).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 2, name: 'Planos' })).toBeVisible();
});

test('Kanban: limite de WIP macio avisa, deixa soltar mesmo assim e o M13 grava o novo limite', async ({ page, request }) => {
  await resetar(request, true);
  expect((await request.put(`${URL_API}/api/config`, { data: { wip: { em_andamento: 1 } } })).ok()).toBeTruthy();
  await abrirApp(page);
  await irPara(page, 'Kanban');

  const emAndamento = page.getByTestId('coluna-em_andamento');
  await expect(emAndamento.getByRole('heading')).toContainText('/1');
  await expect(emAndamento.getByText('Limite', { exact: true })).toBeVisible();
  await expect(page.getByTestId('resumo-wip')).toHaveText('Limite WIP: Em andamento 1 · Refinamento 3'); // Refinamento fica no padrão

  await page.getByTestId('card-CT04.1').dragTo(emAndamento);
  const aviso = page.getByRole('alertdialog', { name: 'Confirmar movimento' });
  await expect(aviso).toContainText('já tem 1 de 1 testes');
  await aviso.getByRole('button', { name: 'Voltar' }).click();
  await expect(emAndamento.getByTestId('card-CT04.1')).toHaveCount(0);

  await page.getByTestId('card-CT04.1').dragTo(emAndamento);
  await page.getByRole('alertdialog').getByRole('button', { name: 'Soltar mesmo assim' }).click();
  await expect(emAndamento.getByTestId('card-CT04.1')).toBeVisible();

  await page.getByRole('button', { name: 'Editar limites' }).click();
  const modal = page.getByRole('dialog', { name: 'Limites de WIP' });
  await modal.getByLabel('Em andamento').fill('4');
  await modal.getByLabel('Refinamento').fill('2');
  await modal.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByTestId('resumo-wip')).toHaveText('Limite WIP: Em andamento 4 · Refinamento 2');

  const gravado = (await (await request.get(`${URL_API}/api/config`)).json()) as { wip: Record<string, number | null> };
  expect(gravado.wip).toEqual({ agendado: null, em_andamento: 4, refinamento: 2, concluido: null });
  await page.reload();
  await irPara(page, 'Kanban');
  await expect(page.getByTestId('resumo-wip')).toHaveText('Limite WIP: Em andamento 4 · Refinamento 2');
});

test('Kanban por responsável: soltar em outra raia pergunta e reatribui no servidor', async ({ page, request }) => {
  await resetar(request, true);
  await abrirApp(page);
  await irPara(page, 'Kanban');
  await page.getByLabel('Agrupar').selectOption('responsavel');
  await expect(page.getByTestId('coluna-agendado')).toHaveCount(0);

  const origem = page.getByTestId('celula-bia-agendado');
  await expect(origem.getByTestId('card-CT03.3')).toBeVisible();
  // As raias ficam mais altas que a janela, então o mouse real rolaria a página no meio do arrasto;
  // aqui disparamos os mesmos eventos de arrastar e soltar direto nos dois elementos.
  const transferencia = await page.evaluateHandle(() => new DataTransfer());
  await page.getByTestId('card-CT03.3').dispatchEvent('dragstart', { dataTransfer: transferencia });
  await page.getByTestId('celula-carlos-agendado').dispatchEvent('drop', { dataTransfer: transferencia });
  const aviso = page.getByRole('alertdialog', { name: 'Confirmar movimento' });
  await expect(aviso).toContainText('Passar CT03.3 de Bia para Carlos?');
  await aviso.getByRole('button', { name: 'Passar' }).click();
  await expect(page.getByTestId('celula-carlos-agendado').getByTestId('card-CT03.3')).toBeVisible();

  const planos = (await (await request.get(`${URL_API}/api/planos`)).json()) as { planos: { id: string; nome: string }[] };
  const id = planos.planos.find((p) => p.nome === '28/09/26')!.id;
  const gravado = (await (await request.get(`${URL_API}/api/planos/${id}`)).json()) as { itens: { idCenario: string; responsavel?: string }[] };
  expect(gravado.itens.find((i) => i.idCenario === 'CT03.3')?.responsavel).toBe('carlos');
});
