# POC Fintech - Automação de Testes com Playwright + Cucumber (BDD)

> Suíte de testes End-to-End (E2E) para o **FintechBankApp**, em **Playwright** + **playwright-bdd** (Cucumber/Gherkin) com **Node.js/TypeScript**.

![Playwright](https://img.shields.io/badge/Playwright-2EAD33?style=for-the-badge&logo=playwright&logoColor=white)
![Cucumber](https://img.shields.io/badge/Cucumber-23D96C?style=for-the-badge&logo=cucumber&logoColor=white)
![NodeJS](https://img.shields.io/badge/Node.js-6DA55F?style=for-the-badge&logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)

## Sobre o Projeto

Testes automatizados das jornadas críticas do FintechBankApp: login, cadastro de novo usuário, dashboard e pagamento de fatura. A suíte está em transição de specs `.spec.ts` (Playwright puro) para cenários `.feature` em Gherkin, rodados via **playwright-bdd** — mesmo motor de execução do Playwright, com os cenários escritos em português natural.

### Documentação Oficial

- [Documentação do Playwright](https://playwright.dev/docs/intro)
- [playwright-bdd](https://vitalets.github.io/playwright-bdd/)

---

## Pre-requisitos

- **[Node.js](https://nodejs.org/)** (LTS recomendado)
- **Git**
- FintechBankApp rodando localmente: **WEB** em `http://localhost:3000` e **API** em `http://localhost:3001`

## Instalação

```bash
git clone git@github.com:GilvanS/poc-fintech-playwright.git
cd poc-fintech-playwright
npm install
npx playwright install
```

---

## Arquitetura BDD

Organização **por tipo de arquivo** (padrão Node/Playwright, não por feature):
`locators/` (elemento da tela), `pages/` (ações + validações + composição de
negócio, tudo numa classe só) e `steps/` (glue code do Gherkin) ficam cada um
na sua pasta, flat — sem subpasta por feature. Do Digio/Uber (projetos mobile
Java/Appium/Cucumber do time) o projeto herda só convenções que não são de
estrutura de pasta: nomear a tela no texto do step, o padrão de log/evidência
(Hooks.java) e a organização da massa em Excel — ver seções abaixo.

```
tests/
├── features/             # SÓ Gherkin (.feature) — a fonte da verdade do QUE é testado
│   ├── login.feature
│   ├── cadastro.feature
│   ├── pix.feature
│   └── dashboard.feature   # em revisão — telas mudaram, ver "Status atual" abaixo
├── steps/                 # Glue code do Gherkin — flat, 1 arquivo por feature + hooks globais
│   ├── login.steps.ts
│   ├── cadastro.steps.ts
│   ├── pix.steps.ts
│   ├── dashboard.steps.ts
│   └── hooks.steps.ts        # BeforeStep/AfterStep globais (log + print automático)
├── pages/                 # Page Objects — 1 classe por tela: ações/validações atômicas
│   │                      # + composição de negócio (setup multi-passo), tudo junto
│   ├── LandingPage.ts        # tela de login (compartilhada por login E cadastro)
│   ├── CadastroPage.ts
│   ├── PixPage.ts
│   ├── DashboardPage.ts
│   ├── FaturasPage.ts        # usada só pelo e2e/ por ora
│   └── components/            # Navbar, Popups — reaproveitados por vários Pages
├── locators/               # 1 classe de locators por Page (mesmo nome, sufixo Locators)
│   ├── LoginLocators.ts
│   ├── CadastroLocators.ts
│   ├── PixLocators.ts
│   ├── DashboardLocators.ts
│   └── FaturasLocators.ts
├── massa-types/            # Interfaces de dado de UI (LoginModel/CadastroModel) — tipam
│                           # a massa vinda do Excel pra preencher formulário, NÃO é DTO de API
├── utils/                  # Tudo que não é Page/Locator/Step/Flow: logger, evidenceHelper,
│                           # TestContext, excelReader, massaCadastroXlsx, massaPix,
│                           # excelTableAppender.ts (edição crua do .xlsx) e summaryReporter.ts
│                           # (plugin do Playwright)
├── flows/                  # Composição CROSS-Page (usa 2+ Page Objects juntos)
│   └── auth.flow.ts          # AuthFlow: jornada de login (LandingPage + DashboardPage)
└── e2e/                    # Specs legados .spec.ts, ainda não convertidos pra BDD
    └── pagamentoFatura.spec.ts   # único fluxo sem .feature próprio ainda

fixtures/testFixture.ts  # Fixture ÚNICA do projeto: 1 fixture por Page Object (landingPage/
                          # cadastroPage/pixPage/dashboardPage/faturasPage) + a camada composta
                          # cross-feature (authFlow, massa, logger automático), tudo num
                          # .extend() só em cima do test do playwright-bdd
packages/gerador-massa-unificado/  # Pacote local (npm workspace) — gerador de dados sintéticos
  └── scripts/              # Scripts de massa (gerar/corrigir/formatar) — ver "Massa de Dados" abaixo
data/MassaDados.xlsx      # Massa de dados real usada pelos testes (ver seção própria abaixo)
```

`tests/flows/auth.flow.ts` (`AuthFlow`) é a única composição CROSS-Page do
projeto — usa `LandingPage` + `DashboardPage` juntos pra jornada de login — por
isso não cabe dentro de nenhum `Page` específico e ganha pasta própria
(`flows/`), separada de `utils/` (que é infra, não lógica de teste).

**Como um `.feature` vira teste executável:** `playwright.config.ts` declara `defineBddConfig({ features: 'tests/features/**/*.feature', steps: [...] })`, que gera specs `.spec.js` dentro de `.features-gen/` (pasta gerada, não versionada) — é isso que o Playwright de fato roda. Sempre que um `.feature` ou step muda, rode `npm run bdd:gen` antes de testar (os scripts `npm run test:bdd*` já fazem isso sozinhos).

### Pipeline de execução (do Gherkin ao navegador)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    1. ESPECIFICAÇÃO (BDD)                                │
│   tests/features/*.feature — Cenários em Gherkin (Given, When, Then)     │
└────────────────────────────────────┬──────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│              2. GERADOR PLAYWRIGHT-BDD ("npm run bdd:gen")               │
│   Converte Gherkin em specs nativas executáveis → .features-gen/         │
└────────────────────────────────────┬──────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│           3. CONFIGURAÇÃO & SELEÇÃO DE NAVEGADOR                         │
│   playwright.config.ts — lê TEST_PROJECT/TEST_ZOOM/TEST_WORKERS (.env)   │
│   e filtra quais projects sobem: chromium | bdd | bdd-headed | edge |    │
│   firefox (default: só "bdd", headless)                                  │
└────────────────────────────────────┬──────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│              4. STEP DEFINITIONS (Glue Code) + HOOKS GLOBAIS              │
│   tests/steps/*.steps.ts — mapeia texto do .feature pra ação do Page      │
│   tests/steps/hooks.steps.ts — BeforeStep (log ▶️) / AfterStep (print)    │
│   rodam pra QUALQUER .feature, sem precisar chamar nada manualmente      │
└────────────────────────────────────┬──────────────────────────────────────┘
                                     │ injeta fixtures
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│         5. FIXTURES (Injeção de Dependência) — fixtures/testFixture.ts   │
│   Instancia Page Objects e massa de dados; expõe tudo pros steps via     │
│   desestruturação: async ({ dashboardPage, authFlow, loginModel }) => .. │
└────────────────────────────────────┬──────────────────────────────────────┘
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│              6. PAGE OBJECTS (ações + validações + negócio)              │
│   tests/pages/<Tela>Page.ts — 1 classe por tela: ações/validações        │
│   atômicas (1 clique, 1 preenchimento) + composição de negócio (setup    │
│   multi-passo, ex: DashboardPage.inicializarDashboard() = validar        │
│   carregado + fechar modal). tests/utils/auth.flow.ts (AuthFlow) é a     │
│   única composição CROSS-Page (Landing + Dashboard). components/         │
│   (Navbar, Popups) são reaproveitados por vários Pages.                  │
└──────────┬──────────────────────────────────────────────────────────────┘
           │ usa locators de tests/locators/<Tela>Locators.ts
           ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                  7. MASSA DE DADOS + EVIDÊNCIA                           │
│   data/MassaDados.xlsx (via TestContext.ts / massaCadastroXlsx.ts)       │
│   alimenta CPF/senha/dados do cenário → resultado de cada step vira      │
│   screenshot automático → evidenceHelper.ts monta o DOCX em evidences/   │
└─────────────────────────────────────────────────────────────────────────┘
```

### Locators separados, ações + negócio no Page

```
              ┌───────────────────────────┐
              │   fixtures/testFixture.ts  │
              │   (injeta instâncias já    │
              │    prontas pros steps)     │
              └─────────────┬─────────────┘
                            │
                            ▼
              ┌───────────────────────────┐              ┌──────────────────────────┐
              │   <Tela>Page.ts             │◄────usa──────│   <Tela>Locators.ts       │
              │   (1 classe por tela)       │              │   (1 classe por tela,     │
              │                             │              │    SÓ Locator, sem ação)  │
              │   ações/validações          │              └──────────────────────────┘
              │     atômicas (1 clique,     │
              │     1 preenchimento)        │
              │   + composição de negócio   │
              │     (setup multi-passo:     │
              │      DashboardPage.         │
              │      inicializarDashboard() │
              │      = validar carregado +  │
              │      fechar modal +         │
              │      fechar painel Saúde    │
              │      Financeira)            │
              └─────────────┬───────────────┘
                            │ herda componentes
                            ▼
              ┌───────────────────────────┐
              │   components/               │
              │   NavbarComponent            │
              │   PopupsComponent            │  ← reaproveitados por VÁRIOS Pages
              └───────────────────────────┘

Regra do projeto: locators ficam SEMPRE numa classe própria em tests/locators/
(POM clássico) — o Page correspondente recebe essa classe no construtor
(this.locators) e concentra TUDO que é comportamento: ação atômica E
composição de negócio, sem uma 3ª camada "Flow" separada. Steps chamam método
do Page direto pra ação isolada e rastreável (1 linha = 1 print de evidência,
ex: cadastro.steps.ts → cadastroPage.X()) e também pra composites de SETUP
que não fazem sentido virar step próprio (ex: "o dashboard está inicializado"
→ dashboardPage.inicializarDashboard()). A única exceção cross-Page é
AuthFlow (tests/utils/auth.flow.ts), que compõe Landing + Dashboard pra
jornada de login.
```

### Convenção: sempre nomear a tela no step

Regra do projeto (mesmo princípio do `LoginSteps.java` dos projetos mobile Digio/Uber —
`"preencho o campo 'CPF' na tela 'Login'"`): todo step de ação/validação termina
identificando a tela onde acontece. Evita duas coisas ao mesmo tempo — steps
ambíguos ("preencho o campo CPF" poderia ser login OU cadastro) e colisão de
step definition (duas features com o mesmo texto exato quebram o `bddgen` com
"Multiple definitions matched scenario step").

| Feature | Qualificador usado | Exemplo |
|---|---|---|
| `login.feature` | `no modal de login` | `eu preencho o campo "CPF" com o CPF do cenário no modal de login` |
| `cadastro.feature` | `na tela de Cadastro` | `eu preencho o campo "CPF" com o CPF do cenário na tela de Cadastro` |
| `pix.feature` | `na Área PIX` | `eu preencho a chave Pix com os dados do cenário na Área PIX` |
| `dashboard.feature` | `no Dashboard` | `eu confirmo o pagamento no Dashboard` |

Pra uma feature nova: escolha um qualificador (o nome da tela/modal/área como o
usuário a reconhece), aplique em TODO step novo daquela tela — incluindo os
`Then` de validação, não só os `When` de ação — e confira com `npm run bdd:gen`
que não apareceu "Multiple definitions matched scenario step" (colisão com
step de outra feature).

**Log e evidência são automáticos — sem código por step.** `hooks.steps.ts` tem 2 hooks globais que valem pra QUALQUER `.feature` novo, sem precisar chamar nada manualmente:
- `BeforeStep` loga o texto de cada step Gherkin (`▶️  <texto do step>`).
- `AfterStep` tira um screenshot depois de cada step, anexado automaticamente no relatório DOCX gerado ao fim do cenário (`evidences/`, via `evidenceHelper.ts` + `docxtemplater`).

Cada cenário começa com um cabeçalho padronizado no log (massa carregada → separador `Execucao/Feature/UUID` → `Iniciando execução`), montado pela fixture `testLogger` (`fixtures/testFixture.ts`).

---

## Massa de Dados (`data/MassaDados.xlsx`)

3 abas, cada uma formatada como **Tabela do Excel** (filtro + listras — Ctrl+T), pra facilitar consulta/filtro manual:

| Aba | Uso |
|---|---|
| `TBL_CENARIOS` | 1 linha por cenário de **login/dashboard/fatura** (`CT01.x`, `CT03.1`, `cadastrar`) — CPF/senha/saldo fixos, editados à mão. Quem decide qual massa cada cenário usa é quem edita a planilha, não o código. |
| `TBL_CADASTRO` | Pool de candidatos pra teste de **cadastro** (nome/email/CPF/senha ainda não registrados no app). Prefixo `C_` no `ID_MASSA` (ex: `C_0021`) diferencia esse pool das massas de `TBL_CENARIOS`. |
| `TBL_MASSA_CADASTRADA` | Registro de quem já foi cadastrado de verdade (gravado automaticamente após o modal de sucesso do cadastro confirmar — nunca antes). `ID_MASSA` aqui vem SEM o prefixo `C_` (uma vez cadastrada, a massa "gradua" pra massa normal). |

**Regra do cenário de cadastro:** `TBL_CENARIOS`/linha `cadastrar` aponta um `ID_MASSA` fixo de `TBL_CADASTRO`. Se essa massa já estiver em `TBL_MASSA_CADASTRADA` (já foi usada), o teste **falha com erro explícito** sugerindo a próxima massa livre — nunca escolhe outra sozinho. Pra gerar mais massa de cadastro: `npm run massa:cadastro -- 10`.

**Premissa da massa viva — o banco da fintech diverge da planilha:** as colunas de valor de `TBL_CENARIOS` (`fatura_fechada`, `fatura_aberta`, `saldo_conta`, `lim_utilizado`, `lim_disponivel`…) são o retrato de quando o script da própria fintech gerou a massa. Como o app movimenta o próprio banco (compras, encargos, pagamentos — inclusive os das execuções anteriores da suíte), a partir da 2ª execução a UI pode mostrar valores diferentes da planilha. **Isso é estado real do banco, não massa errada** — exemplo real: CT03.1 com `fatura_aberta = 6.392,45` na planilha e R$ 7.682,74 na UI (que batia com o `lim_utilizado` vivo). A suíte é desenhada pra essa premissa:

- Valores da planilha são **entrada de ação** (ex: `fatura_fechada` define o valor a pagar) e base de cálculo do mínimo (CT03.2) — nunca assert de igualdade contra a UI.
- Validações antes/depois (Fatura Aberta, Limite Disponível, Saldo) comparam **valores lidos da UI** entre si, não contra a planilha.
- `lim_disponivel` **negativo** é massa válida (limite estourado): o teste valida o **delta** do limite após o pagamento (sobe no máximo o valor pago, nunca cai), não o sinal nem o valor absoluto.

**Preservação da formatação:** escritas nessas abas (`registrarMassaCadastrada`, `gerarMassaCadastro.ts`) usam `tests/utils/excelTableAppender.ts` — acrescenta linha via edição direta do XML do `.xlsx` (zip), nunca reescreve o workbook inteiro. Isso preserva a Tabela do Excel e todo o resto do arquivo intacto; a biblioteca `xlsx` (SheetJS free) usada só pra LEITURA não sabe re-emitir Tabelas do Excel na escrita, então qualquer script que reescreva o workbook inteiro com `XLSX.writeFile()` apagaria a formatação — `packages/gerador-massa-unificado/scripts/corrigirTblCadastro.ts` (migração pontual já aplicada) já foi corrigido pra chamar `formatarTabelas()` automaticamente depois, restaurando a formatação sozinho se for rodado de novo.

---

## Como Rodar os Testes

### Suíte BDD completa (recomendado)

```bash
npm run massa:cadastro -- 5 # gera 5 massas de cadastro novas (TBL_CADASTRO)
npm run test:bdd            # headless
npm run test:bdd:headed     # navegador visível, Chrome maximizado, 1 worker
```

### Testes por Feature

Padrão único pra todas as features: `bdd:<tag>` (headless) e `bdd:<tag>:headed` (navegador
visível) — `<tag>` é sempre o nome da tag `@Feature` em minúsculo, sem conjugação (por isso
`bdd:cadastro`, não `bdd:cadastrar`).

```bash
npm run bdd:login             # headless — os 6 cenários @Login (CT01.1 a CT01.6)
npm run bdd:login:headed      # navegador visível, Chrome maximizado, 1 worker

npm run bdd:cadastro          # headless — @Cadastro (CT00 completo + CT00.1-.5 campo obrigatório)
npm run bdd:cadastro:headed

npm run bdd:pix               # headless — @Pix (CT02.1-.3)
npm run bdd:pix:headed

npm run bdd:dashboard         # headless — @Dashboard
npm run bdd:dashboard:headed
```

#### ⚠️ Intervalo entre execuções do CT03.2 (mínimo 90s entre pagamentos)

O CT03.2 paga o **mínimo** da fatura fechada. A API do app tem uma **guarda de idempotência**
(`POST /cards/invoice/pay`): pagamento de **mesmo CPF + mesmo valor** dentro de uma janela de
**90s** é tratado como reenvio — é **descartado SEM débito** (sem transação no banco) e a
resposta volta com `idempotent: true, debitado: false, amountPaid: 0` (mitigação de dupla
cobrança; ver `docs/BUG-REPORT-FATURA-FECHADA-IMUTAVEL-PAGAMENTO-MINIMO.md`).

Consequências práticas:

- **Duas rodadas do CT03.2 com menos de 90s entre o clique de confirmar** → a 2ª cai na
  guarda: a suíte **falha com causa explícita** (`[Dívida não baixou o valor pago]...`) pelo
  assert de dívida derivada — comportamento **correto** (antes do fix isso passava como
  sucesso falso).
- No ritmo natural da suíte (run completa ≈ 75–90s + reinício do navegador) o intervalo
  entre cliques fica em ~100–116s — **dentro do seguro**. Cuidado apenas ao encadear
  execuções manuais em loop ou com `--grep` em cenários que pagam o MESMO valor seguidas.
- Para repetir o CT03.2 na mesma massa em regressão, **espaçe ≥ 100s entre os cliques de
  confirmação** (ou troque de massa em `TBL_CENARIOS`).
- O cenário **BDD permanente** `@CT03.7` automatiza a validação determinística do reenvio:
  `npm run test:ct03.7` (ou dentro do `test:ct03.all`). A massa é a linha CT03.7 de
  `TBL_CENARIOS` (cópia dos dados da CT03.2): o teste injeta o pagamento original via API
  com o modal de PIN já aberto, paga o mínimo pela UI em seguida e valida: **toast**
  "Este pagamento já havia sido processado…", **ausência** do modal falso de sucesso e
  **+1 pagamento** no histórico (só a injeção).
- ⚠️ CT03.7 usa o MESMO CPF+valor do CT03.2 (cópia da linha na planilha): rodar
  `test:ct03.2` e **imediatamente** `test:ct03.7` coloca a injeção do CT03.7 a ~60s do
  clique do CT03.2 — dentro da janela de 90s — e a INJEÇÃO cai na guarda (falha explícita
  `Injeção do pagamento original via API falhou... idempotent`). Espere ≥ 90s entre as duas
  execuções. Dentro do `test:ct03.all` não há risco: os cenários intermediários (CT03.3–05)
  distanciam os pagamentos em vários minutos. No `test:ct03.7` isolado também não há risco:
  a injeção é sempre o 1º POST de 142,28 do ciclo (após login/navegação), e o reenvio da UI
  vem 3–10s depois — o par guarda/cenário funciona como desenhado.

### Parâmetros de execução (`.env`)

Todos os parâmetros de execução ficam no **`.env`** (leia pelo `playwright.config.ts`). O arquivo
**é versionado** — contém só parâmetros de execução, sem segredos. Um valor definido no
**shell vence** o `.env`, então dá pra trocar pontualmente sem editar arquivo:

```bash
TEST_ZOOM=0.9 TEST_PROJECT=firefox npm run bdd:login
```

| Variável | Default | O que controla |
|---|---|---|
| `TEST_PROJECT` | `bdd` | Navegador(es) que rodam: `bdd` (Chrome headless), `bdd-headed`, `edge`, `firefox`, `chromium` (specs legados). Vários: `edge,bdd`. Todos: `all`. |
| `TEST_WORKERS` | *(padrão do Playwright)* | Quantidade de testes em paralelo. `1` = sequencial, `4` = 4 ao mesmo tempo. |
| `RECORD_VIDEO` | `false` | `true` grava vídeo de cada teste em `test-results/`. |
| `TEST_ZOOM` | `1` | Zoom da tela: `0.9` = 90% (afastado), `1.25` = 125% (perto). Faixa 0.5–3. Chromium only — Firefox ignora. |
| `TEST_VIEWPORT` | *(default de cada project)* | Tamanho da janela headless, formato `LARGURAxALTURA` (ex: `1920x1080`). Não afeta os headed (que maximizam). |
| `TEST_SLOWMO` | `400` | Pausa em ms após cada ação (projetos headed). `0` = sem pausa, execução mais rápida. |
| `TEST_BASE_URL` | `http://localhost:3000` | URL da aplicação sob teste. |
| `TEST_ENV` | *(nenhum = só `.env` local)* | Qualquer valor carrega `.env.<TEST_ENV>` por cima do `.env` (sobrescreve só o que esse arquivo definir — ex: `TEST_BASE_URL`). Projeto é só teste/homologação, nunca produção — use `staging`/`homologacao` conforme o ambiente real do FintechBankApp. Mesmo padrão do `getEnv()` do [ortoniKC/Playwright_Cucumber_TS](https://github.com/ortoniKC/Playwright_Cucumber_TS), adaptado às variáveis `TEST_*` daqui. Uso: `TEST_ENV=staging npm run bdd:login`. |
| `TEST_SCREEN_SIZE` | `1920x1080` | Tamanho da tela considerado no modo lado a lado (abaixo). |
| `TEST_WINDOW_POSITION` | *(automático)* | Fixa a posição da janela, formato `X,Y` (ex: `0,0`). Desliga o lado a lado automático. |
| `TEST_WINDOW_SIZE` | *(automático)* | Fixa o tamanho da janela, formato `LARGURAxALTURA` (ex: `960x1080`). Desliga o lado a lado automático. |

Valores inválidos (ex: `TEST_ZOOM=banana`) derrubam a execução com erro explicativo **antes** de
abrir qualquer navegador.

### Escolher navegador (`TEST_PROJECT`)

O padrão é `bdd` (Chrome headless) — ou seja, `npm run test:bdd` e `npm run bdd:login` rodam
**1 navegador só** por padrão (nada de disparar chromium + edge + firefox de uma vez):

```bash
TEST_PROJECT=firefox npm run bdd:login        # Firefox
TEST_PROJECT=edge,bdd npm run test:bdd        # Edge + Chrome de uma vez
TEST_PROJECT=chromium npm run test:chromium   # specs legados .spec.ts
TEST_PROJECT=all npm run bdd:login            # todos os navegadores (comportamento antigo)
```

Também dá pra fixar no `.env` (`TEST_PROJECT=edge`). O parâmetro `--project=xxx` da CLI do
Playwright continua funcionando e soma com o `TEST_PROJECT`.

> Dica: para testar com o navegador visível, troque para `bdd-headed` (`TEST_PROJECT=bdd-headed`
> + `--headed`) ou use os scripts `*:headed` que já fixam isso pra você.

### Vários navegadores lado a lado

**Regra geral da janela:** com **1 navegador visível** a janela ocupa a **tela inteira**
(maximizada); com **2 ou mais navegadores visíveis**, a tela é dividida — cada um ganha uma
**fatia horizontal**, um do lado do outro.

Os projetos `bdd-headed` e `edge` abrem **sempre visíveis** (não precisam de `--headed`). Os
projetos `bdd` e `chromium` abrem visíveis quando a CLI passa `--headed` — nesse caso eles
também entram na regra (1 sozinho = tela inteira, 2+ = lado a lado):

```bash
TEST_PROJECT=bdd-headed,edge npm run bdd:login
# Ordem direita → esquerda: 1º navegador (bdd-headed) na DIREITA [960,1920],
# 2º (edge) na ESQUERDA [0,960] — um do lado do outro
```

A largura da tela considerada vem de `TEST_SCREEN_SIZE` (default `1920x1080`). Pra controlar a
janela na mão (ex: 1 navegador por terminal), use `TEST_WINDOW_POSITION=X,Y` e/ou
`TEST_WINDOW_SIZE=LARGURAxALTURA` — isso desliga o automático. Firefox não participa do lado a
lado (não aceita os args de janela do Chromium).

### Um cenário específico, com navegador visível

```bash
npm run test:bdd:headed -- --grep "CT01.1"
npm run bdd:cadastro:headed         # atalho já pronto pro cenário de cadastro
```

Ou direto (sem passar pelo `npm run`, útil se já rodou `bdd:gen` recentemente):

```bash
npx playwright test --project=bdd-headed --headed --workers=1 --grep "<tag ou texto>"
```

### Outros browsers

```bash
npm run test:edge:headed      # Microsoft Edge (canal do sistema, não baixado pelo Playwright)
npm run test:firefox:headed   # Firefox
```

### Specs legados (.spec.ts, fora do BDD)

```bash
npx playwright test --project=chromium tests/e2e/pagamentoFatura.spec.ts
```

### Modo Debug / Codegen / Trace

```bash
npx playwright test --debug
npx playwright codegen http://localhost:3000
npx playwright show-trace test-results/<pasta-do-teste>/trace.zip
npx playwright show-report
```

---

## Status atual dos cenários

| Feature | Status | Observação |
|---|---|---|
| `login.feature` | ✅ 6/6 passando | CT01.1–CT01.6 |
| `cadastro.feature` | ✅ 1/1 passando | Fluxo completo: cadastro → modal → login → dashboard → perfil → logout |
| `dashboard.feature` | 🚧 Em revisão | Steps criados, mas as 3 telas originais (`CT02.1` Meta de Gastos, `CT02.2` Diagnóstico IA, `CT02.3` Conta Recorrente) mudaram ou foram removidas do app atual — precisa de codegen na tela nova antes de reescrever os cenários. |
| `pagamentoFatura.spec.ts` | 📋 Não convertido | Ainda `.spec.ts` legado — próximo candidato a virar `.feature`. |

---

## Projects do Playwright (`playwright.config.ts`)

| Project | Uso |
|---|---|
| `chromium` | Specs `.spec.ts` legados |
| `bdd` | Cenários `.feature`, headless (CI). Com `--headed`: janela única = tela inteira; 2+ visíveis = fatia do lado a lado |
| `bdd-headed` | Cenários `.feature`, Chrome maximizado + zoom travado em 100% + `slowMo`, pra assistir a execução |
| `edge` | Mesma config do `bdd-headed`, no Microsoft Edge |
| `firefox` | Cenários `.feature` no Firefox (viewport fixo, sem os launch args de Chromium) |

> `TEST_PROJECT` (ou `--project` da CLI) seleciona quais desses projects rodam — ver
> ["Escolher navegador (`TEST_PROJECT`)"](#escolher-navegador-test_project).

---

## Contribuição

1. Crie uma branch para sua feature (`git checkout -b feature/nova-feature`)
2. Commit suas mudanças (`git commit -m 'feat: adiciona novo cenário de X'`)
3. Faça o push para a branch (`git push origin feature/nova-feature`)
4. Abra um Merge Request

---

_Desenvolvido com foco em qualidade e automação._
