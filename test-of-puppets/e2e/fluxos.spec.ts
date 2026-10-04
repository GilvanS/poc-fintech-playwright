import { expect, test } from '@playwright/test';
import { URL_API } from './ambiente.ts';
import { abrirApp, abrirPlano, idsNaLista, irPara, menu, resetar } from './ajudantes.ts';

// Cada teste parte de uma pasta de dados temporária conhecida (vazia ou com a semente fictícia).

test('entrada sem senha: só o botão Entrar; sem Equipe o cabeçalho convida a cadastrar', async ({ page, request }) => {
  await resetar(request);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Test of Puppets' })).toBeVisible();
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(menu(page)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cadastrar equipe' })).toBeVisible();
});

test('cadastra dois cenários com a mesma massa, monta um plano e a dependência aparece sozinha', async ({ page, request }) => {
  await resetar(request);
  await abrirApp(page);
  await irPara(page, 'Cenários e massa');

  const cadastrar = async (id: string, nome: string, cpf: string) => {
    await page.getByRole('button', { name: 'Novo cenário' }).click();
    const modal = page.getByRole('dialog', { name: 'Novo cenário' });
    await modal.getByLabel('ID do cenário').fill(id);
    await modal.getByLabel('Nome', { exact: true }).fill(nome);
    await modal.getByLabel('Funcionalidade').fill('Faturas');
    await modal.getByLabel('Massa (ID)').fill('0483');
    await modal.getByLabel('CPF (opcional)').fill(cpf);
    return modal;
  };

  const primeiro = await cadastrar('CT03.2', 'Pagar valor mínimo', '52998224725');
  await expect(primeiro.getByLabel('CPF (opcional)')).toHaveValue('529.982.247-25'); // sem máscara de asteriscos
  await expect(primeiro.getByText('CPF fictício de massa de teste (não é dado real). Senha e PIN nunca são guardados.')).toBeVisible();
  await primeiro.getByRole('button', { name: 'Salvar cenário' }).click();

  const segundo = await cadastrar('CT03.7', 'Pagar fatura vencida', '52998224725');
  await expect(segundo.getByText('Massa 0483 já usada por CT03.2 (detectado sozinho)')).toBeVisible();
  await expect(segundo.getByText('Dependência automática: roda depois de CT03.2')).toBeVisible();
  await segundo.getByRole('button', { name: 'Salvar cenário' }).click();

  // A linha do CT03.2 também cita o CT03.7 ("= compartilhada com…"), então a linha certa é a que COMEÇA com o ID.
  const linha37 = page.getByRole('row', { name: /^CT03\.7\b/ });
  await expect(linha37).toContainText('Depende de CT03.2');
  await expect(linha37).toContainText('529.982.247-25');
  await expect(page.getByRole('alert')).toHaveCount(0); // massa repetida não é erro

  await irPara(page, 'Planos');
  await page.getByRole('button', { name: 'Novo Plano' }).click();
  const novo = page.getByRole('dialog', { name: 'Novo Plano' });
  await novo.getByLabel('Nome do plano').fill('12/10/26');
  await novo.getByRole('radio', { name: 'Todos os cenários cadastrados (2)' }).check();
  await novo.getByRole('button', { name: 'Criar plano' }).click();

  const card = page.getByRole('button', { name: /12\/10\/26/ });
  await expect(card).toContainText('2 teste(s) · 2 pendente(s)');
  await card.click();
  await expect(page.getByTestId('teste-CT03.7')).toContainText('Aguardando CT03.2 passar');
});

test('regra da massa na prática: o CT03.7 só anda depois que o CT03.2 passou', async ({ page, request }) => {
  await resetar(request, true);
  await abrirApp(page);
  const detalhe = await abrirPlano(page, '28/09/26');

  await detalhe.getByLabel('Status de CT03.7').selectOption('em_andamento');
  await expect(detalhe.getByRole('alert')).toContainText('Aguardando CT03.2 passar');
  await expect(detalhe.getByLabel('Status de CT03.7')).toHaveValue('agendado');

  await detalhe.getByLabel('Status de CT03.2').selectOption('concluido');
  await detalhe.getByLabel('Resultado de CT03.2').selectOption('passou');
  await expect(page.getByTestId('teste-CT03.7')).not.toContainText('Aguardando CT03.2 passar');

  await detalhe.getByLabel('Status de CT03.7').selectOption('em_andamento');
  await expect(detalhe.getByLabel('Status de CT03.7')).toHaveValue('em_andamento');
});

test('kanban: arrastar o card muda o status e fica gravado', async ({ page, request }) => {
  await resetar(request, true);
  await abrirApp(page);
  const detalhe = await abrirPlano(page, '28/09/26');
  await detalhe.getByRole('tab', { name: 'Visão card' }).click();

  const coluna = page.getByTestId('coluna-em_andamento');
  await expect(coluna.getByTestId('card-CT04.1')).toHaveCount(0);
  await page.getByTestId('card-CT04.1').dragTo(coluna);
  await expect(coluna.getByTestId('card-CT04.1')).toBeVisible();

  const planos = (await (await request.get(`${URL_API}/api/planos`)).json()) as { planos: { id: string; nome: string }[] };
  const id = planos.planos.find((p) => p.nome === '28/09/26')!.id;
  const gravado = (await (await request.get(`${URL_API}/api/planos/${id}`)).json()) as { itens: { idCenario: string; status: string }[] };
  expect(gravado.itens.find((i) => i.idCenario === 'CT04.1')?.status).toBe('em_andamento');
});

test('ordem de execução: o cadeado impede o CT03.7 de passar o CT03.2 e a ordem salva vale na lista', async ({ page, request }) => {
  await resetar(request, true);
  await abrirApp(page);
  const detalhe = await abrirPlano(page, '28/09/26');
  expect(await idsNaLista(page)).toEqual(['CT03.1', 'CT03.2', 'CT03.3', 'CT03.7', 'CT04.1', 'CT04.2', 'CT05.1', 'CT05.2']);

  await detalhe.getByRole('button', { name: 'Ordem de execução do plano' }).click();
  const ordem = page.getByRole('dialog', { name: 'Ordem de execução' });
  await expect(ordem.getByTestId('linha-CT03.7')).toContainText('depois do CT03.2');
  await ordem.getByRole('button', { name: 'Subir CT03.7' }).click();
  await expect(ordem.getByRole('button', { name: 'Subir CT03.7' })).toBeDisabled(); // colou no CT03.2: o cadeado segura
  await ordem.getByRole('button', { name: 'Salvar a ordem' }).click();
  await expect(ordem).toHaveCount(0);

  await expect.poll(() => idsNaLista(page)).toEqual(['CT03.1', 'CT03.2', 'CT03.7', 'CT03.3', 'CT04.1', 'CT04.2', 'CT05.1', 'CT05.2']);
});

test('detalhe do teste: CPF fictício inteiro com aviso, observação salva e histórico entre planos', async ({ page, request }) => {
  await resetar(request, true);
  await abrirApp(page);
  const detalhe = await abrirPlano(page, '28/09/26');

  await page.getByTestId('teste-CT03.2').getByRole('button', { name: 'Ver detalhes de CT03.2' }).click();
  const teste = page.getByRole('dialog', { name: 'Detalhe do teste' });
  await expect(teste.getByText('2 de 8 no plano')).toBeVisible();
  await teste.getByRole('tab', { name: 'Cenário e Datas' }).click();
  await expect(teste.getByText('529.982.247-25')).toBeVisible();
  await expect(teste.getByText('CPF fictício de massa de teste (não é dado real)')).toBeVisible();
  await expect(teste.getByText('= massa compartilhada com CT03.7')).toBeVisible();

  await teste.getByLabel('Observações').fill('rodar de manhã');
  await teste.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(teste.getByText('Alterações salvas.')).toBeVisible();
  await teste.getByRole('button', { name: 'Fechar' }).click();
  await expect(teste).toHaveCount(0);

  await page.getByTestId('teste-CT03.2').getByRole('button', { name: 'Ver detalhes de CT03.2' }).click();
  await teste.getByRole('tab', { name: 'Cenário e Datas' }).click();
  await expect(teste.getByLabel('Observações')).toHaveValue('rodar de manhã');
  await expect(teste.getByRole('tab', { name: /^Histórico \(\d+\)$/ })).toBeVisible();
  await expect(detalhe).toBeVisible();
});

test('Equipe, "Você" e edição em lote', async ({ page, request }) => {
  await resetar(request, true);
  await abrirApp(page);

  await irPara(page, 'Equipe');
  await page.getByRole('button', { name: 'Usar Ana como Você' }).click();
  await expect(page.getByRole('combobox', { name: 'Você' })).toHaveValue('ana');

  const detalhe = await abrirPlano(page, '28/09/26');
  await detalhe.getByRole('checkbox', { name: 'Só meus (Ana)' }).check();
  await expect(detalhe.getByText('Testes (2 de 8)')).toBeVisible();
  expect(await idsNaLista(page)).toEqual(['CT03.1', 'CT03.2']);
  await detalhe.getByRole('checkbox', { name: 'Só meus (Ana)' }).uncheck();

  await detalhe.getByRole('checkbox', { name: 'Selecionar CT04.1' }).check();
  await detalhe.getByRole('checkbox', { name: 'Selecionar CT04.2' }).check();
  const lote = detalhe.getByRole('region', { name: 'Ações em lote' });
  await expect(lote).toContainText('2 selecionados');
  await lote.getByLabel('Atribuir a').selectOption('bia');
  await lote.getByRole('button', { name: 'Aplicar' }).click();

  await expect(detalhe.getByLabel('Responsável de CT04.1')).toHaveValue('bia');
  await expect(detalhe.getByLabel('Responsável de CT04.2')).toHaveValue('bia');
  await expect(lote).toHaveCount(0);
});

test('seletor "Plano" é real e Lista/Kanban abrem o plano escolhido como página', async ({ page, request }) => {
  await resetar(request, true);
  await abrirApp(page);

  const seletor = page.getByRole('combobox', { name: 'Plano' });
  await expect(seletor.locator('option')).toHaveText(['Plano 14/09/26 · concluído', 'Plano 28/09/26', 'Plano 05/10/26']);
  await expect(seletor).toHaveValue(await seletor.locator('option', { hasText: 'Plano 28/09/26' }).getAttribute('value') as string);

  await irPara(page, 'Lista');
  await expect(page.getByRole('heading', { level: 3, name: 'Plano: 28/09/26' })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('tablist')).toHaveCount(0);
  expect(await idsNaLista(page)).toHaveLength(8);

  await seletor.selectOption({ label: 'Plano 14/09/26 · concluído' });
  await expect(page.getByRole('heading', { level: 3, name: 'Plano: 14/09/26' })).toBeVisible();

  await irPara(page, 'Kanban');
  await expect(page.getByTestId('coluna-concluido')).toBeVisible();
  await expect(page.getByTestId('coluna-agendado')).toBeVisible();
});

test('com tudo vazio, o botão carrega os dados de exemplo e não volta a aparecer', async ({ page, request }) => {
  await resetar(request);
  await abrirApp(page);
  await expect(page.getByText('Nenhum plano ainda')).toBeVisible();
  await page.getByRole('button', { name: 'Carregar dados de exemplo' }).click();
  await expect(page.getByRole('tab', { name: 'Em execução (2)' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Executados (1)' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Carregar dados de exemplo' })).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Você' })).toBeVisible(); // a Equipe de exemplo já está no cabeçalho
});
