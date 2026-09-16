# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## O que é este repo

Suíte E2E (Playwright + playwright-bdd/Cucumber + TypeScript) para o **FintechBankApp**
(repo irmão, roda separado). Este projeto só testa; a aplicação sob teste (WEB `:3000`,
API `:3001`) precisa estar rodando localmente antes de qualquer teste.

## Comandos

```bash
npm install && npx playwright install   # setup inicial

npm run bdd:gen                          # gera .features-gen/ a partir de tests/features/*.feature
                                          # (os scripts test:bdd* / bdd:<tag>* já chamam isso sozinhos)

npm run test:bdd                         # suíte BDD completa, headless
npm run test:bdd:headed                  # navegador visível, 1 worker

npm run bdd:login   / bdd:login:headed   # só @Login   (CT01.1–CT01.6)
npm run bdd:cadastro / bdd:cadastro:headed # só @Cadastro
npm run bdd:pix      / bdd:pix:headed    # só @Pix
npm run bdd:dashboard / bdd:dashboard:headed # só @Dashboard (em revisão, ver README)

npm run test:bdd:headed -- --grep "CT01.1"   # 1 cenário específico
npx playwright test --project=bdd-headed --headed --workers=1 --grep "<tag ou texto>"

npx playwright test --project=chromium tests/e2e/pagamentoFatura.spec.ts  # spec legado (não-BDD)

npm run type-check                       # tsc --noEmit (sem lint configurado no projeto)
npm run test:report                      # abre o último relatório HTML
npx playwright show-trace test-results/<pasta>/trace.zip

# gerador de massa (workspace local em packages/gerador-massa-unificado)
npm run massa:cadastro -- 10             # gera N massas novas em TBL_CADASTRO
cd packages/gerador-massa-unificado && npm test   # testes unitários do gerador (node --test)
```

Parâmetros de execução (browser, workers, zoom, viewport, base URL, video) ficam todos em
`.env` (versionado, sem segredos) e podem ser sobrescritos via shell — ex:
`TEST_PROJECT=firefox TEST_ZOOM=0.9 npm run bdd:login`. Ver tabela completa no README.

## Arquitetura

**Pipeline BDD:** `.feature` (Gherkin, `tests/features/`) → `bddgen` gera specs executáveis em
`.features-gen/` (não versionado) → `playwright.config.ts` seleciona o(s) browser(s) via
`TEST_PROJECT` → `tests/steps/*.steps.ts` faz o glue code → fixtures (`fixtures/testFixture.ts`)
injetam Page Objects + massa → `tests/pages/*.ts` executa ações contra `tests/locators/*.ts` →
cada step gera log + screenshot automáticos (via `tests/steps/hooks.steps.ts`), consolidados num
DOCX de evidência em `evidences/` ao fim do cenário. **Sempre que um `.feature` ou step mudar,
rode `npm run bdd:gen` antes de testar** — os scripts `test:bdd*`/`bdd:<tag>*` já fazem isso.

**Organização por tipo de arquivo** (não por feature), tudo flat dentro de cada pasta:
- `tests/features/` — só Gherkin, fonte da verdade do que é testado.
- `tests/steps/` — glue code, 1 arquivo por feature + `hooks.steps.ts` (BeforeStep loga o texto
  do step, AfterStep tira o screenshot — vale pra qualquer feature nova sem código extra).
- `tests/pages/` — 1 classe por tela: ações/validações atômicas **e** composição de negócio de
  setup multi-passo (ex: `DashboardPage.inicializarDashboard()`), tudo na mesma classe — não há
  camada "Flow" separada por tela. `tests/pages/components/` (Navbar, Popups) é reaproveitado
  por várias Pages.
- `tests/locators/` — 1 classe de locators por Page (POM clássico, sem nenhuma ação/assert).
- `tests/flows/auth.flow.ts` (`AuthFlow`) — **única** composição cross-Page do projeto (Landing +
  Dashboard, jornada de login); qualquer coisa que precise de 2+ Page Objects juntos vai aqui,
  não dentro de um Page específico.
- `tests/utils/` — infraestrutura (logger, evidenceHelper, TestContext, excelReader,
  excelTableAppender, summaryReporter — plugin do Playwright).
- `tests/e2e/` — specs `.spec.ts` legados ainda não convertidos para `.feature`.

**Convenção obrigatória:** todo step de ação/validação (incluindo `Then`) termina identificando a
tela/modal/área onde acontece (ex: `"...no modal de login"`, `"...na tela de Cadastro"`). Evita
step ambíguo e colisão de step definition entre features (`bddgen` falha com "Multiple
definitions matched scenario step" quando duas features usam o texto exato). Ao criar uma feature
nova, rode `npm run bdd:gen` para confirmar que não colidiu.

**Massa de dados (`data/MassaDados.xlsx`)** — 3 abas formatadas como Tabela do Excel:
`TBL_CENARIOS` (1 linha por cenário de login/dashboard/fatura, CPF/senha editados à mão),
`TBL_CADASTRO` (pool de candidatos a cadastro, prefixo `C_` no `ID_MASSA`), `TBL_MASSA_CADASTRADA`
(quem já foi cadastrado de verdade — gravado só depois do modal de sucesso confirmar). O cenário
de cadastro aponta um `ID_MASSA` fixo; se já estiver em `TBL_MASSA_CADASTRADA`, o teste **falha
explicitamente** sugerindo a próxima massa livre — nunca escolhe outra sozinho, e o código não
deve reintroduzir auto-pick. Qualquer escrita nessas abas precisa passar por
`tests/utils/excelTableAppender.ts` (edita o XML do `.xlsx` direto, preserva a formatação da
Tabela) — nunca usar `XLSX.writeFile()` do SheetJS pra reescrever o workbook inteiro, isso apaga a
formatação de Tabela.

**`packages/gerador-massa-unificado/`** — workspace npm local, port Node/TS de um gerador de
massa Java pré-existente (ver `docs/plans/gerador-massa-unificado-especificacao.md`); tem testes
próprios (`node --test`), roda isolado do resto da suíte Playwright.

**Regra ao adicionar browser/projeto novo:** todo script `test:<browser>` no `package.json`
precisa ter um `project` correspondente em `playwright.config.ts` no mesmo commit (já aconteceu de
divergir — ver `docs/MELHORIAS-PLAYWRIGHT.md`).

**Sem fallback de credencial silencioso:** helpers de massa de dados (`TestContext.ts` etc.) devem
sempre `console.warn` explícito quando o dado esperado não for encontrado, em vez de cair num
valor fixo sem aviso — mascarava teste mal nomeado ou massa ausente.
