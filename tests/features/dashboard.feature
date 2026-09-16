@Dashboard
Feature: Dashboard da Fintech
  Como um usuário logado na Fintech
  Eu quero interagir com o Dashboard
  Para gerenciar minha meta de gastos, ver insights de IA e pagar contas recorrentes

  Background:
    Given que acesso a landing page
    And eu realizo login com o CPF e senha do cenário
    And o dashboard está inicializado

  @CT01.2 @Dashboard
  Scenario: Alterar Meta de Gastos com sucesso
    When eu altero a meta de gastos para "5000" no Dashboard

  @CT01.3 @Dashboard
  Scenario: Consultar Insights de Assinaturas da IA
    When eu abro o diagnóstico de assinaturas da IA no Dashboard
    And eu fecho o diagnóstico da IA no Dashboard

  @CT01.4 @Dashboard
  Scenario: Tentar pagar conta recorrente e validar erro de PIN incorreto
    When eu inicio o pagamento de uma conta recorrente no débito no Dashboard
    And eu confirmo o pagamento no Dashboard
    Then devo ver o erro de PIN incorreto no Dashboard
