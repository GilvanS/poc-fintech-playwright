import { createBdd } from 'playwright-bdd';
import { test } from '../../fixtures/testFixture';
import { logger } from '../utils/logger';
import { registrarMassaCadastrada } from '../utils/massaCadastroXlsx';

const { Given, When, Then } = createBdd(test);

function formatarCpf(cpf: string): string {
    const digitos = cpf.replace(/\D/g, '');
    return `${digitos.slice(0, 3)}.${digitos.slice(3, 6)}.${digitos.slice(6, 9)}-${digitos.slice(9, 11)}`;
}

// "que acesso a landing page" já vem registrado em login.steps.ts — playwright-bdd
// descobre todos os step files de tests/steps/**/*.ts, não precisa redefinir aqui.
// Log de cada step (▶️ ...) vem do hook global em hooks.steps.ts — não precisa
// repetir aqui, só o que agrega dado real (nome/email/cpf preenchido, etc).

// Massa já foi escolhida na inicialização da fixture cadastroPoolState (mesmo timing de
// testData/loginModel) e logada no cabeçalho do cenário por testLogger — aqui só marca o
// step no fluxo do Gherkin.
Given('que tenho uma massa de cadastro nova', async () => {});

When('eu vou para a tela de cadastro', async ({ landingPage }) => {
    await landingPage.goToSignUp();
});

When('eu preencho o campo "Nome Completo" com o nome completo do cenário na tela de Cadastro', async ({ cadastroPage, cadastroPoolState }) => {
    const dados = cadastroPoolState.dados!;
    await cadastroPage.preencherNomeCompleto(dados.nomeCompleto);
});

When('eu preencho o campo "E-mail" com o email do cenário na tela de Cadastro', async ({ cadastroPage, cadastroPoolState }) => {
    const dados = cadastroPoolState.dados!;
    await cadastroPage.preencherEmail(dados.email);
});

When('eu preencho o campo "CPF" com o CPF do cenário na tela de Cadastro', async ({ cadastroPage, cadastroPoolState }) => {
    const dados = cadastroPoolState.dados!;
    await cadastroPage.preencherCpf(dados.cpf);
});

When('eu preencho o campo "Senha" com a senha do cenário na tela de Cadastro', async ({ cadastroPage, cadastroPoolState }) => {
    const dados = cadastroPoolState.dados!;
    await cadastroPage.preencherSenha(dados.senha);
});

When('eu preencho o campo "Confirme a Senha" com a senha do cenário na tela de Cadastro', async ({ cadastroPage, cadastroPoolState }) => {
    const dados = cadastroPoolState.dados!;
    await cadastroPage.preencherConfirmarSenha(dados.senha);
});

When('eu preencho o campo "Data de Nascimento" com a data de nascimento do cenário na tela de Cadastro', async ({ cadastroPage, cadastroPoolState }) => {
    const dados = cadastroPoolState.dados!;
    if (!dados.dataNascimento) return;
    logger.info(`📅 Data de Nascimento: ${dados.dataNascimento}`);
    await cadastroPage.preencherDataNascimento(dados.dataNascimento);
});

When('eu preencho o campo "Celular" com o celular do cenário na tela de Cadastro', async ({ cadastroPage, cadastroPoolState }) => {
    const dados = cadastroPoolState.dados!;
    if (!dados.telefone) return;
    logger.info(`📱 Celular: ${dados.telefone}`);
    await cadastroPage.preencherCelular(dados.telefone);
});

When('eu preencho o campo "CEP" com o CEP do cenário na tela de Cadastro', async ({ cadastroPage, cadastroPoolState }) => {
    const dados = cadastroPoolState.dados!;
    if (!dados.cep) return;
    logger.info(`🏠 CEP: ${dados.cep}`);
    await cadastroPage.preencherCep(dados.cep);
});

When('eu preencho o campo "Logradouro" com o logradouro do cenário na tela de Cadastro', async ({ cadastroPage, cadastroPoolState }) => {
    const dados = cadastroPoolState.dados!;
    if (!dados.rua) return;
    logger.info(`🏠 Logradouro: ${dados.rua}`);
    await cadastroPage.preencherLogradouro(dados.rua);
});

When('eu preencho o campo "Número" com o número do cenário na tela de Cadastro', async ({ cadastroPage, cadastroPoolState }) => {
    const dados = cadastroPoolState.dados!;
    if (!dados.numero) return;
    logger.info(`🏠 Número: ${dados.numero}`);
    await cadastroPage.preencherNumero(String(dados.numero));
});

When('eu preencho o campo "Cidade" com a cidade do cenário na tela de Cadastro', async ({ cadastroPage, cadastroPoolState }) => {
    const dados = cadastroPoolState.dados!;
    if (!dados.cidade) return;
    logger.info(`🏠 Cidade: ${dados.cidade}`);
    await cadastroPage.preencherCidade(dados.cidade);
});

When('eu preencho o campo "Bairro" com o bairro do cenário na tela de Cadastro', async ({ cadastroPage, cadastroPoolState }) => {
    const dados = cadastroPoolState.dados!;
    if (!dados.bairro) return;
    logger.info(`🏠 Bairro: ${dados.bairro}`);
    await cadastroPage.preencherBairro(dados.bairro);
});

When('eu preencho o campo "UF" com o estado do cenário na tela de Cadastro', async ({ cadastroPage, cadastroPoolState }) => {
    const dados = cadastroPoolState.dados!;
    if (!dados.estado) return;
    logger.info(`🏠 UF: ${dados.estado}`);
    await cadastroPage.preencherUf(dados.estado);
});

When('eu seleciono a bandeira do cartão do cenário na tela de Cadastro', async ({ cadastroPage, cadastroPoolState }) => {
    const dados = cadastroPoolState.dados!;
    if (!dados.bandeiraCartao) return;
    logger.info(`💳 Bandeira: ${dados.bandeiraCartao}`);
    await cadastroPage.selecionarBandeira(dados.bandeiraCartao);
});

When('eu seleciono a categoria do cartão do cenário na tela de Cadastro', async ({ cadastroPage, cadastroPoolState }) => {
    const dados = cadastroPoolState.dados!;
    if (!dados.tierCartao) return;
    logger.info(`💳 Tier: ${dados.tierCartao}`);
    await cadastroPage.selecionarTier(dados.tierCartao);
});

When('eu seleciono o dia de vencimento do cartão do cenário na tela de Cadastro', async ({ cadastroPage, cadastroPoolState }) => {
    const dados = cadastroPoolState.dados!;
    if (!dados.diaVencimento) return;
    logger.info(`💳 Dia de vencimento: ${dados.diaVencimento}`);
    await cadastroPage.selecionarDiaVencimento(String(dados.diaVencimento));
});

When('eu seleciono o plano de conta do cenário na tela de Cadastro', async ({ cadastroPage, cadastroPoolState }) => {
    const dados = cadastroPoolState.dados!;
    if (!dados.planoConta) return;
    logger.info(`💳 Plano de conta: ${dados.planoConta}`);
    await cadastroPage.selecionarPlanoConta(dados.planoConta);
});

// Parênteses em "(Opcional)" são sintaxe de grupo opcional em Cucumber Expressions —
// precisam de escape (\(...\)) pra virar texto literal, senão o step não casa.
When('eu preencho o campo "Chave PIX Inicial \\(Opcional\\)" com a chave PIX do cenário na tela de Cadastro', async ({ cadastroPage, cadastroPoolState }) => {
    const dados = cadastroPoolState.dados!;
    if (!dados.chavePix) return;
    logger.info(`🔑 Chave PIX: ${dados.chavePix}`);
    await cadastroPage.preencherChavePix(dados.chavePix);
});

When('eu confirmo o cadastro', async ({ cadastroPage }) => {
    await cadastroPage.clickSubmitButton();
});

// "no cadastro" desambigua de login.steps.ts ("para CPF"/"para senha" já existem lá pro
// modal de login) — mesmo texto de campo, telas diferentes, igual ao padrão "na tela 'X'".
Then('devo ver a mensagem de campo obrigatório para Nome Completo no cadastro', async ({ cadastroPage }) => {
    await cadastroPage.validarCampoObrigatorioNomeCompleto();
});

Then('devo ver a mensagem de campo obrigatório para CPF no cadastro', async ({ cadastroPage }) => {
    await cadastroPage.validarCampoObrigatorioCpf();
});

Then('devo ver a mensagem de campo obrigatório para E-mail no cadastro', async ({ cadastroPage }) => {
    await cadastroPage.validarCampoObrigatorioEmail();
});

Then('devo ver a mensagem de campo obrigatório para Senha no cadastro', async ({ cadastroPage }) => {
    await cadastroPage.validarCampoObrigatorioSenha();
});

Then('devo ver a mensagem de campo obrigatório para Confirmar Senha no cadastro', async ({ cadastroPage }) => {
    await cadastroPage.validarCampoObrigatorioConfirmarSenha();
});

Then('devo ver o modal de confirmação com os dados do cenário', async ({ cadastroPage, cadastroPoolState }) => {
    const dados = cadastroPoolState.dados!;
    await cadastroPage.validateModalContent(dados.nomeCompleto, dados.email, formatarCpf(dados.cpf));

    // DESLIGADO a pedido (2026-09-12): TBL_MASSA_CADASTRADA não é mais atualizada
    // automaticamente após o cadastro — o motor de tbl_de_massas assume esse papel
    // agora (ver export_tbl_massas / adminScriptsController.exportMassasCsv no
    // FintechBankApp). registrarMassaCadastrada() continua existindo em
    // massaCadastroXlsx.ts, só não é mais chamada daqui.
    //
    // Efeito colateral: obterMassaCadastroDoCenario() (mesmo arquivo) decide "massa
    // já usada" checando essa mesma aba — sem essa gravação, ela nunca mais vai
    // detectar reuso sozinha. Se o ID_MASSA de TBL_CENARIOS/cadastrar não for trocado
    // manualmente entre execuções, o cadastro vai tentar o MESMO CPF de novo e a API
    // vai rejeitar com erro de duplicidade (comportamento diferente do "erro
    // explícito de massa já usada" de antes — mesma causa raiz, sintoma na API
    // agora, não mais na planilha).
    // registrarMassaCadastrada(dados);
});

When('eu fecho o modal de confirmação', async ({ cadastroPage }) => {
    await cadastroPage.closeSuccessModal();
});

When('eu realizo login com o CPF e senha da massa cadastrada', async ({ authFlow, dashboardPage, cadastroPoolState }) => {
    const dados = cadastroPoolState.dados!;
    await authFlow.login(dados.cpf, dados.senha);
    await dashboardPage.validarDashboardCarregado();
    await dashboardPage.fecharModalConquista();
});

Then('devo ver o nome do usuário no dashboard', async ({ dashboardPage, cadastroPoolState }) => {
    const dados = cadastroPoolState.dados!;
    logger.info(`👤 Validando nome no dashboard: ${dados.nomeCompleto}`);
    await dashboardPage.validarPrimeiroNomeNoDashboard(dados.nomeCompleto);
});

Then('devo ver o saldo inicial em conta', async ({ dashboardPage }) => {
    await dashboardPage.validarSaldoInicial('R$ 2.000,00');
});

Then('devo ver o limite de crédito inicial', async ({ dashboardPage }) => {
    await dashboardPage.validarLimiteDisponivelInicial('R$ 5.000,00');
});

When('eu vou para o Meu Perfil', async ({ dashboardPage }) => {
    await dashboardPage.navbar.navigateToProfile();
});

Then('devo ver o nome completo e o email no perfil', async ({ dashboardPage, cadastroPoolState }) => {
    const dados = cadastroPoolState.dados!;
    await dashboardPage.validarNomeEEmailNoPerfil(dados.nomeCompleto, dados.email);
});

When('eu saio da conta', async ({ dashboardPage }) => {
    await dashboardPage.sairDaContaVolt();
});
