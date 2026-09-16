import { createBdd } from 'playwright-bdd';
import { readExcelSheet } from '../utils/excelReader';
import { test } from '../../fixtures/testFixture';
import { PinModalComponent } from '../pages/components/PinModalComponent';
import { logger } from '../utils/logger';

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
When('eu capturo os valores das faturas antes do pagamento', async ({ faturasPage, faturasApiState }) => {
    const totais = await faturasPage.lerTotaisFaturas();
    faturasApiState.totalAntes = totais.fechada;
    faturasApiState.faturaFechadaReal = totais.fechada;
    faturasApiState.limiteDisponivelAntes = await faturasPage.lerLimiteDisponivel();
    logger.info(`📌 Fatura fechada ANTES (UI): R$ ${totais.fechada.toFixed(2)} | Fatura aberta (contexto, não entra no cálculo): R$ ${totais.aberta.toFixed(2)}`);
    logger.info(`📌 Limite Disponível ANTES (UI): R$ ${faturasApiState.limiteDisponivelAntes.toFixed(2)}`);
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
        let esperado: number | null = null;
        if (faturasApiState.formaPagamento === 'total') {
            esperado = faturasApiState.faturaFechadaReal;
        } else if (faturasApiState.formaPagamento === 'minimo') {
            esperado = faturasApiState.faturaFechadaReal * 0.1;
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

// Semântica por forma de pagamento (a feature usa o MESMO step nas 5 formas):
//   Total  → a fatura fechada cai (zera/badge Paga) — prova pelo card.
//   Mínimo/Parcial/Menor/Maior → a fatura NÃO zera e o card "Valor Total da Fatura
//   Fechada" continua com o total original (o app não expõe o residual em card —
//   InvoiceView.getSubTabAmount retorna closedInvoice). A baixa é provada pelo
//   Limite Disponível, que sobe EXATAMENTE o valor pago (confirmado no banco CT03.2:
//   13.273,43 → 13.660,52 = +R$ 387,09).
Then('devo ver o total das faturas diminuído após o pagamento', async ({ faturasPage, faturasApiState }) => {
    if (faturasApiState.totalAntes === null) {
        throw new Error('Total antes do pagamento não foi capturado — rode o step "eu capturo os valores das faturas antes do pagamento" antes.');
    }
    if (faturasApiState.formaPagamento === 'total') {
        // Fecha o modal de sucesso pós-PIN (cobre os cards), relê a fatura fechada na UI e
        // falha se o valor não caiu — comparação real contra o valor capturado antes.
        const fechadaDepois = await faturasPage.validarFaturaFechadaMenor(faturasApiState.totalAntes);
        logger.info(`🔎 Cruzamento: fatura fechada antes R$ ${faturasApiState.totalAntes.toFixed(2)} → depois (UI) R$ ${fechadaDepois.toFixed(2)}`);
    } else {
        // Pagamento parcial: prova pela elevação EXATA do Limite Disponível.
        const valorPago = faturasApiState.valorPagoEfetivo ?? faturasApiState.valorCustomizado ?? (faturasApiState.faturaFechadaReal ?? 0) * 0.1;
        if (faturasApiState.limiteDisponivelAntes === null) {
            throw new Error('Limite Disponível antes do pagamento não foi capturado — rode o step "eu capturo os valores das faturas antes do pagamento" antes.');
        }
        const limiteDepois = await faturasPage.validarPagamentoParcialEfetivado(valorPago, faturasApiState.limiteDisponivelAntes);
        logger.info(`🔎 Cruzamento (parcial): pago R$ ${valorPago.toFixed(2)} → Limite Disponível antes R$ ${faturasApiState.limiteDisponivelAntes.toFixed(2)} → depois (UI) R$ ${limiteDepois.toFixed(2)}`);
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
    const idCenario = testData.ID_CENARIO;
    const tblFatura = readExcelSheet<any>('TBL_FATURA');
    const linha = tblFatura.find((row) => row.ID_CENARIO === idCenario);
    if (!linha) {
        throw new Error(`Linha com ID_CENARIO='${idCenario}' não encontrada na aba TBL_FATURA.`);
    }
    
    // As colunas podem ser 'fat_parcial', 'fat_min', etc.
    const valor = String(linha[coluna]);
    if (!valor || valor === 'undefined') {
        throw new Error(`Coluna '${coluna}' não encontrada ou vazia para o cenário '${idCenario}' na aba TBL_FATURA.`);
    }
    
    await faturasPage.preencherValorCustomizado(valor);
    // Valor customizado (Parcial/Menor/Maior) substitui o alvo do guard do PIN.
    faturasApiState.valorCustomizado = Number(valor.replace(',', '.'));
});

Then('devo ver o pagamento de {string} em Ver Lançamentos na Fatura Aberta', async ({ faturasPage, faturasApiState }, tipoPgto: string) => {
    await faturasPage.selecionarTabFatura('Aberta');
    // Normaliza acentos ANTES do includes: "Mínimo".toLowerCase() contém "mín", não
    // "min" — sem isso caía no 'parcial' e procurava o lançamento errado (falha ao
    // vivo 2026-09-15 21:28). Mesma armadilha do mapeamento de formas acima.
    const tipoSemAcento = tipoPgto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const tipoGherkin = tipoSemAcento.includes('total') ? 'total' : tipoSemAcento.includes('min') ? 'minimo' : 'parcial';

    // Regra REAL do rótulo (API do app, invoiceController:739): o tipo gravado depende
    // do VALOR pago, não da intenção do usuário — personalizado >= mínimo (10% da
    // fatura) é gravado como MINIMO; só < mínimo é PARCIAL. Prova ao vivo 22:43:
    // pagamento personalizado de R$ 500 saiu como "Pagamento fatura (Mínimo)".
    let tipoEsperado = tipoGherkin;
    if (tipoGherkin === 'parcial' && faturasApiState.valorPagoEfetivo !== null && faturasApiState.faturaFechadaReal !== null) {
        tipoEsperado = faturasApiState.valorPagoEfetivo >= faturasApiState.faturaFechadaReal * 0.1 ? 'minimo' : 'parcial';
    }
    logger.info(`🔎 Lançamento esperado: Gherkin "${tipoPgto}" → rótulo real do app: "${tipoEsperado}"`);

    await faturasPage.abrirLancamentosFatura();
    await faturasPage.validarTransacaoPagamentoNoExtrato(tipoEsperado);
});

