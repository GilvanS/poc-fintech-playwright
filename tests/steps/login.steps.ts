import { createBdd } from 'playwright-bdd';
import { test } from '../../fixtures/testFixture';

const { Given, When, Then } = createBdd(test);

Given('que acesso a landing page', async ({ landingPage }) => {
    await landingPage.visit();
});

When('eu realizo login com o CPF e senha do cenário', async ({ authFlow, loginModel }) => {
    await authFlow.login(loginModel.cpf, loginModel.senha);
});

When('eu abro o modal de login', async ({ landingPage }) => {
    await landingPage.openLoginModal();
});

// Steps atômicos (1 campo/ação por linha) usados nos cenários de campo obrigatório —
// "no modal de login" desambigua de "eu preencho o campo ... do cenário" do cadastro.steps.ts
// (mesmo texto de campo, telas diferentes), igual ao padrão "na tela 'X'" dos projetos mobile.
When('eu preencho o campo "CPF" com o CPF do cenário no modal de login', async ({ landingPage, loginModel }) => {
    await landingPage.preencherCpf(loginModel.cpf);
});

When('eu preencho o campo "Senha" com a senha do cenário no modal de login', async ({ landingPage, loginModel }) => {
    await landingPage.preencherSenha(loginModel.senha);
});

When('eu clico no botão "Entrar" no modal de login', async ({ landingPage }) => {
    await landingPage.clicarEntrar();
});

Then('devo ver as mensagens de campo obrigatório para CPF e senha no modal de login', async ({ landingPage }) => {
    await landingPage.alertHaveText([/Campo obrigatório/, /Campo obrigatório/]);
});

Then('devo ver a mensagem de campo obrigatório para senha no modal de login', async ({ landingPage }) => {
    await landingPage.alertHaveText([/Campo obrigatório/]);
});

Then('devo ver a mensagem de campo obrigatório para CPF no modal de login', async ({ landingPage }) => {
    await landingPage.alertHaveText([/Campo obrigatório/]);
});
