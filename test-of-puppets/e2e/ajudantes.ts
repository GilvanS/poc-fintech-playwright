import { expect, type APIRequestContext, type Locator, type Page } from '@playwright/test';
import { URL_API } from './ambiente.ts';

/** Volta a pasta de dados de teste ao ponto de partida: vazia, ou com a semente (8 cenários, 3 pessoas, 3 planos). */
export async function resetar(request: APIRequestContext, semente = false): Promise<void> {
  const resposta = await request.post(`${URL_API}/api/teste/reset`, { data: { semente } });
  expect(resposta.ok(), 'o reset só existe no servidor em modo de teste').toBeTruthy();
}

export const menu = (page: Page): Locator => page.getByRole('complementary', { name: 'Navegação' });

/** Abre a ferramenta e passa pela entrada (sem senha, só o botão Entrar). */
export async function abrirApp(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(menu(page)).toBeVisible();
}

/** Vai para uma tela pelo menu. A sub-opção mora dentro do grupo: com o grupo fechado (trilho ou seta), abre antes. */
export async function irPara(page: Page, item: string): Promise<void> {
  const botao = menu(page).getByRole('button', { name: item, exact: true });
  if (!(await botao.isVisible())) {
    // `has` é relativo ao grupo: o localizador de dentro não pode partir do menu.
    const dentro = page.getByRole('button', { name: item, exact: true, includeHidden: true }); // a sub-opção de grupo fechado está escondida
    await menu(page).locator('[data-grupo]').filter({ has: dentro }).getByRole('button', { name: /^Grupo / }).click();
  }
  await botao.click();
}

/** Abre o detalhe de um plano pelo nome do card. */
export async function abrirPlano(page: Page, nome: string): Promise<Locator> {
  await irPara(page, 'Planos');
  await page.getByTestId('plano-nome').filter({ hasText: nome }).click();
  const detalhe = page.getByRole('dialog', { name: 'Detalhe do plano' });
  await expect(detalhe).toBeVisible();
  return detalhe;
}

/** IDs dos testes na ordem em que aparecem na Visão lista. */
export async function idsNaLista(page: Page): Promise<string[]> {
  return page.locator('[data-testid^="teste-"]').evaluateAll((linhas) => linhas.map((l) => (l.getAttribute('data-testid') ?? '').replace('teste-', '')));
}
