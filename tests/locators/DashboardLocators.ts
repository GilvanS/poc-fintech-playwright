import { Page, Locator } from "@playwright/test";

export class DashboardLocators {
    // Header e Layout Principal
    readonly dashboardHeading: Locator;
    readonly saudeFinanceiraHeading: Locator;
    readonly menuOcultarButton: Locator;
    readonly personalizarPainelButton: Locator;

    // Modais / Banners Iniciais
    readonly conquistaPoupancaText: Locator;
    readonly continuarPoupandoButton: Locator;

    // Saldo e Rendimentos
    readonly saldoContaText: Locator;
    readonly rendimentoText: Locator;

    // Meta de Gastos
    readonly metaGastosHeading: Locator;
    readonly editarMetaButton: Locator;
    readonly cancelarMetaButton: Locator;
    readonly salvarMetaButton: Locator;
    readonly metaValorInput: Locator;

    // Contas Recorrentes e IA
    readonly contasRecorrentesHeading: Locator;
    readonly iaButton: Locator;
    readonly assinaturasIAButton: Locator;
    readonly diagnosticoIAHeading: Locator;
    readonly novaContaButton: Locator;
    readonly fecharModalButton: Locator;

    // Pagamento e Validação de PIN
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
        // "SEU DASHBOARD" nunca existe nessa tela (heading real é "Olá, <nome>", varia por
        // usuário) — usa o botão fixo do header, confirmado por codegen como confiável.
        this.dashboardHeading = page.getByRole('button', { name: 'Ocultar Menu' });
        this.saudeFinanceiraHeading = page.getByRole('heading', { name: 'Saúde Financeira', exact: true });
        this.menuOcultarButton = page.getByRole('button', { name: 'Ocultar Menu' });
        this.personalizarPainelButton = page.getByRole('button', { name: 'PERSONALIZAR PAINEL' });

        this.conquistaPoupancaText = page.getByText('Conquista de Poupança!');
        this.continuarPoupandoButton = page.getByRole('button', { name: /Continuar Poupando/i });

        this.saldoContaText = page.getByText('SALDO EM CONTA');
        this.rendimentoText = page.getByText('+2.5% este mês (Rendimento');

        this.metaGastosHeading = page.getByRole('heading', { name: 'Meta de Gastos' });
        this.editarMetaButton = page.getByRole('button', { name: 'Editar' });
        this.cancelarMetaButton = page.getByRole('button', { name: 'Cancelar' });
        this.salvarMetaButton = page.getByRole('button', { name: 'Salvar' });
        this.metaValorInput = page.getByRole('spinbutton');

        this.contasRecorrentesHeading = page.getByRole('heading', { name: 'Contas Recorrentes' });
        this.iaButton = page.getByRole('button', { name: 'IA', exact: true });
        this.assinaturasIAButton = page.getByRole('button', { name: 'Assinaturas por IA' });
        this.diagnosticoIAHeading = page.getByRole('heading', { name: 'Diagnóstico da IA' });
        this.novaContaButton = page.getByRole('button', { name: 'Nova' });
        this.fecharModalButton = page.getByRole('button', { name: 'Fechar' });

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
}
