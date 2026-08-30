import { LandingPage, CadastroPage } from '../tests/pages';
import { EvidenceHelper } from '../tests/utils/evidenceHelper';

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
        await EvidenceHelper.captureStep(this.landingPage.page, 'Landing page carregada');

        await this.landingPage.goToSignUp();
        await EvidenceHelper.captureStep(this.landingPage.page, 'Formulário de cadastro aberto');

        await this.cadastroPage.fillRegistrationForm(nome, email, cpf, senha);
        await EvidenceHelper.captureStep(this.cadastroPage.page, 'Formulário de cadastro preenchido');

        await this.cadastroPage.clickSubmitButton();
        await EvidenceHelper.captureStep(this.cadastroPage.page, 'Cadastro submetido');

        await this.cadastroPage.validateModalContent(nome, email, cpf);
        await EvidenceHelper.captureStep(this.cadastroPage.page, 'Modal de sucesso validado');

        await this.cadastroPage.closeSuccessModal();
    }
}
