import { expect, Page } from "@playwright/test";
import { PopupsComponent } from "./PopupsComponent";
import { EvidenceHelper } from "../../utils/EvidenceHelper";

export class PinModalComponent {
    private readonly page: Page;
    private readonly popups: PopupsComponent;

    constructor(page: Page) {
        this.page = page;
        this.popups = new PopupsComponent(page);
    }

    /**
     * Digita o PIN no modal de teclado de segurança (comum em Pix e Faturas).
     * @param pin PIN a ser digitado. Padrão: 9898
     */
    async digitarPin(pin: string = '9898'): Promise<void> {
        // Popups automáticos (como Saúde Financeira) podem abrir NO MEIO da digitação.
        // Fechar antes de digitar e de novo antes de cada tentativa de Confirmar.
        await this.popups.fecharModaisSeVisiveis();

        // Respiro pra transição/animação de entrada do modal de PIN terminar
        await this.page.waitForTimeout(800);

        // Escopo do modal de PIN (div que contém o heading — mesmo padrão do
        // PixPage.locator('div', { has: heading })). Definido ANTES dos dígitos porque
        // o modal pode sumir já no 4º dígito (auto-submit do fluxo de Faturas).
        const modalPin = this.page
            .locator('div', { has: this.page.getByRole('heading', { name: /Confirmar Pagamento|Digite a senha do cartão/i }) })
            .last();

        for (const digito of pin.split('')) {
            const numBtn = this.page.getByRole('button', { name: digito, exact: true }).first();
            await expect(numBtn).toBeVisible({ timeout: 5000 });
            
            // Timeout maior que o padrão pois o teclado numérico pode desmontar/remontar
            await numBtn.click({ timeout: 15000 });
            
            // Respiro ENTRE dígitos para evitar falhas durante a transição do re-render React
            await this.page.waitForTimeout(400);
        }
        await this.page.waitForTimeout(300);

        // MODOS DE SUBMISSÃO (duas UIs em campo):
        // 1) AUTO-SUBMIT (fluxo de Faturas atual): o 4º dígito envia o pagamento
        //    sozinho — o modal de PIN some e vira o de sucesso ("Pagamento realizado
        //    com sucesso!"). Prova ao vivo 22:35: sucesso de R$ 500,00 já na tela
        //    enquanto o teste procurava o botão "Confirmar" que não existia mais.
        // 2) LEGADO: precisa clicar em "Confirmar" dentro do modal de PIN.
        // Só procura "Confirmar" se o modal de PIN AINDA estiver aberto — e sempre
        // ESCOPADO ao modal, nunca clique cego em escopo de página (causou
        // double-submit real no CT03.3 de 22:19: débito 2 × R$ 3.667,39).
        const modalAindaAberto = await modalPin.isVisible().catch(() => false);
        let clicouConfirmar = false;
        if (modalAindaAberto) {
            const confirmarBtn = modalPin.getByRole('button', { name: 'Confirmar', exact: true });
            if (await confirmarBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                await this.popups.fecharModaisSeVisiveis();
                await confirmarBtn.click({ timeout: 5000 });
                clicouConfirmar = true;
            }
        }

        // Espera o modal fechar — NO MÁXIMO UM clique, NUNCA re-clique. O "modal aberto"
        // é ambíguo entre clique perdido e servidor processando: re-clicar durante o
        // processamento do 1º pagamento duplica o débito (prova ao vivo 22:50: limite
        // +1000 = 2×500, banco debitou duplo). Se não fechar em 30s, falha com causa
        // explícita — pagamento não efetivado é recuperável; débito duplicado não.
        for (let i = 0; i < 60; i++) {
            if (!(await modalPin.isVisible().catch(() => false))) {
                await EvidenceHelper.captureStep(this.page, 'PIN digitado');
                return;
            }
            await this.page.waitForTimeout(500);
        }
        throw new Error(
            `[PIN] Modal de PIN não fechou 30s após ${clicouConfirmar ? 'clicar em Confirmar' : 'digitar o PIN (auto-submit esperado)'}. ` +
            'Possível processamento travado ou recusa sem alerta visível. NÃO re-clicar Confirmar (risco de pagamento duplicado) — investigue o estado no banco antes de reexecutar.'
        );

        await EvidenceHelper.captureStep(this.page, 'PIN digitado');
    }
}
