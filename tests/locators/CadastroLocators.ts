import { Page, Locator } from "@playwright/test";

export class CadastroLocators {
    readonly fullNameInput: Locator;
    readonly cpfInput: Locator;
    readonly birthDateInput: Locator;
    readonly emailInput: Locator;
    readonly phoneInput: Locator;
    readonly passwordInput: Locator;
    readonly confirmPasswordInput: Locator;
    readonly cepInput: Locator;
    readonly streetInput: Locator;
    readonly numberInput: Locator;
    readonly cityInput: Locator;
    readonly neighborhoodInput: Locator;
    readonly stateInput: Locator;
    readonly cardBrandSelect: Locator;
    readonly cardTierSelect: Locator;
    readonly pixKeyInput: Locator;
    readonly submitButton: Locator;
    readonly modalTitle: Locator;
    readonly modalNameValue: Locator;
    readonly modalEmailValue: Locator;
    readonly modalCpfValue: Locator;
    readonly modalCloseButton: Locator;
    readonly modalOverlay: Locator;

    constructor(page: Page) {
        // Locators adaptáveis (compatível com NewOnboardView e SignUp legado)
        this.fullNameInput = page.getByRole('textbox', { name: 'Nome Completo' }).or(page.getByTestId('signup-input-fullname'));
        this.cpfInput = page.getByRole('textbox', { name: 'CPF' }).or(page.getByTestId('signup-input-cpf'));
        this.birthDateInput = page.getByRole('textbox', { name: 'Data de Nascimento' });
        this.emailInput = page.getByRole('textbox', { name: 'E-mail' }).or(page.getByTestId('signup-input-email'));
        this.phoneInput = page.getByRole('textbox', { name: 'Celular' });
        this.passwordInput = page.getByRole('textbox', { name: 'Senha', exact: true }).or(page.getByTestId('signup-input-password'));
        this.confirmPasswordInput = page.getByRole('textbox', { name: 'Confirmar Senha' }).or(page.getByTestId('signup-input-confirm-password'));
        this.cepInput = page.getByRole('textbox', { name: 'CEP / ZipCode' });
        this.streetInput = page.getByRole('textbox', { name: 'Logradouro' });
        this.numberInput = page.getByRole('textbox', { name: 'Número' });
        this.cityInput = page.getByRole('textbox', { name: 'Cidade' });
        this.neighborhoodInput = page.getByRole('textbox', { name: 'Bairro' });
        this.stateInput = page.getByRole('textbox', { name: 'UF' });
        this.cardBrandSelect = page.getByLabel('Bandeira');
        this.cardTierSelect = page.getByLabel('Categoria (Tier)');
        this.pixKeyInput = page.getByRole('textbox', { name: 'Chave PIX Inicial (Opcional)' });
        this.submitButton = page.getByRole('button', { name: 'Finalizar Cadastro & Abrir' }).or(page.getByTestId('signup-submit-button'));

        this.modalTitle = page.getByTestId('signup-success-modal-title');
        this.modalNameValue = page.getByTestId('signup-success-modal-name');
        this.modalEmailValue = page.getByTestId('signup-success-modal-email');
        this.modalCpfValue = page.getByTestId('signup-success-modal-cpf');
        this.modalCloseButton = page.getByTestId('signup-success-modal-close-button');
        this.modalOverlay = page.getByTestId('signup-success-modal-overlay');
    }
}
