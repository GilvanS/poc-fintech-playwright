import { expect, Page } from "@playwright/test";
import { NavbarComponent } from "./components/NavbarComponent";
import { PopupsComponent } from "./components/PopupsComponent";
import { PixLocators, TipoChavePix } from "../locators/PixLocators";
import { EvidenceHelper } from "../utils/EvidenceHelper";
import { logger } from "../utils/logger";

/** Dados esperados no comprovante/revisão do Pix — preenchidos pelos steps a partir da massa. */
export type PixData = {
    nomeDestinatario: string;
    chave: string;
    mensagem: string;
    valorRevisao: string;
    tipoChave: 'cpf' | 'email' | 'celular' | 'aleatoria';
};

/** Dados dos cards do dashboard validados antes de iniciar o Pix. */
export type DashboardCards = {
    saldo: string;
    fatura: string;
    /** Opcional: a UI pode recalcular o limite de crédito e divergir da massa. */
    limite?: string;
};

/**
 * PixPage - Page Object da Área PIX (envio de Pix por chave) e do extrato.
 *
 * Fluxo mapeado a partir do codegen:
 * Dashboard → "Enviar Pix" → Área PIX (seleção de tipo de chave) →
 * formulário (chave, valor, mensagem, tag) → Dados de Envio (revisão) →
 * Confirmar Envio → PIN do cartão → Envio Realizado (comprovante) →
 * Voltar ao Início → Extrato (validação do comprovante do Pix).
 */
export class PixPage {
    readonly page: Page;
    readonly locators: PixLocators;

    // Component Objects
    readonly navbar: NavbarComponent;
    readonly popups: PopupsComponent;

    /** Tipo de chave selecionado no momento (define qual locator de chave usar). */
    private tipoChaveAtual: TipoChavePix = 'cpf';

    constructor(page: Page) {
        this.page = page;
        this.locators = new PixLocators(page);
        this.navbar = new NavbarComponent(page);
        this.popups = new PopupsComponent(page);
    }

    // ---------- Dashboard ----------

    /**
     * Valida os cartões do dashboard (Saldo, Próxima Fatura, Limite) antes de iniciar o Pix.
     * @param valores Valores formatados como exibidos na tela (ex: 'R$ 17.000,00').
     *                O limite é opcional: a UI recalcula o limite de crédito e pode divergir
     *                da coluna limite_disponivel da massa (ex: massa -750,00, UI R$ 2.750,00).
     */
    async validarCardsDashboard(valores: DashboardCards): Promise<void> {
        await expect(this.locators.saldoContaLabel).toBeVisible();
        await expect(this.locators.valorDoCard(this.locators.saldoContaLabel)).toHaveText(valores.saldo);
        await expect(this.locators.proximaFaturaLabel).toBeVisible();
        await expect(this.locators.valorDoCard(this.locators.proximaFaturaLabel)).toHaveText(valores.fatura);
        await expect(this.locators.limiteDisponivelLabel).toBeVisible();
        if (valores.limite) {
            await expect(this.locators.valorDoCard(this.locators.limiteDisponivelLabel)).toHaveText(valores.limite);
        }
        await EvidenceHelper.captureStep(this.page, 'Cards do dashboard validados');
    }

    /**
     * Lê o saldo exibido no card "Saldo em Conta" da home (texto cru da UI, ex: 'R$ 1.916,27').
     */
    async lerSaldoDashboard(): Promise<string> {
        await expect(this.locators.saldoContaLabel).toBeVisible();
        const texto = await this.locators.valorDoCard(this.locators.saldoContaLabel).textContent();
        await EvidenceHelper.captureStep(this.page, 'Saldo do dashboard capturado');
        return (texto ?? '').trim();
    }

    /**
     * Valida que o card "Saldo em Conta" da home exibe o valor esperado.
     * O expect re-tenta até o valor bater — cobre o refresh assíncrono do saldo após o Pix
     * (a home pode renderizar o valor antigo por alguns instantes depois de voltar).
     * @param valorEsperado Valor numérico esperado.
     */
    async validarCardSaldo(valorEsperado: number): Promise<void> {
        // Compara só os DÍGITOS (ex: 'R$ 1.982,12' → '198212'): a UI usa espaço
        // não-quebrável (U+00A0/U+202F) entre "R$" e o número — já quebrou uma
        // comparação byte a byte com Expected/Received idênticos visualmente
        // (run headed 21:40). Dígitos puros ficam imunes a qualquer variante de
        // espaço, símbolo de moeda ou separador de milhar. O poll re-tenta até
        // bater — cobre o refresh assíncrono do saldo na home após o Pix.
        const digitos = (t: string) => t.replace(/\D/g, '');
        const esperado = digitos(valorEsperado.toFixed(2));
        await expect
            .poll(
                async () => digitos((await this.locators.valorDoCard(this.locators.saldoContaLabel).textContent()) ?? ''),
                { timeout: 15000, intervals: [500, 1000, 2000] },
            )
            .toBe(esperado);
    }

    async abrirAreaPix(): Promise<void> {
        await this.locators.enviarPixButton.click();
        await expect(this.locators.areaPixHeading).toBeVisible();
        await EvidenceHelper.captureStep(this.page, 'Área PIX aberta');
    }

    /**
     * Valida o nome do cliente logado: greeting do dashboard ("Olá, <primeiro nome>")
     * + log no console (logger) com o nome completo vindo da massa (TBL_USUARIOS).
     * @param nomeCompleto Nome completo esperado do remetente (de TBL_USUARIOS).
     */
    async validarNomeClienteLogado(nomeCompleto: string): Promise<void> {
        const primeiroNome = nomeCompleto.trim().split(/\s+/)[0];
        await expect(this.page.getByRole('heading', { name: `Olá, ${primeiroNome}` })).toBeVisible();
        logger.info(`👤 Cliente logado: ${nomeCompleto} — greeting "Olá, ${primeiroNome}" validado no dashboard`);
        await EvidenceHelper.captureStep(this.page, 'Nome do cliente logado validado');
    }

    // ---------- Área PIX ----------

    /**
     * Seleciona o tipo de chave Pix e valida que o campo correspondente apareceu.
     * Guarda o tipo escolhido pra resolver o locator do campo de chave no preenchimento.
     * @param tipo 'cpf' | 'email' | 'celular' | 'aleatoria'
     */
    async selecionarTipoChave(tipo: TipoChavePix): Promise<void> {
        switch (tipo) {
            case 'cpf':
                await this.locators.chaveTipoCpfButton.click();
                await expect(this.locators.chaveInputLocator('cpf')).toBeVisible();
                break;
            case 'email':
                await this.locators.chaveTipoEmailButton.click();
                await expect(this.locators.chaveInputLocator('email')).toBeVisible();
                break;
            case 'celular':
                await this.locators.chaveTipoCelularButton.click();
                await expect(this.locators.chaveInputLocator('celular')).toBeVisible();
                break;
            case 'aleatoria':
                await this.locators.chaveTipoAleatoriaButton.click();
                await expect(this.locators.chaveInputLocator('aleatoria')).toBeVisible();
                break;
        }
        this.tipoChaveAtual = tipo;
    }

    /**
     * Seleciona o tipo de chave CPF e valida que o campo correspondente apareceu.
     * Os demais tipos (email/celular/aleatória) continuam disponíveis via
     * selecionarTipoChave pra cenários futuros — este fluxo é por CPF.
     */
    async selecionarTipoChaveCpf(): Promise<void> {
        await this.selecionarTipoChave('cpf');
        await EvidenceHelper.captureStep(this.page, 'Tipo de chave CPF selecionado');
    }

    /**
     * Preenche só o campo de chave Pix (locator resolvido pelo tipo já selecionado
     * em selecionarTipoChave). Step atômico — 1 campo por linha de Gherkin/evidência.
     * @param chave Valor da chave Pix (ex: '99999999999' para CPF)
     */
    async preencherChavePix(chave: string): Promise<void> {
        const chaveInput = this.locators.chaveInputLocator(this.tipoChaveAtual);
        await chaveInput.click();
        await chaveInput.fill(chave);
        await EvidenceHelper.captureStep(this.page, 'Chave Pix preenchida');
    }

    /**
     * @param valor Valor digitado no campo monetário exatamente como o codegen gravou
     *              (ex: 'R$ 1,500' → a UI exibe 'R$ 15,00' na revisão)
     */
    async preencherValorPix(valor: string): Promise<void> {
        await this.locators.valorInput.click();
        await this.locators.valorInput.fill(valor);
        await EvidenceHelper.captureStep(this.page, 'Valor do Pix preenchido');
    }

    async preencherMensagemPix(mensagem: string): Promise<void> {
        await this.locators.mensagemInput.click();
        await this.locators.mensagemInput.fill(mensagem);
        await EvidenceHelper.captureStep(this.page, 'Mensagem do Pix preenchida');
    }

    /**
     * Marca a tag/categoria de gasto do Pix (ex: 'Refeição').
     */
    async selecionarTagRefeicao(): Promise<void> {
        await this.locators.tagRefeicaoButton.click();
    }

    /**
     * Avança para a tela de revisão (Dados de Envio).
     */
    async prosseguirParaDadosEnvio(): Promise<void> {
        await this.locators.prosseguirButton.click();
        await expect(this.locators.dadosEnvioHeading).toBeVisible();
        await EvidenceHelper.captureStep(this.page, 'Tela de Dados de Envio aberta');
    }

    // ---------- Revisão (Dados de Envio) ----------

    async validarDadosEnvio(dados: PixData): Promise<void> {
        await expect(this.page.getByText('Destinatário')).toBeVisible();
        await expect(this.page.getByText(dados.nomeDestinatario)).toBeVisible();
        await expect(this.page.getByText('Instituição')).toBeVisible();
        await expect(this.page.getByText('Fintech Volt')).toBeVisible();
        await expect(this.page.getByText('Chave informada')).toBeVisible();
        await expect(this.page.getByText(dados.chave).first()).toBeVisible();
        await expect(this.page.getByText('Mensagem')).toBeVisible();
        await expect(this.page.getByText(dados.mensagem).first()).toBeVisible();
        await expect(this.page.getByText('Método')).toBeVisible();
        await expect(this.page.getByText('Saldo de Conta')).toBeVisible();
        await expect(this.page.getByText('Valor a transferir')).toBeVisible();
        await expect(this.page.getByText(dados.valorRevisao)).toBeVisible();
        await EvidenceHelper.captureStep(this.page, 'Dados de Envio validados');
    }

    /**
     * Confirma o envio do Pix, abrindo o modal de PIN do cartão.
     */
    async confirmarEnvio(): Promise<void> {
        await this.locators.confirmarEnvioButton.click();
        await expect(this.locators.pinModalHeading).toBeVisible();
        await EvidenceHelper.captureStep(this.page, 'PIN solicitado');
    }


    // ---------- Comprovante ----------

    /**
     * Valida a tela de sucesso "Envio Realizado!" exibida logo após o PIN correto.
     * Timeout estendido: o backend processa a transferência real (débito do saldo,
     * crédito no destinatário, gravação da transação) e pode levar mais que os 5s
     * padrão do expect — visto falhar com 15s de API num round anterior.
     */
    async validarEnvioRealizado(): Promise<void> {
        await expect(this.locators.envioRealizadoHeading).toBeVisible({ timeout: 20000 });
        await EvidenceHelper.captureStep(this.page, 'Envio realizado');
    }

    /**
     * Abre o comprovante completo do Pix (fecha o overlay via .w-20, do codegen) e
     * valida o resumo: transferência via Pix, destinatário, ID Transação e Data & Hora.
     * @param idTransacaoParcial Prefixo do ID da transação exibido no comprovante
     *                           (opcional — a UI mostra só os primeiros caracteres)
     */
    async abrirComprovante(idTransacaoParcial?: string): Promise<void> {
        await this.locators.fecharComprovanteButton.click();
        await expect(this.locators.envioRealizadoHeading).toBeVisible();
        await expect(this.page.getByText('Sua transferência via Pix de')).toBeVisible();
        await expect(this.page.getByText('Destinatário')).toBeVisible();
        await expect(this.page.getByText('ID Transação')).toBeVisible();
        if (idTransacaoParcial) {
            await expect(this.page.getByText(idTransacaoParcial)).toBeVisible();
        }
        await expect(this.page.getByText('Data & Hora')).toBeVisible();
        await EvidenceHelper.captureStep(this.page, 'Comprovante aberto');
    }

    /**
     * Volta ao dashboard pelo botão "Voltar ao Início" do comprovante.
     */
    async voltarAoInicio(): Promise<void> {
        await this.locators.voltarInicioButton.click();
        // O heading do dashboard é dinâmico ("Olá, <nome>") — usa o botão fixo do
        // header como proxy de volta ao início, mesma abordagem do DashboardPage.
        await expect(this.page.getByRole('button', { name: 'Ocultar Menu' })).toBeVisible();
        await EvidenceHelper.captureStep(this.page, 'Retorno ao início após Pix');
    }

    // ---------- Extrato ----------

    /**
     * Abre o extrato e valida o comprovante do Pix enviado, incluindo o botão de
     * copiar ID (toast de sucesso) e o rodapé de ajuda.
     * @param descricao Descrição da transação no extrato (ex: 'teste' → "Transação: teste")
     */
    async validarComprovanteNoExtrato(descricao: string): Promise<void> {
        await this.locators.extratoButton.click();

        // .first(): transações repetidas (mesma descrição em execuções anteriores) se
        // acumulam no extrato — o item mais recente fica no topo da lista, então o
        // primeiro match é sempre o Pix acabado de enviar neste cenário.
        const itemTransacao = this.page.getByRole('listitem', { name: `Transação: ${descricao}` }).first();
        await itemTransacao.click();
        await expect(this.locators.receiptBackButton).toBeVisible();

        // Cabeçalho do comprovante
        await expect(this.locators.receiptPixLabel).toBeVisible();
        await expect(this.locators.receiptAmount).toBeVisible();
        await expect(this.page.getByText('Transação concluída')).toBeVisible();
        await expect(this.locators.receiptDatetime).toBeVisible();

        // Origem
        await expect(this.page.getByText('Origem')).toBeVisible();
        await expect(this.locators.receiptOriginName).toBeVisible();
        await expect(this.locators.receiptOriginInstitution).toBeVisible();
        await expect(this.page.getByText('FintechBank')).toBeVisible();
        await expect(this.locators.receiptOriginCpf).toBeVisible();

        // Destinatário
        await expect(this.page.getByText('Destinatário')).toBeVisible();
        await expect(this.locators.receiptDestName).toBeVisible();
        await expect(this.locators.receiptDestInstitution).toBeVisible();

        // Chave, cartão e ID da transação
        await expect(this.page.getByText('Chave PIX')).toBeVisible();
        await expect(this.locators.receiptPixKey).toBeVisible();
        await expect(this.page.getByText('Cartão Utilizado')).toBeVisible();
        await expect(this.locators.receiptCardNumber).toBeVisible();
        await expect(this.page.getByText('ID da transação')).toBeVisible();
        await expect(this.locators.receiptTxId).toBeVisible();

        // Copiar ID → toast de sucesso
        await this.locators.receiptCopyIdButton.click();
        await expect(this.locators.toastSuccess).toBeVisible();

        // Rodapé
        await expect(this.locators.receiptHelp).toBeVisible();
        await EvidenceHelper.captureStep(this.page, 'Comprovante do Pix validado no extrato');
    }

    /**
     * Volta da tela de comprovante para a listagem do extrato.
     */
    async voltarDoExtrato(): Promise<void> {
        await this.locators.voltarExtratoButton.click();
        await expect(this.page.getByRole('button', { name: 'Ocultar Menu' })).toBeVisible({ timeout: 5000 }).catch(() => {});
    }

    // ---------- Cenário NEGATIVO: saldo insuficiente ----------

    /**
     * Captura a mensagem que a UI exibe ao bloquear o envio por saldo insuficiente.
     * Modo descoberta: coleta o texto do corpo do modal de PIN (onde a UI exibe o motivo
     * do bloqueio). O step loga o texto real — informe o texto pra fixar o assert depois.
     */
    async capturarMensagemBloqueio(): Promise<string> {
        const textoModal = await this.locators.pinModalTexto.textContent({ timeout: 10000 }).catch(() => null);
        if (textoModal && textoModal.trim() !== '') return textoModal.trim();

        // Fallback: varre todos os textos visíveis do modal de PIN e devolve o que
        // NÃO é o heading nem o hint padrão — costuma ser a mensagem de erro da UI.
        const modal = this.page.locator('div', { has: this.locators.pinModalHeading }).last();
        const candidatos = await modal.getByText(/./g).allTextContents().catch(() => [] as string[]);
        const ignorar = ['Digite a senha do cartão', 'Confirme o seu PIN'];
        return (
            candidatos
                .map((t) => t.trim())
                .filter((t) => t.length > 8 && !ignorar.some((i) => t.startsWith(i)))
                .slice(-3)
                .join(' | ') || '(nenhum texto capturado no modal de PIN)'
        );
    }

    /**
     * Valida que o envio NÃO foi concluído: o modal de PIN continua aberto (a UI
     * bloqueou a transferência e não avançou pro comprovante "Envio Realizado!").
     */
    async validarEnvioNaoConcluido(): Promise<void> {
        await expect(this.locators.pinModalHeading).toBeVisible();
        await expect(this.locators.envioRealizadoHeading).toBeHidden();
        await EvidenceHelper.captureStep(this.page, 'Envio bloqueado (saldo insuficiente)');
    }

    /**
     * Clique em "Prosseguir" SEM validar o resultado — usado pelo cenário negativo
     * "executa e comprova": a validação do bloqueio é um passo separado.
     */
    async tentarAvancarDadosEnvio(): Promise<void> {
        await this.locators.prosseguirButton.click();
    }

    /**
     * Valida a validação nativa do browser (atributo HTML `required`) quando Chave ou Valor
     * ficam vazios e o usuário tenta avançar — mesmo mecanismo do cadastro
     * (CadastroPage.validarCampoObrigatorio): checa `validity.valueMissing` em vez do texto
     * de `validationMessage`, que muda por browser/locale (descoberta ao implementar a
     * validação equivalente do cadastro — Chromium do Playwright usa en-US por padrão).
     */
    async validarCampoObrigatorioChave(): Promise<void> {
        const { valueMissing, mensagem } = await this.locators.chaveInputLocator(this.tipoChaveAtual).evaluate((el: HTMLInputElement) => ({
            valueMissing: el.validity.valueMissing,
            mensagem: el.validationMessage,
        }));
        expect(valueMissing, `Validação nativa do campo: "${mensagem}"`).toBe(true);
    }

    async validarCampoObrigatorioValor(): Promise<void> {
        const { valueMissing, mensagem } = await this.locators.valorInput.evaluate((el: HTMLInputElement) => ({
            valueMissing: el.validity.valueMissing,
            mensagem: el.validationMessage,
        }));
        expect(valueMissing, `Validação nativa do campo: "${mensagem}"`).toBe(true);
    }

    /**
     * Valida o bloqueio por saldo insuficiente NO PRÓPRIO FORMULÁRIO: a mensagem inline
     * aparece (a UI valida já no preenchimento, antes de qualquer PIN) e o avanço para
     * "Dados de Envio" NÃO acontece. Retorna o texto exato da mensagem exibida.
     */
    async validarBloqueioNoFormulario(): Promise<string> {
        const mensagem = this.page.getByText(/saldo insuficiente/i).first();
        await expect(mensagem).toBeVisible({ timeout: 5000 });
        await expect(this.locators.dadosEnvioHeading).toBeHidden();
        await EvidenceHelper.captureStep(this.page, 'Envio bloqueado no formulário (saldo insuficiente)');
        return (await mensagem.textContent())?.trim() ?? '';
    }
}
