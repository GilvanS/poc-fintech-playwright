import { Page, Locator } from "@playwright/test";

export class LoginLocators {
    readonly heading: Locator;
    readonly subTitle: Locator;
    readonly signUpButton: Locator;
    readonly loginButton: Locator;
    readonly loginBrand: Locator;
    readonly loginTitle: Locator;
    readonly cpfInput: Locator;
    readonly passwordInput: Locator;
    readonly submitLoginButton: Locator;
    readonly alertMessage: Locator;

    constructor(page: Page) {
        this.heading = page.getByRole('heading', { name: 'VOLT' });
        this.subTitle = page.getByText('O banco digital que acelera');
        this.signUpButton = page.getByRole('button', { name: 'CRIAR CONTA' });
        this.loginButton = page.getByRole('button', { name: 'ENTRAR' });
        this.loginBrand = page.getByTestId('login-brand');
        this.loginTitle = page.getByTestId('login-title');
        this.cpfInput = page.getByTestId('login-input-cpf');
        this.passwordInput = page.getByTestId('login-input-password');
        this.submitLoginButton = page.getByTestId('login-submit-button');
        this.alertMessage = page.locator('.alert');
    }
}
