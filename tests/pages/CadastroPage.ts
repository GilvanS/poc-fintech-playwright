import { expect, Page, Locator } from "@playwright/test";

export class CadastroPage {
    readonly page: Page;

    // Locators
    private readonly fullNameInput: Locator;
    private readonly emailInput: Locator;
    private readonly cpfInput: Locator;
    private readonly passwordInput: Locator;
    private readonly confirmPasswordInput: Locator;
    private readonly submitButton: Locator;
    private readonly modalTitle: Locator;
    private readonly modalNameValue: Locator;
    private readonly modalEmailValue: Locator;
    private readonly modalCpfValue: Locator;
    private readonly modalCloseButton: Locator;
    private readonly modalOverlay: Locator; // Locator para o fundo do modal

    constructor(page: Page) {
        this.page = page;

        // Inicialização dos locators
        this.fullNameInput = page.getByTestId('signup-input-fullname');
        this.emailInput = page.getByTestId('signup-input-email');
        this.cpfInput = page.getByTestId('signup-input-cpf');
        this.passwordInput = page.getByTestId('signup-input-password');
        this.confirmPasswordInput = page.getByTestId('signup-input-confirm-password');
        this.submitButton = page.getByTestId('signup-submit-button');
        this.modalTitle = page.getByTestId('signup-success-modal-title');
        this.modalNameValue = page.getByTestId('signup-success-name-value');
        this.modalEmailValue = page.getByTestId('signup-success-email-value');
        this.modalCpfValue = page.getByTestId('signup-success-cpf-value');
        this.modalCloseButton = page.getByTestId('signup-success-close-button');
        // Assumindo que o overlay é o div que contém o modal
        this.modalOverlay = page.locator('div.bg-black\\/70');
    }

    async fillRegistrationForm(fullName: string, email: string, cpf: string, password: string) {
        await this.fullNameInput.fill(fullName);
        await this.emailInput.fill(email);
        await this.cpfInput.fill(cpf);
        await this.passwordInput.fill(password);
        await this.confirmPasswordInput.fill(password);
    }

    async clickSubmitButton() {
        await this.submitButton.click();
    }

    async submitRegistrationForm(fullName: string, email: string, cpf: string, password: string) {
        await this.fillRegistrationForm(fullName, email, cpf, password);
        await this.clickSubmitButton();
    }

    async validateModalContent(expectedName: string, expectedEmail: string, expectedCpf: string) {
        await expect(this.modalTitle).toBeVisible();
        await expect(this.modalTitle).toHaveText('Conta criada com sucesso!');
        await expect(this.modalNameValue).toHaveText(expectedName);
        await expect(this.modalEmailValue).toHaveText(expectedEmail);
        await expect(this.modalCpfValue).toHaveText(expectedCpf);
    }

    async closeSuccessModal() {
        await this.modalCloseButton.click();
        await expect(this.modalOverlay).toBeHidden();
    }

    async validateSuccessModal(expectedName: string, expectedEmail: string, expectedCpf: string) {
        await this.validateModalContent(expectedName, expectedEmail, expectedCpf);
        await this.closeSuccessModal();
    }
}
