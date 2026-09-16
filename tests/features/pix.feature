@Pix
Feature: Envio de Pix e validação do extrato
  Como um usuário logado na Fintech
  Eu quero enviar um Pix por chave
  Para transferir dinheiro e conferir o comprovante no extrato

  Background:
    Given que acesso a landing page
    And eu realizo login com o CPF e senha do cenário
    And o dashboard está inicializado

  @CT02.1 @Pix
  Scenario: Enviar Pix por CPF e validar comprovante no extrato
    When eu valido que o cliente tem saldo para enviar o Pix
    And eu valido o nome do cliente logado no dashboard
    And eu abro a Área PIX pelo botão "Enviar Pix"
    And eu seleciono o tipo de chave CPF na Área PIX
    And eu preencho a chave Pix com os dados do cenário na Área PIX
    And eu preencho o valor do Pix com os dados do cenário na Área PIX
    And eu preencho a mensagem do Pix com os dados do cenário na Área PIX
    And eu seleciono a tag "Refeição" na Área PIX
    And eu avanço para os Dados de Envio
    Then devo ver os dados de revisão do Pix
    When eu confirmo o envio do Pix
    And eu digito a senha do cartão no PIN
    Then devo ver o comprovante "Envio Realizado!"
    And devo ver o comprovante completo do Pix
    When eu volto ao início pelo comprovante
    Then devo ver o saldo da home atualizado após o Pix
    And devo ver o comprovante do Pix no extrato
    And eu volto do comprovante do extrato

  # NEGATIVO tipo 1 — "informa e para": TBL_CENARIOS/CT02.2 tem "Valor PIX" maior que o
  # saldo real do remetente no banco. O teste valida o saldo via API, o dashboard confirma
  # o valor insuficiente e ENCERRA SEM tentar o envio. O modo negativo é ligado pela tag
  # @Negativo OU pela coluna RESULTADO=BLOQUEAR em TBL_CENARIOS (a planilha vence quando
  # a coluna existir).
  @CT02.2 @Pix @Negativo
  Scenario: Informar saldo insuficiente antes de enviar o Pix
    When eu valido que o cliente tem saldo para enviar o Pix
    And eu valido o nome do cliente logado no dashboard
    Then o dashboard confirma o saldo insuficiente e o teste encerra sem tentar o Pix

  # NEGATIVO tipo 2 — "executa e comprova": TBL_CENARIOS/CT02.3 também tem "Valor PIX"
  # maior que o saldo. Aqui o teste EXECUTA o fluxo até clicar "Prosseguir" pra provar
  # que a UI BLOQUEIA (comportamento real descoberto: a mensagem "Saldo insuficiente
  # para realizar esta transferência." aparece NO FORMULÁRIO e o avanço não acontece),
  # e no fim valida que o saldo da home NÃO mudou — nada debitado.
  @CT02.3 @Pix @Negativo
  Scenario: Tentar enviar Pix sem saldo e validar o bloqueio da UI
    When eu valido que o cliente tem saldo para enviar o Pix
    And eu abro a Área PIX pelo botão "Enviar Pix"
    And eu seleciono o tipo de chave CPF na Área PIX
    And eu preencho a chave Pix com os dados do cenário na Área PIX
    And eu preencho o valor do Pix com os dados do cenário na Área PIX
    And eu preencho a mensagem do Pix com os dados do cenário na Área PIX
    And eu seleciono a tag "Refeição" na Área PIX
    When eu tento avançar para os Dados de Envio
    Then devo ver a mensagem de saldo insuficiente no formulário de Pix
    When eu volto ao dashboard após o bloqueio
    Then o saldo da home permanece inalterado após o bloqueio

  # Campo obrigatório: mesma validação nativa do browser do cadastro (atributo HTML
  # `required`, validity.valueMissing) — Chave e Valor são obrigatórios, Mensagem é
  # opcional (confirmado direto no app antes de escrever estes cenários). Usa valor de
  # teste literal em vez de dado de massa: são cenários só de validação de UI, nunca
  # avançam pra Dados de Envio, então não precisam de linha própria em TBL_CENARIOS.

  @CT02.4 @Pix
  Scenario: Validar campo obrigatório da chave Pix
    When eu abro a Área PIX pelo botão "Enviar Pix"
    And eu seleciono o tipo de chave CPF na Área PIX
    And eu preencho o valor do Pix com um valor de teste na Área PIX
    And eu tento avançar para os Dados de Envio
    Then devo ver a mensagem de campo obrigatório para a Chave Pix na Área PIX

  @CT02.5 @Pix
  Scenario: Validar campo obrigatório do valor do Pix
    When eu abro a Área PIX pelo botão "Enviar Pix"
    And eu seleciono o tipo de chave CPF na Área PIX
    And eu preencho a chave Pix com um CPF de teste na Área PIX
    And eu tento avançar para os Dados de Envio
    Then devo ver a mensagem de campo obrigatório para o Valor do Pix na Área PIX
