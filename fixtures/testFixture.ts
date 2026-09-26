import { test as base } from 'playwright-bdd';
import { expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { LandingPage } from '../tests/pages/LandingPage';
import { FaturasPage } from '../tests/pages/FaturasPage';
import { CadastroPage } from '../tests/pages/CadastroPage';
import { PixPage } from '../tests/pages/PixPage';
import { DashboardPage } from '../tests/pages/DashboardPage';
import { AuthFlow } from '../tests/flows/auth.flow';
import { TestContext } from '../tests/utils/TestContext';
import { LoginModel } from '../tests/massa-types/LoginModel';
import { CadastroModel } from '../tests/massa-types/CadastroModel';
import { ScenarioData } from '../tests/utils/excelReader';
import { logger, formatarDuracao } from '../tests/utils/logger';
import { EvidenceHelper } from '../tests/utils/EvidenceHelper';
import { obterMassaCadastroDoCenario } from '../tests/utils/massaCadastroXlsx';
import { obterMassaPixDoCenario, PixMassa } from '../tests/utils/massaPix';

// Ponto único de fixtures do projeto — 1 fixture por Page Object (landingPage/cadastroPage/
// pixPage/dashboardPage) junto com a camada COMPOSTA cross-feature (authFlow usa
// Landing+Dashboard) e o estado de massa/log global, tudo num .extend() só.
// Estado de runtime do cenário de Faturas — exportado porque os steps de reenvio
// (@CT03.2-reenvio) tipam os helpers de API com ele.
export type FaturasApiState = {
    totalAntes: number | null;
    faturaFechadaReal: number | null;
    formaPagamento: 'total' | 'minimo' | 'parcial' | null;
    valorCustomizado: number | null;
    limiteDisponivelAntes: number | null;
    valorPagoEfetivo: number | null;
    aberturaAntes: number | null;
    dividaFechadaAntes: number | null;
    cpf: string | null;
    senha: string | null;
    pagamentosAntesCount: number | null;
    dividaPosInjecao: number | null;
};

type MyFixtures = {
    landingPage: LandingPage;
    cadastroPage: CadastroPage;
    pixPage: PixPage;
    dashboardPage: DashboardPage;
    faturasPage: FaturasPage;
    authFlow: AuthFlow;
    testData: ScenarioData | null;
    pixMassa: PixMassa | null;
    pixSaldoState: { saldoAntes: number | null };
    faturasApiState: FaturasApiState;
    loginModel: LoginModel;
    cadastroPoolState: { dados: CadastroModel | null };
    testLogger: void;
};

export const test = base.extend<MyFixtures>({
    landingPage: async ({ page }, use) => {
        await use(new LandingPage(page));
    },

    cadastroPage: async ({ page }, use) => {
        await use(new CadastroPage(page));
    },

    pixPage: async ({ page }, use) => {
        await use(new PixPage(page));
    },

    dashboardPage: async ({ page }, use) => {
        await use(new DashboardPage(page));
    },

    faturasPage: async ({ page }, use) => {
        await use(new FaturasPage(page));
    },

    authFlow: async ({ landingPage, dashboardPage }, use) => {
        await use(new AuthFlow(landingPage, dashboardPage));
    },

    testData: async ({}, use, testInfo) => {
        // Cenários BDD (playwright-bdd) têm testInfo.title = nome do Scenario, sem o ID —
        // o ID só sobrevive na tag (@CT01.1). Specs .spec.ts continuam com o ID no título.
        const tag = testInfo.tags?.find((t) => /^@(CT-?\d+(\.\d+)?|cadastrar)$/i.test(t));
        const idCenario = tag ? tag.replace('@', '') : null;
        const scenario = TestContext.loadFromTestTitle(idCenario ?? testInfo.title);
        await use(scenario);
    },

    // Massa do cenário de Pix (CT02.x): CPF do destinatário vem de TBL_USUARIOS_SECUNDARIOS
    // (linha do mesmo ID_CENARIO), nome vem do join com TBL_MASSA_CADASTRADA/TBL_CADASTRO e
    // o valor vem da coluna "Valor PIX" de TBL_CENARIOS — ver utils/massaPix.ts. Resolvida
    // na inicialização da fixture (não dentro do step), mesmo timing do cadastroPoolState.
    pixMassa: async ({}, use, testInfo) => {
        const tagCenario = testInfo.tags?.find((t) => /^@(CT-?\d+(\.\d+)?)$/i.test(t));
        const dados = tagCenario ? obterMassaPixDoCenario(tagCenario.replace('@', '')) : null;
        await use(dados);
    },

    // Estado de runtime do cenário de Pix: saldo real capturado via API ANTES do envio,
    // pra validar no final que saldo_antes - valor_pix = saldo exibido na home. Objeto
    // mutável (mesmo padrão do cadastroPoolState) — o step grava e o step final lê.
    pixSaldoState: async ({}, use) => {
        await use({ saldoAntes: null });
    },

    // Estado de runtime do cenário de Faturas: total da fatura ANTES do pagamento,
    // capturado via API real (não da planilha, que fica defasada a cada execução —
    // mesmo motivo/padrão do pixSaldoState). O step grava e o Then final lê.
    faturasApiState: async ({}, use) => {
        await use({ totalAntes: null, faturaFechadaReal: null, formaPagamento: null, valorCustomizado: null, limiteDisponivelAntes: null, valorPagoEfetivo: null, aberturaAntes: null, dividaFechadaAntes: null, cpf: null, senha: null, pagamentosAntesCount: null, dividaPosInjecao: null });
    },

    loginModel: async ({ testData }, use) => {
        const loginData = TestContext.getLoginModel();
        await use(loginData);
    },

    // Estado do cenário de cadastro (CT00) — mesmo timing de testData/loginModel:
    // resolvido na inicialização da fixture (não dentro do step), pra já estar
    // disponível quando testLogger loga o cabeçalho do cenário. Escolhe o ID_MASSA fixo
    // de TBL_CENARIOS/cadastrar em TBL_CADASTRO (ver massaCadastroXlsx.ts).
    //
    // Só o cenário que REGISTRA de verdade (tag @cadastrar, o CT00 completo) exige massa
    // "ainda não usada" — os de campo obrigatório (CT00.1-CT00.5, tag @Cadastro sem
    // @cadastrar) nunca completam o submit (bloqueio nativo do browser antes disso), então
    // reusar uma massa já registrada não tem problema nenhum pra eles. Sem essa distinção,
    // rodar a feature inteira (`npm run bdd:cadastro`) sempre quebrava os 5 de validação
    // assim que o CT00 rodava primeiro e consumia o ponteiro compartilhado.
    cadastroPoolState: async ({}, use, testInfo) => {
        const ehCenarioCadastro = testInfo.tags?.includes('@Cadastro');
        const exigirNaoUsada = testInfo.tags?.includes('@cadastrar') ?? false;
        const dados = ehCenarioCadastro ? obterMassaCadastroDoCenario(exigirNaoUsada) : null;
        await use({ dados });
    },

    testLogger: [async ({ testData, cadastroPoolState }, use, testInfo) => {
        // O cenário de cadastro (@Cadastro) tem sua própria massa (TBL_CADASTRO, não
        // TBL_CENARIOS) — mesmo layout do bloco "Massa de Dados Carregada", campos
        // diferentes (não tem saldo/fatura, ainda não existe conta).
        const ehCenarioCadastro = testInfo.tags?.includes('@Cadastro');

        // Bloco de dados vem ANTES do cabeçalho de execução — padrão do CMS: primeiro
        // mostra QUEM/O QUE vai rodar, depois o carimbo de execução (Execucao/Feature/UUID).
        if (ehCenarioCadastro && cadastroPoolState.dados) {
            const dados = cadastroPoolState.dados;
            const tagCenario = testInfo.tags?.find((t) => /^@CT-?\d+(\.\d+)?$/i.test(t));
            logger.info(`🆔 ID Cenário: ${tagCenario ? tagCenario.replace('@', '') : 'CT00'}`);
            logger.info(`✅ Massa de Dados Carregada:`);
            logger.info(`   👤 Nome: ${dados.nomeCompleto}  |  🔖 ID_MASSA: ${dados.idMassa}`);
            logger.info(`   📧 Email: ${dados.email}  |  🔑 Senha: ${dados.senha}`);
            logger.info(`   -----------------------------------------------------------------`);
            logger.info(`   💳 CPF: ${dados.cpf}`);
        } else if (testData) {
            const fmt = (v: unknown) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            logger.info(`🆔 ID Cenário: ${testData.ID_CENARIO}`);
            logger.info(`✅ Massa de Dados Carregada:`);
            logger.info(`   📋 Cenário: ${testData.NOME || 'N/A'}`);
            logger.info(`   💳 CPF: ${testData.CPF}  |  🔑 Senha: ${testData.SENHA}`);
            logger.info(`   -----------------------------------------------------------------`);
            // Colunas reais de TBL_CENARIOS — saldo_conta é coluna de CONTROLE do analista
            // (não é comparada com o banco nos testes de Pix; quem valida saldo é o step
            // "eu valido que o cliente tem saldo para enviar o Pix", via API).
            // Linha extra varia por feature:
            //   @Faturas (CT03.x) → fatura_fechada: valor de controle da planilha que o
            //                       step Then compara contra o valor real capturado na tela
            //   @Pix     (CT02.x) → Valor PIX: coluna de controle do analista
            //   demais             → sem linha extra
            const ehFaturas = testInfo.tags?.some((t) => /^@CT03/i.test(t) || t === '@Faturas');
            const ehPix     = testInfo.tags?.some((t) => /^@CT02/i.test(t) || t === '@Pix');
            logger.info(`   💰 Saldo em Conta (controle): R$ ${fmt(testData.saldo_conta)}  |  🧾 Fatura Aberta: R$ ${fmt(testData.fatura_aberta)}`);
            if (ehFaturas) {
                // A forma de pagamento vem do PRÓPRIO TÍTULO do cenário (Gherkin:
                // "Consultar faturas e pagar o valor total/mínimo/parcial...", "pagar valor
                // MENOR/MAIOR que o minimo") — evita duplicar essa informação na massa ou
                // num campo editável da planilha.
                const tituloCenario = (testInfo.title ?? '').toLowerCase();
                const formaPagamento = /valor total/.test(tituloCenario) ? 'Total'
                    : /menor que o minim/.test(tituloCenario) ? 'Menor que o mínimo'
                    : /maior que o minim/.test(tituloCenario) ? 'Maior que o mínimo'
                    : /parcial/.test(tituloCenario) ? 'Parcial (personalizado)'
                    : /mínimo|minimo/.test(tituloCenario) ? 'Mínimo'
                    : 'não identificado';
                logger.info(`   📄 Fatura Fechada (pagamento ${formaPagamento}): R$ ${fmt(testData.fatura_fechada)}`);
                // Limite disponível RAW da massa (TBL_CENARIOS), antes de qualquer ação do
                // teste — safety net pedido em 2026-09-21: fatura_fechada pode incluir
                // encargos (multa/juros/IOF) congelados no valor_total, que NÃO restauram
                // limite quando pagos (só o principal restaura). Ter lim_disponivel/
                // lim_utilizado CRU aqui permite conferir a matemática manualmente se a
                // asserção de limite falhar, sem reconstruir estado depois via banco.
                logger.info(`   📊 Massa (raw, TBL_CENARIOS): lim_utilizado=R$ ${fmt(testData.lim_utilizado)} | lim_disponivel=R$ ${fmt(testData.lim_disponivel)}`);
            } else if (ehPix) {
                logger.info(`   💠 Valor PIX: R$ ${fmt((testData as ScenarioData & { 'Valor PIX'?: number | string })['Valor PIX'])}`);
            }
        }

        // Cabeçalho no padrão do CMS (Execucao/Feature/UUID) — feature name vem do
        // describe do .feature-gen (test.describe(Feature) > test(Scenario)), por isso
        // titlePath.at(-2): último é o título do cenário, penúltimo é o da Feature.
        const idExecucao = randomUUID();
        const featureName = testInfo.titlePath.at(-2) ?? 'N/A';
        const separador = '='.repeat(36);
        logger.info(`${separador} Execucao: ${new Date().toLocaleString('pt-BR')} ${separador}`);
        logger.info(`Feature: ${featureName}`);
        logger.info(idExecucao);

        logger.info(`🔄 Iniciando execução: ${testInfo.title}`);

        EvidenceHelper.clearScreenshots();
        EvidenceHelper.setIdExecucao(idExecucao);

        const startTime = new Date();

        await use();

        // Fim do Teste
        const endTime = new Date();
        const duracaoMs = endTime.getTime() - startTime.getTime();
        const status = testInfo.status === 'passed' ? 'PASSED' : 'FAILED';

        // Início/Fim/Duração por cenário — já existiam como variáveis (usadas só no DOCX de
        // evidência), mas nunca apareciam no log do terminal. Rótulos alinhados por pontos,
        // mesmo estilo de leitura usado no Hooks.java dos projetos mobile (Digio/Uber).
        logger.info(`Início.....: ${startTime.toLocaleTimeString('pt-BR')}`);
        logger.info(`Fim........: ${endTime.toLocaleTimeString('pt-BR')}`);
        logger.info(`Duração....: ${formatarDuracao(duracaoMs)}`);

        if (status === 'FAILED') {
            logger.error(`⚠️ Falha no cenário: ${testInfo.title}`);
        } else {
            logger.info(`✅ Cenário finalizado com sucesso: ${testInfo.title}`);
        }

        // Fecha o bloco do cenário com separador do MESMO peso visual do de abertura
        // (linha "Execucao: ..." acima) — sem isso, quando vários cenários rodam em
        // sequência (ex: npm run bdd:cadastro, 6 de uma vez), a abertura pesada do
        // PRÓXIMO cenário aparece colada no rastro fraco (texto solto) do ANTERIOR, e
        // fica difícil separar visualmente onde um termina e o outro começa. Mesmo
        // princípio do bloco "Finalizing context ===...===" do Hooks.java dos projetos
        // mobile (Digio/Uber): abre e fecha com o mesmo peso. O '\n' final dá 1 linha em
        // branco de respiro antes do próximo cenário — sem depender só disso pra separar.
        logger.info(`${separador} Fim: ${endTime.toLocaleString('pt-BR')} ${separador}\n`);

        // Anexa o README.md ao relatório do Playwright (Attachments)
        const readmePath = path.resolve(__dirname, '../README.md');
        if (fs.existsSync(readmePath)) {
            await testInfo.attach('README.md', {
                path: readmePath,
                contentType: 'text/markdown',
            });
        }
        
        // Gerar evidência
        const nomesNavegador: Record<string, string> = {
            chromium: 'Chrome',
            firefox: 'Firefox',
            webkit: 'Safari',
        };
        await EvidenceHelper.generateEvidence({
            feature: testInfo.file.split(/[\\/]/).pop() || 'N/A',
            scenario: testInfo.title,
            status: status,
            inicio: startTime.toLocaleString('pt-BR'),
            fim: endTime.toLocaleString('pt-BR'),
            data: new Date().toLocaleDateString('pt-BR'),
            navegador: nomesNavegador[testInfo.project.name] || testInfo.project.name
        }, testInfo.title);
    }, { auto: true }]
});

export { expect };
