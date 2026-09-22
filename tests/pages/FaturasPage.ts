import { expect, Locator, Page } from "@playwright/test";
import { FaturasLocators } from "../locators/FaturasLocators";
import { NavbarComponent } from "./components/NavbarComponent";
import { PopupsComponent } from "./components/PopupsComponent";
import { EvidenceHelper } from "../utils/EvidenceHelper";
import { truncar4 } from "../utils/moeda";
import { logger } from "../utils/logger";

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

    /**
     * Converte um valor monetário pt-BR ("R$ 3.870,86" ou "-R$ 50,00") pra número
     * (3870.86 / -50.00). O app renderiza negativo (limite estourado) com
     * `toLocaleString('pt-BR', {style:'currency'})`, que produz o hífen ANTES do
     * "R$" — a regex de limpeza abaixo descarta tudo que não é dígito/vírgula,
     * então o sinal precisa ser detectado ANTES da limpeza, senão "-R$ 50,00" virava
     * 50.00 positivo (sinal perdido, achado em 2026-09-21 ao investigar massa com
     * lim_disponivel negativo quebrando a matemática antes/depois do teste).
     */
    private parseValorBRL(texto: string): number {
        const negativo = texto.trim().startsWith('-');
        const limpo = texto.replace(/[^\d,]/g, '');
        const num = Number(limpo.replace(/\./g, '').replace(',', '.'));
        if (Number.isNaN(num)) {
            throw new Error(`Valor "${texto}" não pôde ser interpretado como monetário pt-BR.`);
        }
        return negativo ? -num : num;
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
     * da tab certa). A fatura fechada é IMUTÁVEL (docs/REGRAS-NEGOCIO-FATURA.md): o
     * card "Valor Total da Fatura Fechada" continua renderizado e mostra o valor
     * ORIGINAL mesmo depois de paga (badge "Paga" ao lado) — nunca fica 0,00 nem
     * some do DOM. Por isso SEMPRE lê o card real, paga ou não — nada de fallback
     * hardcoded pra 0 (isso mascarava regressão: 2026-09-20, log mostrou "depois R$
     * 0.00" que na verdade era só o retorno hardcoded daqui, não o valor real da UI).
     * Sempre VOLTA pra tab "Fatura Aberta", onde ficam os botões de pagamento usados
     * pelos steps seguintes.
     */
    private async lerValorFaturaFechada(): Promise<number> {
        await this.alternarTabFatura('Fechada');
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
     * Valida pagamento TOTAL (fatura fechada quitada de uma vez, CT03.1). Regra de
     * negócio (docs/REGRAS-NEGOCIO-FATURA.md): a fatura fechada é IMUTÁVEL — o valor
     * exibido NÃO zera nem "diminui", continua sendo o valor ORIGINAL, só ganha o
     * badge "Paga". A prova real da baixa é matemática, cruzada contra dois outros
     * pontos da tela (mesmo princípio de validarPagamentoParcialEfetivado, generalizado):
     *   1. Fatura fechada exibida == valor original capturado antes (imutabilidade).
     *   2. Limite Disponível sobe — só o PRINCIPAL restaura, não o valor pago inteiro
     *      quando há encargos embutidos (ver validarLimiteDisponivelSubiuComPagamento,
     *      corrigido em 2026-09-21 — a versão anterior assumia 1:1 e quebrava com
     *      fatura com multa/juros congelados).
     *   3. Fatura Aberta cai EXATAMENTE o valor pago — "Valor Atual da Fatura" é o
     *      total consolidado (currentInvoice + closedInvoiceTotal, a dívida da
     *      fechada pendente entra nesse número); ao quitar a fechada, esse valor
     *      sai do consolidado (prova ao vivo 2026-09-20: antes R$ 4.852,26, pago
     *      R$ 3.870,86, depois R$ 981,40).
     * Substitui o antigo validarFaturaFechadaMenor, que aceitava até um retorno 0
     * hardcoded como "diminuiu" — mascarava exatamente o tipo de regressão que essa
     * validação existe pra pegar (2026-09-20).
     */
    async validarPagamentoTotalEfetivado(
        valorAntes: number,
        limiteDisponivelAntes: number,
        aberturaAntes: number
    ): Promise<{ fechadaDepois: number; limiteDepois: number; abertaDepois: number }> {
        // Fecha alerta de erro, modal de sucesso pós-PIN e popups (ex: drawer "Saúde
        // Financeira" que abre em cima depois do pagamento) — todos cobrem os cards.
        await this.fecharAlertaErro();
        await this.fecharModalSucessoPagamento();
        await this.popups.fecharModaisSeVisiveis();

        // (1) Badge "Paga" + valor exibido continua o ORIGINAL (imutável).
        await this.alternarTabFatura('Fechada');
        await expect(this.locators.faturaFechadaPagaBadge).toBeVisible({ timeout: 10000 });
        const fechadaDepois = await this.lerValorCard(this.locators.valorTotalFaturaFechadaText);
        if (Math.abs(fechadaDepois - valorAntes) > 0.01) {
            throw new Error(
                `Fatura fechada é imutável — deveria continuar mostrando o valor original R$ ${valorAntes.toFixed(2)} (com badge Paga), mas mostra R$ ${fechadaDepois.toFixed(2)}.`
            );
        }

        // (3) Fatura ABERTA cai exatamente o valor pago (ela consolida a dívida da
        // fechada pendente — ver comentário do método acima).
        await this.alternarTabFatura('Aberta');
        const abertaDepois = await this.lerValorCard(this.locators.valorAtualFaturaText);
        // Diferença calculada segue a regra da fintech: TRUNCADA em 4 casas (a UI
        // renderiza o consolidado com 2 casas arredondadas — tolerância de 0,01 abaixo
        // cobre a diferença máxima entre truncar4 e a exibição).
        const abertaEsperada = truncar4(aberturaAntes - valorAntes);
        if (Math.abs(abertaDepois - abertaEsperada) > 0.01) {
            throw new Error(
                `Fatura aberta não caiu o valor pago após o pagamento TOTAL da fechada — antes R$ ${aberturaAntes.toFixed(2)} - pago R$ ${valorAntes.toFixed(2)} = esperado R$ ${abertaEsperada.toFixed(2)}, mas a UI mostra R$ ${abertaDepois.toFixed(2)}.`
            );
        }

        // (2) Limite Disponível sobe — só o principal restaura (ver validarLimiteDisponivelSubiuComPagamento).
        const limiteDepois = await this.validarLimiteDisponivelSubiuComPagamento(valorAntes, limiteDisponivelAntes);

        return { fechadaDepois, limiteDepois, abertaDepois };
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
     * Valida a subida do Limite Disponível após pagamento de fatura fechada, SEM
     * assumir igualdade exata com o valor pago. Regra de negócio real (API
     * invoiceController.js): só o PRINCIPAL restaura limite — encargos (multa/
     * juros_mora/juros_remuneratorios/iof) já congelados no valor_total da fatura
     * fechada NÃO restauram, mesmo quando o valor pago os inclui. A UI não expõe o
     * breakdown principal/encargos em nenhum card desta tela, então o teste não tem
     * como calcular o valor exato esperado — só pode validar os LIMITES matemáticos:
     *   - o limite nunca pode CAIR após um pagamento (encargos >= 0, nunca negativo);
     *   - o limite nunca pode subir MAIS que o valor pago (principal <= valor pago).
     * Corrigido em 2026-09-21: a versão anterior (`toBeCloseTo(antes + pago, 1)`)
     * assumia 1:1 e falhava sempre que a fatura tinha encargos embutidos — prova ao
     * vivo CPF 24662236606: pago R$ 5.291,58, mas o limite só subiu R$ 3.933,06
     * (diferença de R$ 1.358,52 = exatamente os encargos congelados na fatura).
     */
    private async validarLimiteDisponivelSubiuComPagamento(valorPago: number, limiteDisponivelAntes: number): Promise<number> {
        const limiteMinimo = limiteDisponivelAntes - 0.01;
        const limiteMaximo = limiteDisponivelAntes + valorPago + 0.01;
        await expect
            .poll(async () => this.lerLimiteDisponivel(), { timeout: 15000, intervals: [500, 1000, 2500] })
            .toBeGreaterThanOrEqual(limiteMinimo);
        const limiteDepois = await this.lerLimiteDisponivel();
        if (limiteDepois > limiteMaximo) {
            throw new Error(
                `Limite Disponível subiu MAIS que o valor pago — antes R$ ${limiteDisponivelAntes.toFixed(2)}, pago R$ ${valorPago.toFixed(2)} (teto R$ ${limiteMaximo.toFixed(2)}), mas ficou R$ ${limiteDepois.toFixed(2)}.`
            );
        }
        // Diferenças calculadas com a regra da fintech: TRUNCADAS em 4 casas — sem
        // isso o ruído de float do JS vira "encargos R$ -0.00" no log (visto no
        // CT03.4 em 2026-09-22: valorPago - restaurado = -2.8e-14).
        const restaurado = truncar4(limiteDepois - limiteDisponivelAntes);
        const encargosEmbutidos = truncar4(valorPago - restaurado);
        logger.info(`   🧮 Limite: antes R$ ${limiteDisponivelAntes.toFixed(2)} + restaurado R$ ${restaurado.toFixed(2)} = depois R$ ${limiteDepois.toFixed(2)} (encargos embutidos no pagamento: R$ ${encargosEmbutidos.toFixed(2)})`);
        return limiteDepois;
    }

    /**
     * Valida pagamento PARCIAL (Mínimo/Parcial/Menor/Maior). A fatura fechada NÃO zera
     * e o app continua exibindo o TOTAL original no card "Valor Total da Fatura Fechada"
     * (InvoiceView.getSubTabAmount retorna closedInvoice; o residual não é exposto em
     * card nenhum da UI). A prova WEB da baixa é:
     *   1. o Limite Disponível sobe — só o PRINCIPAL restaura, não o valor pago inteiro
     *      quando há encargos embutidos (ver validarLimiteDisponivelSubiuComPagamento);
     *      prova ao vivo CT03.2 sem encargos: 13.273,43 → 13.660,52 = +R$ 387,09;
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

        // (1) Limite Disponível sobe — só o principal restaura (ver validarLimiteDisponivelSubiuComPagamento).
        return this.validarLimiteDisponivelSubiuComPagamento(valorPago, limiteDisponivelAntes);
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

        const item = this.page.getByRole('button', { name: regex }).first();
        await expect(item).toBeVisible({ timeout: 10000 });
        // Prova visual do item que casou: pagamentos de execuções anteriores acumulam na
        // lista e um lançamento ANTIGO com o mesmo rótulo satisfaria este assert (falso
        // positivo silencioso) — a evidência mostra qual item foi aceito.
        await EvidenceHelper.captureStep(this.page, `Lançamento do pagamento validado (${regex})`);
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
