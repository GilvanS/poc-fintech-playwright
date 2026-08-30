# Auditoria de padrão Playwright — melhorias aplicadas

Data: 2026-08-30

## Contexto

Análise do projeto contra as boas práticas oficiais do Playwright (Page Object
Model, fixtures, locators resilientes, ausência de waits arbitrários,
paralelismo/CI). O projeto já seguia o padrão na maior parte: POM em
`tests/pages`, camada de `flows` reutilizáveis, fixtures customizadas em
`fixtures/testFixture.ts`, locators via `getByRole`/`getByTestId`, dados via
Excel (`tests/utils/excelReader.ts`) e nenhum `waitForTimeout`/sleep
hardcoded.

Dois pontos de risco foram corrigidos nesta rodada.

## O que foi corrigido

### 1. `playwright.config.ts` — projetos `firefox`/`webkit` ausentes

**Problema:** `package.json` define `test:firefox` e `test:webkit`
(`playwright test --project=firefox|webkit`), mas `projects` só declarava
`chromium`. Rodar esses scripts falhava com `Project(s) "firefox" not found`.

**Correção:** adicionados os projetos `firefox` (`devices['Desktop Firefox']`)
e `webkit` (`devices['Desktop Safari']`) ao array `projects`, alinhando o
config com os scripts já existentes.

**Regra daqui pra frente:** todo script `test:<browser>` no `package.json`
precisa ter um `project` correspondente em `playwright.config.ts`. Ao
adicionar um novo browser/dispositivo a um script, adicionar o projeto no
mesmo commit.

### 2. `tests/utils/TestContext.ts` — fallback de credencial silencioso

**Problema:** `getLoginModel()` retornava um CPF/senha fixos
(`11111111111` / `admin999`) sem nenhum aviso sempre que:
- o título do teste não batia com o regex de ID de cenário (`CTxx.x`), ou
- a busca no Excel falhava silenciosamente antes de popular o contexto.

Isso mascara teste mal nomeado ou massa de dados ausente — o teste roda com
credencial fixa sem ninguém perceber que a massa esperada não foi carregada.
Além disso essa credencial específica é conhecida por ficar desatualizada
com o tempo (ambiente já teve troca de credencial de admin).

**Correção:** adicionado `console.warn(...)` explícito no branch de fallback,
apontando que nenhuma massa foi encontrada e sugerindo verificar o padrão do
título do teste ou a existência do CPF em `TBL_CENARIOS`. O valor retornado
não mudou — o objetivo é tornar o fallback visível no log, não quebrar specs
que hoje dependem dele.

**Regra daqui pra frente:**
- Não usar fallback de credencial silencioso em nenhum novo helper de massa
  de dados — sempre logar quando o dado esperado não for encontrado.
- Se este fallback disparar no CI/local sem ser esperado, tratar como sinal
  de teste com título fora do padrão ou massa faltando no Excel — não como
  comportamento normal.
- Antes de trocar a credencial fixa, confirmar no ambiente-alvo qual login
  está de fato válido (credenciais de ambiente mudam; não assumir a
  constante do código como fonte de verdade).

## O que foi analisado mas **não** alterado (decisão, não bug)

- **`baseURL` aponta direto para `/login`** (`http://localhost:3000/FintechBankApp/login`)
  em vez da raiz do site. Funciona porque `LandingPage.visit()` usa
  `page.goto('/')` relativo, mas é atípico — normalmente `baseURL` fica na
  raiz. Não alterado por ser decisão de configuração de ambiente, não erro.
- **`webServer` comentado** no config — os testes dependem do app já estar
  rodando manualmente em `localhost:3000` antes da suíte iniciar. Não
  configurado automaticamente aqui porque exigiria assumir o comando de
  start do app (WEB/API neste monorepo), o que não foi confirmado. Regra:
  **sempre subir o app manualmente antes de rodar `npm test` neste projeto**
  até que um `webServer` explícito seja configurado e validado.

## Padrões já corretos (manter)

- Page Object Model com locators privados e métodos de ação/assert no
  próprio Page Object (`tests/pages/*.ts`).
- Camada de `flows` para jornadas reutilizáveis multi-step
  (`flows/auth.flow.ts`, `flows/cadastro.flow.ts`).
- Fixtures customizadas (`fixtures/testFixture.ts`) injetando pages, flows e
  modelos de dados — specs não instanciam nada manualmente.
- Locators resilientes: `getByRole`, `getByTestId`, `getByText` — evitar
  introduzir seletor CSS/XPath frágil em novos testes.
- Nenhum `waitForTimeout`/sleep fixo — manter essa regra em código novo;
  usar `expect(...).toBeVisible()` / auto-waiting do Playwright.
- Dados de teste via Excel (`TestContext` + `excelReader.ts`), amarrados ao
  ID do cenário no título do teste (`CTxx.x`) — ao criar teste novo, seguir
  esse padrão de nomenclatura para a massa ser carregada automaticamente.
- `.env` fora do controle de versão — nunca commitar credencial real.
