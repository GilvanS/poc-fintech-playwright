import { Page, Locator } from "@playwright/test";
import { PopupsComponent } from "./PopupsComponent";

export class NavbarComponent {
    private readonly page: Page;
    private readonly popups: PopupsComponent;
    private readonly inicioButton: Locator;
    private readonly cartoesButton: Locator;
    private readonly faturasButton: Locator;
    private readonly shopButton: Locator;
    private readonly profileButton: Locator;
    private readonly sairButton: Locator;

    constructor(page: Page) {
        this.page = page;
        this.popups = new PopupsComponent(page);
        // Os botões da barra de navegação inferior (ícone Lucide + legenda) não
        // expõem role="button" na árvore de acessibilidade (fica "generic"),
        // então getByRole('button', ...) nunca casa. Usa nav + texto (CSS puro).
        this.inicioButton = page.locator('nav button', { hasText: 'Início' });
        this.cartoesButton = page.locator('nav button', { hasText: 'Cartões' });
        this.faturasButton = page.locator('nav button', { hasText: 'Faturas' });
        this.shopButton = page.locator('nav button', { hasText: 'Shop' });
        this.profileButton = page.locator('nav button', { hasText: 'Perfil' });
        this.sairButton = page.locator('nav button', { hasText: 'Sair' });
    }

    async navigateToHome(): Promise<void> {
        await this.inicioButton.click();
    }

    async navigateToProfile(): Promise<void> {
        await this.profileButton.click();
    }

    async navegarParaCartoes(): Promise<void> {
        await this.cartoesButton.click();
    }

    async navegarParaFaturas(): Promise<void> {
        // O app pode empilhar mais de uma sobreposição ao mesmo tempo (conquista
        // de poupança, aviso de fatura em atraso, painel de Saúde Financeira —
        // esse último também tem seu próprio botão "Continuar Poupando"). Fecha
        // em loop até não sobrar nenhuma, em vez de assumir só 1 de cada.
        // NUNCA clicar em "Pagar Fatura Anterior" aqui — esse botão inicia o
        // fluxo real de pagamento (navega pra fora do Dashboard), e este método
        // só deve dispensar avisos pra liberar acesso à navbar.
        // Cada isVisible/click abaixo tem timeout curto e explícito: sem isso,
        // click({force:true}) pode ficar preso ~30s (default do Playwright)
        // tentando resolver um elemento que já não existe mais no instante da
        // chamada, estourando o timeout total do teste dentro deste loop.
        for (let tentativa = 0; tentativa < 5; tentativa++) {
            let fechouAlgo = false;

            const btnPoupando = this.page.getByRole('button', { name: /Continuar Poupando/i }).first();
            if (await btnPoupando.isVisible({ timeout: 1000 }).catch(() => false)) {
                await btnPoupando.click({ force: true, timeout: 3000 }).catch(() => {});
                await this.page.waitForTimeout(300);
                fechouAlgo = true;
            }

            const btnEntendi = this.page.getByRole('button', { name: 'Entendi' }).first();
            if (await btnEntendi.isVisible({ timeout: 1000 }).catch(() => false)) {
                await btnEntendi.click({ force: true, timeout: 3000 }).catch(() => {});
                await this.page.waitForTimeout(300);
                fechouAlgo = true;
            }

            if (!fechouAlgo) break;
        }

        if (await this.page.getByRole('button', { name: 'Fechada' }).isVisible({ timeout: 1000 }).catch(() => false)) {
            return;
        }

        await this.faturasButton.click({ force: true, timeout: 5000 });
        await this.page.waitForTimeout(500);
    }

    async navegarParaShop(): Promise<void> {
        await this.shopButton.click();
    }

    async sairDoApp(): Promise<void> {
        await this.sairButton.click();
    }
}
