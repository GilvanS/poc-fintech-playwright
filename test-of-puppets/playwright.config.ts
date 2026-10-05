import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { PORTA_API, PORTA_WEB, URL_API, URL_WEB } from './e2e/ambiente.ts';

/**
 * E2E da própria ferramenta. Sobe um servidor SÓ para o teste: porta própria, pasta de dados temporária
 * (nunca a `dados/` de verdade) e modo de teste (rota de reset). Nada do FintechBankApp é tocado.
 * Rodar: npm run test:e2e   (o Playwright e o Chromium vêm do projeto-pai).
 */
const dadosTemporarios = mkdtempSync(join(tmpdir(), 'puppets-e2e-'));

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
      env: { PUPPETS_PORT: String(PORTA_API), PUPPETS_DADOS: dadosTemporarios, PUPPETS_MODO_TESTE: '1' },
      url: `${URL_API}/api/saude`,
      reuseExistingServer: false,
      timeout: 60_000,
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
