import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { URL_API } from './ambiente.ts';
import { abrirApp, irPara, resetar } from './ajudantes.ts';

// Cadastro de cenários em SQLite: detalhe, filtros, exportar e importar CSV.

const csv = (linhas: string[]) => ['ID;Nome;Funcionalidade;Feature;Projeto;Massa;CPF;Passos;Resultado esperado', ...linhas].join('\r\n');

test('exportar o CSV, editar fora e importar de volta atualiza o cadastro (ID como chave); linha com erro fica de fora', async ({ page, request }) => {
  await resetar(request, true);
  await abrirApp(page);
  await irPara(page, 'Cenários e massa');
  await expect(page.getByTestId('armazenamento')).toContainText('8 de 5.000 cenários');

  // Exportar: baixa cenarios.csv com o cabeçalho e os cenários da semente.
  const baixando = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar CSV' }).click();
  const download = await baixando;
  expect(download.suggestedFilename()).toBe('cenarios.csv');
  const caminho = await download.path();
  const exportado = await readFile(caminho, 'utf8');
  expect(exportado.startsWith('﻿ID;Nome;Funcionalidade;Feature;Projeto;Massa;CPF;Passos;Resultado esperado')).toBe(true);
  expect(exportado).toContain('CT03.2;');

  // Importar: um existente com nome novo, um novo e uma linha ruim.
  await page.getByRole('button', { name: 'Importar CSV' }).click();
  const painel = page.getByRole('dialog', { name: 'Importar cenários (CSV)' });
  await painel.getByLabel('Arquivo CSV').setInputFiles({
    name: 'volta.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      csv([
        'CT03.2;Pagar valor mínimo (revisado);Faturas;faturas.feature;FintechBankApp;0483;;Abrir a fatura;Mínimo registrado',
        'CT90.1;Cenário importado;Cartões;cartoes.feature;FintechBankApp;;;;',
        'XX;Ruim;;;;;;;',
      ]),
      'utf8',
    ),
  });
  const resumo = painel.getByTestId('resumo-importacao');
  await expect(resumo).toContainText('3Linhas');
  await expect(resumo).toContainText('1Novos');
  await expect(resumo).toContainText('1Com erro');
  await expect(painel.getByTestId('problemas-importacao')).toContainText('Linha 4');
  // A prévia não gravou nada.
  expect(((await (await request.get(`${URL_API}/api/cenarios`)).json()) as { cenarios: unknown[] }).cenarios).toHaveLength(8);

  await painel.getByRole('radio', { name: /Atualizar com os dados do arquivo/ }).check();
  await painel.getByRole('button', { name: 'Importar 2 cenários' }).click();
  await expect(painel.getByText('Importação concluída.')).toBeVisible();
  await painel.getByRole('button', { name: 'Concluir' }).click();

  await expect(page.getByTestId('armazenamento')).toContainText('9 de 5.000 cenários');
  await expect(page.getByRole('button', { name: 'Detalhes de CT90.1' })).toBeVisible();

  const gravado = (await (await request.get(`${URL_API}/api/cenarios`)).json()) as { cenarios: { idCenario: string; nome: string; projeto?: string; versao: number }[]; projetos: string[] };
  const ct32 = gravado.cenarios.find((c) => c.idCenario === 'CT03.2')!;
  expect(ct32.nome).toBe('Pagar valor mínimo (revisado)');
  expect(ct32.projeto).toBe('FintechBankApp');
  expect(ct32.versao).toBe(2);
  expect(gravado.projetos).toEqual(['FintechBankApp']);
});

test('detalhe do cenário mostra os dados e os planos onde ele está; filtro por funcionalidade', async ({ page, request }) => {
  await resetar(request, true);
  await abrirApp(page);
  await irPara(page, 'Cenários e massa');

  await page.getByRole('button', { name: 'Detalhes de CT03.2' }).click();
  const detalhe = page.getByRole('dialog', { name: 'Detalhe do cenário' });
  await expect(detalhe.getByText('529.982.247-25')).toBeVisible();
  await expect(detalhe.getByText(/^Planos \(\d+\)$/)).toBeVisible();
  await expect(detalhe.getByText('Plano 28/09/26')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(detalhe).toHaveCount(0);

  await page.getByLabel('Filtrar por funcionalidade').selectOption('Pix');
  await expect(page.getByText(/^\d+ de 8 cenários$/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Detalhes de CT03.2' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Detalhes de CT04.1' })).toBeVisible();
});
