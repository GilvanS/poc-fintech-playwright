import { LandingPage, CadastroPage } from '../tests/pages';

export class CadastroFlow {
    constructor(
        private landingPage: LandingPage,
        private cadastroPage: CadastroPage
    ) {}

    /**
     * Executa a jornada completa de cadastro de novo usuário a partir da Landing Page.
     */
    async realizarCadastroCompleto(
        nome: string,
        email: string,
        cpf: string,
        senha: string
    ): Promise<void> {
        await this.landingPage.visit();
        await this.landingPage.goToSignUp();
        await this.cadastroPage.submitRegistrationForm(nome, email, cpf, senha);
        await this.cadastroPage.validateSuccessModal(nome, email, cpf);
    }
}
