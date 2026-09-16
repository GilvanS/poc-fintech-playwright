import { Page, Locator } from "@playwright/test";

/** Tipos de chave Pix suportados pela Área PIX. */
export type TipoChavePix = 'cpf' | 'email' | 'celular' | 'aleatoria';

export class PixLocators {
    readonly page: Page;

    // Dashboard (ponto de partida do Pix)
    readonly enviarPixButton: Locator;
    readonly saldoContaLabel: Locator;
    readonly proximaFaturaLabel: Locator;
    readonly limiteDisponivelLabel: Locator;

    // Área PIX — tipos de chave
    readonly areaPixHeading: Locator;
    readonly chaveTipoCpfButton: Locator;
    readonly chaveTipoEmailButton: Locator;
    readonly chaveTipoCelularButton: Locator;
    readonly chaveTipoAleatoriaButton: Locator;

    // Formulário de Envio de Pix
    readonly valorInput: Locator;
    readonly mensagemInput: Locator;
    readonly tagRefeicaoButton: Locator;
    readonly prosseguirButton: Locator;

    // Revisão (Dados de Envio)
    readonly dadosEnvioHeading: Locator;
    readonly confirmarEnvioButton: Locator;

    // Modal de PIN (senha do cartão)
    readonly pinModalHeading: Locator;
    readonly pinModalTexto: Locator;

    // Comprovante (Envio Realizado)
    readonly envioRealizadoHeading: Locator;
    readonly fecharComprovanteButton: Locator;
    readonly voltarInicioButton: Locator;

    // Extrato
    readonly extratoButton: Locator;
    readonly receiptBackButton: Locator;
    readonly receiptPixLabel: Locator;
    readonly receiptAmount: Locator;
    readonly receiptOriginName: Locator;
    readonly receiptOriginInstitution: Locator;
    readonly receiptOriginCpf: Locator;
    readonly receiptDestName: Locator;
    readonly receiptDestInstitution: Locator;
    readonly receiptPixKey: Locator;
    readonly receiptCardNumber: Locator;
    readonly receiptTxId: Locator;
    readonly receiptCopyIdButton: Locator;
    readonly receiptDatetime: Locator;
    readonly receiptHelp: Locator;
    readonly toastSuccess: Locator;
    readonly voltarExtratoButton: Locator;

    constructor(page: Page) {
        this.page = page;

        this.enviarPixButton = page.getByRole('button', { name: 'Enviar Pix' });
        this.saldoContaLabel = page.getByText('Saldo em Conta');
        this.proximaFaturaLabel = page.getByText('Próxima Fatura');
        this.limiteDisponivelLabel = page.getByText('Limite Disponível');

        this.areaPixHeading = page.getByRole('heading', { name: 'Área PIX' });
        this.chaveTipoCpfButton = page.getByRole('button', { name: 'CPF', exact: true });
        this.chaveTipoEmailButton = page.getByRole('button', { name: 'E-mail' });
        this.chaveTipoCelularButton = page.getByRole('button', { name: 'Celular' });
        this.chaveTipoAleatoriaButton = page.getByRole('button', { name: 'Aleatória' });

        // O campo de CHAVE não fica aqui: o placeholder dele muda conforme o tipo
        // selecionado (CPF → máscara '-00', Email → 'exemplo@email.com', Celular →
        // '(11) 99999-', Aleatória → 'Chave aleatória com hifens') — resolvido por
        // chaveInputLocator(tipo).
        this.valorInput = page.getByRole('textbox', { name: '0,00' });
        this.mensagemInput = page.getByRole('textbox', { name: 'Escreva uma mensagem para o' });
        this.tagRefeicaoButton = page.getByRole('button', { name: 'Refeição' });
        this.prosseguirButton = page.getByRole('button', { name: 'Prosseguir' });

        this.dadosEnvioHeading = page.getByRole('heading', { name: 'Dados de Envio' });
        this.confirmarEnvioButton = page.getByRole('button', { name: 'Confirmar Envio' });

        this.pinModalHeading = page.getByRole('heading', { name: 'Digite a senha do cartão' });
        this.pinModalTexto = page.getByText(/padrão: 9898|saldo insuficiente|não foi possível|erro/i).first();

        this.envioRealizadoHeading = page.getByRole('heading', { name: 'Envio Realizado!' });
        // .w-20 vem direto do codegen: elemento que fecha/avança o overlay do comprovante.
        this.fecharComprovanteButton = page.locator('.w-20');
        this.voltarInicioButton = page.getByRole('button', { name: 'Voltar ao Início' });

        this.extratoButton = page.getByRole('button', { name: 'Extrato' });
        this.receiptBackButton = page.getByTestId('receipt-back');
        this.receiptPixLabel = page.getByText('PIX Enviado');
        this.receiptAmount = page.getByTestId('receipt-amount');
        this.receiptOriginName = page.getByTestId('receipt-origin-name');
        this.receiptOriginInstitution = page.getByTestId('receipt-origin').getByText('Instituição');
        this.receiptOriginCpf = page.getByTestId('receipt-origin-cpf');
        this.receiptDestName = page.getByTestId('receipt-dest-name');
        this.receiptDestInstitution = page.getByTestId('receipt-dest-institution');
        this.receiptPixKey = page.getByTestId('receipt-pix-key');
        this.receiptCardNumber = page.getByTestId('receipt-card-number');
        this.receiptTxId = page.getByTestId('receipt-tx-id');
        this.receiptCopyIdButton = page.getByTestId('receipt-copy-id');
        this.receiptDatetime = page.getByTestId('receipt-datetime');
        this.receiptHelp = page.getByTestId('receipt-help');
        this.toastSuccess = page.getByTestId('toast-success');
        this.voltarExtratoButton = page.getByRole('button', { name: 'Voltar' });
    }

    /**
     * Locator do valor exibido num card do dashboard: primeiro parágrafo seguinte ao
     * label em ordem de documento (following::p[1]) — o card do Saldo tem um wrapper
     * extra (label + botão de olho) em torno do label, então following-sibling não
     * serve pra todos os cards. Escopado por eixo (não getByText na página inteira)
     * porque o mesmo valor costuma repetir em gráficos/seções e quebraria o strict mode.
     */
    valorDoCard(cardLabel: Locator): Locator {
        return cardLabel.locator('xpath=following::p[1]');
    }

    /**
     * Locator do campo de chave Pix, resolvido pelo placeholder exibido para cada tipo.
     * CPF: placeholder é a máscara '000.000.000-00' (accessible name termina em '-00').
     */
    chaveInputLocator(tipo: TipoChavePix): Locator {
        switch (tipo) {
            case 'cpf':
                return this.page.getByRole('textbox', { name: '-00' });
            case 'email':
                return this.page.getByRole('textbox', { name: 'exemplo@email.com' });
            case 'celular':
                return this.page.getByRole('textbox', { name: '(11) 99999-' });
            case 'aleatoria':
                return this.page.getByRole('textbox', { name: 'Chave aleatória com hifens' });
        }
    }
}
