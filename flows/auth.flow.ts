import { LandingPage, DashboardPage } from '../tests/pages';
import { EvidenceHelper } from '../tests/utils/evidenceHelper';

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

        await this.dashboardPage.navbar.navigateToProfile();
        await EvidenceHelper.captureStep(this.dashboardPage.page, 'Navegou para o Perfil');

        await this.dashboardPage.validateProfileName(nomeEsperado);
        await EvidenceHelper.captureStep(this.dashboardPage.page, 'Nome do perfil validado');
    }
}
