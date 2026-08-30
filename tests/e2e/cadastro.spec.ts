import { test } from '../../fixtures/testFixture';
import { createNewUser } from '../utils/faker-helper';
import { EvidenceHelper } from '../utils/evidenceHelper';

test.describe('CT00 - User Registration and Login', () => {
    test('should allow a new user to register, login, and validate profile name', async ({ page, landingPage, cadastroPage, dashboardPage }) => {
        const newUser = createNewUser('fr');

        // Configura a massa de teste no cabeçalho da evidência
        EvidenceHelper.setMassaDeTeste(
            `Nome: ${newUser.fullName} | E-mail: ${newUser.email} | CPF: ${newUser.cpf} | Senha: ${newUser.password}`
        );

        // 1. Visita a Landing Page
        await landingPage.visit();
        await EvidenceHelper.captureStep(page, 'Passo 1 - Acesso à Landing Page');
        await landingPage.goToSignUp();

        // 2. Preenche o formulário de cadastro (Print ANTES de clicar em avançar)
        await cadastroPage.fillRegistrationForm(
            newUser.fullName,
            newUser.email,
            newUser.cpf,
            newUser.password
        );
        await EvidenceHelper.captureStep(page, 'Passo 2 - Formulário de Cadastro Preenchido (Antes de Avançar)');
        await cadastroPage.clickSubmitButton();

        // 3. Valida o modal de sucesso do cadastro
        await cadastroPage.validateModalContent(
            newUser.fullName,
            newUser.email,
            newUser.cpf
        );
        await EvidenceHelper.captureStep(page, 'Passo 3 - Modal de Confirmação de Conta Criada com Sucesso');
        await cadastroPage.closeSuccessModal();

        // 4. Abre o modal de login e preenche as credenciais (Print ANTES de clicar em avançar)
        await landingPage.openLoginModal();
        await landingPage.fillLoginForm(newUser.cpf, newUser.password);
        await EvidenceHelper.captureStep(page, 'Passo 4 - Formulário de Login Preenchido (Antes de Avançar)');
        await landingPage.clickSubmitLoginButton();

        // 5. Navega ao perfil e valida o nome do novo usuário no Dashboard
        await dashboardPage.validarDashboardCarregado();
        await dashboardPage.fecharModalConquista();
        await dashboardPage.navbar.navigateToProfile();
        await dashboardPage.validateProfileName(newUser.fullName);
        await EvidenceHelper.captureStep(page, 'Passo 5 - Dashboard Carregado e Perfil do Usuário Validado');
    });
});

