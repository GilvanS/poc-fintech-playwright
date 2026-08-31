import { Page } from "@playwright/test";

/**
 * PopupsComponent - Component Object para gerenciamento centralizado de popups,
 * avisos e modais sobrepostos (Poupança, Fatura em Atraso, Saúde Financeira, etc).
 */
export class PopupsComponent {
    private readonly page: Page;

    constructor(page: Page) {
        this.page = page;
    }

    /**
     * Verifica e fecha qualquer popup, alerta, drawer ou modal sobreposto ativo na página.
     */
    async fecharModaisSeVisiveis(): Promise<void> {
        // 1. Close button no banner de aviso no topo (⚠️ Fatura atrasada)
        const topBannerCloseBtn = this.page.getByText(/atrasada/i).locator('..').getByRole('button').first();
        if (await topBannerCloseBtn.isVisible().catch(() => false)) {
            await topBannerCloseBtn.click({ force: true }).catch(() => {});
            await this.page.waitForTimeout(300);
        }

        // 2. Botão 'Continuar Poupando! 🚀' (Conquista de Poupança)
        const btnPoupando = this.page.getByRole('button', { name: /Continuar Poupando/i }).first();
        if (await btnPoupando.isVisible().catch(() => false)) {
            await btnPoupando.click({ force: true }).catch(() => {});
            await this.page.waitForTimeout(300);
        }

        // 3. Botão 'Entendi' (Aviso de Fatura em Atraso)
        const btnEntendi = this.page.getByRole('button', { name: 'Entendi' });
        if (await btnEntendi.isVisible().catch(() => false)) {
            await btnEntendi.click({ force: true }).catch(() => {});
            await this.page.waitForTimeout(300);
        }
    }
}
