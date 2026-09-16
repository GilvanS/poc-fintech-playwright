import { expect, Page } from "@playwright/test";
import { LoginLocators } from "../locators/LoginLocators";

export class LandingPage {
    readonly page: Page;
    readonly locators: LoginLocators;

    constructor(page: Page) {
        this.page = page;
        this.locators = new LoginLocators(page);
    }

    async visit(): Promise<void> {
        await this.page.goto('/');
        await expect(this.locators.heading).toBeVisible();
        await expect(this.locators.subTitle).toBeVisible();
    }

    async goToSignUp(): Promise<void> {
        await this.locators.signUpButton.click();
    }

    async openLoginModal(): Promise<void> {
        await this.locators.loginButton.click();
        await expect(this.locators.loginBrand).toBeVisible();
        await expect(this.locators.loginTitle).toBeVisible();
    }

    async fillLoginForm(cpf: string, password: string): Promise<void> {
        if (cpf) {
            await this.locators.cpfInput.fill(cpf);
        }
        if (password) {
            await this.locators.passwordInput.fill(password);
        }
    }

    /** Preenche só o campo CPF — usado pelos steps atômicos de validação de campo obrigatório. */
    async preencherCpf(cpf: string): Promise<void> {
        await this.locators.cpfInput.fill(cpf);
    }

    /** Preenche só o campo Senha — usado pelos steps atômicos de validação de campo obrigatório. */
    async preencherSenha(password: string): Promise<void> {
        await this.locators.passwordInput.fill(password);
    }

    async clickSubmitLoginButton(): Promise<void> {
        await this.locators.submitLoginButton.click();
    }

    /** Alias em português do clique de submit — mesmo botão, nome alinhado ao texto do Gherkin. */
    async clicarEntrar(): Promise<void> {
        await this.locators.submitLoginButton.click();
    }

    // Mantido pelos specs legados (tests/e2e/) — os steps de login.feature usam os métodos
    // atômicos (preencherCpf/preencherSenha/clicarEntrar) acima, um por linha de Gherkin.
    async submitLoginForm(cpf: string, password: string): Promise<void> {
        await this.fillLoginForm(cpf, password);
        await this.clickSubmitLoginButton();
    }

    async alertHaveText(target: RegExp[]): Promise<void> {
        await expect(this.locators.alertMessage).toHaveText(target);
    }
}
