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
     * Digita o PIN no modal de teclado de segurança (comum em Pix e Faturas) e
     * FINALIZA clicando no botão de confirmação do modal — o app NÃO efetiva a
     * operação só com a digitação.
     * @param pin PIN a ser digitado. Padrão: 9898
     */
    async digitarPin(pin: string = '9898'): Promise<void> {
        // Popups automáticos (como Saúde Financeira) podem abrir NO MEIO da digitação.
        // Fechar antes de digitar e de novo antes de cada tentativa de finalizar.
        await this.popups.fecharModaisSeVisiveis();

        // Respiro pra transição/animação de entrada do modal de PIN terminar
        await this.page.waitForTimeout(800);

        // Escopo do modal de PIN: o CARD que contém o heading E o teclado (botão "1").
        // Escopar só por heading com .last() pegava o div mais interno que contém o
        // título (wrapper do cabeçalho), que NÃO contém o botão de finalizar — o lookup
        // do "Confirmar" falhava em silêncio e o modal ficava aberto com o botão verde
        // habilitado (falha ao vivo CT03.1 em 19/09/2026). Definido ANTES dos dígitos
        // porque o modal pode sumir já no 4º dígito (auto-submit legado do Pix).
        const modalPin = this.page
            .locator('div', {
                has: this.page.getByRole('heading', {
                    name: /Confirmar Pagamento|Digite a senha do cartão|Confirme o seu PIN/i,
                }),
            })
            .filter({ has: this.page.getByRole('button', { name: '1', exact: true }) })
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

        // FINALIZAÇÃO OBRIGATÓRIA: digitar o PIN não basta — é preciso clicar no botão
        // de finalizar do modal ("Confirmar"; "Continuar" em variantes da UI) para
        // efetivar a operação (pagamento de fatura, Pix). Válido pra TODO fluxo que usa
        // o popup de PIN. Dois desfechos aceitos, nesta ordem:
        //   1) auto-submit legado: o modal fecha sozinho ao digitar o último dígito →
        //      nada a clicar (detecção: card do modal some);
        //   2) botão habilita após o último dígito → clicar UMA vez, DENTRO do escopo do
        //      modal (nunca clique cego em escopo de página — causou double-submit real
        //      no CT03.3: débito 2 × R$ 3.667,39).
        // Regex com âncoras + /i: aceita "Confirmar" e "CONFIRMAR" (accessible name muda
        // de caixa entre estados), mas não pega "Confirmar Pagamento" (botão legado de
        // outra modal) nem "Confirmar Envio" (Pix).
        const finalizarBtn = modalPin.getByRole('button', { name: /^(Confirmar|Continuar)$/i });
        let tentouFinalizar = false;
        let clicouFinalizar = false;
        for (let i = 0; i < 6 && !clicouFinalizar; i++) {
            // Popups automáticos (Saúde Financeira etc.) podem abrir NO MEIO da digitação
            // e interceptar o clique de finalização — fechar antes de cada tentativa
            // (mesma guarda da digitação, no início do método).
            await this.popups.fecharModaisSeVisiveis();

            // Modal já fechou sozinho (auto-submit legado) → nada a clicar
            if (!(await modalPin.isVisible().catch(() => false))) break;

            if (await finalizarBtn.first().isVisible().catch(() => false)) {
                tentouFinalizar = true;
                // Um ÚNICO clique: se falhar (sobreposição/desabilitado), NÃO re-tentar
                // aqui — o loop de fechamento abaixo falha com causa explícita. O click
                // do Playwright já espera actionability (habilitado) antes de disparar.
                await finalizarBtn
                    .first()
                    .click({ timeout: 5000 })
                    .then(() => { clicouFinalizar = true; })
                    .catch(() => {});
                break;
            }
            await this.page.waitForTimeout(500);
        }

        // Espera o modal fechar — NO MÁXIMO UM clique, NUNCA re-clique. O "modal aberto"
        // é ambíguo entre clique perdido e servidor processando: re-clicar durante o
        // processamento do 1º pagamento duplica o débito (prova ao vivo 22:50: limite
        // +1000 = 2×500, banco debitou duplo). Se não fechar em 60s, falha com causa
        // explícita — pagamento não efetivado é recuperável; débito duplicado não.
        // Limite subiu de 30s->60s em 2026-09-21: o loop de polling que travava o
        // pay() foi corrigido (FintechBankApp WEB/components/Dashboard.tsx), mas o
        // enrichUserCreditCardData no fim do pay() ainda pode passar de 30s sob carga
        // (volume de dados de teste acumulado), então a folga evita falso negativo.
        for (let i = 0; i < 120; i++) {
            if (!(await modalPin.isVisible().catch(() => false))) {
                await EvidenceHelper.captureStep(this.page, 'PIN digitado');
                return;
            }
            await this.page.waitForTimeout(500);
        }
        const estadoFinalizar = clicouFinalizar
            ? 'o botão de finalizar foi clicado (1×) e o modal permaneceu aberto'
            : tentouFinalizar
                ? 'o clique no botão de finalizar não foi efetivado (interceptado ou desabilitado)'
                : 'o botão de finalizar nunca ficou visível dentro do modal';
        throw new Error(
            `[PIN] Modal de PIN não fechou 60s após digitar o PIN: ${estadoFinalizar}. ` +
            'Possível processamento travado ou recusa sem alerta visível. ' +
            'NÃO re-clicar Confirmar (risco de pagamento duplicado) — investigue o estado no banco antes de reexecutar.'
        );
    }
}
