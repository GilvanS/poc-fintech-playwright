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
