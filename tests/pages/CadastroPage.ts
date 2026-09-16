import { expect, Page, Locator } from "@playwright/test";
import { CadastroLocators } from "../locators/CadastroLocators";
import { logger } from "../utils/logger";

/**
 * CadastroPage - Page Object da tela de Cadastro.
 */
export class CadastroPage {
    readonly page: Page;
    readonly locators: CadastroLocators;

    constructor(page: Page) {
        this.page = page;
        this.locators = new CadastroLocators(page);
    }

    async preencherNomeCompleto(valor: string) {
        await this.locators.fullNameInput.fill(valor);
    }

    async preencherEmail(valor: string) {
        await this.locators.emailInput.fill(valor);
    }

    async preencherCpf(valor: string) {
        await this.locators.cpfInput.fill(valor);
    }

    async preencherSenha(valor: string) {
        await this.locators.passwordInput.fill(valor);
    }

    async preencherConfirmarSenha(valor: string) {
        await this.locators.confirmPasswordInput.fill(valor);
    }

    async preencherDataNascimento(valor: string) {
        if (await this.locators.birthDateInput.isVisible()) {
            await this.locators.birthDateInput.fill(valor);
        }
    }

    async preencherCelular(valor: string) {
        if (await this.locators.phoneInput.isVisible()) {
            await this.locators.phoneInput.fill(valor);
        }
    }

    async preencherCep(valor: string) {
        if (await this.locators.cepInput.isVisible()) {
            await this.locators.cepInput.fill(valor);
        }
    }

    async preencherLogradouro(valor: string) {
        if (await this.locators.streetInput.isVisible()) {
            await this.locators.streetInput.fill(valor);
        }
    }

    async preencherNumero(valor: string) {
        if (await this.locators.numberInput.isVisible()) {
            await this.locators.numberInput.fill(valor);
        }
    }

    async preencherCidade(valor: string) {
        if (await this.locators.cityInput.isVisible()) {
            await this.locators.cityInput.fill(valor);
        }
    }

    async preencherBairro(valor: string) {
        if (await this.locators.neighborhoodInput.isVisible()) {
            await this.locators.neighborhoodInput.fill(valor);
        }
    }

    async preencherUf(valor: string) {
        if (await this.locators.stateInput.isVisible()) {
            await this.locators.stateInput.fill(valor);
        }
    }

    async selecionarBandeira(valor: string) {
        if (await this.locators.cardBrandSelect.isVisible()) {
            await this.locators.cardBrandSelect.selectOption(valor.toUpperCase());
        }
    }

    async selecionarTier(valor: string) {
        if (await this.locators.cardTierSelect.isVisible()) {
            await this.locators.cardTierSelect.selectOption(valor.toUpperCase());
        }
    }

    async selecionarDiaVencimento(dia: string) {
        const dueBtn = this.page.getByRole('button', { name: `Dia ${dia}` });
        if (await dueBtn.isVisible()) {
            await dueBtn.click();
        }
    }

    async selecionarPlanoConta(plano: string) {
        const planText = plano === 'VIP_BLACK' ? 'VIP Black' : plano === 'PRO' ? 'Volt Pro' : 'Gratuito';
        const planBtn = this.page.getByRole('button', { name: new RegExp(planText, 'i') });
        if (await planBtn.isVisible()) {
            await planBtn.click();
        }
    }

    async preencherChavePix(valor: string) {
        if (await this.locators.pixKeyInput.isVisible()) {
            await this.locators.pixKeyInput.fill(valor);
        }
    }

    async clickSubmitButton() {
        await this.locators.submitButton.click();
    }

    /**
     * Valida a validação nativa do browser (atributo HTML `required`) quando o campo fica
     * vazio e o formulário é submetido — a tela de cadastro NÃO usa alert customizado
     * (diferente do login/LandingPage.alertHaveText): é `validity`/`validationMessage` do
     * próprio input, reportado só pro primeiro campo obrigatório vazio em ordem de DOM.
     * Checa `validity.valueMissing` (booleano) em vez do texto de `validationMessage`:
     * esse texto é gerado pelo browser no idioma/locale dele — Chrome pt-BR mostra
     * "Preencha este campo.", o Chromium do Playwright (locale padrão en-US) mostra
     * "Please fill out this field.", e Firefox/Edge têm textos próprios.
     */
    private async validarCampoObrigatorio(input: Locator): Promise<void> {
        const { valueMissing, mensagem } = await input.evaluate((el: HTMLInputElement) => ({
            valueMissing: el.validity.valueMissing,
            mensagem: el.validationMessage,
        }));
        logger.info(`⚠️ Validação nativa do campo: "${mensagem}"`);
        expect(valueMissing).toBe(true);
    }

    async validarCampoObrigatorioNomeCompleto(): Promise<void> {
        await this.validarCampoObrigatorio(this.locators.fullNameInput);
    }

    async validarCampoObrigatorioCpf(): Promise<void> {
        await this.validarCampoObrigatorio(this.locators.cpfInput);
    }

    async validarCampoObrigatorioEmail(): Promise<void> {
        await this.validarCampoObrigatorio(this.locators.emailInput);
    }

    async validarCampoObrigatorioSenha(): Promise<void> {
        await this.validarCampoObrigatorio(this.locators.passwordInput);
    }

    async validarCampoObrigatorioConfirmarSenha(): Promise<void> {
        await this.validarCampoObrigatorio(this.locators.confirmPasswordInput);
    }

    async validateModalContent(expectedName: string, expectedEmail: string, expectedCpf: string) {
        if (await this.locators.modalTitle.isVisible()) {
            await expect(this.locators.modalTitle).toBeVisible();
            await expect(this.locators.modalNameValue).toHaveText(expectedName);
            await expect(this.locators.modalEmailValue).toHaveText(expectedEmail);
            await expect(this.locators.modalCpfValue).toHaveText(expectedCpf);
        } else {
            // Em NewOnboardView, o sucesso redireciona para login (/login) ou mostra sucesso
            const toastError = this.page.getByTestId('toast-message')
                .or(this.page.getByTestId('toast-error'))
                .or(this.page.getByRole('alert'))
                .or(this.page.getByTestId('signup-error-message'));

            try {
                await expect(this.page).toHaveURL(/.*(login|dashboard)/, { timeout: 4000 });
            } catch (urlErr) {
                if (await toastError.first().isVisible()) {
                    const mensagemErroWeb = await toastError.first().innerText();
                    logger.error(`❌ Erro exibido no Web Onboarding: "${mensagemErroWeb.trim()}"`);
                    console.error(`\n❌ [ONBOARDING WEB] Erro exibido na tela: "${mensagemErroWeb.trim()}"\n`);
                    throw new Error(`O formulário de cadastro Web exibiu o erro: "${mensagemErroWeb.trim()}".`);
                }
                throw urlErr;
            }
        }
    }

    async closeSuccessModal() {
        if (await this.locators.modalCloseButton.isVisible()) {
            await this.locators.modalCloseButton.click();
            await expect(this.locators.modalOverlay).toBeHidden();
        }
    }
}
