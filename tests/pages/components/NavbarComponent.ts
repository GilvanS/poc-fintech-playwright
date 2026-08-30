import { Page, Locator } from "@playwright/test";

/**
 * NavbarComponent - Menu de navegação persistente exibido nas telas internas
 * pós-login (Dashboard, Cartões, Shop, Perfil). Component Object: agrupa os
 * locators/ações do menu para ser composto pelos Page Objects que o exibem,
 * evitando duplicar esses locators em cada página.
 */
export class NavbarComponent {
    private readonly page: Page;

    private readonly profileButton: Locator;
    private readonly cartoesButton: Locator;
    private readonly shopButton: Locator;
    private readonly perfilIconButton: Locator;
    private readonly sairButton: Locator;

    constructor(page: Page) {
        this.page = page;

        this.profileButton = page.getByRole('button', { name: 'Perfil' });
        this.cartoesButton = page.getByRole('button', { name: 'credit_card Cartões' });
        this.shopButton = page.getByRole('button', { name: 'storefront Shop' });
        this.perfilIconButton = page.getByRole('button', { name: 'person Perfil' });
        this.sairButton = page.getByRole('button', { name: 'Sair do App' });
    }

    async navigateToProfile(): Promise<void> {
        await this.profileButton.click();
    }

    async navegarParaCartoes(): Promise<void> {
        await this.cartoesButton.click();
    }

    async navegarParaShop(): Promise<void> {
        await this.shopButton.click();
    }

    async navegarParaPerfil(): Promise<void> {
        await this.perfilIconButton.click();
    }

    async sairDoApp(): Promise<void> {
        await this.sairButton.click();
    }
}
