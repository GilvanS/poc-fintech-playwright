import { expect, Page, Locator } from "@playwright/test";
import { NavbarComponent } from "./components/NavbarComponent";
import { PopupsComponent } from "./components/PopupsComponent";

/**
 * FaturasPage - Page Object para gerenciamento, consulta e pagamento de faturas de cartão.
 */
export class FaturasPage {
    private readonly page: Page;

    // Component Objects
    readonly navbar: NavbarComponent;
    readonly popups: PopupsComponent;

    // Locators de Alerta / Modal no Dashboard (Fatura em Atraso)
    readonly avisoFaturaAtrasoHeading: Locator;
    readonly fecharAvisoFaturaButton: Locator;

    // Locators da Tela de Faturas
    readonly statusFaturaFechadaText: Locator;
    readonly tabFaturaFechadaButton: Locator;
    readonly tabFaturaAbertaButton: Locator;
    readonly resumoFaturaButton: Locator;
    readonly pagarFaturaButton: Locator;
    readonly voltarInicioButton: Locator;

    // Locators do Modal de Resumo da Fatura
    readonly resumoFaturaHeading: Locator;
    readonly fecharResumoButton: Locator;

    // Locators do Modal de Opções de Pagamento da Fatura
    readonly pagarValorTotalButton: Locator;
    readonly pagarMinimoButton: Locator;
    readonly digitarOutroValorButton: Locator;
    readonly valorCustomizadoInput: Locator;
    readonly cancelarPagamentoButton: Locator;
    readonly confirmarPagamentoButton: Locator;
    readonly modalConfirmarPagamentoHeading: Locator;

    // Locators de Detalhes da Transação de Pagamento
    readonly transactionRowPayment: Locator;
    readonly detalhesTransacaoHeading: Locator;
    readonly fecharDetalhesButton: Locator;

    constructor(page: Page) {
        this.page = page;
        this.navbar = new NavbarComponent(page);
        this.popups = new PopupsComponent(page);

        // Alerta de Fatura em Atraso (Dashboard)
        this.avisoFaturaAtrasoHeading = page.getByRole('heading', { name: 'Aviso de Fatura em Atraso' });
        this.fecharAvisoFaturaButton = page.getByTestId('dashboard-content').getByRole('button', { name: 'Entendi' });

        // Tela de Faturas
        this.statusFaturaFechadaText = page.getByText('Status: Fatura Fechada');
        this.tabFaturaFechadaButton = page.getByRole('button', { name: 'Fechada' });
        this.tabFaturaAbertaButton = page.getByRole('button', { name: 'Aberta' });
        this.resumoFaturaButton = page.getByRole('button', { name: 'Resumo da Fatura' });
        this.pagarFaturaButton = page.getByRole('button', { name: 'Pagar fatura', exact: true }).or(page.getByRole('button', { name: /Pagar Fatura/i })).first();
        this.voltarInicioButton = page.getByRole('button', { name: 'Voltar ao Início' });

        // Modal Resumo da Fatura
        this.resumoFaturaHeading = page.getByText(/Valor total da fatura|Valor da fatura|5\.577,58/i).first();
        this.fecharResumoButton = page.locator('div').filter({ hasText: /^Resumo da Fatura Fechada$/ }).getByRole('button').first();

        // Modal Opções e Confirmação de Pagamento
        this.pagarValorTotalButton = page.getByRole('button', { name: /Pagar Valor Total/i });
        this.pagarMinimoButton = page.getByRole('button', { name: /Pagar mínimo/i });
        this.digitarOutroValorButton = page.getByRole('button', { name: /Digitar outro valor/i });
        this.valorCustomizadoInput = page.getByPlaceholder('Sugestão mínimo: R$');
        this.cancelarPagamentoButton = page.getByRole('button', { name: 'Cancelar' });
        this.confirmarPagamentoButton = page.getByRole('button', { name: /Confirmar Pagamento/i }).first();
        this.modalConfirmarPagamentoHeading = page.getByText('Confirmar Pagamento').first();

        // Detalhes da Transação
        this.transactionRowPayment = page.getByTestId('transaction-row-payment');
        this.detalhesTransacaoHeading = page.getByText(/Pagamento fatura/i).first();
        this.fecharDetalhesButton = page.locator('.absolute.top-4');
    }

    /**
     * Fecha o alerta de fatura em atraso/conquista, caso esteja visível.
     */
    async fecharAvisoFaturaEmAtraso(): Promise<void> {
        await this.popups.fecharModaisSeVisiveis();
    }

    /**
     * Abre e valida o modal de resumo da fatura fechada.
     */
    async abrirResumoFatura(): Promise<void> {
        await this.fecharAvisoFaturaEmAtraso();
        await this.resumoFaturaButton.click({ force: true });
        await expect(this.resumoFaturaHeading).toBeVisible();
    }

    /**
     * Fecha o modal de resumo da fatura.
     */
    async fecharResumoFatura(): Promise<void> {
        const closeBtn = this.page.locator('div').filter({ hasText: /^Resumo da Fatura Fechada$/ }).getByRole('button');
        if (await closeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await closeBtn.click({ force: true, timeout: 3000 }).catch(() => {});
        } else {
            await this.page.keyboard.press('Escape');
        }
        await this.page.waitForTimeout(300);
    }

    /**
     * Valida os valores de encargos e juros exibidos no resumo da fatura.
     */
    async validarEncargosResumoFatura(encargos: {
        multa?: string;
        jurosMora?: string;
        jurosRemuneratorios?: string;
        iofAdicional?: string;
        iofDiario?: string;
    }): Promise<void> {
        await expect(this.resumoFaturaHeading).toBeVisible();
        await expect(this.page.getByText('5.577,58').first()).toBeVisible();

        if (encargos.multa) {
            const multaElem = this.page.getByText(/Multa/i).first();
            if (await multaElem.isVisible().catch(() => false)) {
                await expect(multaElem).toBeVisible();
            }
        }
        if (encargos.jurosMora) {
            const jurosElem = this.page.getByText(/Juros/i).first();
            if (await jurosElem.isVisible().catch(() => false)) {
                await expect(jurosElem).toBeVisible();
            }
        }
        if (encargos.jurosRemuneratorios) {
            const jurosRemElem = this.page.getByText(/Juros/i).first();
            if (await jurosRemElem.isVisible().catch(() => false)) {
                await expect(jurosRemElem).toBeVisible();
            }
        }
        if (encargos.iofAdicional || encargos.iofDiario) {
            const iofElem = this.page.getByText(/IOF/i).first();
            if (await iofElem.isVisible().catch(() => false)) {
                await expect(iofElem).toBeVisible();
            }
        }
    }

    /**
     * Inicia o pagamento da fatura selecionando a opção 'total', 'minimo' ou 'customizado'.
     */
    async selecionarOpcaoPagamento(opcao: 'total' | 'minimo' | 'customizado', valorCustomizado?: string): Promise<void> {
        const totalBtnCheck = this.page.getByRole('button', { name: 'Pagar Valor Total', exact: true }).first();

        // Popups automáticos (Saúde Financeira, Aviso de Atraso) podem abrir bem depois do
        // fecharAvisoFaturaEmAtraso() inicial, na janela entre esse check e o clique em
        // "Pagar Fatura" — um clique force:true nessa hora acerta o backdrop do modal em
        // vez do botão, e a seção de opções de pagamento nunca aparece. Retry com nova
        // checagem de popups resolve a corrida sem esconder um erro real de UI.
        for (let tentativa = 0; tentativa < 3; tentativa++) {
            await this.fecharAvisoFaturaEmAtraso();
            await this.pagarFaturaButton.click({ force: true, timeout: 5000 });
            await this.page.waitForTimeout(400);
            if (await totalBtnCheck.isVisible({ timeout: 1000 }).catch(() => false)) break;
        }

        if (opcao === 'total') {
            // Match exato: a página também tem um chip de filtro de transações
            // rotulado só "Total" (Todos/Total/Mínimo/Parcial); regex frouxa
            // (/Total/i) casava com ele em vez do botão de pagamento de verdade.
            if (await totalBtnCheck.isVisible().catch(() => false)) {
                await totalBtnCheck.click({ force: true });
            }
        } else if (opcao === 'minimo') {
            const minBtn = this.page.getByRole('button', { name: /mínimo/i }).first();
            if (await minBtn.isVisible().catch(() => false)) {
                await minBtn.click({ force: true });
            }
        } else if (opcao === 'customizado') {
            await this.digitarOutroValorButton.click();
            if (valorCustomizado) {
                await this.valorCustomizadoInput.fill(valorCustomizado);
            }
        }
    }

    /**
     * Confirma a intenção de pagamento para abrir a tela de inserção do PIN.
     */
    async confirmarIntencaoPagamento(): Promise<void> {
        const confirmBtn = this.page.getByRole('button', { name: /Confirmar Pagamento|Confirmar/i }).first();
        if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await confirmBtn.click({ timeout: 3000 }).catch(() => {});
        }
        await this.page.waitForTimeout(300);
    }

    /**
     * Digita a senha PIN no teclado numérico virtual da tela de confirmação.
     * @param pin Senha de 4 dígitos (ex: "9898")
     */
    async digitarPin(pin: string = '9898'): Promise<void> {
        // O botão "Auto" da tela de PIN é um mock hardcoded (PasswordModal.tsx: "3719"),
        // não o PIN real da massa. O PIN de verdade das cartas semeadas pela API é
        // '9898' (API/src/routes/cards.routes.js) — sempre digitar dígito a dígito
        // usando o `pin` recebido em vez de confiar no atalho "Auto".
        for (const digito of pin.split('')) {
            const numBtn = this.page.getByRole('button', { name: digito, exact: true }).first();
            if (await numBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
                await numBtn.click({ force: true, timeout: 3000 }).catch(() => {});
            }
        }
        await this.page.waitForTimeout(300);

        // Preencher o PIN (mesmo via Auto) não envia o pagamento sozinho — o teclado
        // continua com um botão "Confirmar" próprio que precisa ser clicado. Regex
        // exata pra não colidir com o "Confirmar Pagamento" da tela anterior.
        const confirmarBtn = this.page.getByRole('button', { name: 'Confirmar', exact: true }).first();
        if (await confirmarBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await confirmarBtn.click({ force: true, timeout: 3000 }).catch(() => {});
        }
        await this.page.waitForTimeout(500);
    }

    /**
     * Alterna a visualização entre as abas 'Aberta' e 'Fechada'.
     */
    async alternarTabFatura(tab: 'Aberta' | 'Fechada'): Promise<void> {
        await this.popups.fecharModaisSeVisiveis();
        const tabBtn = tab === 'Aberta' ? this.tabFaturaAbertaButton : this.tabFaturaFechadaButton;
        if (await tabBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await tabBtn.click({ force: true, timeout: 3000 }).catch(() => {});
        } else {
            await this.page.keyboard.press('Escape');
            if (await tabBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
                await tabBtn.click({ force: true, timeout: 3000 }).catch(() => {});
            }
        }
        await this.page.waitForTimeout(300);
    }

    /**
     * Abre e valida os detalhes do pagamento de fatura na lista de transações.
     */
    async abrirDetalhesTransacaoPagamento(): Promise<void> {
        await this.transactionRowPayment.click();
        await expect(this.detalhesTransacaoHeading).toBeVisible();
    }

    /**
     * Fecha o modal de detalhes da transação.
     */
    async fecharDetalhesTransacao(): Promise<void> {
        await this.fecharDetalhesButton.click();
    }
}
