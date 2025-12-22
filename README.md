# 🚀 POC Fintech - Automação de Testes co Playwright

> Projeto de automação de testes End-to-End (E2E) para a aplicação Fintech, utilizando **Playwright** com **Node.js**.

![Playwright](https://img.shields.io/badge/-playwright-%232EAD33?style=for-the-badge&logo=playwright&logoColor=white)
![NodeJS](https://img.shields.io/badge/node.js-6DA55F?style=for-the-badge&logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)

## 📋 Sobre o Projeto

Este repositório contém a suíte de testes automatizados para validar as funcionalidades críticas do sistema Fintech. O foco desta branch é a implementação utilizando **Playwright** com **Node.js**.

### 🌍 Estrutura de Branches (Multilinguagem)

Este projeto serve como base para estudos comparativos e implementações em diferentes linguagens. A organização das branches é a seguinte:

| Branch | Tecnologia | Descrição |
| :--- | :--- | :--- |
| **`main`** (Atual) | **Playwright + Node.js** | Stack principal de automação com JavaScript/TypeScript. |
| **`java`** | **Java** | Implementação utilizando ecossistema Java (ex: Selenium/Playwright Java). |
| **`python`** | **Python** | Implementação utilizando ecossistema Python (ex: Playwright Python/Selenium). |

### 📚 Documentação Oficial

Para mais detalhes sobre a configuração e comandos do Playwright, consulte a documentação oficial:
- [Documentação do Playwright (Intro)](https://playwright.dev/docs/intro)

---

## ⚙️ Pré-requisitos

- **[Node.js](https://nodejs.org/)** (LTS recomendado)
- **Git**

## 🚀 Instalação

1. Clone o repositório:
```bash
git clone git@gitlab.com:GilvanS/poc-fintech-playwright.git
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

## 🏃‍♂️ Como Rodar os Testes

### Rodar todos os testes (Headless)
Executa todos os testes no terminal.
```bash
npx playwright test
```

### Modo UI (Interativo)
Abre a interface gráfica do Playwright, excelente para debug e visualização de traces.
```bash
npx playwright test --ui
```

### Rodar em um navegador específico
```bash
npx playwright test --project=chromium
```

### Gerar relatório HTML
```bash
npx playwright show-report
```

---

## 📂 Estrutura do Projeto

```
poc-fintech-playwright/
├── tests/               # Arquivos de teste
├── tests-examples/      # Exemplos gerados pelo Playwright
├── playwright.config.ts # Configuração do Playwright
├── package.json         # Dependências e scripts
└── README.md            # Documentação
```

## 🤝 Contribuição

1. Crie uma branch para sua feature (`git checkout -b feature/nova-feature`)
2. Commit suas mudanças (`git commit -m 'feat: adiciona novos testes de login'`)
3. Faça o push para a branch (`git push origin feature/nova-feature`)
4. Abra um Merge Request

---

_Desenvolvido com foco em qualidade e automação._
