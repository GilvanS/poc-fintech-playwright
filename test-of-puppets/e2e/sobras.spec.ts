import { expect, test } from '@playwright/test';
import { URL_API, URL_WEB } from './ambiente.ts';
import { abrirApp, irPara, resetar } from './ajudantes.ts';

// Mover para plano em lote, M12 "Equipe e capacidade" no Planejamento e a presença "Online: …".

type ItemApi = { idCenario: string; status: string };
const itensDo = async (request: import('@playwright/test').APIRequestContext, nomeDoPlano: string) => {
  const lista = ((await (await request.get(`${URL_API}/api/planos`)).json()) as { planos: { id: string; nome: string }[] }).planos;
  const id = lista.find((p) => p.nome === nomeDoPlano)?.id ?? '';
  return ((await (await request.get(`${URL_API}/api/planos/${id}`)).json()) as { itens: ItemApi[] }).itens.map((i) => i.idCenario);
};

test('Mover para plano: os testes agendados marcados saem do plano e chegam ao outro, gravado no servidor', async ({ page, request }) => {
  await resetar(request, true);
  await abrirApp(page);
  await irPara(page, 'Lista');
  await expect(page.getByRole('heading', { level: 3, name: 'Plano: 28/09/26' })).toBeVisible();
  expect(await itensDo(request, '05/10/26')).toEqual([]);

  // Um teste que já começou na seleção tira "Mover" e "Remover do plano" da barra.
  await page.getByRole('checkbox', { name: 'Selecionar CT03.2' }).check(); // em andamento na semente
  await expect(page.getByRole('region', { name: 'Ações em lote' })).toBeVisible();
  await expect(page.getByLabel('Mover para plano')).toHaveCount(0);
  await page.getByRole('checkbox', { name: 'Selecionar CT03.2' }).uncheck();

  await page.getByRole('checkbox', { name: 'Selecionar CT03.3' }).check();
  await page.getByRole('checkbox', { name: 'Selecionar CT04.1' }).check();
  const barra = page.getByRole('region', { name: 'Ações em lote' });
  await barra.getByLabel('Mover para plano').selectOption({ label: '05/10/26' });
  await barra.getByRole('button', { name: 'Mover', exact: true }).click();

  await expect(page.getByTestId('teste-CT03.3')).toHaveCount(0);
  await expect(page.getByTestId('teste-CT04.1')).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Ações em lote' })).toHaveCount(0);
  expect(await itensDo(request, '05/10/26')).toEqual(['CT03.3', 'CT04.1']);
  expect(await itensDo(request, '28/09/26')).not.toContain('CT03.3');
});

test('M12 Equipe e capacidade: muda capacidade, adiciona pessoa e tudo sobrevive a recarregar', async ({ page, request }) => {
  await resetar(request, true);
  type PessoaApi = { id: string; nome: string; capacidadeMinSemana: number };
  const pessoas = async () => ((await (await request.get(`${URL_API}/api/pessoas`)).json()) as { pessoas: PessoaApi[] }).pessoas;

  await abrirApp(page);
  await irPara(page, 'Planejamento');
  await page.getByRole('button', { name: 'Equipe e capacidade' }).click();
  const modal = page.getByRole('dialog', { name: 'Equipe e capacidade' });
  await expect(modal.getByLabel('Capacidade de Bia')).toHaveValue('90');

  await modal.getByLabel('Capacidade de Bia').fill('100');
  await modal.getByRole('button', { name: 'Adicionar pessoa' }).click();
  await modal.getByLabel('Nome da pessoa nova').fill('Dora');
  await modal.getByLabel('Capacidade de Dora').fill('45');
  await modal.getByRole('button', { name: 'Salvar' }).click();
  await expect(modal).toHaveCount(0);

  const depois = await pessoas();
  expect(depois.find((p) => p.nome === 'Bia')?.capacidadeMinSemana).toBe(100);
  expect(depois.find((p) => p.nome === 'Dora')?.capacidadeMinSemana).toBe(45);

  // A grade do Planejamento passa a ter a Dora, e o modal reaberto (após recarregar) mostra a capacidade nova.
  await expect(page.getByTestId('linha-pessoa-dora')).toBeVisible();
  await page.reload();
  await irPara(page, 'Planejamento');
  await page.getByRole('button', { name: 'Equipe e capacidade' }).click();
  await expect(page.getByRole('dialog', { name: 'Equipe e capacidade' }).getByLabel('Capacidade de Bia')).toHaveValue('100');
});

test('Presença: dois navegadores com pessoas diferentes se enxergam em "Online: …"', async ({ browser, request }) => {
  await resetar(request, true);
  const entrar = async (quem: 'ana' | 'bia') => {
    const contexto = await browser.newContext({ baseURL: URL_WEB, locale: 'pt-BR' });
    const pagina = await contexto.newPage();
    await abrirApp(pagina);
    await pagina.getByRole('combobox', { name: 'Você' }).selectOption(quem);
    return { contexto, pagina };
  };

  const ana = await entrar('ana');
  const bia = await entrar('bia');
  try {
    for (const { pagina } of [ana, bia]) {
      await expect(pagina.getByTestId('online')).toContainText('Ana');
      await expect(pagina.getByTestId('online')).toContainText('Bia');
    }
    const online = ((await (await request.get(`${URL_API}/api/presenca`)).json()) as { online: string[] }).online;
    expect([...online].sort()).toEqual(['ana', 'bia']);
  } finally {
    await ana.contexto.close();
    await bia.contexto.close();
  }
});
