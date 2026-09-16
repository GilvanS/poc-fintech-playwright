@Login
Feature: Login na Fintech
  Como um usuário da Fintech
  Eu quero acessar minha conta com CPF e senha
  Para gerenciar meu dinheiro pelo app

  @CT01.1 @Login
  Scenario: Abrir site e validar textos
    Given que acesso a landing page

  @CT01.2 @Login
  Scenario: Fazer login como Admin
    Given que acesso a landing page
    When eu realizo login com o CPF e senha do cenário

  @CT01.3 @Login
  Scenario: Fazer login como Cliente
    Given que acesso a landing page
    When eu realizo login com o CPF e senha do cenário

  @CT01.4 @Login
  Scenario: Validar campo obrigatório
    Given que acesso a landing page
    When eu abro o modal de login
    And eu clico no botão "Entrar" no modal de login
    Then devo ver as mensagens de campo obrigatório para CPF e senha no modal de login

  @CT01.5 @Login
  Scenario: Validar campo obrigatório senha
    Given que acesso a landing page
    When eu abro o modal de login
    And eu preencho o campo "CPF" com o CPF do cenário no modal de login
    And eu clico no botão "Entrar" no modal de login
    Then devo ver a mensagem de campo obrigatório para senha no modal de login

  @CT01.6 @Login
  Scenario: Validar campo obrigatório CPF
    Given que acesso a landing page
    When eu abro o modal de login
    And eu preencho o campo "Senha" com a senha do cenário no modal de login
    And eu clico no botão "Entrar" no modal de login
    Then devo ver a mensagem de campo obrigatório para CPF no modal de login
