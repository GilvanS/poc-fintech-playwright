import { expect, test } from '@playwright/test';
import { URL_API } from './ambiente.ts';
import { abrirApp, idsNaLista, irPara, resetar } from './ajudantes.ts';

// Roadmap, Lançamento, Planejamento da semana e Iterações.

test('Roadmap: barra do teste na data planejada, arrastar muda o dia no servidor e o Trimestral mostra a carga', async ({ page, request }) => {
  await resetar(request);
  // Datas relativas a hoje (dia útil seguinte e o depois dele), para o teste não envelhecer.
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const brasil = (s: string) => s.split('-').reverse().join('/');
  const diaUtil = (depoisDe: Date) => {
    const d = new Date(depoisDe);
    do d.setDate(d.getDate() + 1);
    while (d.getDay() === 0 || d.getDay() === 6);
    return d;
  };
  const primeiro = diaUtil(new Date());
  const segundo = diaUtil(primeiro);

  expect((await request.post(`${URL_API}/api/cenarios`, { data: { idCenario: 'CT90.1', nome: 'Teste do roadmap', funcionalidade: 'Roadmap' } })).ok()).toBeTruthy();
  const criado = (await (await request.post(`${URL_API}/api/planos`, { data: { nome: 'Roadmap E2E', idCenarios: ['CT90.1'] } })).json()) as { plano: { id: string }; itens: { versao: number }[] };
  const planoId = criado.plano.id;
  expect((await request.patch(`${URL_API}/api/planos/${planoId}/testes/CT90.1`, { data: { versao: criado.itens[0].versao, dataPlanejada: iso(primeiro), estimativaMin: 45 } })).ok()).toBeTruthy();

  await abrirApp(page);
  await irPara(page, 'Roadmap');
  await expect(page.getByRole('heading', { level: 2, name: 'Roadmap' })).toBeVisible();
  await expect(page.getByTestId(`linha-plano-${planoId}`)).toContainText('Plano Roadmap E2E');
  await expect(page.getByRole('button', { name: `CT90.1: planejado em ${brasil(iso(primeiro))}` })).toBeVisible();

  const transferencia = await page.evaluateHandle(() => new DataTransfer());
  await page.getByRole('button', { name: `CT90.1: planejado em ${brasil(iso(primeiro))}` }).dispatchEvent('dragstart', { dataTransfer: transferencia });
  await page.locator(`[data-testid="linha-teste-${planoId}-CT90.1"] [data-dia="${iso(segundo)}"]`).dispatchEvent('drop', { dataTransfer: transferencia });
  await expect(page.getByRole('button', { name: `CT90.1: planejado em ${brasil(iso(segundo))}` })).toBeVisible();

  const gravado = (await (await request.get(`${URL_API}/api/planos/${planoId}`)).json()) as { itens: { idCenario: string; dataPlanejada?: string }[] };
  expect(gravado.itens.find((i) => i.idCenario === 'CT90.1')?.dataPlanejada).toBe(iso(segundo));

  await page.getByRole('button', { name: 'Trimestral' }).click();
  await expect(page.getByTestId('linha-carga')).toContainText('45');
  await page.getByRole('button', { name: 'Mensal' }).click();
  await page.getByRole('button', { name: `CT90.1: planejado em ${brasil(iso(segundo))}` }).click();
  await expect(page.getByRole('dialog', { name: 'Detalhe do teste' })).toBeVisible();
});

test('Lançamento: quadro por funcionalidade do plano escolhido e o clique na célula abre a Lista filtrada', async ({ page, request }) => {
  await resetar(request, true);
  await abrirApp(page);
  await irPara(page, 'Lançamento');

  await expect(page.getByRole('heading', { level: 3, name: 'Lançamento do plano 28/09/26' })).toBeVisible();
  await expect(page.getByTestId('linha-total')).toBeVisible();
  await expect(page.getByTestId('linha-Faturas')).toContainText('Ana');
  await expect(page.getByText('= massa 0483 compartilhada (CT03.2 → CT03.7)')).toBeVisible();
  await expect(page.getByText('CT03.7 espera CT03.2 (mesma massa 0483)')).toBeVisible();

  const celula = page.getByRole('button', { name: /^Faturas × Agendado: \d+$/ });
  const quantos = Number(/: (\d+)$/.exec((await celula.getAttribute('aria-label')) ?? '')?.[1]);
  expect(quantos).toBeGreaterThan(0);
  await celula.click();

  await expect(page.getByRole('heading', { level: 2, name: 'Lista' })).toBeVisible();
  await expect(page.getByLabel('Funcionalidade')).toHaveValue('Faturas');
  await expect(page.getByLabel('Status', { exact: true })).toHaveValue('agendado');
  expect(await idsNaLista(page)).toHaveLength(quantos);

  // Passou/Falhou filtram pelo resultado, que é um filtro novo da Lista.
  await irPara(page, 'Lançamento');
  await page.getByRole('button', { name: /^Faturas × Passou: \d+$/ }).click();
  await expect(page.getByLabel('Resultado', { exact: true })).toHaveValue('passou');
  await expect(page.getByLabel('Status', { exact: true })).toHaveValue('concluido');
});

test('Planejamento: capacidade por pessoa, soltar além do limite avisa e "Colocar na Bia" grava no servidor', async ({ page, request }) => {
  await resetar(request);
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const segunda = new Date();
  segunda.setDate(segunda.getDate() - ((segunda.getDay() + 6) % 7));
  const terca = new Date(segunda);
  terca.setDate(terca.getDate() + 1);

  expect((await request.post(`${URL_API}/api/pessoas`, { data: { nome: 'Ana', capacidadeMinSemana: 60 } })).ok()).toBeTruthy();
  expect((await request.post(`${URL_API}/api/pessoas`, { data: { nome: 'Bia', capacidadeMinSemana: 120 } })).ok()).toBeTruthy();
  for (const id of ['CT91.1', 'CT91.2']) {
    expect((await request.post(`${URL_API}/api/cenarios`, { data: { idCenario: id, nome: `Teste ${id}`, funcionalidade: 'Planejamento' } })).ok()).toBeTruthy();
  }
  const criado = (await (await request.post(`${URL_API}/api/planos`, { data: { nome: 'Planejamento E2E', idCenarios: ['CT91.1', 'CT91.2'] } })).json()) as { plano: { id: string }; itens: { idCenario: string; versao: number }[] };
  const planoId = criado.plano.id;
  const versao = (id: string) => criado.itens.find((i) => i.idCenario === id)!.versao;
  expect((await request.patch(`${URL_API}/api/planos/${planoId}/testes/CT91.1`, { data: { versao: versao('CT91.1'), responsavel: 'ana', dataPlanejada: iso(segunda), estimativaMin: 40 } })).ok()).toBeTruthy();
  expect((await request.patch(`${URL_API}/api/planos/${planoId}/testes/CT91.2`, { data: { versao: versao('CT91.2'), estimativaMin: 30, prioridade: 'P1' } })).ok()).toBeTruthy();

  await abrirApp(page);
  await irPara(page, 'Planejamento');
  await expect(page.getByRole('heading', { level: 2, name: 'Planejamento' })).toBeVisible();
  await expect(page.getByTestId(`celula-ana-${iso(segunda)}`).getByRole('button', { name: 'CT91.1: 40 min' })).toBeVisible();
  await expect(page.getByTestId('uso-ana')).toContainText('40/60 min');
  await expect(page.getByTestId('backlog-CT91.2')).toBeVisible();

  const transferencia = await page.evaluateHandle(() => new DataTransfer());
  await page.getByTestId('backlog-CT91.2').dispatchEvent('dragstart', { dataTransfer: transferencia });
  await page.getByTestId(`celula-ana-${iso(terca)}`).dispatchEvent('drop', { dataTransfer: transferencia });

  const aviso = page.getByRole('alertdialog', { name: 'Capacidade excedida' });
  await expect(aviso).toContainText('Ana ficaria com 70 min para 60 min de capacidade.');
  await expect(aviso).toContainText('Bia (120 min)');
  await aviso.getByRole('button', { name: 'Colocar na Bia' }).click();

  await expect(page.getByTestId(`celula-bia-${iso(terca)}`).getByRole('button', { name: 'CT91.2: 30 min' })).toBeVisible();
  await expect(page.getByTestId('uso-bia')).toContainText('30/120 min');
  await expect(page.getByTestId('backlog-CT91.2')).toHaveCount(0);

  const gravado = (await (await request.get(`${URL_API}/api/planos/${planoId}`)).json()) as { itens: { idCenario: string; responsavel?: string; dataPlanejada?: string }[] };
  const item = gravado.itens.find((i) => i.idCenario === 'CT91.2');
  expect(item?.responsavel).toBe('bia');
  expect(item?.dataPlanejada).toBe(iso(terca));
});

test('Iterações: cards atual e próxima, burndown, e o backlog do catálogo vira teste do plano', async ({ page, request }) => {
  await resetar(request);
  const iso = (dias: number) => {
    const d = new Date();
    d.setDate(d.getDate() + dias);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  for (const id of ['CT92.1', 'CT92.2', 'CT92.3', 'CT92.4']) {
    expect((await request.post(`${URL_API}/api/cenarios`, { data: { idCenario: id, nome: `Teste ${id}`, funcionalidade: 'Iteracoes' } })).ok()).toBeTruthy();
  }
  const atual = (await (await request.post(`${URL_API}/api/planos`, { data: { nome: 'Iteração atual', previsao: iso(10), idCenarios: ['CT92.1', 'CT92.2'] } })).json()) as { plano: { id: string } };
  const proxima = (await (await request.post(`${URL_API}/api/planos`, { data: { nome: 'Iteração próxima', previsao: iso(24) } })).json()) as { plano: { id: string } };

  await abrirApp(page);
  await irPara(page, 'Iterações');
  await expect(page.getByRole('heading', { level: 2, name: 'Iterações' })).toBeVisible();
  await expect(page.getByTestId('iteracao-atual')).toContainText('Plano Iteração atual');
  await expect(page.getByTestId('iteracao-atual')).toContainText('0 de 2 concluídos');
  await expect(page.getByTestId('iteracao-proxima')).toContainText('Plano Iteração próxima');
  await expect(page.getByRole('img', { name: /Burndown do plano Iteração atual: 2 testes no início/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Backlog priorizado (2)' })).toBeVisible();

  // "Mover" leva para a próxima iteração (o destino padrão) e grava no servidor.
  await page.getByRole('button', { name: 'Mover CT92.3' }).click();
  await expect(page.getByTestId('iteracao-proxima')).toContainText('0 de 1 concluídos');
  await expect(page.getByTestId('backlog-CT92.3')).toHaveCount(0);
  const naProxima = (await (await request.get(`${URL_API}/api/planos/${proxima.plano.id}`)).json()) as { itens: { idCenario: string }[] };
  expect(naProxima.itens.map((i) => i.idCenario)).toEqual(['CT92.3']);

  // Soltar no card da iteração em andamento avisa que o escopo aumenta.
  const transferencia = await page.evaluateHandle(() => new DataTransfer());
  await page.getByTestId('backlog-CT92.4').dispatchEvent('dragstart', { dataTransfer: transferencia });
  await page.getByTestId('iteracao-atual').dispatchEvent('drop', { dataTransfer: transferencia });
  const aviso = page.getByRole('alertdialog', { name: 'Aumentar o escopo' });
  await expect(aviso).toContainText('aumenta o escopo');
  await aviso.getByRole('button', { name: 'Adicionar mesmo assim' }).click();
  await expect(page.getByTestId('iteracao-atual')).toContainText('0 de 3 concluídos');

  const naAtual = (await (await request.get(`${URL_API}/api/planos/${atual.plano.id}`)).json()) as { itens: { idCenario: string }[] };
  expect(naAtual.itens.map((i) => i.idCenario).sort()).toEqual(['CT92.1', 'CT92.2', 'CT92.4']);
  await expect(page.getByText('Todo cenário do catálogo já está em algum plano aberto.')).toBeVisible();
});
