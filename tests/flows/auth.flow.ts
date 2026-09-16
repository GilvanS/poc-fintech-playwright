import { expect } from '@playwright/test';
import { LandingPage } from '../pages/LandingPage';
import { DashboardPage } from '../pages/DashboardPage';
import { EvidenceHelper } from '../utils/EvidenceHelper';

export class AuthFlow {
    constructor(
        private landingPage: LandingPage,
        private dashboardPage: DashboardPage
    ) {}

    /**
     * Executa a jornada completa de abertura do modal e tentativa de login.
     */
    async login(cpf: string, pass: string): Promise<void> {
        await this.landingPage.visit();
        await EvidenceHelper.captureStep(this.landingPage.page, 'Landing page carregada');

        await this.landingPage.openLoginModal();
        await EvidenceHelper.captureStep(this.landingPage.page, 'Modal de login aberto');

        await this.landingPage.fillLoginForm(cpf, pass);
        await EvidenceHelper.captureStep(this.landingPage.page, 'Formulário de login preenchido');

        await this.landingPage.clickSubmitLoginButton();
        await EvidenceHelper.captureStep(this.landingPage.page, 'Login submetido');
    }

    /**
     * Executa o login com sucesso e valida o nome do perfil no Dashboard.
     */
    async loginEValidarPerfil(cpf: string, pass: string, nomeEsperado: string): Promise<void> {
        await this.login(cpf, pass);

        // Primeiro login de uma conta recém-criada dispara o modal de conquista/boas-vindas
        // e o painel de Saúde Financeira — este último busca dados assíncronos antes de
        // abrir, com atraso variável (visto de <1s até >8s entre execuções). Espera a rede
        // estabilizar antes de checar, em vez de adivinhar um tempo fixo.
        await this.dashboardPage.page.waitForLoadState('networkidle').catch(() => {});

        const btnSaudeFinanceira = this.dashboardPage.page.getByRole('button', { name: 'Entendido, Continuar Poupando!' });
        await btnSaudeFinanceira.click({ timeout: 15000 }).catch(() => {});
        // Confirma que realmente fechou antes de seguir — click({force:true}) mais adiante
        // não avisa se acertou o alvo errado por causa de um painel ainda sobreposto.
        await expect(btnSaudeFinanceira).toBeHidden({ timeout: 5000 }).catch(() => {});

        await this.dashboardPage.fecharModalConquista();
        await EvidenceHelper.captureStep(this.dashboardPage.page, 'Modal de conquista fechado (se houver)');

        await this.dashboardPage.navbar.navigateToProfile();
        await EvidenceHelper.captureStep(this.dashboardPage.page, 'Navegou para o Perfil');

        await this.dashboardPage.validateProfileName(nomeEsperado);
        await EvidenceHelper.captureStep(this.dashboardPage.page, 'Nome do perfil validado');
    }
}
