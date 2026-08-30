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

### 3. `pages/components/` — Component Objects para UI compartilhada entre páginas

**Referência:** [testdino.com/blog/playwright-page-object-model](https://testdino.com/blog/playwright-page-object-model),
seção "Modeling reusable components".

**Problema:** o projeto tinha só `tests/pages/*.ts` (uma classe por tela).
O menu de navegação persistente pós-login (Perfil, Cartões, Shop, Sair do
App) estava declarado dentro de `DashboardPage.ts`, mas por natureza não é
conteúdo do Dashboard — é chrome de app que reaparece em qualquer tela
interna (Cartões, Shop, Perfil, etc.), hoje ainda não modeladas como Page
Object próprias. Deixar esses locators dentro de `DashboardPage` significa
duplicá-los quando essas outras páginas forem criadas.

**Correção:** criada `tests/pages/components/NavbarComponent.ts` (Component
Object) com os locators/ações do menu (`navigateToProfile`,
`navegarParaCartoes`, `navegarParaShop`, `navegarParaPerfil`, `sairDoApp`).
`DashboardPage` passou a compor o componente via propriedade pública:

```ts
// tests/pages/DashboardPage.ts
import { NavbarComponent } from "./components/NavbarComponent";

export class DashboardPage {
    readonly navbar: NavbarComponent;

    constructor(page: Page) {
        this.navbar = new NavbarComponent(page);
        // ...demais locators específicos do Dashboard
    }
}
```

Call sites passam a acessar via `dashboardPage.navbar.<ação>()` em vez de
`dashboardPage.<ação>()` (atualizado em `flows/auth.flow.ts`). Métodos que
validam/agem sobre *conteúdo* de tela (`validateProfileName`,
`aceitarOfertaShop`) continuaram em `DashboardPage` — não são chrome de
navegação, são específicos da tela.

**Regra daqui pra frente — quando extrair um Component Object:**
- Vira componente em `pages/components/` qualquer locator/ação que aparece
  **igual em mais de uma tela** (navbar, sidebar, modal genérico, header).
  Se só existe em uma tela hoje, ele fica no Page Object daquela tela até
  aparecer em uma segunda — não crie componente especulativo.
  Segue o mesmo princípio de não abstrair antes da necessidade real.
- O Page Object que usa o componente expõe ele como propriedade pública
  (`readonly navbar: NavbarComponent`) instanciada no próprio construtor —
  não via fixture separada. A fixture continua só injetando o Page Object
  pai; o componente é detalhe de implementação dele.
- Nome de arquivo/classe no padrão `<Nome>Component.ts` /
  `<Nome>Component`, dentro de `tests/pages/components/`, com barrel
  `tests/pages/components/index.ts` espelhando o barrel de `tests/pages/`.
- Ao mover um método existente pra dentro de um componente, manter o nome
  do método idêntico quando possível — só muda o caminho de acesso
  (`page.metodo()` → `page.componente.metodo()`), evitando diff misturado
  de "mover" com "renomear".

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
