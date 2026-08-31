import { expect, Page, Locator } from "@playwright/test";
import { NavbarComponent } from "./components/NavbarComponent";
import { PopupsComponent } from "./components/PopupsComponent";

/**
 * DashboardPage - Page Object para o dashboard e funcionalidades pós-login.
 */
export class DashboardPage {
    readonly page: Page;

    // Component Objects
    readonly navbar: NavbarComponent;
    readonly popups: PopupsComponent;

    // Locators do Header e Layout Principal
    readonly dashboardHeading: Locator;
    readonly saudeFinanceiraHeading: Locator;
    readonly menuOcultarButton: Locator;
    readonly personalizarPainelButton: Locator;

    // Locators de Modais / Banners Iniciais
    readonly conquistaPoupancaText: Locator;
    readonly continuarPoupandoButton: Locator;

    // Locators de Saldo e Rendimentos
    readonly saldoContaText: Locator;
    readonly rendimentoText: Locator;

    // Locators da Meta de Gastos
    readonly metaGastosHeading: Locator;
    readonly editarMetaButton: Locator;
    readonly cancelarMetaButton: Locator;
    readonly salvarMetaButton: Locator;
    readonly metaValorInput: Locator;

    // Locators de Contas Recorrentes e IA
    readonly contasRecorrentesHeading: Locator;
    readonly iaButton: Locator;
    readonly assinaturasIAButton: Locator;
    readonly diagnosticoIAHeading: Locator;
    readonly novaContaButton: Locator;
    readonly fecharModalButton: Locator;

    // Locators de Pagamento e Validação de PIN
    readonly pendenteBadge: Locator;
    readonly pagarButton: Locator;
    readonly opcaoPagamentoHeading: Locator;
    readonly opcaoDebitoText: Locator;
    readonly opcaoCreditoText: Locator;
    readonly continuarPagamentoButton: Locator;
    readonly confirmarPagamentoHeading: Locator;
    readonly confirmarButton: Locator;
    readonly erroHeading: Locator;
    readonly pinIncorretoText: Locator;
    readonly entendiButton: Locator;

    constructor(page: Page) {
        this.page = page;
        this.navbar = new NavbarComponent(page);
        this.popups = new PopupsComponent(page);

        // Header & Menu
        this.dashboardHeading = page.getByRole('heading', { name: 'SEU DASHBOARD' });
        this.saudeFinanceiraHeading = page.getByRole('heading', { name: 'Saúde Financeira', exact: true });
        this.menuOcultarButton = page.getByRole('button', { name: 'Ocultar Menu' });
        this.personalizarPainelButton = page.getByRole('button', { name: 'PERSONALIZAR PAINEL' });

        // Conquistas & Modais
        this.conquistaPoupancaText = page.getByText('Conquista de Poupança!');
        this.continuarPoupandoButton = page.getByRole('button', { name: /Continuar Poupando/i });

        // Saldo
        this.saldoContaText = page.getByText('SALDO EM CONTA');
        this.rendimentoText = page.getByText('+2.5% este mês (Rendimento');

        // Meta de Gastos
        this.metaGastosHeading = page.getByRole('heading', { name: 'Meta de Gastos' });
        this.editarMetaButton = page.getByRole('button', { name: 'Editar' });
        this.cancelarMetaButton = page.getByRole('button', { name: 'Cancelar' });
        this.salvarMetaButton = page.getByRole('button', { name: 'Salvar' });
        this.metaValorInput = page.getByRole('spinbutton');

        // Contas Recorrentes & IA
        this.contasRecorrentesHeading = page.getByRole('heading', { name: 'Contas Recorrentes' });
        this.iaButton = page.getByRole('button', { name: 'IA', exact: true });
        this.assinaturasIAButton = page.getByRole('button', { name: 'Assinaturas por IA' });
        this.diagnosticoIAHeading = page.getByRole('heading', { name: 'Diagnóstico da IA' });
        this.novaContaButton = page.getByRole('button', { name: 'Nova' });
        this.fecharModalButton = page.getByRole('button', { name: 'Fechar' });

        // Pagamentos & PIN
        this.pendenteBadge = page.getByText('Pendente', { exact: true });
        this.pagarButton = page.getByRole('button', { name: 'PAGAR', exact: true });
        this.opcaoPagamentoHeading = page.getByRole('heading', { name: 'Opção de Pagamento' });
        this.opcaoDebitoText = page.getByText('Pagar no Débito (Saldo da');
        this.opcaoCreditoText = page.getByText('Adiantar no Crédito (Lançar');
        this.continuarPagamentoButton = page.getByRole('button', { name: 'Continuar Pagamento' });
        this.confirmarPagamentoHeading = page.getByRole('heading', { name: 'Confirmar Pagamento Recorrente' });
        this.confirmarButton = page.getByRole('button', { name: 'Confirmar' });
        this.erroHeading = page.getByRole('heading', { name: 'Erro' });
        this.pinIncorretoText = page.getByText('Senha PIN incorreta!');
        this.entendiButton = page.getByRole('button', { name: 'Entendi' });
    }

    /**
     * Valida que o Dashboard foi carregado com sucesso.
     */
    async validarDashboardCarregado(): Promise<void> {
        await expect(this.dashboardHeading).toBeVisible({ timeout: 15000 });
    }

    /**
     * Fecha o modal inicial de Conquista de Poupança, se estiver visível.
     */
    async fecharModalConquista(): Promise<void> {
        await this.popups.fecharModaisSeVisiveis();
    }

    /**
     * Edita o valor da meta de gastos no dashboard.
     * @param novoValor Novo valor a ser inserido no campo de meta.
     */
    async editarMetaDeGastos(novoValor: string): Promise<void> {
        await this.editarMetaButton.click();
        await expect(this.cancelarMetaButton).toBeVisible();
        await this.metaValorInput.click();
        await this.metaValorInput.fill(novoValor);
        await this.salvarMetaButton.click();
        await expect(this.editarMetaButton).toBeVisible();
    }

    /**
     * Abre e valida o modal de Diagnóstico da IA para assinaturas.
     */
    async abrirDiagnosticoIA(): Promise<void> {
        await this.iaButton.click();
        await expect(this.diagnosticoIAHeading).toBeVisible();
    }

    /**
     * Fecha o modal de Diagnóstico da IA.
     */
    async fecharDiagnosticoIA(): Promise<void> {
        await this.fecharModalButton.click();
    }

    /**
     * Inicia o pagamento de uma conta recorrente escolhendo a opção (débito ou crédito).
     */
    async iniciarPagamentoContaRecorrente(tipo: 'debito' | 'credito' = 'debito'): Promise<void> {
        await this.pagarButton.click();
        await expect(this.opcaoPagamentoHeading).toBeVisible();

        if (tipo === 'debito') {
            await this.opcaoDebitoText.click();
        } else {
            await this.opcaoCreditoText.click();
        }

        await this.continuarPagamentoButton.click();
        await expect(this.confirmarPagamentoHeading).toBeVisible();
    }

    /**
     * Confirma o pagamento e tenta submeter.
     */
    async confirmarPagamento(): Promise<void> {
        await this.confirmarButton.click();
    }

    /**
     * Valida o modal de erro de Senha PIN incorreta e o fecha.
     */
    async validarErroPinIncorreto(): Promise<void> {
        await expect(this.erroHeading).toBeVisible();
        await expect(this.pinIncorretoText).toBeVisible();
        await this.entendiButton.click();
    }

    async validateProfileName(fullName: string): Promise<void> {
        const profileNameHeading = this.page.getByRole('heading', { name: fullName });
        await expect(profileNameHeading).toBeVisible();
    }

    async aceitarOfertaShop(): Promise<void> {
        await this.page.getByRole('button', { name: 'Quero aproveitar' }).click();
    }
}
