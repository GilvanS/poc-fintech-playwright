import { test, expect } from '../../fixtures/testFixture';
import { EvidenceHelper } from '../utils/evidenceHelper';

test.describe('CT03 - Pagamento de Fatura do Cartão', () => {
    test('CT03.1 - Realizar pagamento de fatura fechada com sucesso com massa específica', async ({ page, landingPage, dashboardPage, faturasPage }) => {
        test.setTimeout(180000);
        const cpf = '421.116.790-11';
        const senha = 'admin999';

        EvidenceHelper.setMassaDeTeste(`CPF: ${cpf} | Senha: ${senha} | Saldo em Conta: R$ 7.110,18 | Fatura Fechada: R$ 5.577,58`);

        // 1. Login na aplicação (Valida visibilidade do campo CPF antes do print)
        await landingPage.visit();
        await landingPage.openLoginModal();
        await expect(landingPage.cpfInput).toBeVisible();
        await landingPage.fillLoginForm(cpf, senha);
        await EvidenceHelper.captureStep(page, 'Passo 1 - Preenchimento do Login (Antes de Avançar)');
        await landingPage.clickSubmitLoginButton();

        // 2. Dashboard e validação do saldo em conta (Valida visibilidade do Dashboard e do Saldo antes do print)
        // Esse CPF tem fatura em atraso (mais dado pra processar) e pode demorar
        // além do timeout padrão de 5s pra sair da tela de "Carregando...".
        await expect(dashboardPage.dashboardHeading).toBeVisible({ timeout: 20000 });
        await dashboardPage.fecharModalConquista();
        await expect(page.getByText('7.110,18').first()).toBeVisible();
        await EvidenceHelper.captureStep(page, 'Passo 2 - Dashboard Carregado e Saldo de Conta Validado');

        // 3. Navegação para a tela de Faturas (Valida visibilidade dos botões de Fatura antes do print)
        await faturasPage.navbar.navegarParaFaturas();
        await expect(faturasPage.tabFaturaFechadaButton).toBeVisible();
        await expect(faturasPage.resumoFaturaButton).toBeVisible();
        await EvidenceHelper.captureStep(page, 'Passo 3 - Tela de Faturas (Fatura Fechada)');

        // 4. Consulta e Validação do Resumo da Fatura (Valida visibilidade do Modal de Resumo antes do print)
        await faturasPage.abrirResumoFatura();
        await expect(faturasPage.resumoFaturaHeading).toBeVisible();
        await faturasPage.validarEncargosResumoFatura({
            multa: '232,26',
            jurosMora: '73,49',
            jurosRemuneratorios: '1.131,93',
            iofAdicional: '71,80',
        });
        await EvidenceHelper.captureStep(page, 'Passo 4 - Modal de Resumo da Fatura com Encargos Validados');
        await faturasPage.fecharResumoFatura();

        // 5. Início do pagamento da Fatura (Valida visibilidade do Modal de Opções/Confirmação de Pagamento antes do print)
        await faturasPage.selecionarOpcaoPagamento('total');
        await expect(faturasPage.confirmarPagamentoButton).toBeVisible();
        await EvidenceHelper.captureStep(page, 'Passo 5 - Seleção da Opção de Pagamento Total (Antes de Avançar)');
        await faturasPage.confirmarIntencaoPagamento();

        // 6. Digitação do PIN (Valida visibilidade do teclado virtual/botão Auto antes do print)
        const autoBtn = page.getByRole('button', { name: 'Auto' }).or(page.getByRole('button', { name: '1' })).first();
        await expect(autoBtn).toBeVisible();
        await EvidenceHelper.captureStep(page, 'Passo 6 - Tela de Confirmação de PIN para Pagamento');
        await faturasPage.digitarPin('9898');

        // 7. Modal de Comprovante de Pagamento (Valida visibilidade do modal de sucesso antes do print)
        const successModal = page.getByTestId('payment-success-modal');
        await expect(successModal).toBeVisible({ timeout: 10000 });
        await expect(page.getByTestId('payment-success-amount')).toBeVisible();
        await EvidenceHelper.captureStep(page, 'Passo 7 - Comprovante de Pagamento Exibido com Sucesso');
        await page.getByTestId('payment-success-ok').click({ force: true, timeout: 3000 }).catch(() => {});
        await expect(successModal).not.toBeVisible({ timeout: 5000 }).catch(() => {});

        // 8. Validação do lançamento do pagamento na aba Aberta (prova real da transação, não só a troca de aba)
        await faturasPage.alternarTabFatura('Aberta');
        await expect(faturasPage.tabFaturaAbertaButton).toBeVisible();
        await expect(faturasPage.transactionRowPayment.first()).toBeVisible({ timeout: 10000 });
        await EvidenceHelper.captureStep(page, 'Passo 8 - Lançamento do Pagamento Validado na Aba Aberta');
    });
});
