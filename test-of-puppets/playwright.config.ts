import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { CPF_E2E_MASSA, PORTA_API, PORTA_APP_FALSO, PORTA_WEB, URL_API, URL_APP_FALSO, URL_WEB } from './e2e/ambiente.ts';
import { criarXlsxFalso } from './server/tests/massa.apoio.ts';

/**
 * E2E da própria ferramenta. Sobe um servidor SÓ para o teste: porta própria, pasta de dados temporária
 * (nunca a `dados/` de verdade) e modo de teste (rota de reset). Nada do FintechBankApp é tocado.
 * Rodar: npm run test:e2e   (o Playwright e o Chromium vêm do projeto-pai).
 */
const dadosTemporarios = mkdtempSync(join(tmpdir(), 'puppets-e2e-'));

// "Projeto de testes" de mentira para o Play/Stop: pasta temporária com o mínimo que o "Verificar ambiente" confere
// e comandos falsos (e2e/falso/executar.cjs). Nenhum teste de verdade roda e nada do FintechBankApp é tocado.
const raizFalsa = mkdtempSync(join(tmpdir(), 'puppets-e2e-raiz-'));
mkdirSync(join(raizFalsa, 'node_modules', '@playwright', 'test'), { recursive: true });
mkdirSync(join(raizFalsa, 'data'), { recursive: true });
writeFileSync(join(raizFalsa, 'package.json'), JSON.stringify({ scripts: { 'bdd:gen': 'echo falso' } }));
writeFileSync(join(raizFalsa, 'node_modules', '@playwright', 'test', 'package.json'), '{}');
// Planilha SINTÉTICA (server/tests/massa.apoio.ts) com a linha do CPF do CT03.1 da semente: o "Atualizar massa" grava nela, nunca no MassaDados.xlsx de verdade.
criarXlsxFalso(join(raizFalsa, 'data', 'MassaDados.xlsx'), CPF_E2E_MASSA);
const executarFalso = join(process.cwd(), 'e2e', 'falso', 'executar.cjs');

export default defineConfig({
  testDir: 'e2e',
  // Folga para máquina carregada: semear os dados de exemplo grava dezenas de arquivos e pode levar vários segundos.
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: { baseURL: URL_WEB, locale: 'pt-BR', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node --import tsx server/src/index.ts',
      env: {
        PUPPETS_PORT: String(PORTA_API),
        PUPPETS_DADOS: dadosTemporarios,
        PUPPETS_MODO_TESTE: '1',
        PUPPETS_RAIZ: raizFalsa,
        PUPPETS_CMD_GERAR: `node "${executarFalso}" gerar`,
        PUPPETS_CMD_RODAR: `node "${executarFalso}" rodar {id}`,
        PUPPETS_URLS_APP: `${URL_API}/api/saude`,
        PUPPETS_APP_URL: URL_APP_FALSO,
        PUPPETS_APP_TOKEN: 'tk-e2e',
      },
      url: `${URL_API}/api/saude`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: 'node e2e/falso/app-falso.cjs',
      env: { PORTA_APP_FALSO: String(PORTA_APP_FALSO), CPF_E2E_MASSA },
      url: `${URL_APP_FALSO}/saude`,
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: 'npx vite --config vite.config.ts',
      env: { PUPPETS_API: URL_API, PUPPETS_WEB_PORT: String(PORTA_WEB) },
      url: URL_WEB,
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
