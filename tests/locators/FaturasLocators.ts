import { Page, Locator } from "@playwright/test";

export class FaturasLocators {
    // ---------- Legado (tests/e2e/pagamentoFatura.spec.ts — UI antiga) ----------
    // Alerta / Modal no Dashboard (Fatura em Atraso)
    readonly avisoFaturaAtrasoHeading: Locator;
    readonly fecharAvisoFaturaButton: Locator;

    // Tela de Faturas (UI antiga)
    readonly statusFaturaFechadaText: Locator;
    readonly tabFaturaFechadaButton: Locator;
    readonly tabFaturaAbertaButton: Locator;
    readonly resumoFaturaButton: Locator;
    readonly pagarFaturaButton: Locator;
    readonly voltarInicioButton: Locator;

    // Modal de Resumo da Fatura
    readonly resumoFaturaHeading: Locator;
    readonly fecharResumoButton: Locator;

    // Modal de Opções de Pagamento da Fatura
    readonly pagarValorTotalButton: Locator;
    readonly pagarMinimoButton: Locator;
    readonly digitarOutroValorButton: Locator;
    readonly valorCustomizadoInput: Locator;
    readonly cancelarPagamentoButton: Locator;
    readonly confirmarPagamentoButton: Locator;
    readonly modalConfirmarPagamentoHeading: Locator;

    // Detalhes da Transação de Pagamento
    readonly transactionRowPayment: Locator;
    readonly detalhesTransacaoHeading: Locator;
    readonly fecharDetalhesButton: Locator;

    // ---------- UI atual (codegen do fluxo de pagamento de fatura) ----------

    // Header da tela de Faturas
    readonly faturasHeading: Locator;
    readonly voltarButton: Locator;
    // Nav lateral/superior da tela (AllureShell): Fatura / Lançamentos / Parcelamentos —
    // confirmado ao vivo em 2026-09-12 (a UI foi reorganizada; o texto antigo
    // "Parcelamento fatura ..." não existe mais, virou só "Parcelamentos" no nav).
    readonly parcelamentosNavButton: Locator;

    // Tabs de fatura (botões que agregam status + valor, ex: "Fatura Aberta (R$ 8.912,45)")
    readonly tabFaturaAbertaAtualButton: Locator;
    readonly tabFaturaFechadaAtualButton: Locator;

    // Cards do resumo da fatura aberta
    readonly faturaAbertaStatusText: Locator;
    readonly valorAtualFaturaText: Locator;

    // Card da fatura fechada
    readonly valorTotalFaturaFechadaText: Locator;

    // Modal "Como deseja pagar?"
    readonly comoDesejaPagarHeading: Locator;
    readonly pagarTotalButton: Locator;
    readonly pagarMinimoDezButton: Locator;
    readonly valorPersonalizadoButton: Locator;
    readonly valorPersonalizadoInput: Locator;
    readonly continuarPagamentoFaturaButton: Locator;

    // Confirmação + PIN
    readonly confirmarPagamentoFaturaHeading: Locator;
    readonly tecladoPinButton: (digito: string) => Locator;

    // Extrato (validação do lançamento da transação)
    readonly extratoButton: Locator;
    readonly itemTransacaoExtrato: (descricao: string) => Locator;

    // Cards do dashboard (Saldo / Próxima Fatura / Limite) — consulta pós-pagamento
    readonly saldoContaCardLabel: Locator;
    readonly proximaFaturaCardLabel: Locator;
    readonly limiteDisponivelCardLabel: Locator;

    // Modal de sucesso pós-pagamento (PaymentSuccessModal.tsx, componente de Invoices) —
    // aparece SEPARADO da tela de Faturas depois do PIN; sem fechar, cobre elementos
    // por baixo. Confirmado ao vivo em 2026-09-14 (codegen do usuário).
    readonly pagamentoSucessoHeading: Locator;
    readonly pagamentoSucessoFecharButton: Locator;

    // "Ver Lançamentos" — botão dentro da PRÓPRIA tela de Fatura (troca activeSection
    // pra 'lancamentos' sem navegar pra fora), diferente do Extrato global do
    // dashboard. Dentro dessa seção, as sub-tabs "Fatura Aberta"/"Fatura Fechada"
    // são cópias com o MESMO texto de tabFaturaAbertaAtualButton/tabFaturaFechadaAtualButton
    // (ambas já com .first(), reaproveitam sem locator novo).
    readonly verLancamentosButton: Locator;
    // Item de lançamento do pagamento de fatura na lista (nome dinâmico com data/valor,
    // regex casa só o prefixo fixo). Confirmado ao vivo: o pagamento SEMPRE aparece
    // na Fatura Aberta, nunca na Fechada (2026-09-14).
    readonly pagamentoFaturaLancamentoItem: Locator;

    // Badge "Paga" da fatura fechada quitada (texto puro, não é botão — só leitura).
    readonly faturaFechadaPagaBadge: Locator;
    // KPI "Limite Utilizado" do header da tela de Fatura — mesmo padrão de
    // valorDoCard (label + <p> seguinte), só leitura/registro de dado, não clique.
    readonly limiteUtilizadoCardLabel: Locator;

    constructor(page: Page) {
        // ---------- Legado ----------
        this.avisoFaturaAtrasoHeading = page.getByRole('heading', { name: 'Aviso de Fatura em Atraso' });
        this.fecharAvisoFaturaButton = page.getByTestId('dashboard-content').getByRole('button', { name: 'Entendi' });

        this.statusFaturaFechadaText = page.getByText('Status: Fatura Fechada');
        this.tabFaturaFechadaButton = page.getByRole('button', { name: 'Fechada' });
        this.tabFaturaAbertaButton = page.getByRole('button', { name: 'Aberta' });
        this.resumoFaturaButton = page.getByRole('button', { name: 'Resumo da Fatura' });
        this.pagarFaturaButton = page.getByRole('button', { name: 'Pagar fatura', exact: true }).or(page.getByRole('button', { name: /Pagar Fatura/i })).first();
        this.voltarInicioButton = page.getByRole('button', { name: 'Voltar ao Início' });

        this.resumoFaturaHeading = page.getByText(/Valor total da fatura|Valor da fatura/i).first();
        this.fecharResumoButton = page.locator('div').filter({ hasText: /^Resumo da Fatura Fechada$/ }).getByRole('button').first();

        this.pagarValorTotalButton = page.getByRole('button', { name: /Pagar Valor Total/i });
        this.pagarMinimoButton = page.getByRole('button', { name: /Pagar mínimo/i });
        this.digitarOutroValorButton = page.getByRole('button', { name: /Digitar outro valor/i });
        this.valorCustomizadoInput = page.getByPlaceholder('Sugestão mínimo: R$');
        this.cancelarPagamentoButton = page.getByRole('button', { name: 'Cancelar' });
        this.confirmarPagamentoButton = page.getByRole('button', { name: /Confirmar Pagamento/i }).first();
        this.modalConfirmarPagamentoHeading = page.getByText('Confirmar Pagamento').first();

        this.transactionRowPayment = page.getByTestId('transaction-row-payment');
        this.detalhesTransacaoHeading = page.getByText(/Pagamento fatura/i).first();
        this.fecharDetalhesButton = page.locator('.absolute.top-4');

        // ---------- UI atual ----------
        this.faturasHeading = page.getByRole('heading', { name: 'Faturas', exact: true });
        this.voltarButton = page.getByRole('button', { name: 'Voltar', exact: true });
        this.parcelamentosNavButton = page.getByRole('button', { name: 'Parcelamentos', exact: true }).first();

        // Botões-tab do agrupador "Fatura"/"Lançamentos" — desde 2026-09-12 o texto NÃO
        // leva mais o valor entre parênteses (removido a pedido: o valor já aparece no
        // card "Valor Atual da Fatura" logo abaixo, redundante no título da aba). Match
        // exato: sem exact:true colidiria com o "Fatura Aberta"/"Fatura Fechada" cru dos
        // cards de resumo — mas esses são <p> (role=paragraph), não button, então nem
        // precisaria; mantido exact por clareza e porque há 2 cópias idênticas do botão
        // (uma em cada aba Fatura/Lançamentos) que devem casar igual.
        this.tabFaturaAbertaAtualButton = page.getByRole('button', { name: 'Fatura Aberta', exact: true }).first();
        this.tabFaturaFechadaAtualButton = page.getByRole('button', { name: 'Fatura Fechada', exact: true }).first();

        this.faturaAbertaStatusText = page.getByRole('paragraph').filter({ hasText: 'Fatura Aberta' });
        this.valorAtualFaturaText = page.getByText('Valor Atual da Fatura');
        this.valorTotalFaturaFechadaText = page.getByText('Valor Total da Fatura Fechada');

        // "Como deseja pagar?" — modal de opções com valores dinâmicos no label
        // ("Pagar Total R$ 8.912,45"), por isso regex em vez de nome exato.
        this.comoDesejaPagarHeading = page.getByRole('heading', { name: 'Como deseja pagar?' });
        this.pagarTotalButton = page.getByRole('button', { name: /Pagar Total/i });
        this.pagarMinimoDezButton = page.getByRole('button', { name: /Pagar Mínimo \(10%\)/i });
        this.valorPersonalizadoButton = page.getByRole('button', { name: 'Valor Personalizado' });
        this.valorPersonalizadoInput = page.getByPlaceholder('Ex:');
        this.continuarPagamentoFaturaButton = page
            .getByTestId('dashboard-content')
            .getByRole('button', { name: 'Continuar', exact: true });

        this.confirmarPagamentoFaturaHeading = page.getByRole('heading', { name: 'Confirmar Pagamento da Fatura' });
        this.tecladoPinButton = (digito: string) => page.getByRole('button', { name: digito, exact: true }).first();

        this.extratoButton = page.getByRole('button', { name: 'Extrato', exact: true });
        this.itemTransacaoExtrato = (descricao: string) =>
            page.getByRole('listitem', { name: `Transação: ${descricao}` }).first();

        // Labels dos cards do dashboard — o valor fica no card pai (valorDoCard resolve).
        this.saldoContaCardLabel = page.getByText('Saldo em Conta');
        this.proximaFaturaCardLabel = page.getByText('Próxima Fatura');
        this.limiteDisponivelCardLabel = page.getByText('Limite Disponível');

        // Modal de sucesso pós-pagamento (PaymentSuccessModal.tsx) — heading exato
        // "Pagamento realizado com sucesso!" e botão com aria-label="Fechar".
        this.pagamentoSucessoHeading = page.getByRole('heading', { name: 'Pagamento realizado com sucesso!', exact: true });
        this.pagamentoSucessoFecharButton = page.getByRole('button', { name: 'Fechar', exact: true }).first();

        // "Ver Lançamentos" — quick action dentro da própria tela de Fatura.
        this.verLancamentosButton = page.getByRole('button', { name: 'Ver Lançamentos', exact: true });
        // Item de lançamento do pagamento (InvoicesAllureView.tsx renderLancamentos):
        // nome dinâmico "Pagamento fatura (Total) <data>" — regex casa só o prefixo fixo.
        this.pagamentoFaturaLancamentoItem = page.getByRole('button', { name: /Pagamento fatura \(Total\)/ }).first();

        this.faturaFechadaPagaBadge = page.getByText('Paga', { exact: true });
        this.limiteUtilizadoCardLabel = page.getByText('Limite Utilizado');
    }

    /**
     * Locator do valor exibido num card do dashboard: primeiro parágrafo seguinte ao
     * label em ordem de documento (following::p[1]) — mesma regra provada de
     * PixLocators.valorDoCard. Escopado por eixo (não getByText na página inteira)
     * porque o mesmo valor costuma repetir em gráficos/seções e quebraria o strict mode.
     */
    valorDoCard(cardLabel: Locator): Locator {
        return cardLabel.locator('xpath=following::p[1]');
    }
}
