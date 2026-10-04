import { expect, test } from '@playwright/test';
import { URL_API } from './ambiente.ts';
import { abrirApp, resetar } from './ajudantes.ts';

// Sino (T10): os lembretes saem dos dados; só "lida" fica gravado (dados/lembretes.json), por pessoa.

const hojeLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

test('Sino: teste de hoje aparece, marcar como lida persiste por pessoa, abrir leva à tela e marcar todas zera', async ({ page, request }) => {
  await resetar(request, true);
  type Lista = { lembretes: { chave: string; tipo: string; titulo: string; detalhe: string; lida: boolean }[]; naoLidas: number };
  const lembretes = async (voce: string) => (await (await request.get(`${URL_API}/api/lembretes?voce=${voce}`)).json()) as Lista;

  // Põe um teste do plano em aberto para hoje, com a Ana de responsável.
  const planos = ((await (await request.get(`${URL_API}/api/planos`)).json()) as { planos: { id: string; resumo: { executado: boolean } }[] }).planos;
  const aberto = planos.find((p) => !p.resumo.executado);
  const detalhe = (await (await request.get(`${URL_API}/api/planos/${aberto?.id}`)).json()) as { itens: { idCenario: string; versao: number; status: string; dependeDe: string[]; nome?: string }[] };
  const alvo = detalhe.itens.find((i) => i.status !== 'concluido' && i.dependeDe.length === 0);
  expect(alvo, 'a semente tem um teste livre em plano aberto').toBeTruthy();
  const patch = await request.patch(`${URL_API}/api/planos/${aberto?.id}/testes/${alvo?.idCenario}`, { data: { versao: alvo?.versao, dataPlanejada: hojeLocal(), responsavel: 'ana' } });
  expect(patch.ok()).toBeTruthy();

  const inicial = await lembretes('ana');
  const doTeste = inicial.lembretes.find((l) => l.tipo === 'teste_hoje');
  expect(doTeste?.detalhe).toContain(alvo?.idCenario ?? '?');
  const total = inicial.naoLidas;
  // O teste de hoje + o INC aberto da Ana + a ação pendente da retro de exemplo (o INC da Bia não aparece para ela).
  expect(inicial.lembretes.map((l) => l.tipo).sort()).toEqual(['acao_retro', 'inc_aberto', 'teste_hoje']);
  expect(total).toBe(3);

  await abrirApp(page);
  await page.getByRole('combobox', { name: 'Você' }).selectOption('ana');
  await expect(page.getByRole('button', { name: `Lembretes (${total})` })).toBeVisible();
  await expect(page.getByTestId('sino-contador')).toHaveText(String(total));

  // Abre a lista e vê o teste de hoje.
  await page.getByRole('button', { name: `Lembretes (${total})` }).click();
  const painel = page.getByRole('dialog', { name: 'Lembretes' });
  await expect(painel.getByText('Teste de hoje', { exact: false }).first()).toBeVisible();

  // Marcar como lida: o contador cai e continua assim depois de recarregar a página.
  await painel.getByRole('button', { name: /^Marcar como lida: Teste de hoje/ }).click();
  await expect(page.getByRole('button', { name: `Lembretes (${total - 1})` })).toBeVisible();
  expect((await lembretes('ana')).naoLidas).toBe(total - 1);
  await page.reload();
  await expect(page.getByRole('button', { name: `Lembretes (${total - 1})` })).toBeVisible();

  // A marca é da Ana: a Bia ainda não leu este.
  const daBia = await lembretes('bia');
  expect(daBia.lembretes.every((l) => !l.lida)).toBe(true);

  // Abrir um INC leva para a tela de Incidentes.
  await page.getByRole('button', { name: `Lembretes (${total - 1})` }).click();
  await page.getByRole('dialog', { name: 'Lembretes' }).getByRole('button', { name: /^Abrir: INC aberto/ }).first().click();
  await expect(page.getByRole('heading', { level: 2, name: 'Incidentes' })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Lembretes' })).toHaveCount(0);

  // Marcar todas como lidas zera o contador (a bolinha some).
  await page.getByRole('button', { name: `Lembretes (${total - 1})` }).click();
  await page.getByRole('button', { name: 'Marcar todas como lidas' }).click();
  await expect(page.getByRole('button', { name: 'Lembretes (0)' })).toBeVisible();
  await expect(page.getByTestId('sino-contador')).toHaveCount(0);
  expect((await lembretes('ana')).naoLidas).toBe(0);
});
