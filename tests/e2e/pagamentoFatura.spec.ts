import { test, expect } from '../../fixtures/testFixture';
import { PinModalComponent } from "../pages/components/PinModalComponent";
import { EvidenceHelper } from '../utils/EvidenceHelper';

const API_BASE_URL = 'http://localhost:3001/api';

function formatBRL(value: string | number | undefined): string {
    const num = Number(value ?? 0);
    return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

test.describe('CT03.1 - Pagamento de Fatura do Cartão', () => {
    test('CT03.1 - Realizar pagamento de fatura fechada com sucesso com massa específica', async ({ page, landingPage, dashboardPage, faturasPage, loginModel, testData }) => {
        test.setTimeout(180000);
        const cpf = loginModel.cpf;
        const senha = loginModel.senha;
        const saldoContaFormatado = formatBRL(testData?.BALANCE);
        const faturaFechadaFormatada = formatBRL(testData?.valor_total);

        EvidenceHelper.setMassaDeTeste(`CPF: ${cpf} | Senha: ${senha} | Saldo em Conta: R$ ${saldoContaFormatado} | Fatura Fechada: R$ ${faturaFechadaFormatada}`);

        // 0. Health Check da Massa (falha rápido e com mensagem clara se a planilha estiver
        // desatualizada, em vez de gastar ~1min de UI pra falhar com um locator genérico
        // lá na frente). Confere: (a) a linha existe em TBL_CENARIOS, (b) a fatura fechada
        // no banco bate com o valor_total da planilha, (c) essa fatura ainda não foi paga
        // (massa usada uma vez fica "gasta" — pagar de novo não repete o mesmo cenário).
        if (!testData) {
            throw new Error(`[Health Check] Massa não encontrada em TBL_CENARIOS para o cenário CT03.1. Verifique a planilha MassaDadosCMS.xlsx.`);
        }
        const cpfLimpo = cpf.replace(/\D/g, '');
        const loginResp = await page.request.post(`${API_BASE_URL}/auth/login`, {
            data: { cpf, password: senha },
        });
        if (!loginResp.ok()) {
            throw new Error(`[Health Check] Login da massa CT03.1 falhou (CPF ${cpf}): ${await loginResp.text()}`);
        }
        const { token } = await loginResp.json();
        const userResp = await page.request.get(`${API_BASE_URL}/users/${cpfLimpo}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        const { user } = await userResp.json();
        const faturaReal = Number(user?.creditCard?.closedInvoiceTotal ?? user?.creditCard?.closedInvoice ?? 0);
        const faturaPlanilha = Number(testData.valor_total ?? 0);
        const jaPaga = Boolean(user?.creditCard?.closedInvoiceIsPaid);

        if (jaPaga) {
            throw new Error(`[Health Check] A fatura fechada do CPF ${cpf} já está PAGA no banco — essa massa foi consumida por uma execução anterior. Atualize a linha CT03.1 na planilha com um CPF novo (com fatura fechada em aberto).`);
        }
        if (Math.abs(faturaReal - faturaPlanilha) > 0.01) {
            throw new Error(`[Health Check] Massa desatualizada: a planilha diz valor_total R$ ${faturaPlanilha.toFixed(2)}, mas o banco tem R$ ${faturaReal.toFixed(2)} pro CPF ${cpf}. Atualize a coluna valor_total na TBL_CENARIOS.`);
        }

        // 1. Login na aplicação (Valida visibilidade do campo CPF antes do print)
        await landingPage.visit();
        await landingPage.openLoginModal();
        await expect(landingPage.locators.cpfInput).toBeVisible();
        await landingPage.fillLoginForm(cpf, senha);
        await EvidenceHelper.captureStep(page, 'Passo 1 - Preenchimento do Login (Antes de Avançar)');
        await landingPage.clickSubmitLoginButton();

        // 2. Dashboard e validação do saldo em conta (Valida visibilidade do Dashboard e do Saldo antes do print)
        // Massas com fatura em atraso têm mais dado pra processar e podem demorar
        // além do timeout padrão de 5s pra sair da tela de "Carregando...".
        await expect(dashboardPage.locators.dashboardHeading).toBeVisible({ timeout: 20000 });
        await dashboardPage.fecharModalConquista();
        await expect(page.getByText(saldoContaFormatado).first()).toBeVisible();
        await EvidenceHelper.captureStep(page, 'Passo 2 - Dashboard Carregado e Saldo de Conta Validado');

        // 3. Navegação para a tela de Faturas (Valida visibilidade dos botões de Fatura antes do print)
        await faturasPage.navbar.navegarParaFaturas();
        await expect(faturasPage.locators.tabFaturaFechadaButton).toBeVisible();
        await expect(faturasPage.locators.resumoFaturaButton).toBeVisible();
        await EvidenceHelper.captureStep(page, 'Passo 3 - Tela de Faturas (Fatura Fechada)');

        // 4. Consulta e Validação do Resumo da Fatura (Valida visibilidade do Modal de Resumo antes do print)
        await faturasPage.abrirResumoFatura();
        await expect(faturasPage.locators.resumoFaturaHeading).toBeVisible();
        await faturasPage.validarEncargosResumoFatura(faturaFechadaFormatada);
        await EvidenceHelper.captureStep(page, 'Passo 4 - Modal de Resumo da Fatura com Valor Validado');
        await faturasPage.fecharResumoFatura();

        // 5. Início do pagamento da Fatura (Valida visibilidade do Modal de Opções/Confirmação de Pagamento antes do print)
        await faturasPage.selecionarOpcaoPagamento('total');
        await expect(faturasPage.locators.confirmarPagamentoButton).toBeVisible();
        await EvidenceHelper.captureStep(page, 'Passo 5 - Seleção da Opção de Pagamento Total (Antes de Avançar)');
        await faturasPage.confirmarIntencaoPagamento();

        // 6. Digitação do PIN (Valida visibilidade do teclado virtual antes do print)
        const digitBtn = page.getByRole('button', { name: '1' }).first();
        await expect(digitBtn).toBeVisible();
        await EvidenceHelper.captureStep(page, 'Passo 6 - Tela de Confirmação de PIN para Pagamento');
        const pinModal = new PinModalComponent(page);
        await pinModal.digitarPin('9898');

        // 7. Modal de Comprovante de Pagamento (Valida visibilidade do modal de sucesso antes do print)
        const successModal = page.getByTestId('payment-success-modal');
        await expect(successModal).toBeVisible({ timeout: 10000 });
        await expect(page.getByTestId('payment-success-amount')).toBeVisible();
        await EvidenceHelper.captureStep(page, 'Passo 7 - Comprovante de Pagamento Exibido com Sucesso');
        await page.getByTestId('payment-success-ok').click({ force: true, timeout: 3000 }).catch(() => {});
        await expect(successModal).not.toBeVisible({ timeout: 5000 }).catch(() => {});

        // 8. Validação do lançamento do pagamento na aba Aberta (prova real da transação, não só a troca de aba)
        await faturasPage.alternarTabFatura('Aberta');
        await expect(faturasPage.locators.tabFaturaAbertaButton).toBeVisible();
        await expect(faturasPage.locators.transactionRowPayment.first()).toBeVisible({ timeout: 10000 });
        await EvidenceHelper.captureStep(page, 'Passo 8 - Lançamento do Pagamento Validado na Aba Aberta');
    });
});
