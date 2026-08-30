import { test } from '../../fixtures/testFixture';

test.describe('Dashboard - Jornadas do Usuário', () => {

    test.beforeEach(async ({ authFlow, loginModel }) => {
        // Realiza o login prévio antes de cada teste no Dashboard
        await authFlow.login(loginModel.cpf, loginModel.senha);
    });

    test('CT02.1 - Alterar Meta de Gastos com sucesso', async ({ dashboardFlow }) => {
        await dashboardFlow.inicializarDashboard();
        await dashboardFlow.alterarMetaDeGastos('5000');
    });

    test('CT02.2 - Consultar Insights de Assinaturas da IA', async ({ dashboardFlow }) => {
        await dashboardFlow.inicializarDashboard();
        await dashboardFlow.consultarInsightsIA();
    });

    test('CT02.3 - Tentar pagar conta recorrente e validar erro de PIN incorreto', async ({ dashboardFlow }) => {
        await dashboardFlow.inicializarDashboard();
        await dashboardFlow.pagarContaComErroPin('debito');
    });
});
