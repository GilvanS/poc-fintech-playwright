import { createBdd } from 'playwright-bdd';
import { test } from '../../fixtures/testFixture';

const { Given, When, Then } = createBdd(test);

Given('o dashboard está inicializado', async ({ dashboardPage }) => {
    // O painel de Saúde Financeira (dentro de inicializarDashboard) pode levar >15s pra
    // aparecer e ser fechado — soma com login já consome perto dos 30s padrão do teste.
    test.info().setTimeout(60000);
    await dashboardPage.inicializarDashboard();
});

When('eu altero a meta de gastos para {string} no Dashboard', async ({ dashboardPage }, novoValor: string) => {
    await dashboardPage.editarMetaDeGastos(novoValor);
});

When('eu abro o diagnóstico de assinaturas da IA no Dashboard', async ({ dashboardPage }) => {
    await dashboardPage.abrirDiagnosticoIA();
});

When('eu fecho o diagnóstico da IA no Dashboard', async ({ dashboardPage }) => {
    await dashboardPage.fecharDiagnosticoIA();
});

When('eu inicio o pagamento de uma conta recorrente no débito no Dashboard', async ({ dashboardPage }) => {
    await dashboardPage.iniciarPagamentoContaRecorrente('debito');
});

When('eu confirmo o pagamento no Dashboard', async ({ dashboardPage }) => {
    await dashboardPage.confirmarPagamento();
});

Then('devo ver o erro de PIN incorreto no Dashboard', async ({ dashboardPage }) => {
    await dashboardPage.validarErroPinIncorreto();
});
