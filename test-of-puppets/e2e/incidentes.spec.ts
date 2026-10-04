import { expect, test } from '@playwright/test';
import { URL_API } from './ambiente.ts';
import { abrirApp, abrirPlano, irPara, menu, resetar } from './ajudantes.ts';

// Incidentes: etiqueta e aba dentro do plano, e a tela própria.

test('Incidentes: etiqueta nos testes, aba do plano, registrar, vincular existente e desvincular gravam no servidor', async ({ page, request }) => {
  await resetar(request, true);
  const incidentes = async () => ((await (await request.get(`${URL_API}/api/incidentes`)).json()) as { incidentes: { numero: string; testesAfetados: string[]; historico: { tipo: string }[] }[] }).incidentes;
  expect((await incidentes()).map((i) => i.numero).sort()).toEqual(['INC0715790010', 'INC0715799001', 'INC0715802225']);

  await abrirApp(page);
  const detalhe = await abrirPlano(page, '28/09/26');
  await expect(detalhe.getByRole('tab', { name: 'Incidentes (3)' })).toBeVisible();
  await expect(detalhe.getByTestId('teste-CT03.1').getByTestId('etiqueta-INC0715802225')).toBeVisible();
  await expect(detalhe.getByTestId('etiqueta-INC0715790010')).toHaveCount(0); // resolvido não etiqueta

  await detalhe.getByRole('tab', { name: 'Incidentes (3)' }).click();
  await expect(detalhe.getByTestId('inc-INC0715802225')).toContainText('Alta');
  await expect(detalhe.getByTestId('inc-INC0715802225')).toContainText('Em análise');

  // M6: registrar um INC novo ligado ao CT04.2.
  await detalhe.getByRole('button', { name: 'Registrar INC' }).click();
  const registrar = page.getByRole('dialog', { name: 'Registrar INC' });
  await registrar.getByLabel('Nº do INC').fill('INC0715900001');
  await registrar.getByLabel('Título').fill('Pix agendado não executa');
  await registrar.getByLabel('Severidade').selectOption('alta');
  await registrar.getByLabel('Adicionar teste').selectOption('CT04.2');
  await registrar.getByRole('button', { name: 'Registrar' }).click();
  await expect(detalhe.getByTestId('inc-INC0715900001')).toContainText('Pix agendado não executa');
  await expect(detalhe.getByRole('tab', { name: 'Incidentes (4)' })).toBeVisible();
  const registrado = (await incidentes()).find((i) => i.numero === 'INC0715900001');
  expect(registrado?.testesAfetados).toEqual(['CT04.2']);
  expect(registrado?.historico.map((h) => h.tipo)).toEqual(['registro', 'vinculo']);

  await detalhe.getByRole('tab', { name: 'Visão lista' }).click();
  await expect(detalhe.getByTestId('teste-CT04.2').getByTestId('etiqueta-INC0715900001')).toBeVisible();

  // M7: vincular um INC que já existe a mais um teste.
  await detalhe.getByRole('tab', { name: 'Incidentes (4)' }).click();
  await detalhe.getByRole('button', { name: 'Vincular INC existente' }).click();
  const vincular = page.getByRole('dialog', { name: 'Vincular INC existente' });
  await vincular.getByLabel('Buscar').fill('cpf repetido');
  await vincular.getByRole('radio').first().check();
  await vincular.getByLabel('Adicionar teste').selectOption('CT03.3');
  await vincular.getByRole('button', { name: 'Vincular' }).click();
  await expect(detalhe.getByTestId('inc-INC0715799001')).toContainText('CT03.3');
  expect((await incidentes()).find((i) => i.numero === 'INC0715799001')?.testesAfetados).toEqual(['CT05.2', 'CT03.3']);

  // Desvincular tira o INC de todos os testes deste plano.
  await detalhe.getByRole('button', { name: 'Desvincular INC0715799001' }).click();
  const confirmar = page.getByRole('alertdialog', { name: 'Confirmar desvínculo' });
  await expect(confirmar).toContainText('CT05.2, CT03.3');
  await confirmar.getByRole('button', { name: 'Desvincular' }).click();
  await expect(detalhe.getByTestId('inc-INC0715799001')).toHaveCount(0);
  expect((await incidentes()).find((i) => i.numero === 'INC0715799001')?.testesAfetados).toEqual([]);
});

test('Tela Incidentes: selo no menu, quadro, status, painel (editar e comentar) e excluir gravam no servidor', async ({ page, request }) => {
  await resetar(request, true);
  type IncApi = { numero: string; status: string; severidade: string; comentarios: { texto: string; autor: string | null }[]; historico: { tipo: string; autor: string | null }[] };
  const incidentes = async () => ((await (await request.get(`${URL_API}/api/incidentes`)).json()) as { incidentes: IncApi[] }).incidentes;
  const achar = async (numero: string) => (await incidentes()).find((i) => i.numero === numero);

  await abrirApp(page);
  await page.getByRole('combobox', { name: 'Você' }).selectOption('ana');
  await expect(menu(page).getByRole('button', { name: 'Incidentes' })).toContainText('2'); // 2 abertos (o 3º está resolvido)
  await irPara(page, 'Incidentes');
  await expect(page.getByRole('heading', { level: 2, name: 'Incidentes' })).toBeVisible();
  await expect(page.getByTestId('resumo-inc')).toContainText('abertos 2');
  await expect(page.getByTestId('resumo-inc')).toContainText('testes travados 3');
  await expect(page.getByTestId('coluna-inc-em_analise').getByTestId('card-inc-INC0715802225')).toBeVisible();

  // Mudar o status pelo seletor do card.
  await page.getByLabel('Status de INC0715799001').selectOption('em_analise');
  await expect(page.getByTestId('coluna-inc-em_analise').getByTestId('card-inc-INC0715799001')).toBeVisible();
  const mudado = await achar('INC0715799001');
  expect(mudado?.status).toBe('em_analise');
  expect(mudado?.historico.at(-1)).toMatchObject({ tipo: 'status', autor: 'ana' });

  // Painel lateral: severidade nova + comentário.
  await page.getByRole('button', { name: 'Abrir INC0715799001', exact: true }).click();
  const painel = page.getByRole('dialog', { name: 'Detalhe do INC0715799001' });
  await painel.getByLabel('Severidade').selectOption('alta');
  await painel.getByLabel('Escrever comentário').fill('Reproduzido na massa 0521.');
  await painel.getByRole('button', { name: 'Enviar' }).click();
  await expect(painel.getByText('Reproduzido na massa 0521.')).toBeVisible();
  await painel.getByRole('button', { name: 'Salvar' }).click();
  await expect(painel.getByText('Alterações salvas.')).toBeVisible();
  const salvo = await achar('INC0715799001');
  expect(salvo?.severidade).toBe('alta');
  expect(salvo?.comentarios).toEqual([expect.objectContaining({ texto: 'Reproduzido na massa 0521.', autor: 'ana' })]);
  await painel.getByRole('button', { name: 'Fechar' }).click();
  await expect(page.getByTestId('resumo-inc')).toContainText('Alta 2');

  // Excluir o INC resolvido: pede confirmação e some do servidor.
  await page.getByRole('button', { name: 'Abrir INC0715790010', exact: true }).click();
  await page.getByRole('dialog', { name: 'Detalhe do INC0715790010' }).getByRole('button', { name: 'Excluir INC' }).click();
  await page.getByRole('alertdialog', { name: 'Confirmar exclusão' }).getByRole('button', { name: 'Excluir' }).click();
  await expect(page.getByTestId('card-inc-INC0715790010')).toHaveCount(0);
  expect((await incidentes()).map((i) => i.numero).sort()).toEqual(['INC0715799001', 'INC0715802225']);
});
