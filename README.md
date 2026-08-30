# POC Fintech - Automação de Testes com Playwright

> Projeto de automação de testes End-to-End (E2E) para a aplicação Fintech, utilizando **Playwright** com **Node.js**.

![Playwright](https://img.shields.io/badge/Playwright-2EAD33?style=for-the-badge&logo=playwright&logoColor=white)
![NodeJS](https://img.shields.io/badge/Node.js-6DA55F?style=for-the-badge&logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)

## Sobre o Projeto

Este repositório contém a suíte de testes automatizados para validar as funcionalidades críticas do sistema Fintech. O foco desta branch é a implementação utilizando **Playwright** com **Node.js**.

### Estrutura de Branches (Multilinguagem)

Este projeto serve como base para estudos comparativos e implementações em diferentes linguagens. A organização das branches é a seguinte:

| Branch | Tecnologia | Descrição |
| :--- | :--- | :--- |
| **`main`** (Atual) | **Playwright + Node.js** | Stack principal de automação com JavaScript/TypeScript. |
| **`java`** | **Java** | Implementação utilizando ecossistema Java (ex: Selenium/Playwright Java). |
| **`python`** | **Python** | Implementação utilizando ecossistema Python (ex: Playwright Python/Selenium). |

### Documentação Oficial

Para mais detalhes sobre a configuração e comandos do Playwright, consulte a documentação oficial:
- [Documentação do Playwright (Intro)](https://playwright.dev/docs/intro)

---

## Pre-requisitos

- **[Node.js](https://nodejs.org/)** (LTS recomendado)
- **Git**

## Instalacao

1. Clone o repositório:
```bash
git clone git@github.com:GilvanS/poc-fintech-playwright.git
```

2. Acesse a pasta do projeto:
```bash
cd poc-fintech-playwright
```

3. Instale as dependências:
```bash
npm install
```

4. Instale os navegadores do Playwright:
```bash
npx playwright install
```

---

## Como Rodar os Testes

> Os comandos abaixo podem ser executados via `npx playwright ...` ou pelos atalhos `npm run ...` definidos no `package.json`.

---

### Execução padrão — Headless (sem UI)
Roda todos os testes no terminal, sem abrir o navegador. Modo padrão para CI/CD.
```bash
npx playwright test
# ou
npm test
```

### Execução com navegador visível — Headed
Abre o navegador durante a execução. Útil para observar o fluxo do teste em tempo real.
```bash
npx playwright test --headed
# ou
npm run test:headed
```

### Modo UI — Interface Interativa
Abre o Playwright UI, que permite selecionar, executar e depurar testes visualmente, com timeline e snapshots de cada passo.
```bash
npx playwright test --ui
# ou
npm run test:ui
```

---

### Executar um arquivo específico
```bash
npx playwright test tests/e2e/login.spec.ts
```

### Executar por nome de teste (grep)
Filtra e executa apenas os testes cujo título corresponde ao padrão informado.
```bash
npx playwright test --grep "CT01"
npx playwright test --grep "login"
```

### Executar em um browser específico
O projeto tem **webkit** ativo por padrão. Para usar outro browser, habilite-o em `playwright.config.ts` primeiro.
```bash
# WebKit — Safari (ativo no projeto)
npx playwright test --project=webkit
npm run test:webkit

# Chromium — Chrome/Edge
npx playwright test --project=chromium
npm run test:chromium

# Firefox
npx playwright test --project=firefox
npm run test:firefox
```

### Executar em paralelo / controlar workers
```bash
# Máximo de workers em paralelo (padrão: automático)
npx playwright test --workers=4

# Execução serial (1 worker) — útil para debug
npx playwright test --workers=1
```

---

### Modo Debug — Passo a passo com DevTools
Pausa a execução no primeiro passo ativando o Playwright Inspector.
```bash
npx playwright test --debug

# Debug de um arquivo específico
npx playwright test tests/e2e/login.spec.ts --debug
```

### Modo Codegen — Gravação de testes
Abre o navegador e grava as interações do usuário, gerando código TypeScript automaticamente.
```bash
# Grava a partir da URL base do projeto (http://localhost:3000)
npx playwright codegen http://localhost:3000

# Grava e salva o código gerado em um arquivo
npx playwright codegen http://localhost:3000 --output tests/e2e/novo-teste.spec.ts

# Grava simulando um dispositivo móvel
npx playwright codegen --device="iPhone 15" http://localhost:3000
```

---

### Trace Viewer — Inspecionar execuções gravadas
O trace é coletado automaticamente na primeira re-tentativa de testes falhos (`trace: 'on-first-retry'`). Para abrir manualmente:
```bash
# Abre o trace de um arquivo .zip gerado em test-results/
npx playwright show-trace test-results/<pasta-do-teste>/trace.zip

# Forçar coleta de trace em todos os testes
npx playwright test --trace=on
```

### Relatório HTML
Exibe o relatório da última execução no navegador.
```bash
npx playwright show-report
# ou
npm run test:report
```

---

### Variáveis de ambiente úteis
```bash
# Simular ambiente de CI (retries=2, workers=1, forbidOnly)
CI=true npx playwright test

# Desabilitar paralelismo manualmente
npx playwright test --workers=1
```

---

## Estrutura do Projeto

```
poc-fintech-playwright/
├── tests/               # Arquivos de teste
├── tests-examples/      # Exemplos gerados pelo Playwright
├── playwright.config.ts # Configuração do Playwright
├── package.json         # Dependências e scripts
└── README.md            # Documentação
```

## Contribuição

1. Crie uma branch para sua feature (`git checkout -b feature/nova-feature`)
2. Commit suas mudanças (`git commit -m 'feat: adiciona novos testes de login'`)
3. Faça o push para a branch (`git push origin feature/nova-feature`)
4. Abra um Merge Request

---

_Desenvolvido com foco em qualidade e automação._
