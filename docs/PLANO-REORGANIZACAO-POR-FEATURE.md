# Plano: reorganizar estrutura por feature (inspirado em Digio/Uber)

Data: 2026-09-11
Status: **planejado, não iniciado**

## Contexto

Analisando os projetos mobile do time (`digio-qa-digio-mobile`,
`digio-qa-uber-mobile`), a organização de código deles é **por feature**
(fatia vertical), não por tipo de arquivo:

```
test/business/<feature>/
  XxxPage.java     ← locators da tela
  XxxLogic.java    ← ações/regra de negócio (equivalente ao nosso "Flow")
  XxxSteps.java    ← glue do Gherkin
resources/features/<domínio>/*.feature
```

Tudo de UMA feature mora na mesma pasta. `core/` é só infraestrutura
(driver, exceptions, logger) — equivalente ao nosso `tests/utils/`.

Este projeto (`poc-fintech-playwright`) organiza **por tipo de arquivo**:

```
tests/pages/*.ts     ← todas as páginas juntas (Landing, Cadastro, Pix, Dashboard)
tests/steps/*.ts     ← todos os steps juntos
flows/*.ts           ← todos os flows juntos (na raiz do projeto, nem dentro de tests/)
tests/features/*.feature
```

Pra mexer na feature "Pix" hoje é preciso abrir 3-4 pastas diferentes
(`tests/features/`, `tests/steps/`, `tests/pages/`, `flows/`) em vez de uma só.

Achado relacionado (já registrado, ainda não corrigido): `flows/` fica fora
do `include` do `tsconfig.json` (`tests/**/*.ts`, `fixtures/**/*.ts`,
`playwright.config.ts` — `flows/**/*.ts` não está listado). Só é
type-checado hoje porque `fixtures/testFixture.ts` importa `from '../flows'`
e o TS inclui transitivamente qualquer arquivo alcançável por import de um
arquivo já incluído. Se esse import sumir num refactor futuro, `flows/`
para de ser verificado silenciosamente, sem erro nenhum.

## Estrutura proposta

```
tests/
  features/
    login/
      login.feature
      login.steps.ts
    cadastro/
      cadastro.feature
      cadastro.steps.ts
      cadastroPage.ts
      cadastro.flow.ts
    pix/
      pix.feature
      pix.steps.ts
      PixPage.ts
      pix.flow.ts
    dashboard/
      dashboard.feature
      dashboard.steps.ts
      DashboardPage.ts
      dashboard.flow.ts
  pages/
    LandingPage.ts        ← compartilhada entre login/cadastro (ponto de entrada)
    components/            ← Navbar/Popups, usados por várias features — continuam à parte
  utils/                   ← infraestrutura (logger, evidenceHelper, TestContext, massaCadastroXlsx...)
  e2e/                     ← specs legados .spec.ts (não mexer agora)
fixtures/testFixture.ts   ← fica na raiz (injeta tudo, não pertence a 1 feature só)
```

Observações de design:
- `LandingPage.ts` fica fora das pastas de feature porque é ponto de entrada
  compartilhado por login E cadastro (`visit()`, `openLoginModal()`,
  `goToSignUp()`) — não pertence a uma feature só.
- `components/` (Navbar, Popups) continua separado pelo mesmo motivo: usado
  por `DashboardPage`, `PixPage` e outras.
- `DashboardPage`/`dashboard.flow.ts` entram na pasta `dashboard/` mesmo
  sendo usados por outras features (ex: `PixFlow` usa `DashboardPage` pra
  ler saldo) — isso é import cross-feature normal, igual acontece no
  Digio/Uber entre módulos de negócio relacionados.

## Arquivos afetados (mapeamento)

| Atual | Novo |
|---|---|
| `tests/features/login.feature` | `tests/features/login/login.feature` |
| `tests/steps/login.steps.ts` | `tests/features/login/login.steps.ts` |
| `tests/features/cadastro.feature` | `tests/features/cadastro/cadastro.feature` |
| `tests/steps/cadastro.steps.ts` | `tests/features/cadastro/cadastro.steps.ts` |
| `../tests/pages/cadastroPage.ts` | `tests/features/cadastro/CadastroPage.ts` |
| `flows/cadastro.flow.ts` | `tests/features/cadastro/cadastro.flow.ts` |
| `tests/features/pix.feature` | `tests/features/pix/pix.feature` |
| `tests/steps/pix.steps.ts` | `tests/features/pix/pix.steps.ts` |
| `tests/pages/PixPage.ts` | `tests/features/pix/PixPage.ts` |
| `flows/pix.flow.ts` | `tests/features/pix/pix.flow.ts` |
| `tests/features/dashboard.feature` | `tests/features/dashboard/dashboard.feature` |
| `tests/steps/dashboard.steps.ts` | `tests/features/dashboard/dashboard.steps.ts` |
| `tests/pages/DashboardPage.ts` | `tests/features/dashboard/DashboardPage.ts` |
| `flows/dashboard.flow.ts` | `tests/features/dashboard/dashboard.flow.ts` |
| `flows/auth.flow.ts` | fica em `tests/pages/` (usa Landing+Dashboard, cross-feature) ou pasta `tests/features/login/` — decidir na hora |
| `tests/steps/hooks.steps.ts` | fica em `tests/steps/hooks.steps.ts` (global, não é de 1 feature) — **ou** criar `tests/support/hooks.steps.ts` |
| `tests/pages/LandingPage.ts` | mantém em `tests/pages/LandingPage.ts` |
| `tests/pages/components/*` | mantém em `tests/pages/components/` |
| `tests/pages/FaturasPage.ts` | avaliar — spec legado (`pagamentoFatura.spec.ts`), não tem feature BDD ainda |
| `tests/pages/index.ts` (barrel) | precisa reexportar dos novos caminhos |
| `flows/index.ts` (barrel) | remover ou apontar pros novos caminhos por feature |

## Pontos de configuração que precisam mudar

1. **`playwright.config.ts`** — `defineBddConfig({ features: 'tests/features/**/*.feature', steps: [...] })`. O glob `tests/features/**/*.feature` já cobre subpastas, não muda. O array `steps: ['tests/steps/**/*.ts', 'fixtures/testFixture.ts']` precisa virar `['tests/features/**/*.steps.ts', 'tests/steps/hooks.steps.ts', 'fixtures/testFixture.ts']` (ou manter `tests/**/*.steps.ts` se hooks.steps.ts também for movido pra dentro de `tests/features/`).
2. **`tsconfig.json`** — `include` já tem `tests/**/*.ts`, cobre a nova estrutura automaticamente. Resolve de graça o problema do `flows/` fora do include (não existe mais `flows/` na raiz).
3. **`tests/pages/index.ts`** e **`flows/index.ts`** — barrels precisam apontar pros novos caminhos, ou serem eliminados em favor de import direto por feature.
4. **Todos os imports relativos** em cada arquivo movido (`../tests/utils/...`, `../../fixtures/...`, `../pages`, etc.) — cada nível de aninhamento muda.
5. **`fixtures/testFixture.ts`** — imports de `LandingPage, DashboardPage, CadastroPage, FaturasPage, PixPage` e `AuthFlow, CadastroFlow, DashboardFlow, PixFlow` precisam apontar pros novos caminhos por feature.
6. **`README.md`** — diagrama da árvore de pastas (seção "Arquitetura BDD") precisa ser redesenhado.

## Passo a passo sugerido (pra quem retomar)

1. Criar as pastas `tests/features/login/`, `tests/features/cadastro/`,
   `tests/features/pix/`, `tests/features/dashboard/`.
2. Mover 1 feature por vez (começar por `dashboard` — a mais simples/menor
   risco, já documentada como "em revisão"), rodando `tsc --noEmit` +
   `npx bddgen` depois de cada uma antes de seguir pra próxima.
3. Deixar `login` por último (é a mais usada por Background de outras
   features via steps globais — `que acesso a landing page` e `eu realizo
   login...` continuam em `tests/steps/login.steps.ts` ou movem pra um
   `tests/support/`, a decidir).
4. Atualizar `playwright.config.ts` (glob de `steps`) e `tsconfig.json` só
   se necessário (deve funcionar sem mudança, ver seção acima).
5. Rodar a suíte completa de cada feature (`npm run bdd:login`,
   `bdd:cadastro`, `bdd:pix`, `bdd:dashboard`) headless antes de considerar
   concluído.
6. Atualizar o diagrama de pastas no `README.md`.

## Decisões em aberto (perguntar ao usuário quando retomar)

- `auth.flow.ts` e `hooks.steps.ts` são cross-feature — onde exatamente
  morar? Proposta: criar `tests/support/` pra código global que não é de
  nenhuma feature específica (hooks, auth flow, landing page compartilhada).
- Vale a pena manter os barrels `index.ts` (`tests/pages/index.ts`,
  `flows/index.ts`) ou trocar tudo por import direto do arquivo?
- `FaturasPage.ts` (usada só pelo spec legado `pagamentoFatura.spec.ts`,
  ainda sem `.feature`) — mover pra dentro de uma pasta de feature futura
  "fatura", ou deixar em `tests/pages/` até virar BDD?
