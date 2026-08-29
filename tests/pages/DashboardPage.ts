import { expect, Page, Locator } from "@playwright/test";

/**
 * DashboardPage - Page Object para o dashboard e páginas acessíveis após o login.
 */
export class DashboardPage {
    private page: Page;

    constructor(page: Page) {
        this.page = page;
    }
    /**
     * Navega para a seção de Perfil do usuário.
     */
    async navigateToProfile(): Promise<void> {
        await this.page.getByRole('button', { name: 'Perfil' }).click();
    }
    /**
     * Valida se o nome completo do usuário é exibido como um cabeçalho na página de perfil.
     * @param fullName O nome completo do usuário a ser validado.
     */
    async validateProfileName(fullName: string): Promise<void> {
        const profileNameHeading = this.page.getByRole('heading', { name: fullName });
        await expect(profileNameHeading).toBeVisible();
    }
    // Métodos antigos mantidos para compatibilidade, se necessário
    async navegarParaCartoes(): Promise<void> {
        await this.page.getByRole('button', { name: 'credit_card Cartões' }).click();
    }

    async navegarParaShop(): Promise<void> {
        await this.page.getByRole('button', { name: 'storefront Shop' }).click();
    }

    async aceitarOfertaShop(): Promise<void> {
        await this.page.getByRole('button', { name: 'Quero aproveitar' }).click();
    }

    async navegarParaPerfil(): Promise<void> {
        await this.page.getByRole('button', { name: 'person Perfil' }).click();
    }

    async sairDoApp(): Promise<void> {
        await this.page.getByRole('button', { name: 'Sair do App' }).click();
    }
}
