import { expect, Page, Locator } from "@playwright/test";

export class LandingPage {
    readonly page: Page;

    // Propriedades da página (Locators centralizados)
    private readonly heading: Locator;
    private readonly subTitle: Locator;
    private readonly signUpButton: Locator;
    private readonly loginButton: Locator;
    private readonly loginBrand: Locator;
    private readonly loginTitle: Locator;
    private readonly signupPrompt: Locator;
    private readonly cpfInput: Locator;
    private readonly passwordInput: Locator;
    private readonly submitLoginButton: Locator;
    private readonly alertMessage: Locator;

    constructor(page: Page) {
        this.page = page;

        // Inicialização dos locators
        this.heading = page.getByRole('heading', { name: 'VOLT' });
        this.subTitle = page.getByText('O banco digital que acelera');
        this.signUpButton = page.getByRole('button', { name: 'CRIAR CONTA' });
        this.loginButton = page.getByRole('button', { name: 'ENTRAR' });
        this.loginBrand = page.getByTestId('login-brand');
        this.loginTitle = page.getByTestId('login-title');
        this.signupPrompt = page.getByText('Não tem uma conta? Cadastre-se');
        this.cpfInput = page.getByTestId('login-input-cpf');
        this.passwordInput = page.getByTestId('login-input-password');
        this.submitLoginButton = page.getByTestId('login-submit-button');
        this.alertMessage = page.locator('.alert');
    }

    async visit(): Promise<void> {
        await this.page.goto('/');
        await expect(this.heading).toBeVisible();
        await expect(this.subTitle).toBeVisible();
    }

    async goToSignUp(): Promise<void> {
        await this.signUpButton.click();
    }

    async openLoginModal(): Promise<void> {
        await this.loginButton.click();
        await expect(this.loginBrand).toBeVisible();
        await expect(this.loginTitle).toBeVisible();
    }

    async validateSignupPrompt(): Promise<void> {
        await expect(this.signupPrompt).toBeVisible();
    }

    async fillLoginForm(cpf: string, password: string): Promise<void> {
        if (cpf) {
            await this.cpfInput.fill(cpf);
        }
        if (password) {
            await this.passwordInput.fill(password);
        }
    }

    async clickSubmitLoginButton(): Promise<void> {
        await this.submitLoginButton.click();
    }

    async submitLoginForm(cpf: string, password: string): Promise<void> {
        await this.fillLoginForm(cpf, password);
        await this.clickSubmitLoginButton();
    }

    async alertHaveText(target: RegExp[]): Promise<void> {
        await expect(this.alertMessage).toHaveText(target);
    }
}
