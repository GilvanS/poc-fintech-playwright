import { createBdd } from 'playwright-bdd';
import { test, expect } from '../../fixtures/testFixture';
import { PinModalComponent } from '../pages/components/PinModalComponent';
import { calcularMinimoFatura, truncar4 } from '../utils/moeda';
import { logger } from '../utils/logger';

// ── Cenário @CT03.7 (guarda de idempotência, bug CT03.2 2026-09) ──
// Helpers de API (:3001) usados pela injeção do "pagamento original" e pelos asserts
// de não-débito. Login/GET /users seguem o mesmo padrão dos steps de captura acima —
// sem fallback silencioso: falha de API é erro do cenário, nunca valor chutado.
const API_BASE = 'http://localhost:3001';

/** Login na API da massa (CPF/senha no faturasApiState, capturados no step de captura). */
async function loginApiFaturas(
    page: import('@playwright/test').Page,
    state: import('../../fixtures/testFixture').FaturasApiState
): Promise<string> {
    if (!state.cpf || !state.senha) {
        throw new Error('CPF/senha não capturados — rode o step "eu capturo os valores das faturas antes do pagamento" antes da injeção via API.');
    }
    const resp = await page.request.post(`${API_BASE}/api/auth/login`, {
        data: { cpf: state.cpf, password: state.senha },
    });
    if (!resp.ok()) {
        throw new Error(`Login na API (:3001) falhou (${resp.status()}) no fluxo de reenvio.`);
    }
    const { token } = await resp.json();
    return token;
}

/** Estado da fatura fechada do usuário (residual derivado + nº de pagamentos). */
async function estadoFaturaFechada(
    page: import('@playwright/test').Page,
    token: string,
    state: import('../../fixtures/testFixture').FaturasApiState
): Promise<{ residual: number; qtdPagamentos: number }> {
    if (!state.cpf) {
        throw new Error('CPF não capturado — rode o step "eu capturo os valores das faturas antes do pagamento" antes.');
    }
    const resp = await page.request.get(`${API_BASE}/api/users/${state.cpf.replace(/\D/g, '')}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok()) {
        throw new Error(`GET /users falhou (${resp.status()}) no fluxo de reenvio.`);
    }
    const { user } = await resp.json();
    const residual = Number(user?.creditCard?.closedInvoiceResidual ?? NaN);
    if (!Number.isFinite(residual)) {
        throw new Error('closedInvoiceResidual ausente/inválido no payload — não dá para provar a não-dupla-cobrança.');
    }
    const qtdPagamentos = Array.isArray(user?.creditCard?.paymentHistory) ? user.creditCard.paymentHistory.length : 0;
    return { residual, qtdPagamentos };
}

const { When, Then } = createBdd(test);

// Os steps do Background ("que acesso a landing page", "eu realizo login com o CPF e
// senha do cenário" e "o dashboard está inicializado") já estão registrados em
// login.steps.ts e dashboard.steps.ts — playwright-bdd descobre todos os step file de
// tests/steps/**/*.ts, então a feature FATURAS reaproveita o Background de login/
// dashboard sem duplicar nada. O timeout do teste é estendido no primeiro step
// (corpo do teste) — mesmo padrão do pix.steps.ts (o setTimeout em hook Before é
// ignorado pelo Playwright).

// Massa usada: TBL_CENARIOS linha CT03.x → CPF, SENHA (login via Background), PIN
// (coluna PIN, fallback '9898') e fatura_fechada (só CT03.2 valida por valor exato).
// Mesmo layout de massa do fluxo legado CT03.1 (pagamentoFatura.spec.ts).

/**
 * Formata valor numérico da massa (ex: '5211.23') para o padrão pt-BR da UI
 * (ex: '5.211,23'). Mesma regra do formatBRL do spec legado.
 */
function formatarValorFatura(valor: string | number | undefined): string {
    const num = Number(valor ?? 0);
    return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** PIN da massa: coluna PIN de TBL_CENARIOS com fallback fixo '9898' enquanto vazia. */
const PIN_FALLBACK = '9898';

// Mesmo padrão do fluxo de Pix (ver pix.steps.ts, "eu valido que o cliente tem saldo
// para enviar o Pix"): o total real da fatura vem da API, NÃO da planilha — cada
// execução altera o estado real da massa (compras/pagamentos anteriores), então
// fatura_fechada/fatura_aberta de TBL_CENARIOS fica defasada a partir da 2ª execução
// (mesmo motivo pelo qual o log real mostrou "Fatura Aberta: R$ 10.485,67" da massa,
// só de controle — nunca comparado com o banco). Captura o estado real ANTES de
// qualquer interação com a UI e falha cedo com erro explícito se a massa não tiver
// mais fatura em aberto (precondição do cenário), em vez de deixar o teste avançar
// e quebrar de forma confusa mais tarde na tela.
When('eu valido que a fatura pode ser paga', async ({ testData, faturasApiState }) => {
    // Timeout base do Playwright BDD
    test.setTimeout(180000);

    if (!testData) {
        throw new Error('Massa não encontrada em TBL_CENARIOS para o cenário de Faturas (tag @CTxx.x ausente ou linha inexistente).');
    }

    const cpf = testData.CPF;

    // O pagamento mira a FATURA FECHADA (em atraso) — valor EXPLÍCITO na coluna
    // fatura_fechada de TBL_CENARIOS. NÃO soma a fatura aberta: pagamento composto de
    // duas faturas é outro cenário. Sem cálculo indevido — segue o valor da coluna.
    const faturaFechadaPlanilha = Number(testData.fatura_fechada ?? 0);

    if (faturaFechadaPlanilha <= 0) {
        throw new Error(`[Fatura já quitada] CPF ${cpf} não tem fatura fechada pra pagar (coluna fatura_fechada = ${faturaFechadaPlanilha}) — massa inconsistente para este cenário, escolha outra em TBL_CENARIOS.`);
    }

    // Salva o estado usando exclusivamente o valor da coluna fatura_fechada (planilha)
    faturasApiState.totalAntes = faturaFechadaPlanilha;
    faturasApiState.faturaFechadaReal = faturaFechadaPlanilha;

    logger.info(`📌 Fatura a pagar (fechada/em atraso): R$ ${faturaFechadaPlanilha.toFixed(2).replace('.', ',')} (Lido da coluna fatura_fechada)`);
});

When('eu navego para a tela de Faturas pelo dashboard', async ({ faturasPage }) => {
    test.setTimeout(180000);
    await faturasPage.navegarParaFaturas();
});

Then('eu valido que a tela de Faturas carregou com o histórico de parcelamento', async ({ faturasPage }) => {
    await faturasPage.validarTelaFaturasCarregada();
});

// Referência de comparação = valor da FATURA FECHADA lido da UI (a fatura que será
// paga). A aberta é registrada só como contexto de log — não entra em nenhum cálculo.
// Limite Disponível também capturado: no pagamento PARCIAL (Mínimo/Parcial/Menor/Maior)
// a fatura não zera e o card continua com o total original — a baixa aparece no Limite.
When('eu capturo os valores das faturas antes do pagamento', async ({ page, testData, faturasPage, faturasApiState }) => {
    const totais = await faturasPage.lerTotaisFaturas();
    faturasApiState.totalAntes = totais.fechada;
    faturasApiState.faturaFechadaReal = totais.fechada;
    faturasApiState.aberturaAntes = totais.aberta;
    faturasApiState.limiteDisponivelAntes = await faturasPage.lerLimiteDisponivel();
    logger.info(`📌 Fatura fechada ANTES (UI): R$ ${totais.fechada.toFixed(2)} | Fatura aberta ANTES (UI): R$ ${totais.aberta.toFixed(2)}`);
    logger.info(`📌 Limite Disponível ANTES (UI): R$ ${faturasApiState.limiteDisponivelAntes.toFixed(2)}`);

    // Dívida derivada da fatura fechada (cascata, mais antiga primeiro) vem da API —
    // é o SALDO REALMENTE DEVIDO (closedInvoiceResidual), que o card da fechada não
    // mostra (imutável, mostra o original por regra de negócio). Capturada ANTES do
    // pagamento pra o Then final assertar a queda exata do débito — sem isso, um
    // descarte silencioso da idempotência passava como sucesso (bug CT03.2 2026-09:
    // 2 de 8 pagamentos sem débito, teste passando igual).
    if (testData) {
        const cpfLimpo = testData.CPF.replace(/\D/g, '');
        const loginResp = await page.request.post('http://localhost:3001/api/auth/login', {
            data: { cpf: testData.CPF, password: testData.SENHA },
        });
        if (loginResp.ok()) {
            const { token } = await loginResp.json();
            const userResp = await page.request.get(`http://localhost:3001/api/users/${cpfLimpo}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (userResp.ok()) {
                const { user } = await userResp.json();
                const residual = Number(user?.creditCard?.closedInvoiceResidual ?? NaN);
                if (Number.isFinite(residual)) {
                    faturasApiState.dividaFechadaAntes = residual;
                    faturasApiState.cpf = testData.CPF;
                    faturasApiState.senha = testData.SENHA;
                    logger.info(`📌 Dívida FECHADA derivada ANTES (API, closedInvoiceResidual): R$ ${residual.toFixed(2)}`);
                } else {
                    console.warn('[Faturas] closedInvoiceResidual ausente/inválido no payload da API — assert de dívida derivada será pulado.');
                    logger.warn('⚠️ closedInvoiceResidual ausente no payload — assert de dívida derivada pulado (sem fallback silencioso de valor).');
                }
            } else {
                console.warn(`[Faturas] GET /users/${cpfLimpo} falhou (${userResp.status()}) — assert de dívida derivada será pulado.`);
            }
        } else {
            console.warn(`[Faturas] Login da massa ${testData.ID_CENARIO} falhou (${loginResp.status()}) — assert de dívida derivada será pulado.`);
        }
    }
});

// Comparação por DÍGITOS: dígitos puros ficam imunes a separadores e ao espaço
// não-quebrável entre "R$" e o número (mesmo cuidado do validarCardSaldo do Pix).
// Valor vem de faturasApiState.faturaFechadaReal (API, capturado no step "eu valido
// que a fatura pode ser paga"), NÃO da coluna fatura_fechada de TBL_CENARIOS — essa
// coluna é o valor de quando a massa foi criada; se a fatura já foi paga numa
// execução anterior deste mesmo teste, o valor real no banco é outro (mesmo
// problema que o pixSaldoState resolve pro saldo do Pix).
Then('eu valido a fatura fechada com o valor da massa', async ({ faturasPage, faturasApiState }) => {
    if (faturasApiState.faturaFechadaReal === null) {
        throw new Error('Fatura fechada real não foi capturada — rode o step "eu valido que a fatura pode ser paga" antes.');
    }
    const valorEsperado = formatarValorFatura(faturasApiState.faturaFechadaReal);
    logger.info(`🧾 Fatura fechada REAL (API): R$ ${valorEsperado}`);
    await faturasPage.validarFaturaFechada(`R$ ${valorEsperado}`);
});


When('eu inicio o pagamento da fatura', async ({ faturasPage }) => {
    await faturasPage.abrirPagamentoFatura();
});

// Mapeia o texto do Gherkin pro botão do modal "Como deseja pagar?". Famílias:
//   'total'                          → preset "Pagar Total"
//   'mínimo' / 'Mínimo (10%)'        → preset "Pagar Mínimo (10%)"
//   'parcial'                        → "Valor Personalizado" — compartilhado por
//     "Parcial", "Menor que o mínimo" e "Maior que o mínimo" (CT03.3/03.4/03.5),
//     que abrem a MESMA tela de valor livre (padrão da família no app).
When('eu seleciono a forma de pagamento {string}', async ({ faturasPage, faturasApiState }, forma: string) => {
    const opcao = forma.trim().toLowerCase();
    let tipo: 'total' | 'minimo' | 'parcial';
    if (opcao === 'total') {
        tipo = 'total';
    } else if (opcao === 'mínimo' || opcao === 'minimo' || opcao === 'mínimo (10%)' || opcao === 'minimo (10%)') {
        tipo = 'minimo';
    } else if (opcao === 'parcial' || opcao.includes('menor') || opcao.includes('maior')) {
        tipo = 'parcial';
    } else {
        throw new Error(`Forma de pagamento não suportada: "${forma}". Use "Total", "Mínimo", "Parcial", "Menor que o mínimo" ou "Maior que o mínimo".`);
    }
    // Guard de alvo no modal de PIN precisa saber a forma: "Total" exibe o valor da
    // fatura, "Mínimo" exibe 10% dela (prova ao vivo: R$ 387,09 = 10% de R$ 3.870,86).
    faturasApiState.formaPagamento = tipo;
    await faturasPage.selecionarOpcaoPagamento(tipo);
});

When('eu preencho o valor personalizado com {string}', async ({ faturasApiState, faturasPage }, valor: string) => {
    // Mesmo formato aceito pelo codegen ('4000.00') — a UI normaliza pra R$ 4.000,00.
    await faturasPage.preencherValorCustomizado(valor);
    // Valor customizado (Parcial/Menor/Maior) substitui o alvo do guard do PIN.
    faturasApiState.valorCustomizado = Number(String(valor).replace(',', '.'));
    logger.info(`💳 Valor personalizado do pagamento: ${valor}`);
});

When('eu confirmo a forma de pagamento escolhida', async ({ faturasPage }) => {
    await faturasPage.confirmarFormaPagamento();
});

// PIN vem da coluna PIN de TBL_CENARIOS (fallback '9898' enquanto vazia — mesmo
// fallback do fluxo de Pix). Dígito a dígito, nunca confiar no atalho "Auto" do
// teclado (mock hardcoded) — mesmo cuidado do fluxo legado.
When('eu digito o PIN da massa no teclado da confirmação', async ({ page, faturasPage, faturasApiState, testData }) => {
    if (!testData) {
        throw new Error('Massa não encontrada em TBL_CENARIOS para o cenário de Faturas.');
    }
    const pin = String(testData.PIN ?? '').trim() || PIN_FALLBACK;
    logger.info(`🔐 PIN usado no pagamento da fatura: ${pin}`);

    // Cruzamento de alvo: o modal de PIN exibe o valor que será pago, que DEPENDE da
    // forma escolhida — Total = fatura fechada inteira; Mínimo = 10% dela (prova ao vivo
    // 2026-09-15: R$ 387,09); Parcial/Menor/Maior = valor personalizado preenchido.
    // Divergência (ex: app abriu o pagamento da fatura ABERTA por estar em outra tab)
    // falha em segundos com causa explícita em vez de travar no PIN.
    if (faturasApiState.faturaFechadaReal !== null) {
        const valorNoModal = await faturasPage.lerValorModalPin();
        if (valorNoModal === null) {
            // Doutrina anti-fallback-silencioso (CLAUDE.md): sem o valor do modal o guard
            // de alvo fica INOPERANTE — avisar, não passar em silêncio (um pagamento
            // aberto pra fatura/valor errado só seria descoberto lá na frente, nas
            // validações pós-PIN).
            logger.warn('⚠️ [PIN] Valor do pagamento ("...confirmar o pagamento de R$ X.") não ficou visível no modal de PIN em 3s — guard de alvo pulado. Se o alvo estiver errado, a falha só aparecerá nas validações pós-PIN.');
        }
        let esperado: number | null = null;
        if (faturasApiState.formaPagamento === 'total') {
            esperado = faturasApiState.faturaFechadaReal;
        } else if (faturasApiState.formaPagamento === 'minimo') {
            // 10% com a regra da fintech: TRUNCADO em 4 casas, nunca arredondado.
            // A UI RENDERIZA o preset com 2 casas (toLocaleString arredonda o que
            // exibe — ex: 423,505 truncado → "R$ 423,50"), então a comparação aqui
            // continua com tolerância de exibição (R$ 0,011). O valor EFETIVADO
            // (crédito no Limite) é o truncado — validado no step pós-pagamento.
            esperado = calcularMinimoFatura(faturasApiState.faturaFechadaReal);
        } else if (faturasApiState.valorCustomizado !== null) {
            esperado = faturasApiState.valorCustomizado;
        }
        if (valorNoModal !== null && esperado !== null && Math.abs(valorNoModal - esperado) > 0.011) {
            throw new Error(
                `[Alvo errado] O modal de PIN exibe pagamento de R$ ${valorNoModal.toFixed(2)}, mas o esperado para a forma "${faturasApiState.formaPagamento ?? '?'}" é R$ ${esperado.toFixed(2)}. ` +
                `O pagamento foi aberto para a fatura/valor errado — verifique a tab ativa.`
            );
        }
        // Guarda o valor EFETIVAMENTE pago (o que o modal confirmou) — é o que deve
        // subir no Limite Disponível no pagamento parcial.
        if (valorNoModal !== null) {
            faturasApiState.valorPagoEfetivo = valorNoModal;
        }
    }

    const pinModal = new PinModalComponent(page);
    await pinModal.digitarPin(pin);

    // Recusa do app ("Saldo insuficiente") deixa o modal de PIN aberto bloqueando tudo —
    // detecta em ~2s com causa clara em vez de gastar o timeout total (180s).
    await faturasPage.validarErroSaldoInsuficiente();
});

// ════════ Cenário @CT03.7 — guarda de idempotência do pagamento de fatura ════════
// Bug CT03.2 2026-09: o reenvio do mesmo pagamento (cpf+valor em <90s) era descartado
// pela API MAS a UI exibia o modal falso "Pagamento realizado com sucesso!" como se
// houvesse débito novo. Correção (PR #80): API responde idempotent/debitado:false e o
// WEB mostra toast informativo. Este cenário prova o fluxo completo de ponta a ponta.
//
// O "pagamento original" é INJETADO via API com o modal de PIN já aberto na UI —
// elimina a corrida da janela de 90s (o intervalo natural entre cliques da suíte fica
// em ~100s e nunca dispararia a guarda por si só).

When('eu injeto o pagamento original via API com o modal de PIN aberto', async ({ page, faturasApiState, testData }) => {
    test.setTimeout(180000);
    if (!testData) {
        throw new Error('Massa não encontrada em TBL_CENARIOS para o CT03.7 (reenvio).');
    }
    const pin = String(testData.PIN ?? '').trim() || PIN_FALLBACK;

    // Mínimo = 10% do TOTAL imutável da fechada (o mesmo alvo do preset da UI),
    // truncado em 4 casas — a injeção precisa ser EXATAMENTE o mesmo valor que a UI
    // vai pagar, senão a guarda não casa (cpf+valor).
    if (faturasApiState.faturaFechadaReal === null) {
        throw new Error('Fatura fechada real não foi capturada — rode o step "eu valido que a fatura pode ser paga" antes.');
    }
    const valorInjecao = calcularMinimoFatura(faturasApiState.faturaFechadaReal);

    // Estado ANTES: residual + nº de pagamentos (base dos asserts de não-débito).
    const tokenAntes = await loginApiFaturas(page, faturasApiState);
    const antes = await estadoFaturaFechada(page, tokenAntes, faturasApiState);
    faturasApiState.pagamentosAntesCount = antes.qtdPagamentos;

    // Injeção: débito REAL nº 1. A janela de 90s da guarda abre aqui.
    const tokenInj = await loginApiFaturas(page, faturasApiState);
    const injResp = await page.request.post(`${API_BASE}/api/cards/invoice/pay`, {
        headers: { Authorization: `Bearer ${tokenInj}` },
        data: { cpf: faturasApiState.cpf, pin, amount: valorInjecao },
    });
    const injBody = await injResp.json().catch(() => null);
    if (!injResp.ok() || !injBody?.success || injBody?.idempotent) {
        throw new Error(`Injeção do pagamento original via API falhou (${injResp.status()}): ${JSON.stringify(injBody).slice(0, 300)}`);
    }

    // Prova da injeção: residual caiu o valor injetado e o histórico cresceu 1.
    const tokenPos = await loginApiFaturas(page, faturasApiState);
    const posInjecao = await estadoFaturaFechada(page, tokenPos, faturasApiState);
    const queda = Math.round((antes.residual - posInjecao.residual) * 100) / 100;
    if (Math.abs(queda - valorInjecao) > 0.01 || posInjecao.qtdPagamentos !== antes.qtdPagamentos + 1) {
        throw new Error(
            `[Injeção incoerente] Residual R$ ${antes.residual.toFixed(2)} → R$ ${posInjecao.residual.toFixed(2)} (queda R$ ${queda.toFixed(2)}, esperado R$ ${valorInjecao.toFixed(2)}); ` +
            `pagamentos ${antes.qtdPagamentos} → ${posInjecao.qtdPagamentos} (esperado +1).`
        );
    }
    faturasApiState.dividaPosInjecao = posInjecao.residual;

    logger.info(`💉 Pagamento original injetado via API: R$ ${valorInjecao.toFixed(2)} debitado de verdade (residual R$ ${antes.residual.toFixed(2)} → R$ ${posInjecao.residual.toFixed(2)}; pagamentos ${antes.qtdPagamentos} → ${posInjecao.qtdPagamentos}) — janela de 90s ABERTA.`);
});

When('eu digito o PIN da massa para o reenvio do pagamento', async ({ page, faturasPage, faturasApiState, testData }) => {
    if (!testData) {
        throw new Error('Massa não encontrada em TBL_CENARIOS para o CT03.7 (reenvio).');
    }
    const pin = String(testData.PIN ?? '').trim() || PIN_FALLBACK;
    const pinModal = new PinModalComponent(page);
    // POST do reenvio chega 2–5s depois do da injeção — dentro da janela de 90s.
    await pinModal.digitarPin(pin);
    await faturasPage.validarErroSaldoInsuficiente();
    logger.info('🔁 Reenvio do pagamento enviado pela UI (2º POST, mesmo cpf+valor) — aguardando resposta da guarda.');
});

Then('devo ver o aviso de pagamento já processado sem débito novo', async ({ faturasPage }) => {
    // Imediatamente após o PIN: o toast some em ~8s.
    await faturasPage.validarToastReenvioIdempotente();
});

Then('o histórico de pagamentos cresce exatamente 1 desde a captura inicial', async ({ page, faturasApiState }) => {
    if (faturasApiState.pagamentosAntesCount === null) {
        throw new Error('Contagem inicial de pagamentos não foi capturada — rode o step de injeção primeiro.');
    }
    const tokenFim = await loginApiFaturas(page, faturasApiState);
    const fim = await estadoFaturaFechada(page, tokenFim, faturasApiState);

    // Só a INJEÇÃO debitou: histórico = antes + 1. Se a UI gravou 2ª tx, a guarda falhou.
    if (fim.qtdPagamentos !== faturasApiState.pagamentosAntesCount + 1) {
        throw new Error(
            `[Débito duplicado] Histórico de pagamentos: ${faturasApiState.pagamentosAntesCount} → ${fim.qtdPagamentos} (esperado +1, só a injeção). ` +
            'O reenvio da UI GEROU débito novo — a guarda de idempotência NÃO funcionou (regressão do bug CT03.2).'
        );
    }
    if (faturasApiState.dividaPosInjecao !== null && Math.abs(fim.residual - faturasApiState.dividaPosInjecao) > 0.01) {
        throw new Error(
            `[Débito duplicado] Residual pós-injeção R$ ${faturasApiState.dividaPosInjecao.toFixed(2)} → final R$ ${fim.residual.toFixed(2)} — o reenvio alterou a dívida sem gravar no histórico.`
        );
    }
    logger.info(`✅ Nenhuma transação nova do reenvio: pagamentos ${faturasApiState.pagamentosAntesCount} → ${fim.qtdPagamentos} (+1 = só a injeção); residual estável em R$ ${fim.residual.toFixed(2)}.`);
});

// Semântica por forma de pagamento (a feature usa o MESMO step nas 5 formas):
//   Total  → a fatura fechada cai (zera/badge Paga) — prova pelo card.
//   Mínimo/Parcial/Menor/Maior → a fatura NÃO zera e o card "Valor Total da Fatura
//   Fechada" continua com o total original (o app não expõe o residual em card —
//   InvoiceView.getSubTabAmount retorna closedInvoice). A baixa é provada pelo
//   Limite Disponível, que sobe EXATAMENTE o valor pago (confirmado no banco CT03.2:
//   13.273,43 → 13.660,52 = +R$ 387,09).
Then('devo ver o total das faturas diminuído após o pagamento', async ({ page, faturasPage, faturasApiState }) => {
    if (faturasApiState.totalAntes === null) {
        throw new Error('Total antes do pagamento não foi capturado — rode o step "eu capturo os valores das faturas antes do pagamento" antes.');
    }
    if (faturasApiState.formaPagamento === 'total') {
        if (faturasApiState.limiteDisponivelAntes === null) {
            throw new Error('Limite Disponível antes do pagamento não foi capturado — rode o step "eu capturo os valores das faturas antes do pagamento" antes.');
        }
        if (faturasApiState.aberturaAntes === null) {
            throw new Error('Fatura aberta antes do pagamento não foi capturada — rode o step "eu capturo os valores das faturas antes do pagamento" antes.');
        }
        // Fecha o modal de sucesso pós-PIN (cobre os cards) e cruza os 3 pontos reais da
        // UI: fatura fechada mantém o valor original (imutável, badge Paga), Limite
        // Disponível sobe exatamente o valor pago, Fatura Aberta não muda.
        const { fechadaDepois, limiteDepois, abertaDepois } = await faturasPage.validarPagamentoTotalEfetivado(
            faturasApiState.totalAntes,
            faturasApiState.limiteDisponivelAntes,
            faturasApiState.aberturaAntes
        );
        logger.info(
            `🔎 Cruzamento (total): fatura fechada mantém valor original R$ ${fechadaDepois.toFixed(2)} (imutável, badge Paga) | ` +
            `Limite Disponível antes R$ ${faturasApiState.limiteDisponivelAntes.toFixed(2)} → depois R$ ${limiteDepois.toFixed(2)} (+R$ ${faturasApiState.totalAntes.toFixed(2)}) | ` +
            `Fatura Aberta antes R$ ${faturasApiState.aberturaAntes.toFixed(2)} - pago R$ ${faturasApiState.totalAntes.toFixed(2)} → depois R$ ${abertaDepois.toFixed(2)} (consolidado sem a dívida quitada)`
        );
    } else {
        // Pagamento parcial: prova pela elevação EXATA do Limite Disponível.
        // Fallback do mínimo: 10% com regra da fintech (TRUNCADO em 4 casas — o
        // crédito no limite é o truncado, ex: 10% de 4.235,05 = 423,50, não 423,51).
        const valorPago = faturasApiState.valorPagoEfetivo ?? faturasApiState.valorCustomizado ?? calcularMinimoFatura(faturasApiState.faturaFechadaReal ?? 0);
        if (faturasApiState.limiteDisponivelAntes === null) {
            throw new Error('Limite Disponível antes do pagamento não foi capturado — rode o step "eu capturo os valores das faturas antes do pagamento" antes.');
        }
        const limiteDepois = await faturasPage.validarPagamentoParcialEfetivado(valorPago, faturasApiState.limiteDisponivelAntes);
        logger.info(`🔎 Cruzamento (parcial): pago R$ ${valorPago.toFixed(2)} → Limite Disponível antes R$ ${faturasApiState.limiteDisponivelAntes.toFixed(2)} → depois (UI) R$ ${limiteDepois.toFixed(2)}`);

        // ── Assert de dívida derivada (defeito CT03.2 2026-09: descarte silencioso) ──
        // O card da fatura fechada é imutável por regra de negócio (mostra o original);
        // a baixa real acontece no closedInvoiceResidual (cascata, mais antiga primeiro).
        // Se a dívida derivada NÃO caiu exatamente o valor pago, houve descarte
        // silencioso (idempotência) e o teste falha com causa explícita — em vez de
        // passar fingindo débito. Sem fallback de valor: sem captura antes, falha
        // pedindo pra rodar o step de captura (mesmo padrão dos outros asserts).
        if (faturasApiState.dividaFechadaAntes === null) {
            throw new Error('Dívida fechada derivada (closedInvoiceResidual) não foi capturada antes do pagamento — rode o step "eu capturo os valores das faturas antes do pagamento" com acesso à API (:3001).');
        }
        const cpfLimpo = faturasApiState.cpf ? String(faturasApiState.cpf).replace(/\D/g, '') : null;
        if (!cpfLimpo) {
            throw new Error('CPF da massa não está em faturasApiState — assert de dívida derivada não pode consultar a API.');
        }
        const loginRespDepois = await page.request.post('http://localhost:3001/api/auth/login', {
            data: { cpf: faturasApiState.cpf, password: faturasApiState.senha },
        });
        if (!loginRespDepois.ok()) {
            throw new Error(`Login na API (:3001) falhou (${loginRespDepois.status()}) ao validar a dívida derivada pós-pagamento.`);
        }
        const { token: tokenDepois } = await loginRespDepois.json();
        const userRespDepois = await page.request.get(`http://localhost:3001/api/users/${cpfLimpo}`, {
            headers: { Authorization: `Bearer ${tokenDepois}` },
        });
        if (!userRespDepois.ok()) {
            throw new Error(`GET /users/${cpfLimpo} falhou (${userRespDepois.status()}) ao validar a dívida derivada pós-pagamento.`); 
        }
        const { user: userDepois } = await userRespDepois.json();
        const dividaDepois = Number(userDepois?.creditCard?.closedInvoiceResidual ?? NaN);
        if (!Number.isFinite(dividaDepois)) {
            throw new Error('closedInvoiceResidual ausente/inválido no payload pós-pagamento — não dá pra provar a baixa da dívida.');
        }
        const quedaEsperada = Math.min(valorPago, faturasApiState.dividaFechadaAntes);
        const quedaReal = Math.round((faturasApiState.dividaFechadaAntes - dividaDepois) * 100) / 100;
        if (Math.abs(quedaReal - quedaEsperada) > 0.01) {
            throw new Error(
                `[Dívida não baixou o valor pago] Dívida fechada derivada: R$ ${faturasApiState.dividaFechadaAntes.toFixed(2)} → R$ ${dividaDepois.toFixed(2)} ` +
                `(queda R$ ${quedaReal.toFixed(2)}), esperado R$ ${quedaEsperada.toFixed(2)} (pago R$ ${valorPago.toFixed(2)}). ` +
                `Suspeita de descarte silencioso pela guarda de idempotência da API — confira transactions INVOICE_PAYMENT no banco e o stdout da API ([pay][idempotencia]).`
            );
        }
        logger.info(`✅ Dívida fechada derivada: R$ ${faturasApiState.dividaFechadaAntes.toFixed(2)} → R$ ${dividaDepois.toFixed(2)} (queda R$ ${quedaReal.toFixed(2)} = pago R$ ${valorPago.toFixed(2)})`);
    }
});

Then('devo ver que a fatura fechada ficou zerada', async ({ faturasPage }) => {
    await faturasPage.validarFaturaFechadaZerada();
});

Then('devo ver o pagamento em Ver Lançamentos na Fatura Aberta', async ({ faturasPage }) => {
    await faturasPage.validarPagamentoNosLancamentosDaFatura();
});

When('eu volto ao dashboard pela tela de Faturas', async ({ faturasPage }) => {
    await faturasPage.voltarAoDashboard();
});

// Validação de rótulos + presença de valores: os valores EXATOS dos cards dependem
// do estado do banco (pagamentos/pix anteriores), e a prova real do pagamento é a
// fatura recalculada + lançamento no extrato.
Then('devo ver os cards de Saldo, Próxima Fatura e Limite com valores', async ({ faturasPage }) => {
    await faturasPage.validarCardsDashboardPosPagamento();
});

When('eu abro o extrato pelo dashboard', async ({ faturasPage }) => {
    await faturasPage.abrirExtrato();
});

Then('devo ver o lançamento do pagamento de fatura no extrato', async ({ faturasPage }) => {
    await faturasPage.validarTransacaoPagamentoNoExtrato('total');
});

When('eu volto do extrato ao dashboard', async ({ faturasPage }) => {
    await faturasPage.voltarDoExtrato();
});


When('eu preencho o valor personalizado com o valor {string} da massa', async ({ faturasApiState, faturasPage, testData }, coluna: string) => {
    if (!testData) {
        throw new Error('Massa de cenário ausente');
    }
    // As colunas fat_* (fat_min, fat_parcial, fat_menor_min, fat_maior_min) vivem na
    // PRÓPRIA linha de TBL_CENARIOS — testData (fixture) já é essa linha. A aba
    // TBL_FATURA existe na planilha mas só tem ID_CENARIO/ID_MASSA/CPF (mais 2 linhas
    // órfãs sem ID_CENARIO): ler dela falhava SEMPRE para CT03.3–03.5 com "Coluna
    // 'fat_parcial' não encontrada ou vazia". Falha explícita (não silenciosa) se a
    // coluna sumir da linha de TBL_CENARIOS.
    const bruto = String(testData[coluna] ?? '').trim();
    if (!bruto || bruto === 'undefined') {
        throw new Error(`Coluna '${coluna}' não encontrada ou vazia na linha ${testData.ID_CENARIO} de TBL_CENARIOS (MassaDados.xlsx).`);
    }

    // Moeda tem só 2 casas decimais — o xlsx às vezes devolve o número com ruído de
    // ponto flutuante (ex: 457.17100000000005 em vez de 457.17, típico de fórmula
    // do Excel). TRUNCA em 4 casas (regra de cálculo da fintech — nunca arredonda)
    // ANTES de digitar: mata o ruído de float sem inventar centavos que a massa
    // não tem (o Math.round antigo podia ARREDONDAR pra cima um valor da massa).
    const valorNum = truncar4(Number(bruto.replace(',', '.')));
    if (Number.isNaN(valorNum)) {
        throw new Error(`Coluna '${coluna}' tem valor não-numérico ("${bruto}") na linha ${testData.ID_CENARIO} de TBL_CENARIOS.`);
    }
    const valor = valorNum.toFixed(2);

    await faturasPage.preencherValorCustomizado(valor);
    // Valor customizado (Parcial/Menor/Maior) substitui o alvo do guard do PIN.
    faturasApiState.valorCustomizado = valorNum;
    logger.info(`💳 Valor personalizado (${coluna}) do pagamento: ${valor}`);
});

Then('devo ver o pagamento de {string} em Ver Lançamentos na Fatura Aberta', async ({ faturasPage, faturasApiState }, tipoPgto: string) => {
    await faturasPage.selecionarTabFatura('Aberta');
    // Normaliza acentos ANTES do includes: "Mínimo".toLowerCase() contém "mín", não
    // "min" — sem isso caía no 'parcial' e procurava o lançamento errado (falha ao
    // vivo 2026-09-15 21:28). Mesma armadilha do mapeamento de formas acima.
    const tipoSemAcento = tipoPgto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const tipoGherkin = tipoSemAcento.includes('total') ? 'total' : tipoSemAcento.includes('min') ? 'minimo' : 'parcial';

    // Regra REAL do rótulo (API do app, invoiceController:739): o tipo gravado depende
    // do VALOR pago, não da intenção do usuário — personalizado >= mínimo é gravado
    // como MINIMO; só < mínimo é PARCIAL. O patamar do mínimo é o TRUNCADO em 4 casas
    // (regra de cálculo da fintech) — comparar contra o arredondado pode inverter o
    // rótulo quando o valor personalizado cai exatamente entre 10% e 10%+0,005.
    let tipoEsperado = tipoGherkin;
    if (tipoGherkin === 'parcial' && faturasApiState.valorPagoEfetivo !== null && faturasApiState.faturaFechadaReal !== null) {
        tipoEsperado = faturasApiState.valorPagoEfetivo >= calcularMinimoFatura(faturasApiState.faturaFechadaReal) ? 'minimo' : 'parcial';
    }
    logger.info(`🔎 Lançamento esperado: Gherkin "${tipoPgto}" → rótulo real do app: "${tipoEsperado}"`);

    await faturasPage.abrirLancamentosFatura();
    await faturasPage.validarTransacaoPagamentoNoExtrato(tipoEsperado);
});

