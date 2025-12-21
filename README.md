# poc-fintech-playwright
Prova de conceito com playwright

# 🚀 POC Fintech - Automação de Testes com Cypress

> Projeto de automação de testes End-to-End (E2E) para a aplicação Fintech, utilizando Cypress e boas práticas de QA.

![Cypress](https://img.shields.io/badge/-cypress-%23E5E5E5?style=for-the-badge&logo=cypress&logoColor=058a5e)
![JavaScript](https://img.shields.io/badge/javascript-%23323330.svg?style=for-the-badge&logo=javascript&logoColor=%23F7DF1E)
![NodeJS](https://img.shields.io/badge/node.js-6DA55F?style=for-the-badge&logo=node.js&logoColor=white)

## 📋 Sobre o Projeto

Este repositório contém a suíte de testes automatizados para validar as funcionalidades críticas do sistema Fintech. O objetivo é garantir a qualidade do software através de testes rápidos, confiáveis e de fácil manutenção.

### 🛠 Tecnologias Utilizadas

- **[Cypress](https://www.cypress.io/)**: Framework de automação de testes moderna.
- **Node.js**: Ambiente de execução JavaScript.
- **GitLab CI/CD**: Para integração contínua (futuro).
- **Mochawesome Report**: Gerador de relatórios visuais (configuração recomendada).

---

## ⚙️ Pré-requisitos

Antes de começar, certifique-se de ter instalado em sua máquina:

- **[Node.js](https://nodejs.org/)** (Versão 16 ou superior recomendada)
- **Git**

## 🚀 Instalação

1. Clone o repositório:
```bash
git clone git@gitlab.com:GilvanS/poc-fintech-cypress.git
```

2. Acesse a pasta do projeto:
```bash
cd poc-fintech-cypress
```

3. Instale as dependências:
```bash
npm install
# ou
npm i
```

---

## 🏃‍♂️ Como Rodar os Testes

### Modo Interativo (Cypress Open)
Abre a interface gráfica do Cypress para ver os testes rodando em tempo real. Ideal para desenvolvimento e debug.

```bash
npx cypress open
```

### Modo Headless (Cypress Run)
Executa os testes no terminal, sem abrir o navegador. Ideal para CI/CD e execução rápida.

```bash
npx cypress run
```

### Rodar uma Spec Específica
```bash
npx cypress run --spec "cypress/e2e/minha-spec.cy.js"
```

---

## 📂 Estrutura do Projeto

```
poc-fintech-cypress/
├── cypress/
│   ├── e2e/             # Arquivos de teste (.cy.js)
│   ├── fixtures/        # Massas de dados (JSON)
│   ├── support/         # Comandos customizados e configurações globais
│   └── videos/          # Evidências de execução (gerado automaticamente)
├── cypress.config.js    # Arquivo de configuração do Cypress
├── package.json         # Dependências e scripts do projeto
├── README.md            # Documentação do projeto
└── .gitignore           # Arquivos ignorados pelo Git
```

## 🤝 Contribuição

1. Crie uma branch para sua feature (`git checkout -b feature/nova-feature`)
2. Commit suas mudanças (`git commit -m 'Adiciona novos testes de login'`)
3. Faça o push para a branch (`git push origin feature/nova-feature`)
4. Abra um Merge Request

---

_Desenvolvido com foco em qualidade e automação._

