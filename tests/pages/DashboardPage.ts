import { expect, Page } from "@playwright/test";
import { NavbarComponent } from "./components/NavbarComponent";
import { PopupsComponent } from "./components/PopupsComponent";
import { DashboardLocators } from "../locators/DashboardLocators";
import { EvidenceHelper } from "../utils/EvidenceHelper";

/**
 * DashboardPage - Page Object para o dashboard e funcionalidades pós-login.
 */
export class DashboardPage {
    readonly page: Page;
    readonly locators: DashboardLocators;

    // Component Objects
    readonly navbar: NavbarComponent;
    readonly popups: PopupsComponent;

    constructor(page: Page) {
        this.page = page;
        this.locators = new DashboardLocators(page);
        this.navbar = new NavbarComponent(page);
        this.popups = new PopupsComponent(page);
    }

    async validarDashboardCarregado(): Promise<void> {
        await expect(this.locators.dashboardHeading).toBeVisible({ timeout: 15000 });
    }

    async fecharModalConquista(): Promise<void> {
        await this.popups.fecharModaisSeVisiveis();
    }

    async editarMetaDeGastos(novoValor: string): Promise<void> {
        await this.locators.editarMetaButton.click();
        await expect(this.locators.cancelarMetaButton).toBeVisible();
        await this.locators.metaValorInput.click();
        await this.locators.metaValorInput.fill(novoValor);
        await this.locators.salvarMetaButton.click();
        await expect(this.locators.editarMetaButton).toBeVisible();
    }

    async abrirDiagnosticoIA(): Promise<void> {
        await this.locators.iaButton.click();
        await expect(this.locators.diagnosticoIAHeading).toBeVisible();
    }

    async fecharDiagnosticoIA(): Promise<void> {
        await this.locators.fecharModalButton.click();
    }

    async iniciarPagamentoContaRecorrente(tipo: 'debito' | 'credito' = 'debito'): Promise<void> {
        await this.locators.pagarButton.click();
        await expect(this.locators.opcaoPagamentoHeading).toBeVisible();

        if (tipo === 'debito') {
            await this.locators.opcaoDebitoText.click();
        } else {
            await this.locators.opcaoCreditoText.click();
        }

        await this.locators.continuarPagamentoButton.click();
        await expect(this.locators.confirmarPagamentoHeading).toBeVisible();
    }

    async confirmarPagamento(): Promise<void> {
        await this.locators.confirmarButton.click();
    }

    async validarErroPinIncorreto(): Promise<void> {
        await expect(this.locators.erroHeading).toBeVisible();
        await expect(this.locators.pinIncorretoText).toBeVisible();
        await this.locators.entendiButton.click();
    }

    async validateProfileName(fullName: string): Promise<void> {
        const profileNameHeading = this.page.getByRole('heading', { name: fullName });
        await expect(profileNameHeading).toBeVisible();
    }

    async aceitarOfertaShop(): Promise<void> {
        await this.page.getByRole('button', { name: 'Quero aproveitar' }).click();
    }

    /** Mostra só o primeiro nome no cumprimento do dashboard ("Olá, <primeiro nome>"). */
    async validarPrimeiroNomeNoDashboard(nomeCompleto: string): Promise<void> {
        const primeiroNome = nomeCompleto.trim().split(/\s+/)[0];
        await expect(this.page.getByRole('heading', { name: `Olá, ${primeiroNome}` })).toBeVisible();
    }

    /** Saldo/limite iniciais de conta nova recém-cadastrada (valores padrão de onboarding). */
    async validarSaldoInicial(valorEsperado: string): Promise<void> {
        await expect(this.page.getByText(valorEsperado, { exact: true }).first()).toBeVisible();
    }

    async validarLimiteDisponivelInicial(valorEsperado: string): Promise<void> {
        await expect(this.page.getByText(valorEsperado, { exact: true }).first()).toBeVisible();
    }

    async validarNomeEEmailNoPerfil(nomeCompleto: string, email: string): Promise<void> {
        await expect(this.page.getByRole('heading', { name: nomeCompleto })).toBeVisible();
        await expect(this.page.getByText(email)).toBeVisible();
    }

    async sairDaContaVolt(): Promise<void> {
        await this.page.getByRole('button', { name: 'Sair da Conta Volt' }).click();
    }

    // ---------- Composição de negócio (fluxos de mais de um passo) ----------

    /**
     * Fecha modais iniciais se estiverem presentes e confirma carregamento do dashboard.
     */
    async inicializarDashboard(): Promise<void> {
        await this.validarDashboardCarregado();

        await this.page.waitForLoadState('networkidle').catch(() => {});

        await this.fecharModalConquista();
        await EvidenceHelper.captureStep(this.page, 'Dashboard inicializado');
    }

    /**
     * Executa a alteração da meta de gastos.
     * @param novoValor Novo valor limite desejado.
     */
    async alterarMetaDeGastos(novoValor: string): Promise<void> {
        await this.editarMetaDeGastos(novoValor);
        await EvidenceHelper.captureStep(this.page, 'Meta de gastos alterada');
    }

    /**
     * Abre e consulta a inteligência de assinaturas via IA.
     */
    async consultarInsightsIA(): Promise<void> {
        await this.abrirDiagnosticoIA();
        await EvidenceHelper.captureStep(this.page, 'Diagnóstico da IA aberto');

        await this.fecharDiagnosticoIA();
        await EvidenceHelper.captureStep(this.page, 'Diagnóstico da IA fechado');
    }

    /**
     * Tenta realizar o pagamento de uma conta recorrente com tipo especificado
     * e valida a mensagem de erro quando o PIN é incorreto.
     * @param tipoOpcao 'debito' ou 'credito'
     */
    async pagarContaComErroPin(tipoOpcao: 'debito' | 'credito' = 'debito'): Promise<void> {
        await this.iniciarPagamentoContaRecorrente(tipoOpcao);
        await EvidenceHelper.captureStep(this.page, 'Pagamento de conta recorrente iniciado');

        await this.confirmarPagamento();
        await EvidenceHelper.captureStep(this.page, 'Pagamento confirmado');

        await this.validarErroPinIncorreto();
        await EvidenceHelper.captureStep(this.page, 'Erro de PIN incorreto validado');
    }
}
