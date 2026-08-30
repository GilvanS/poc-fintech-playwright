import { DashboardPage } from '../tests/pages';
import { EvidenceHelper } from '../tests/utils/evidenceHelper';

/**
 * DashboardFlow - Classe de fluxo de negócio para a página principal (Dashboard).
 */
export class DashboardFlow {
    constructor(private dashboardPage: DashboardPage) {}

    /**
     * Fecha modais iniciais se estiverem presentes e confirma carregamento do dashboard.
     */
    async inicializarDashboard(): Promise<void> {
        await this.dashboardPage.validarDashboardCarregado();
        await this.dashboardPage.fecharModalConquista();
        await EvidenceHelper.captureStep(this.dashboardPage.page, 'Dashboard inicializado');
    }

    /**
     * Executa a alteração da meta de gastos.
     * @param novoValor Novo valor limite desejado.
     */
    async alterarMetaDeGastos(novoValor: string): Promise<void> {
        await this.dashboardPage.editarMetaDeGastos(novoValor);
        await EvidenceHelper.captureStep(this.dashboardPage.page, 'Meta de gastos alterada');
    }

    /**
     * Abre e consulta a inteligência de assinaturas via IA.
     */
    async consultarInsightsIA(): Promise<void> {
        await this.dashboardPage.abrirDiagnosticoIA();
        await EvidenceHelper.captureStep(this.dashboardPage.page, 'Diagnóstico da IA aberto');

        await this.dashboardPage.fecharDiagnosticoIA();
        await EvidenceHelper.captureStep(this.dashboardPage.page, 'Diagnóstico da IA fechado');
    }

    /**
     * Tenta realizar o pagamento de uma conta recorrente com tipo especificado
     * e valida a mensagem de erro quando o PIN é incorreto.
     * @param tipoOpcao 'debito' ou 'credito'
     */
    async pagarContaComErroPin(tipoOpcao: 'debito' | 'credito' = 'debito'): Promise<void> {
        await this.dashboardPage.iniciarPagamentoContaRecorrente(tipoOpcao);
        await EvidenceHelper.captureStep(this.dashboardPage.page, 'Pagamento de conta recorrente iniciado');

        await this.dashboardPage.confirmarPagamento();
        await EvidenceHelper.captureStep(this.dashboardPage.page, 'Pagamento confirmado');

        await this.dashboardPage.validarErroPinIncorreto();
        await EvidenceHelper.captureStep(this.dashboardPage.page, 'Erro de PIN incorreto validado');
    }
}
