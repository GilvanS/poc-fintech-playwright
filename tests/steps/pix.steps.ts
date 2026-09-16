import { createBdd } from 'playwright-bdd';
import { PinModalComponent } from "../pages/components/PinModalComponent";
import { test } from '../../fixtures/testFixture';
import { logger } from '../utils/logger';
import { formatarValorPix } from '../utils/massaPix';

const { Before, When, Then } = createBdd(test);

// O fluxo completo de Pix (Background de login+dashboard ≈ 35s + formulário, revisão,
// PIN, comprovante e extrato) não cabe no timeout padrão de 60s — em headless o teste
// morria no meio do comprovante do extrato por timeout do teste, não por falha real.
// O setTimeout fica no PRIMEIRO step (corpo do teste) e não num hook Before: dentro de
// hook do playwright-bdd (que roda como fixture) o Playwright ignora test.setTimeout.
Before({ tags: '@Pix' }, async ({ context }) => {
    // O comprovante do extrato tem o botão "Copiar" do ID da transação, que usa a
    // Clipboard API — em headless o Chromium nega clipboard-write por padrão, a UI
    // não exibe o toast de sucesso e a validação falha. Concede as permissões.
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
});

// Os steps do Background ("que acesso a landing page", "eu realizo login com o CPF e senha
// do cenário" e "o dashboard está inicializado") já estão registrados em login.steps.ts e
// dashboard.steps.ts — playwright-bdd descobre todos os step files de tests/steps/**/*.ts,
// então a feature PIX reaproveita o Background de login/dashboard sem duplicar nada.

// Nada mockado: chave (CPF do destinatário), valor, nome, mensagem e PIN vêm da planilha
// via fixture pixMassa (ver fixtures/testFixture.ts e utils/massaPix.ts):
//   TBL_CENARIOS/CT02.x          → CPF do remetente, "Valor PIX", MENSAGEM e PIN
//   TBL_USUARIOS_SECUNDARIOS     → CPF de quem recebe (linha do mesmo ID_CENARIO)
//   TBL_USUARIOS                 → Nome Completo do remetente (correlação por CPF)
//   TBL_MASSA_CADASTRADA/CADASTRO→ NOME_COMPLETO do destinatário (join por CPF)
// MENSAGEM/PIN têm fallback fixo ('teste'/'9898') enquanto as colunas estiverem vazias
// na planilha — quando você preencher, o valor da planilha vence automaticamente.

/**
 * Formata um valor numérico/decimal da massa (ex: '17000.00') para o padrão exibido na
 * UI (ex: 'R$ 17.000,00'). Mesma regra do formatBRL usado no pagamentoFatura.spec.ts.
 */
function formatBRL(value: string | number | undefined): string {
    const num = Number(value ?? 0);
    return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

When('eu valido que o cliente tem saldo para enviar o Pix', async ({ page, testData, pixMassa, pixSaldoState, $testInfo }) => {
    // Timeout do teste estendido aqui (corpo do teste) — ver comentário no Before acima.
    test.setTimeout(180000);
    if (!testData) {
        throw new Error('Massa não encontrada em TBL_CENARIOS para o cenário de Pix (tag @CTxx.x ausente ou linha inexistente).');
    }
    if (!pixMassa) {
        throw new Error('Massa de Pix não carregada — verifique a linha do cenário em TBL_CENARIOS/TBL_USUARIOS (ver utils/massaPix.ts).');
    }
    // O saldo REAL vem da API: cada execução de Pix envia dinheiro de verdade, então o
    // valor na planilha (saldo_conta) fica defasado — é coluna de CONTROLE do analista,
    // nunca comparada com o banco aqui.
    const cpfLimpo = testData.CPF.replace(/\D/g, '');
    const loginResp = await page.request.post('http://localhost:3001/api/auth/login', {
        data: { cpf: testData.CPF, password: testData.SENHA },
    });
    if (!loginResp.ok()) {
        throw new Error(`[Health Check] Login da massa ${testData.ID_CENARIO} falhou (CPF ${cpfLimpo}): ${await loginResp.text()}`);
    }
    const { token } = await loginResp.json();
    const userResp = await page.request.get(`http://localhost:3001/api/users/${cpfLimpo}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    const { user } = await userResp.json();
    const saldoReal = Number(user?.balance ?? 0);

    // Dois tipos de cenário NEGATIVO (tag @Negativo OU coluna RESULTADO=BLOQUEAR em
    // TBL_CENARIOS — a planilha vence quando existir):
    //   tipo 1 "informa e para" (CT02.2) — detecta aqui, o dashboard confirma o saldo
    //     insuficiente e o teste encerra SEM tentar o envio;
    //   tipo 2 "executa e comprova" (CT02.3) — segue o fluxo até o PIN pra provar que a
    //     UI bloqueia, e no fim valida que nada foi debitado.
    // Em cenário POSITIVO, saldo insuficiente = massa inconsistente → erro explícito.
    const ehNegativo = $testInfo.tags?.includes('@Negativo') || pixMassa.resultadoEsperado === 'BLOQUEAR';
    const saldoInsuficiente = pixMassa.valorPix > saldoReal;
    if (saldoInsuficiente && ehNegativo) {
        logger.info(`🚫 Cenário NEGATIVO: Pix de R$ ${formatBRL(pixMassa.valorPix)} > saldo real R$ ${formatBRL(saldoReal)} — o envio deve ser bloqueado/encerrado.`);
    } else if (saldoInsuficiente) {
        const msg = `[Saldo Insuficiente] Cliente ${pixMassa.nomeRemetente} (CPF ${cpfLimpo}) tem R$ ${formatBRL(saldoReal)} em conta, mas o Pix é de R$ ${formatBRL(pixMassa.valorPix)} — teste encerrado.`;
        logger.error(`❌ ${msg}`);
        throw new Error(msg);
    } else {
        logger.info(`💰 Saldo disponível: R$ ${formatBRL(saldoReal)} — suficiente para o Pix de R$ ${formatBRL(pixMassa.valorPix)}`);
    }

    // Guarda o saldo real pra validar no final: saldo_antes - valor_pix = saldo da home.
    pixSaldoState.saldoAntes = saldoReal;
    logger.info(`📌 Saldo antes do Pix: R$ ${formatBRL(saldoReal)} (capturado da API)`);
});

Then('devo ver o saldo da home atualizado após o Pix', async ({ pixPage, pixMassa, pixSaldoState }) => {
    if (!pixMassa) {
        throw new Error('Massa de Pix não carregada — verifique a linha do cenário em TBL_CENARIOS/TBL_USUARIOS (ver utils/massaPix.ts).');
    }
    if (pixSaldoState.saldoAntes === null) {
        throw new Error('Saldo antes do Pix não foi capturado — rode o step "eu valido que o cliente tem saldo para enviar o Pix" antes do envio.');
    }

    // Cálculo esperado: saldo capturado da API antes do envio menos o valor do Pix da massa.
    const saldoEsperado = pixSaldoState.saldoAntes - pixMassa.valorPix;
    const esperadoFmt = `R$ ${formatarValorPix(saldoEsperado)}`;
    logger.info(`🧮 Cálculo: R$ ${formatBRL(pixSaldoState.saldoAntes)} - R$ ${formatBRL(pixMassa.valorPix)} = ${esperadoFmt}`);

    // Lê o card "Saldo em Conta" da home e confere com o cálculo — validação REAL de UI,
    // não de API: prova que o débito apareceu na tela com o valor exato da massa.
    const saldoNaTela = await pixPage.lerSaldoDashboard();
    logger.info(`🏠 Saldo na home: ${saldoNaTela}`);
    await pixPage.validarCardSaldo(saldoEsperado);
    logger.info(`✅ Saldo pós-Pix confere: ${esperadoFmt} (antes R$ ${formatBRL(pixSaldoState.saldoAntes)} − Pix R$ ${formatBRL(pixMassa.valorPix)})`);
});

When('eu abro a Área PIX pelo botão {string}', async ({ pixPage }, botao: string) => {
    await pixPage.abrirAreaPix();
    logger.info(`💠 Área PIX aberta via "${botao}"`);
});

When('eu valido o nome do cliente logado no dashboard', async ({ pixPage, pixMassa }) => {
    if (!pixMassa) {
        throw new Error('Massa de Pix não carregada — verifique a linha do cenário em TBL_CENARIOS/TBL_USUARIOS (ver utils/massaPix.ts).');
    }
    // Nome completo vem de TBL_USUARIOS (correlação por CPF + ID_MASSA); o logger imprime
    // o nome completo no console e o greeting "Olá, <primeiro nome>" é validado na tela.
    await pixPage.validarNomeClienteLogado(pixMassa.nomeRemetente);
});

When('eu seleciono o tipo de chave CPF na Área PIX', async ({ pixPage }) => {
    // Envio é por CPF — não percorre os outros tipos (ficam disponíveis em
    // PixPage.selecionarTipoChave pra cenários futuros de email/celular/aleatória).
    await pixPage.selecionarTipoChaveCpf();
});

// Formulário de Pix quebrado em 1 step por campo (chave/valor/mensagem) — cada linha do
// Gherkin gera seu próprio print de evidência via hooks.steps.ts, igual ao padrão dos
// projetos mobile (1 sentença = 1 ação = 1 step function, nada de bundle multi-campo).
// O tipo de chave já foi selecionado por um step anterior ("eu seleciono o tipo de chave CPF").

When('eu preencho a chave Pix com os dados do cenário na Área PIX', async ({ pixPage, pixMassa }) => {
    if (!pixMassa) {
        throw new Error('Massa de Pix não carregada — verifique a linha do cenário em TBL_CENARIOS e TBL_USUARIOS_SECUNDARIOS (ver utils/massaPix.ts).');
    }
    logger.info(`💠 Chave Pix (CPF): ${pixMassa.cpfDestinatario} (${pixMassa.nomeDestinatario}, ID_MASSA ${pixMassa.idMassaDestinatario})`);
    await pixPage.preencherChavePix(pixMassa.cpfDestinatario);
});

When('eu preencho o valor do Pix com os dados do cenário na Área PIX', async ({ pixPage, pixMassa }) => {
    if (!pixMassa) {
        throw new Error('Massa de Pix não carregada — verifique a linha do cenário em TBL_CENARIOS (ver utils/massaPix.ts).');
    }
    // O campo monetário da UI funciona por dígitos (centavos implícitos): 'R$ 15,99'
    // digitado resulta em R$ 15,99 na revisão — entrada e validação usam o mesmo valor
    // formatado, vindo direto da coluna "Valor PIX" de TBL_CENARIOS.
    const valorFmt = `R$ ${formatarValorPix(pixMassa.valorPix)}`;
    logger.info(`💠 Valor do Pix: ${valorFmt}`);
    await pixPage.preencherValorPix(valorFmt);
});

When('eu preencho a mensagem do Pix com os dados do cenário na Área PIX', async ({ pixPage, pixMassa }) => {
    if (!pixMassa) {
        throw new Error('Massa de Pix não carregada — verifique a linha do cenário em TBL_CENARIOS (ver utils/massaPix.ts).');
    }
    logger.info(`💠 Mensagem do Pix: "${pixMassa.mensagem}"`);
    await pixPage.preencherMensagemPix(pixMassa.mensagem);
});

When('eu seleciono a tag {string} na Área PIX', async ({ pixPage }, tag: string) => {
    if (tag !== 'Refeição') {
        throw new Error(`Tag de Pix não suportada pelo Page Object: "${tag}". Atualmente só "Refeição" é mapeada.`);
    }
    await pixPage.selecionarTagRefeicao();
});

When('eu avanço para os Dados de Envio', async ({ pixPage }) => {
    await pixPage.prosseguirParaDadosEnvio();
});

// Valores de teste literais (não vêm da massa) — só pros cenários de campo obrigatório
// (CT02.4/CT02.5), que nunca avançam pra Dados de Envio e não precisam de linha própria
// em TBL_CENARIOS. Mesmo princípio do CPF/senha inválidos hardcoded em login.steps.ts.
When('eu preencho a chave Pix com um CPF de teste na Área PIX', async ({ pixPage }) => {
    await pixPage.preencherChavePix('11111111111');
});

When('eu preencho o valor do Pix com um valor de teste na Área PIX', async ({ pixPage }) => {
    await pixPage.preencherValorPix('R$ 10,00');
});

When('eu tento avançar para os Dados de Envio', async ({ pixPage }) => {
    // Cenário negativo: clique em "Prosseguir" SEM validar o resultado — o bloqueio
    // (ou o avanço, se a UI deixasse passar) é validado nos steps seguintes.
    await pixPage.tentarAvancarDadosEnvio();
});

Then('devo ver os dados de revisão do Pix', async ({ pixPage, pixMassa }) => {
    if (!pixMassa) {
        throw new Error('Massa de Pix não carregada — verifique a linha do cenário em TBL_CENARIOS e TBL_USUARIOS_SECUNDARIOS (ver utils/massaPix.ts).');
    }
    // Nome do destinatário validado é o NOME_COMPLETO real da massa (join por CPF), não
    // um valor fixo — a UI resolve a chave CPF pro usuário cadastrado e o step confere.
    await pixPage.validarDadosEnvio({
        nomeDestinatario: pixMassa.nomeDestinatario,
        chave: pixMassa.cpfDestinatario,
        mensagem: pixMassa.mensagem,
        valorRevisao: `R$ ${formatarValorPix(pixMassa.valorPix)}`,
        tipoChave: 'cpf',
    });
});

When('eu confirmo o envio do Pix', async ({ pixPage }) => {
    await pixPage.confirmarEnvio();
});

When('eu digito a senha do cartão no PIN', async ({ page, pixMassa }) => {
    const pinModal = new PinModalComponent(page);
    if (!pixMassa) {
        throw new Error('Massa de Pix não carregada — verifique a linha do cenário em TBL_CENARIOS (ver utils/massaPix.ts).');
    }
    await pinModal.digitarPin(pixMassa.pin);
});

// ---------- Cenários NEGATIVOS: saldo insuficiente (@CT02.2 e @CT02.3) ----------
// A massa negativa (linha em TBL_CENARIOS com "Valor PIX" maior que o saldo real do
// remetente) aponta um destinatário em TBL_USUARIOS_SECUNDARIOS como qualquer cenário
// positivo — a diferença está no QUE é validado:
//   CT02.2 ("informa e para")     → o step de saldo detecta, o dashboard confirma o
//                                   saldo insuficiente e o teste encerra SEM tentar o envio.
//   CT02.3 ("executa e comprova") → o fluxo vai até o clique em "Prosseguir" pra provar
//                                   que a UI bloqueia, e o saldo da home NÃO muda.

Then('o dashboard confirma o saldo insuficiente e o teste encerra sem tentar o Pix', async ({ pixPage, pixMassa, pixSaldoState }) => {
    if (!pixMassa) {
        throw new Error('Massa de Pix não carregada — verifique a linha do cenário em TBL_CENARIOS/TBL_USUARIOS (ver utils/massaPix.ts).');
    }
    if (pixSaldoState.saldoAntes === null) {
        throw new Error('Saldo antes do Pix não foi capturado — rode o step "eu valido que o cliente tem saldo para enviar o Pix" antes.');
    }
    // O card da home deve exibir exatamente o saldo real capturado da API — a prova
    // visual de que esse saldo não paga o Pix.
    const saldoNaTela = await pixPage.lerSaldoDashboard();
    logger.info(`🏠 Saldo no dashboard: ${saldoNaTela} — insuficiente para o Pix de R$ ${formatarValorPix(pixMassa.valorPix)}`);
    await pixPage.validarCardSaldo(pixSaldoState.saldoAntes);
    logger.info(`🛑 Teste encerrado por saldo insuficiente: Pix R$ ${formatarValorPix(pixMassa.valorPix)} > saldo R$ ${formatBRL(pixSaldoState.saldoAntes)} — o envio NÃO foi tentado.`);
});

Then('devo ver a mensagem de saldo insuficiente no formulário de Pix', async ({ pixPage }) => {
    // Comportamento REAL do app (descoberto na primeira execução do CT02.3): a UI valida
    // o saldo JÁ NO FORMULÁRIO — ao clicar "Prosseguir" com valor > saldo, a mensagem
    // inline "Saldo insuficiente para realizar esta transferência." aparece e o avanço
    // para "Dados de Envio" não acontece (o PIN nunca é alcançado).
    const mensagem = await pixPage.validarBloqueioNoFormulario();
    logger.info(`🚫 Bloqueio no formulário: "${mensagem}"`);
    if (!/saldo insuficiente/i.test(mensagem)) {
        throw new Error(`A mensagem exibida não é de saldo insuficiente: "${mensagem}".`);
    }
});

Then('o envio do Pix não deve ser concluído', async ({ pixPage }) => {
    await pixPage.validarEnvioNaoConcluido();
});

When('eu volto ao dashboard após o bloqueio', async ({ page }) => {
    // O bloqueio deixa o formulário preso na tela (não há navegação de volta no estado de
    // erro) — recarrega a página: a sessão persiste e a home renderiza o saldo do banco.
    await page.reload({ waitUntil: 'domcontentloaded' });
    logger.info('↩️ Dashboard recarregado após o bloqueio do Pix');
});

Then('o saldo da home permanece inalterado após o bloqueio', async ({ pixPage, pixMassa, pixSaldoState }) => {
    if (!pixMassa) {
        throw new Error('Massa de Pix não carregada — verifique a linha do cenário em TBL_CENARIOS/TBL_USUARIOS (ver utils/massaPix.ts).');
    }
    if (pixSaldoState.saldoAntes === null) {
        throw new Error('Saldo antes do Pix não foi capturado — rode o step "eu valido que o cliente tem saldo para enviar o Pix" antes.');
    }
    const saldoNaTela = await pixPage.lerSaldoDashboard();
    logger.info(`🏠 Saldo na home após o bloqueio: ${saldoNaTela}`);
    // Mesmo saldo capturado ANTES da tentativa = nada foi debitado.
    await pixPage.validarCardSaldo(pixSaldoState.saldoAntes);
    logger.info(`✅ Saldo inalterado: R$ ${formatBRL(pixSaldoState.saldoAntes)} — o bloqueio não debitou nada do Pix de R$ ${formatarValorPix(pixMassa.valorPix)}.`);
});

Then('devo ver a mensagem de campo obrigatório para a Chave Pix na Área PIX', async ({ pixPage }) => {
    await pixPage.validarCampoObrigatorioChave();
});

Then('devo ver a mensagem de campo obrigatório para o Valor do Pix na Área PIX', async ({ pixPage }) => {
    await pixPage.validarCampoObrigatorioValor();
});

Then('devo ver o comprovante {string}', async ({ pixPage }, comprovante: string) => {
    if (!comprovante.includes('Envio Realizado')) {
        throw new Error(`Comprovante não suportado: "${comprovante}".`);
    }
    await pixPage.validarEnvioRealizado();
});

Then('devo ver o comprovante completo do Pix', async ({ pixPage }) => {
    await pixPage.abrirComprovante();
});

When('eu volto ao início pelo comprovante', async ({ pixPage }) => {
    await pixPage.voltarAoInicio();
});

Then('devo ver o comprovante do Pix no extrato', async ({ pixPage, pixMassa }) => {
    if (!pixMassa) {
        throw new Error('Massa de Pix não carregada — verifique a linha do cenário em TBL_CENARIOS (ver utils/massaPix.ts).');
    }
    await pixPage.validarComprovanteNoExtrato(pixMassa.mensagem);
});

Then('eu volto do comprovante do extrato', async ({ pixPage }) => {
    await pixPage.voltarDoExtrato();
});
