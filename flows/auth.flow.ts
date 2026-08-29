import { LandingPage, DashboardPage } from '../tests/pages';

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
        await this.landingPage.openLoginModal();
        await this.landingPage.submitLoginForm(cpf, pass);
    }

    /**
     * Executa o login com sucesso e valida o nome do perfil no Dashboard.
     */
    async loginEValidarPerfil(cpf: string, pass: string, nomeEsperado: string): Promise<void> {
        await this.login(cpf, pass);
        await this.dashboardPage.navigateToProfile();
        await this.dashboardPage.validateProfileName(nomeEsperado);
    }
}
