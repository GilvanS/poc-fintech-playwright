import { test } from '../../fixtures/testFixture';

test('CT01.1 - Abrir site e validar textos', async ({ landingPage }) => {
    await landingPage.visit();
});

test('CT01.2 - Fazer login como Admin', async ({ authFlow, loginModel }) => {
    // authFlow executa a jornada de login reutilizável (visit -> openLoginModal -> submitLoginForm)
    await authFlow.login(loginModel.cpf, loginModel.senha);
});

test('CT01.3 - Fazer login como Cliente', async ({ authFlow, loginModel }) => {
    // loginModel é carregado AUTOMATICAMENTE do Excel com base no ID 'CT01.3'
    await authFlow.login(loginModel.cpf, loginModel.senha);
});

test('CT01.4 - Validar campo obrigatório', async ({ landingPage }) => {
    await landingPage.visit();
    await landingPage.openLoginModal();
    await landingPage.submitLoginForm('', '');

    const message = [
        /Campo obrigatório/,
        /Campo obrigatório/
    ];
    await landingPage.alertHaveText(message);
});

test('CT01.5 - Validar campo obrigatório senha', async ({ landingPage }) => {
    await landingPage.visit();
    await landingPage.openLoginModal();
    await landingPage.submitLoginForm('999.999.999-99', '');

    const message = [
        /Campo obrigatório/
    ];
    await landingPage.alertHaveText(message);
});

test('CT01.6 - Validar campo obrigatório CPF', async ({ landingPage }) => {
    await landingPage.visit();
    await landingPage.openLoginModal();
    await landingPage.submitLoginForm('', 'admin999');

    const message = [
        /Campo obrigatório/
    ];
    await landingPage.alertHaveText(message);
});
