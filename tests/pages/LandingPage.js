import { expect } from "@playwright/test";

export class LandingPage {

    constructor(page) {
        this.page = page;
    }

    async visit(message = 'Olá!') {
        await this.page.goto('/');
        const loggedUsed = this.page.locator('#prelogin-greeting');
        await expect(loggedUsed).toHaveText(message);
    }

    async openLoginModal() {
        const message = 'Acessar minha conta'
        await this.page.getByRole('button', { name: message }).click();
    }

    async validMsg() {
        const message = 'Não é cliente? Abra uma conta'
        const msgNaoECliente = this.page.locator('#btn-signup')
        await expect(msgNaoECliente).toHaveText(message)
    }

    async submitLoginForm(cpf, password) {
        if (cpf) {
            await this.page.locator('#login-cpf').fill(cpf);
        }
        if (password) {
            await this.page.locator('#login-password').fill(password);
        }
        await this.page.getByRole('button', { name: 'Entrar' }).click();
    }

    async alertHaveText(target) {
        await expect(this.page.locator('.alert')).toHaveText(target);
    }
}
