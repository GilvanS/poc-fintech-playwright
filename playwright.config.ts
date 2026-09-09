import { defineConfig, devices } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';
import dotenv from 'dotenv';
import path from 'path';

// Carrega as variáveis de ambiente do arquivo .env
dotenv.config({ path: path.resolve(__dirname, '.env') });

const bddTestDir = defineBddConfig({
  features: 'tests/features/**/*.feature',
  steps: ['tests/steps/**/*.ts', 'fixtures/testFixture.ts'],
  outputDir: '.features-gen',
});

/**
 * Seleção de navegador via variável de ambiente TEST_PROJECT (definida no .env ou no shell).
 * Padrão: 'bdd' — roda SOMENTE o projeto bdd (Chrome headless), sem disparar os outros
 * navegadores de uma vez. Valores aceitos: chromium | bdd | bdd-headed | edge | firefox,
 * vários separados por vírgula (ex: "bdd,edge") ou "all" pra voltar ao comportamento antigo
 * de rodar tudo. Exemplos:
 *   TEST_PROJECT=firefox npm run bdd:login
 *   TEST_PROJECT=edge,bdd npm run test:bdd
 */
const validProjectNames = ['chromium', 'bdd', 'bdd-headed', 'edge', 'firefox'];
const projectAliases: Record<string, string[]> = {
  all: validProjectNames,
};
const selectedProjectNames = (process.env.TEST_PROJECT ?? 'bdd')
  .split(',')
  .map((name) => name.trim())
  .filter(Boolean)
  .flatMap((name) => projectAliases[name] ?? [name]);
const invalidProjects = selectedProjectNames.filter((name) => !validProjectNames.includes(name));
if (invalidProjects.length > 0) {
  throw new Error(
    `TEST_PROJECT inválido: "${invalidProjects.join(', ')}". ` +
      `Opções: ${validProjectNames.join(' | ')} (ou "all").`,
  );
}

// Projetos passados explicitamente via CLI (--project=xxx): entram na lista junto com os do
// TEST_PROJECT, pra scripts que já fixam o navegador (--project=edge, --project=chromium...)
// continuarem funcionando mesmo com o default TEST_PROJECT=bdd — o filtro da CLI do Playwright
// escolhe o vencedor. Nomes desconhecidos via CLI o Playwright valida sozinho.
const cliProjectNames = process.argv
  .filter((arg) => arg.startsWith('--project='))
  .flatMap((arg) => arg.slice('--project='.length).split(','))
  .map((name) => name.trim())
  .filter(Boolean);
if (cliProjectNames.length > 0) {
  process.env.PLAYWRIGHT_CLI_PROJECTS = cliProjectNames.join(',');
}
const envCliProjects = (process.env.PLAYWRIGHT_CLI_PROJECTS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const effectiveProjectNames = Array.from(
  new Set([...selectedProjectNames, ...cliProjectNames, ...envCliProjects]),
);

/**
 * Nº de workers via TEST_WORKERS (opcional). Sem isso, vale o padrão do Playwright
 * (paralelo local, 1 worker no CI) — mesmo comportamento de antes.
 */
const TEST_WORKERS = process.env.TEST_WORKERS ? Number(process.env.TEST_WORKERS) : undefined;
if (TEST_WORKERS !== undefined && (Number.isNaN(TEST_WORKERS) || TEST_WORKERS < 1)) {
  throw new Error(`TEST_WORKERS inválido: "${process.env.TEST_WORKERS}". Use um número >= 1.`);
}

/**
 * Zoom da tela via TEST_ZOOM (default 1 = 100%). Vira --force-device-scale-factor nos
 * projetos Chromium (chromium, bdd, bdd-headed, edge); Firefox não suporta esse arg e ignora.
 * Ex.: TEST_ZOOM=0.9 (90%) deixa a tela mais "afastada"; TEST_ZOOM=1.25 (125%) mais "perto".
 */
const TEST_ZOOM = process.env.TEST_ZOOM ? Number(process.env.TEST_ZOOM) : 1;
if (Number.isNaN(TEST_ZOOM) || TEST_ZOOM < 0.5 || TEST_ZOOM > 3) {
  throw new Error(`TEST_ZOOM inválido: "${process.env.TEST_ZOOM}". Use um número entre 0.5 e 3 (1 = 100%).`);
}
const zoomArgs = TEST_ZOOM !== 1 ? [`--force-device-scale-factor=${TEST_ZOOM}`] : [];

/**
 * Tamanho da janela via TEST_VIEWPORT (formato LARGURAxALTURA, ex: 1920x1080). Sem valor,
 * cada project usa o default dele (bdd: 1440x900, firefox: 1920x1080, headed: maximizado).
 * Não afeta os projetos headed com viewport:null — neles a janela maximiza de verdade.
 */
const viewportMatch = (process.env.TEST_VIEWPORT ?? '').match(/^(\d{2,5})x(\d{2,5})$/);
if (process.env.TEST_VIEWPORT && !viewportMatch) {
  throw new Error(`TEST_VIEWPORT inválido: "${process.env.TEST_VIEWPORT}". Use o formato LARGURAxALTURA, ex: 1920x1080.`);
}
const TEST_VIEWPORT = viewportMatch
  ? { width: Number(viewportMatch[1]), height: Number(viewportMatch[2]) }
  : undefined;

/**
 * Velocidade da execução via TEST_SLOWMO (ms de espera após cada ação do Playwright).
 * Default 400, usado pelos projetos headed pra dar tempo de acompanhar a execução.
 * TEST_SLOWMO=0 remove as esperas (execução mais rápida, só não dá pra "seguir" os passos).
 */
const TEST_SLOWMO =
  process.env.TEST_SLOWMO !== undefined && process.env.TEST_SLOWMO !== ''
    ? Number(process.env.TEST_SLOWMO)
    : 400;
if (Number.isNaN(TEST_SLOWMO) || TEST_SLOWMO < 0) {
  throw new Error(`TEST_SLOWMO inválido: "${process.env.TEST_SLOWMO}". Use um número >= 0 (ms).`);
}

/**
 * URL da aplicação sob teste via TEST_BASE_URL (default http://localhost:3000).
 * Útil pra apontar a suíte pra outro ambiente sem editar código.
 */
const TEST_BASE_URL = process.env.TEST_BASE_URL ?? 'http://localhost:3000';

/**
 * Janelas lado a lado: quando 2+ projetos VISÍVEIS de Chromium estão selecionados
 * (bdd-headed, edge), cada navegador ganha uma fatia horizontal da tela em vez de um
 * maximizado cobrir o outro. A geometria da tela vem de TEST_SCREEN_SIZE (default 1920x1080).
 * Pra desligar o automático e fixar a janela na mão (bom p/ 1 navegador por terminal), use
 * TEST_WINDOW_POSITION="X,Y" e/ou TEST_WINDOW_SIZE="LARGURAxALTURA".
 * Firefox não aceita --window-position/--window-size e fica fora do lado a lado.
 */
const screenSizeMatch = (process.env.TEST_SCREEN_SIZE || '1920x1080').match(/^(\d{2,5})x(\d{2,5})$/);
if (!screenSizeMatch) {
  throw new Error(`TEST_SCREEN_SIZE inválido: "${process.env.TEST_SCREEN_SIZE}". Use o formato LARGURAxALTURA, ex: 1920x1080.`);
}
const SCREEN_WIDTH = Number(screenSizeMatch[1]);
const SCREEN_HEIGHT = Number(screenSizeMatch[2]);

const windowPosMatch = process.env.TEST_WINDOW_POSITION
  ? process.env.TEST_WINDOW_POSITION.match(/^(\d{1,5}),(\d{1,5})$/)
  : null;
if (process.env.TEST_WINDOW_POSITION && !windowPosMatch) {
  throw new Error(`TEST_WINDOW_POSITION inválido: "${process.env.TEST_WINDOW_POSITION}". Use o formato X,Y, ex: 0,0.`);
}

const windowSizeMatch = process.env.TEST_WINDOW_SIZE
  ? process.env.TEST_WINDOW_SIZE.match(/^(\d{2,5})x(\d{2,5})$/)
  : null;
if (process.env.TEST_WINDOW_SIZE && !windowSizeMatch) {
  throw new Error(`TEST_WINDOW_SIZE inválido: "${process.env.TEST_WINDOW_SIZE}". Use o formato LARGURAxALTURA, ex: 960x1080.`);
}

const manualWindowArgs = [
  windowPosMatch ? `--window-position=${windowPosMatch[1]},${windowPosMatch[2]}` : null,
  windowSizeMatch ? `--window-size=${windowSizeMatch[1]},${windowSizeMatch[2]}` : null,
].filter((arg): arg is string => arg !== null);

/**
 * Roda com janela visível? --headed na CLI. Os projetos bdd-headed/edge são sempre
 * visíveis (headless:false); chromium e bdd só abrem janela de verdade com --headed.
 */
const isHeadedRun = process.argv.includes('--headed');

/** Projetos que abrem janela visível de Chromium (Firefox não aceita args de janela),
 *  na ordem em que foram selecionados (ordem de TEST_PROJECT + --project da CLI). */
const visibleChromiumSet = new Set(['bdd-headed', 'edge', ...(isHeadedRun ? ['chromium', 'bdd'] : [])]);
const visibleChromiumProjects = Array.from(
  new Set([...selectedProjectNames, ...cliProjectNames]),
).filter((name) => visibleChromiumSet.has(name));

/**
 * Ordem do lado a lado: o PRIMEIRO navegador selecionado fica na DIREITA da tela, o próximo
 * vai pra ESQUERDA dele, e assim por diante (direita → esquerda). Ex. com bdd-headed,edge
 * em tela 1920: bdd-headed ocupa [960,1920] (direita) e edge ocupa [0,960] (esquerda).
 */
function windowArgsFor(projectName: string): string[] {
  if (manualWindowArgs.length > 0) return manualWindowArgs;
  if (visibleChromiumProjects.length >= 2) {
    const sliceWidth = Math.floor(SCREEN_WIDTH / visibleChromiumProjects.length);
    const sliceX = (visibleChromiumProjects.length - 1 - visibleChromiumProjects.indexOf(projectName)) * sliceWidth;
    return [`--window-position=${sliceX},0`, `--window-size=${sliceWidth},${SCREEN_HEIGHT}`];
  }
  return ['--start-maximized'];
}

// Loga o layout de janelas calculado — facilita conferir as posições sem abrir o navegador.
if (manualWindowArgs.length === 0 && visibleChromiumProjects.length >= 2) {
  const sliceWidth = Math.floor(SCREEN_WIDTH / visibleChromiumProjects.length);
  const descricoes = visibleChromiumProjects.map((name, i) => {
    const x = (visibleChromiumProjects.length - 1 - i) * sliceWidth;
    return `${name}: X=${x}–${x + sliceWidth}`;
  });
  console.log(`🪟 Lado a lado (ordem direita → esquerda): ${descricoes.join(' | ')}`);
} else if (manualWindowArgs.length === 0 && visibleChromiumProjects.length === 1) {
  console.log(`🪟 ${visibleChromiumProjects[0]}: janela única → tela inteira (maximizado)`);
}

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Default (30s) é curto demais pro fluxo completo de cadastro (form + submit + modal +
     login + validações de dashboard + navegação de perfil), especialmente em --headed. */
  timeout: 60_000,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: TEST_WORKERS ?? (process.env.CI ? 1 : undefined),
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [['list'], ['html'], ['./tests/utils/summaryReporter.ts']],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('')`. Configurável via TEST_BASE_URL. */
    baseURL: TEST_BASE_URL,

    /* viewport: null + --start-maximized abre o Chromium ocupando a tela inteira
       em vez de uma janela com tamanho fixo — só tem efeito em modo --headed. */
    viewport: null,
    launchOptions: {
      // --disable-save-password-bubble: sem isso, todo login bem-sucedido dispara o
      // popup nativo do Chrome "Salvar senha?" — atrapalha screenshot/vídeo/clique
      // seguinte em --headed, e é só ruído em headless.
      // zoomArgs: --force-device-scale-factor entra aqui quando TEST_ZOOM != 1.
      args: ['--start-maximized', '--disable-save-password-bubble', ...zoomArgs],
    },

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',

    /* Screenshot automático só quando o teste falha (anexado no relatório HTML e em test-results/) */
    screenshot: 'only-on-failure',

    /* Control video recording based on the RECORD_VIDEO property in the .env file */
    video: process.env.RECORD_VIDEO === 'true' ? 'on' : 'off',
  },

  /* Configure projects for major browsers.
     effectiveProjectNames (via TEST_PROJECT e/ou --project da CLI) filtra quais projetos sobem
     — por padrão só 'bdd'. */
  projects: [
    {
      name: 'chromium',
      // devices['Desktop Chrome'] vem com viewport fixo (1280x720) e deviceScaleFactor,
      // e o Playwright recusa deviceScaleFactor junto de viewport:null — precisa zerar
      // os dois aqui pra maximizar valer de verdade.
      use: { ...devices['Desktop Chrome'], viewport: null, deviceScaleFactor: undefined },
    },
    {
      name: 'bdd',
      testDir: bddTestDir,
      // Headless (padrão, CI): viewport fixo 1440x900 — headless não tem janela visível, e
      // o viewport explícito evita a janela curta (~561px) que cobria a navbar no Dashboard.
      // Headed (--headed): viewport null + maximização — tela INTEIRA quando é o único
      // navegador visível, e fatia do lado a lado quando há 2+ (mesma regra do bdd-headed).
      use: {
        ...devices['Desktop Chrome'],
        ...(isHeadedRun
          ? {
              viewport: null,
              deviceScaleFactor: undefined,
              launchOptions: {
                args: ['--disable-save-password-bubble', ...windowArgsFor('bdd'), ...zoomArgs],
              },
            }
          : {
              viewport: TEST_VIEWPORT ?? { width: 1440, height: 900 },
              launchOptions: {
                args: ['--disable-save-password-bubble', ...zoomArgs],
              },
            }),
      },
    },
    {
      // Só pra assistir a execução. Viewport fixo (1920x1080) foi tentado antes pra fugir
      // do escalonamento de tela do Windows (DPI 125%/150%), mas esse tamanho fixo pode não
      // caber na tela real — aí o Chrome "estoura" pra fora da área visível. Correção:
      // viewport:null + --start-maximized deixa o Chrome maximizar pro tamanho real da tela
      // (qualquer que seja), e --force-device-scale-factor=1 trava o zoom em 100% mesmo com
      // escala do Windows ativa — sem isso, o DPI do Windows fazia o Chrome renderizar em
      // zoom diferente de 100%. slowMo dá tempo de acompanhar cada passo. Sempre --headed.
      name: 'bdd-headed',
      testDir: bddTestDir,
      use: {
        ...devices['Desktop Chrome'],
        // Projeto de assistir: sempre visível, mesmo sem --headed na CLI.
        headless: false,
        viewport: null,
        deviceScaleFactor: undefined,
        launchOptions: {
          // windowArgsFor devolve --start-maximized OU a fatia da tela no modo lado a lado.
          args: ['--disable-save-password-bubble', ...windowArgsFor('bdd-headed'), `--force-device-scale-factor=${TEST_ZOOM}`],
          slowMo: TEST_SLOWMO,
        },
      },
    },
    {
      // Microsoft Edge (channel 'msedge' usa o Edge instalado no Windows, não um binário
      // baixado pelo Playwright) — Edge é Chromium por baixo, então os mesmos launchOptions
      // do bdd-headed valem aqui (maximiza de verdade + trava zoom em 100%).
      name: 'edge',
      testDir: bddTestDir,
      use: {
        ...devices['Desktop Edge'],
        channel: 'msedge',
        // Projeto de assistir: sempre visível, mesmo sem --headed na CLI.
        headless: false,
        viewport: null,
        deviceScaleFactor: undefined,
        launchOptions: {
          // windowArgsFor devolve --start-maximized OU a fatia da tela no modo lado a lado.
          args: ['--disable-save-password-bubble', ...windowArgsFor('edge'), `--force-device-scale-factor=${TEST_ZOOM}`],
          slowMo: TEST_SLOWMO,
        },
      },
    },
    {
      // Firefox não entende os launchOptions.args do Chromium (--start-maximized,
      // --disable-save-password-bubble, --force-device-scale-factor não existem pra ele) —
      // por isso viewport fixo em vez de tentar maximizar, mesma solução do project 'bdd'.
      name: 'firefox',
      testDir: bddTestDir,
      use: {
        ...devices['Desktop Firefox'],
        viewport: TEST_VIEWPORT ?? { width: 1920, height: 1080 },
        launchOptions: { slowMo: TEST_SLOWMO },
      },
    },
  ].filter((project) => effectiveProjectNames.includes(project.name)),

  /* Run your local dev server before starting the tests */
  // webServer: {
  //   command: 'npm run start',
  //   url: 'http://localhost:3000',
  //   reuseExistingServer: !process.env.CI,
  // },
});
