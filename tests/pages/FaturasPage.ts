import { expect, Locator, Page } from "@playwright/test";
import { FaturasLocators } from "../locators/FaturasLocators";
import { NavbarComponent } from "./components/NavbarComponent";
import { PopupsComponent } from "./components/PopupsComponent";

/** Valores numéricos lidos dos cards de fatura (Aberta/Fechada) da tela de Faturas. */
export interface TotaisFaturas {
    aberta: number;
    fechada: number;
    total: number;
}

export class FaturasPage {
    private readonly page: Page;
    readonly locators: FaturasLocators;
    readonly navbar: NavbarComponent;
    private readonly popups: PopupsComponent;

    constructor(page: Page) {
        this.page = page;
        this.locators = new FaturasLocators(page);
        this.navbar = new NavbarComponent(page);
        this.popups = new PopupsComponent(page);
    }

    // ---------- Navegação ----------

    /**
     * Entra na tela de Faturas pela SIDEBAR de navegação (complementary — "Faturas" do
     * menu lateral, o mesmo âncora do "Meu Perfil" que já é o padrão do projeto). O
     * #bottom-nav é legado: existe no DOM mas não navega (screenshot 19:44 — o clique
     * foi dado e o app continuou no dashboard). Fechar sobreposições (Saúde Financeira,
     * conquista, aviso de atraso) continua responsabilidade do NavbarComponent.
     */
    async navegarParaFaturas(): Promise<void> {
        await this.popups.fecharModaisSeVisiveis();
        await this.page.getByRole('complementary').getByRole('button', { name: 'Faturas' }).click();
        await expect(this.locators.faturasHeading).toBeVisible();
    }

    async validarTelaFaturasCarregada(): Promise<void> {
        await expect(this.locators.faturasHeading).toBeVisible();
    }

    async voltarAoDashboard(): Promise<void> {
        await this.locators.voltarButton.click();
    }

    async voltarDoExtrato(): Promise<void> {
        await this.locators.voltarButton.click();
    }

    // ---------- Leitura de valores ----------

    /** Converte um valor monetário pt-BR ("R$ 3.870,86") pra número (3870.86). */
    private parseValorBRL(texto: string): number {
        const limpo = texto.replace(/[^\d,]/g, '');
        const num = Number(limpo.replace(/\./g, '').replace(',', '.'));
        if (Number.isNaN(num)) {
            throw new Error(`Valor "${texto}" não pôde ser interpretado como monetário pt-BR.`);
        }
        return num;
    }

    /**
     * Lê o valor do card pelo label (o número é o primeiro <p> seguinte ao label).
     * Timeout curto e erro explícito: sem isso, um card ausente na tab ativa deixa o
     * teste preso no timeout total (180s) em vez de falhar em ~10s com causa clara.
     */
    private async lerValorCard(cardLabel: Locator): Promise<number> {
        const alvo = this.locators.valorDoCard(cardLabel);
        try {
            const texto = (await alvo.innerText({ timeout: 10000 })).trim();
            return this.parseValorBRL(texto);
        } catch {
            const label = (await cardLabel.innerText({ timeout: 3000 }).catch(() => '')).trim() || '<label desconhecido>';
            throw new Error(
                `Card "${label}" não encontrado na tab ativa da tela de Faturas. ` +
                `O card da fatura fechada só existe na tab "Fatura Fechada" (a tela abre na "Fatura Aberta").`
            );
        }
    }

    /**
     * Lê o valor da FATURA FECHADA, que só existe na tab "Fatura Fechada" — a tela de
     * Faturas abre na tab "Fatura Aberta" (preso 180s em 2026-09-15 lendo o card fora
     * da tab certa). Fallback: fatura já quitada mostra badge "Paga" sem card de valor
     * → devolve 0. Sempre VOLTA pra tab "Fatura Aberta", onde ficam os botões de
     * pagamento usados pelos steps seguintes.
     */
    private async lerValorFaturaFechada(): Promise<number> {
        await this.alternarTabFatura('Fechada');
        const quitada = await this.locators.faturaFechadaPagaBadge
            .first()
            .isVisible({ timeout: 2000 })
            .catch(() => false);
        if (quitada) {
            await this.alternarTabFatura('Aberta');
            return 0;
        }
        const valor = await this.lerValorCard(this.locators.valorTotalFaturaFechadaText);
        await this.alternarTabFatura('Aberta');
        return valor;
    }

    /**
     * Lê os cards da tela de Faturas (Fatura Aberta + Fatura Fechada) e devolve os
     * valores numéricos separados — fonte de verdade é a WEB (UI), NÃO planilha nem
     * API (ambas ficam defasadas a cada pagamento executado). `total` NÃO é soma:
     * espelha a fatura fechada, que é a que se paga.
     */
    async lerTotaisFaturas(): Promise<TotaisFaturas> {
        // Pós-pagamento a tela fica na tab "Fatura Fechada" (de onde o pagamento partiu) —
        // garante a tab Aberta antes de ler o card "Valor Atual da Fatura", que só existe
        // nela. Clicar na tab já ativa é inofensivo (idempotente).
        await this.alternarTabFatura('Aberta');
        const aberta = await this.lerValorCard(this.locators.valorAtualFaturaText);
        const fechada = await this.lerValorFaturaFechada();
        return { aberta, fechada, total: fechada };
    }

    /**
     * Valida que a FATURA FECHADA (a que se paga no CT03.1) caiu após o pagamento.
     * `valorAntes` é o valor real capturado da UI no step "eu capturo os valores das
     * faturas antes do pagamento" — não o valor de controle da planilha. Retorna o
     * valor depois.
     */
    async validarFaturaFechadaMenor(valorAntes: number): Promise<number> {
        // Fecha alerta de erro, modal de sucesso pós-PIN e popups (ex: drawer "Saúde
        // Financeira" que abre em cima depois do pagamento) — todos cobrem os cards.
        await this.fecharAlertaErro();
        await this.fecharModalSucessoPagamento();
        await this.popups.fecharModaisSeVisiveis();
        const depois = await this.lerTotaisFaturas();
        if (depois.fechada >= valorAntes) {
            throw new Error(
                `Fatura fechada pós-pagamento (R$ ${depois.fechada.toFixed(2)}) não caiu em relação ao valor real lido da UI antes do pagamento (R$ ${valorAntes.toFixed(2)}).`
            );
        }
        return depois.fechada;
    }

    /**
     * Lê o KPI "Limite Disponível" do header da tela de Faturas (fonte WEB — UI).
     * .first() porque o mesmo label pode repetir em seções de baixo da página.
     */
    async lerLimiteDisponivel(): Promise<number> {
        await this.popups.fecharModaisSeVisiveis();
        return this.lerValorCard(this.locators.limiteDisponivelCardLabel.first());
    }

    /**
     * Valida pagamento PARCIAL (Mínimo/Parcial/Menor/Maior). A fatura fechada NÃO zera
     * e o app continua exibindo o TOTAL original no card "Valor Total da Fatura Fechada"
     * (InvoiceView.getSubTabAmount retorna closedInvoice; o residual não é exposto em
     * card nenhum da UI). A prova WEB da baixa é:
     *   1. o Limite Disponível sobe exatamente o valor pago (prova ao vivo CT03.2:
     *      13.273,43 → 13.660,52 = +R$ 387,09);
     *   2. o badge "Paga" NÃO aparece na tab Fechada (fatura segue em aberto).
     * Retorna o Limite Disponível depois do pagamento.
     */
    async validarPagamentoParcialEfetivado(valorPago: number, limiteDisponivelAntes: number): Promise<number> {
        await this.fecharAlertaErro();
        await this.fecharModalSucessoPagamento();
        await this.popups.fecharModaisSeVisiveis();

        // (2) Fatura segue em aberto — badge "Paga" não pode aparecer na tab Fechada.
        await this.alternarTabFatura('Fechada');
        const paga = await this.locators.faturaFechadaPagaBadge
            .first()
            .isVisible({ timeout: 2000 })
            .catch(() => false);
        if (paga) {
            throw new Error('Fatura fechada aparece como PAGA após pagamento parcial — o app quitou a fatura inteira quando deveria ter quitado só parte.');
        }

        // (1) Limite Disponível sobe exatamente o valor pago — poll porque o KPI
        // recarrega um instante depois do modal de sucesso fechar.
        const esperadoLimite = limiteDisponivelAntes + valorPago;
        await expect
            .poll(async () => this.lerLimiteDisponivel(), { timeout: 15000, intervals: [500, 1000, 2500] })
            .toBeCloseTo(esperadoLimite, 1);
        return this.lerLimiteDisponivel();
    }

    // ---------- Tabs de fatura ----------

    /** Abre a tab 'Aberta' ou 'Fechada' (botões com MESMO texto nas views Fatura e Lançamentos — .first() resolve). */
    async alternarTabFatura(tab: 'Aberta' | 'Fechada'): Promise<void> {
        await this.popups.fecharModaisSeVisiveis();
        const botao = tab === 'Aberta'
            ? this.locators.tabFaturaAbertaAtualButton
            : this.locators.tabFaturaFechadaAtualButton;
        await botao.click();
    }

    async selecionarTabFatura(tab: 'Aberta' | 'Fechada'): Promise<void> {
        await this.alternarTabFatura(tab);
    }

    /**
     * Valida a fatura fechada contra um valor formatado pt-BR (ex: "R$ 3.870,86").
     * Compara só os dígitos/separadores, imune a espaços não-quebráveis.
     */
    async validarFaturaFechada(valor: string): Promise<void> {
        await this.alternarTabFatura('Fechada');
        const esperado = valor.replace(/[^\d,]/g, '');
        await expect
            .poll(async () => {
                const texto = await this.locators.valorDoCard(this.locators.valorTotalFaturaFechadaText).innerText();
                return texto.replace(/[^\d,]/g, '');
            })
            .toBe(esperado);
    }

    /** Fatura fechada quitada: badge "Paga" visível na tab Fechada. */
    async validarFaturaFechadaZerada(): Promise<void> {
        await this.alternarTabFatura('Fechada');
        await expect(this.locators.faturaFechadaPagaBadge).toBeVisible({ timeout: 10000 });
    }

    // ---------- Pagamento ----------

    async abrirPagamentoFatura(): Promise<void> {
        await this.popups.fecharModaisSeVisiveis();
        // CT03.x paga a FATURA FECHADA (em atraso) — o botão "Pagar Fatura" da tab Aberta
        // abre o pagamento da ABERTA (prova: modal de PIN "pagamento de R$ 4.660,02" +
        // alerta "Saldo insuficiente" em 2026-09-15 20:11). Sempre mira a tab Fechada.
        await this.alternarTabFatura('Fechada');
        const jaPaga = await this.locators.faturaFechadaPagaBadge
            .first()
            .isVisible({ timeout: 2000 })
            .catch(() => false);
        if (jaPaga) {
            throw new Error('[Massa consumida] A fatura fechada já aparece PAGA na UI — massa usada em execução anterior. Escolha outro CPF em TBL_CENARIOS.');
        }
        await this.locators.pagarFaturaButton.click();
        await expect(this.locators.comoDesejaPagarHeading).toBeVisible();
    }

    /**
     * Seleciona a opção no modal "Como deseja pagar?": 'total' (preset), 'minimo'
     * (preset 10%) ou 'parcial' (valor personalizado — família usada por Parcial,
     * Menor que o mínimo e Maior que o mínimo, que compartilham a MESMA tela).
     */
    async selecionarOpcaoPagamento(opcao: 'total' | 'minimo' | 'parcial', valorCustomizado?: string): Promise<void> {
        if (opcao === 'total') {
            await this.locators.pagarTotalButton.click();
        } else if (opcao === 'minimo') {
            await this.locators.pagarMinimoDezButton.click();
        } else {
            await this.locators.valorPersonalizadoButton.click();
            if (valorCustomizado !== undefined) {
                await this.preencherValorCustomizado(valorCustomizado);
            }
        }
    }

    async preencherValorCustomizado(valor: string): Promise<void> {
        await this.locators.valorPersonalizadoInput.fill(valor);
    }

    async confirmarFormaPagamento(): Promise<number | null> {
        await this.locators.continuarPagamentoFaturaButton.click();
        await expect(this.locators.confirmarPagamentoFaturaHeading).toBeVisible();

        // Guard de alvo: o modal de PIN exibe o valor efetivamente pago ("...confirmar o
        // pagamento de R$ X."). Retorna o valor pra o step cruzar com o capturado da UI —
        // pega pagamento da fatura ERRADA em segundos, não depois do PIN.
        const texto = this.page.getByText(/confirmar o pagamento de R\$/i).first();
        if (!(await texto.isVisible({ timeout: 3000 }).catch(() => false))) {
            return null;
        }
        const match = (await texto.innerText()).match(/R\$\s*([\d.,]+)/);
        return match ? this.parseValorBRL(match[1]) : null;
    }

    /**
     * Lê o valor exibido no modal de PIN ("...confirmar o pagamento de R$ X.") —
     * é o alvo efetivo do pagamento. Retorna null se o texto não estiver visível.
     */
    async lerValorModalPin(): Promise<number | null> {
        const texto = this.page.getByText(/confirmar o pagamento de R\$/i).first();
        if (!(await texto.isVisible({ timeout: 3000 }).catch(() => false))) {
            return null;
        }
        const match = (await texto.innerText()).match(/R\$\s*([\d.,]+)/);
        return match ? this.parseValorBRL(match[1]) : null;
    }

    /** UI legada (pagamentoFatura.spec.ts): confirma no modal e espera o teclado do PIN. */
    async confirmarIntencaoPagamento(): Promise<void> {
        await this.locators.confirmarPagamentoButton.click();
        await expect(this.locators.tecladoPinButton('1')).toBeVisible();
    }

    /**
     * Fecha o modal de sucesso pós-PIN (PaymentSuccessModal — aparece SEPARADO da tela
     * de Faturas e cobre os elementos por baixo; confirmado ao vivo em 2026-09-14).
     * Idempotente: se o modal não estiver aberto, não faz nada.
     */
    async fecharModalSucessoPagamento(): Promise<void> {
        const heading = this.locators.pagamentoSucessoHeading;
        if (await heading.isVisible({ timeout: 5000 }).catch(() => false)) {
            const fechou = await this.locators.pagamentoSucessoFecharButton
                .click({ timeout: 3000 })
                .then(() => true)
                .catch(() => false);
            if (!fechou) {
                // Fallback no testid do PaymentSuccessModal.tsx (mesmo do spec legado).
                await this.page.getByTestId('payment-success-ok').click({ force: true, timeout: 3000 }).catch(() => {});
            }
            await expect(heading).toBeHidden({ timeout: 5000 });
        }
    }

    /** Fecha o alerta "Notificação de erro" (ex: Saldo insuficiente) se estiver aberto. */
    async fecharAlertaErro(): Promise<void> {
        const fechar = this.page.getByRole('button', { name: 'Fechar notificação' });
        if (await fechar.isVisible().catch(() => false)) {
            await fechar.click({ force: true, timeout: 2000 }).catch(() => {});
        }
    }

    /**
     * Falha com mensagem clara se o app recusou o pagamento por saldo insuficiente —
     * sem isso o modal de PIN fica aberto bloqueando a tela até o timeout total (180s,
     * visto ao vivo em 2026-09-15). Chamado logo após o PIN.
     */
    async validarErroSaldoInsuficiente(): Promise<void> {
        const alerta = this.page.getByRole('alert').filter({ hasText: /Saldo insuficiente/i });
        if (await alerta.first().isVisible({ timeout: 5000 }).catch(() => false)) {
            throw new Error(
                '[Saldo insuficiente] O app recusou o pagamento da fatura: o saldo em conta da massa é MENOR que o valor a pagar. ' +
                'Atualize a massa (saldo_conta ou fatura_fechada menor) em TBL_CENARIOS antes de reexecutar.'
            );
        }
    }

    // ---------- Lançamentos / Extrato ----------

    async abrirLancamentosFatura(): Promise<void> {
        await this.locators.verLancamentosButton.click();
    }

    /**
     * Valida o item "Pagamento fatura (Total|Mínimo|Parcial)" na lista de lançamentos.
     * Pagamentos de execuções anteriores acumulam na lista — .first() pega o mais
     * recente sem quebrar o strict mode.
     */
    async validarTransacaoPagamentoNoExtrato(tipo: string): Promise<void> {
        let regex: RegExp;
        if (tipo === 'total') regex = /Pagamento fatura \(Total\)/i;
        else if (tipo === 'minimo') regex = /Pagamento fatura \(Mínimo\)/i;
        else regex = /Pagamento fatura \(Parcial\)/i;

        await expect(this.page.getByRole('button', { name: regex }).first()).toBeVisible({ timeout: 10000 });
    }

    /** Variante sem tipo (step legado "devo ver o pagamento em Ver Lançamentos..."). */
    async validarPagamentoNosLancamentosDaFatura(): Promise<void> {
        await expect(this.locators.pagamentoFaturaLancamentoItem).toBeVisible({ timeout: 10000 });
    }

    // ---------- Resumo (UI legada — pagamentoFatura.spec.ts) ----------

    async abrirResumoFatura(): Promise<void> {
        await this.locators.resumoFaturaButton.click();
        await expect(this.locators.resumoFaturaHeading).toBeVisible();
    }

    async validarEncargosResumoFatura(valorFormatado: string): Promise<void> {
        await expect(this.page.getByText(valorFormatado).first()).toBeVisible();
    }

    async fecharResumoFatura(): Promise<void> {
        await this.locators.fecharResumoButton.click();
    }

    // ---------- Dashboard pós-pagamento (steps extras fora da feature atual) ----------

    async validarCardsDashboardPosPagamento(): Promise<void> {
        await expect(this.locators.saldoContaCardLabel).toBeVisible();
        await expect(this.locators.proximaFaturaCardLabel).toBeVisible();
        await expect(this.locators.limiteDisponivelCardLabel).toBeVisible();
    }

    async abrirExtrato(): Promise<void> {
        await this.locators.extratoButton.click();
    }

    async validarErroValorMenorQueMinimo(): Promise<void> {
        await expect(this.page.getByText(/menor que o mínimo/i)).toBeVisible();
    }
}
