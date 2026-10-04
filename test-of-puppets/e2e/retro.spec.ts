import { expect, test } from '@playwright/test';
import { URL_API } from './ambiente.ts';
import { abrirApp, irPara, resetar } from './ajudantes.ts';

// Retro (V8): notas, votos e ações do plano concluído ficam em dados/retros.json; fechar trava notas e votos.

test('Retro: sugestão vira nota, voto, anônimas, ação com INC, fechar e reabrir gravam no servidor', async ({ page, request }) => {
  await resetar(request, true);
  type RetroApi = {
    status: string;
    anonimas: boolean;
    fechadaPor: string | null;
    notas: { texto: string; autor: string; votos: string[]; coluna: string }[];
    acoes: { texto: string; responsavel: string | null; incId: string | null; feito: boolean; feitoPor: string | null; origem: string | null }[];
  };
  const planos = ((await (await request.get(`${URL_API}/api/planos`)).json()) as { planos: { id: string; nome: string; resumo: { executado: boolean } }[] }).planos;
  const executado = planos.find((p) => p.resumo.executado);
  expect(executado, 'a semente tem um plano executado').toBeTruthy();
  const idPlano = executado?.id ?? '';
  const retro = async () => (await (await request.get(`${URL_API}/api/retros/${idPlano}`)).json()) as RetroApi;

  await abrirApp(page);
  await page.getByRole('combobox', { name: 'Você' }).selectOption('ana');
  await irPara(page, 'Retro');

  // O plano do cabeçalho está em andamento: a retro explica e deixa abrir a de um plano anterior.
  await expect(page.getByTestId('retro-indisponivel')).toContainText('ainda está em andamento');
  await page.getByLabel('Retros anteriores').selectOption(idPlano);
  await expect(page.getByRole('heading', { level: 3, name: `Retrospectiva — Plano ${executado?.nome}` })).toBeVisible();
  await expect(page.getByTestId('retro-status')).toContainText('ABERTA');

  // Sugestão automática vira nota (com o autor).
  const primeira = page.getByTestId('sugestoes').getByRole('listitem').first();
  const textoSugestao = ((await primeira.locator('span').first().textContent()) ?? '').replace('• ', '');
  await primeira.getByRole('button').click();
  await expect.poll(async () => (await retro()).notas.length).toBe(1);
  expect((await retro()).notas[0]).toMatchObject({ texto: textoSugestao, autor: 'ana', votos: [] });

  // Nota escrita à mão na coluna "Foi bem".
  const nota = 'Kanban com WIP evitou execuções em paralelo.';
  await page.getByRole('button', { name: 'Nova nota (Foi bem)' }).click();
  await page.getByLabel('Escreva a nota (Foi bem)').fill(nota);
  await page.getByTestId('coluna-retro-bem').getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByTestId('coluna-retro-bem').getByText(nota)).toBeVisible();

  // Voto: um por pessoa; o segundo clique tira.
  await page.getByRole('button', { name: `Votar em: ${nota}` }).click();
  await expect(page.getByRole('button', { name: `Tirar o voto de: ${nota}` })).toContainText('+1');
  expect((await retro()).notas.find((n) => n.texto === nota)?.votos).toEqual(['ana']);

  // Notas anônimas: o nome some e a própria nota diz "(sua nota)".
  // (Os checkboxes só mudam depois da resposta do servidor: clicar e esperar, em vez de .check().)
  await page.getByRole('checkbox', { name: 'Notas anônimas' }).click();
  await expect(page.getByRole('checkbox', { name: 'Notas anônimas' })).toBeChecked();
  await expect(page.getByTestId('coluna-retro-bem')).toContainText('(sua nota)');
  expect((await retro()).anonimas).toBe(true);
  await page.getByRole('checkbox', { name: 'Notas anônimas' }).click();
  await expect(page.getByRole('checkbox', { name: 'Notas anônimas' })).not.toBeChecked();
  await expect.poll(async () => (await retro()).anonimas).toBe(false);

  // Virar ação a partir da nota, abrindo também um INC.
  await page.getByRole('button', { name: `Virar ação: ${nota}` }).click();
  const modal = page.getByRole('dialog', { name: 'Nova ação' });
  await expect(modal).toContainText(`nota "${nota}"`);
  await modal.getByLabel('Ação', { exact: true }).fill('Manter o limite de WIP em 3');
  await modal.getByLabel('Prazo').fill('2026-12-20');
  await modal.getByRole('checkbox', { name: 'Criar também um INC' }).check();
  await modal.getByLabel('Número do INC').fill('INC0900001');
  await modal.getByLabel('Severidade do INC').selectOption('alta');
  await modal.getByRole('button', { name: 'Salvar ação' }).click();
  await expect(modal).toHaveCount(0);
  await expect(page.getByTestId('coluna-retro-acoes')).toContainText('Manter o limite de WIP em 3');
  await expect(page.getByTestId('coluna-retro-acoes')).toContainText('INC0900001');
  expect((await retro()).acoes[0]).toMatchObject({ texto: 'Manter o limite de WIP em 3', responsavel: 'ana', incId: 'INC0900001', origem: nota });
  const incidentes = ((await (await request.get(`${URL_API}/api/incidentes`)).json()) as { incidentes: { numero: string; severidade: string; titulo: string }[] }).incidentes;
  expect(incidentes.find((i) => i.numero === 'INC0900001')).toMatchObject({ severidade: 'alta', titulo: 'Manter o limite de WIP em 3' });

  // Marcar a ação como feita grava quem fez.
  await page.getByRole('checkbox', { name: 'Marcar como feita: Manter o limite de WIP em 3' }).click();
  await expect(page.getByRole('checkbox', { name: 'Marcar como feita: Manter o limite de WIP em 3' })).toBeChecked();
  await expect.poll(async () => (await retro()).acoes[0].feito).toBe(true);
  expect((await retro()).acoes[0].feitoPor).toBe('ana');

  // Fechar trava notas e votos; as ações continuam editáveis.
  await page.getByRole('button', { name: 'Fechar retro' }).click();
  await expect(page.getByTestId('retro-status')).toContainText('FECHADA');
  expect(await retro()).toMatchObject({ status: 'fechada', fechadaPor: 'ana' });
  await expect(page.getByRole('button', { name: 'Nova nota (Foi bem)' })).toBeDisabled();
  await expect(page.getByTestId('resumo-acoes')).toContainText('Ações concluídas (1)');
  const recusado = await request.post(`${URL_API}/api/retros/${idPlano}/notas`, { data: { coluna: 'bem', texto: 'Tarde demais', autor: 'bia' } });
  expect(recusado.status()).toBe(409);

  // Reabrir pede confirmação.
  await page.getByRole('button', { name: 'Reabrir' }).click();
  await page.getByRole('alertdialog', { name: 'Confirmar reabertura' }).getByRole('button', { name: 'Reabrir' }).click();
  await expect(page.getByTestId('retro-status')).toContainText('ABERTA');
  expect((await retro()).status).toBe('aberta');
});
