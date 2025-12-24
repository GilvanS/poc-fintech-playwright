import { expect } from "@playwright/test";

export class LandingPage {

    constructor(page) {
        this.page = page;
    }

    async visit(message = 'Olá!') {
        await this.page.goto('/');
        const loggedUsed = this.page.locator('.text-2xl');
        await expect(loggedUsed).toHaveText(message);
    }

    async openLoginModal() {
        const message = 'Acessar minha conta'
        await this.page.getByRole('button', { name: message }).click();
    }

    async validMsg() {
        const message = 'Não é cliente? Abra uma conta'
        const msgNaoECliente = this.page.locator('.py-3')
        await expect(msgNaoECliente).toHaveText(message)
    }

    async submitLoginForm(cpf, password) {
        if (cpf) {
            await this.page.getByPlaceholder('000.000.000-00').fill(cpf);
        }
        if (password) {
            await this.page.locator('#password-login').fill(password);
        }
        await this.page.getByRole('button', { name: 'Entrar' }).click();
    }

    async alertHaveText(target) {
        await expect(this.page.locator('.alert')).toHaveText(target);
    }
}
