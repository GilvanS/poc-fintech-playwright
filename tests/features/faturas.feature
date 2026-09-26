@Faturas
Feature: Consulta e pagamento de faturas do cartão
  Como um usuário logado na Fintech
  Eu quero consultar minhas faturas aberta e fechada
  Para pagar no total, mínimo, parcial ou ter bloqueio em menor que o mínimo

  Background:
    Given que acesso a landing page
    And eu realizo login com o CPF e senha do cenário
    And o dashboard está inicializado

  @CT03.1 @Faturas
  Scenario: Consultar faturas e pagar o valor total
    When eu valido que a fatura pode ser paga
    And eu navego para a tela de Faturas pelo dashboard
    And eu valido que a tela de Faturas carregou com o histórico de parcelamento
    And eu capturo os valores das faturas antes do pagamento
    And eu inicio o pagamento da fatura
    And eu seleciono a forma de pagamento "Total"
    And eu confirmo a forma de pagamento escolhida
    And eu digito o PIN da massa no teclado da confirmação
    Then devo ver o total das faturas diminuído após o pagamento
    And devo ver que a fatura fechada ficou zerada
    And devo ver o pagamento de "Total" em Ver Lançamentos na Fatura Aberta

  @CT03.2 @Faturas
  Scenario: Consultar faturas e pagar o valor mínimo
    When eu valido que a fatura pode ser paga
    And eu navego para a tela de Faturas pelo dashboard
    And eu valido que a tela de Faturas carregou com o histórico de parcelamento
    And eu capturo os valores das faturas antes do pagamento
    And eu inicio o pagamento da fatura
    And eu seleciono a forma de pagamento "Mínimo"
    And eu confirmo a forma de pagamento escolhida
    And eu digito o PIN da massa no teclado da confirmação
    Then devo ver o total das faturas diminuído após o pagamento
    And devo ver o pagamento de "Mínimo" em Ver Lançamentos na Fatura Aberta

  @CT03.7 @Faturas
  Scenario: Reenvio do pagamento mínimo cai na guarda de idempotência sem débito novo
    When eu valido que a fatura pode ser paga
    And eu navego para a tela de Faturas pelo dashboard
    And eu valido que a tela de Faturas carregou com o histórico de parcelamento
    And eu capturo os valores das faturas antes do pagamento
    And eu inicio o pagamento da fatura
    And eu seleciono a forma de pagamento "Mínimo"
    And eu confirmo a forma de pagamento escolhida
    When eu injeto o pagamento original via API com o modal de PIN aberto
    And eu digito o PIN da massa para o reenvio do pagamento
    Then devo ver o aviso de pagamento já processado sem débito novo
    And o histórico de pagamentos cresce exatamente 1 desde a captura inicial

  @CT03.3 @Faturas
  Scenario: Consultar faturas e pagar com valor parcial (personalizado)
    When eu valido que a fatura pode ser paga
    And eu navego para a tela de Faturas pelo dashboard
    And eu valido que a tela de Faturas carregou com o histórico de parcelamento
    And eu capturo os valores das faturas antes do pagamento
    And eu inicio o pagamento da fatura
    And eu seleciono a forma de pagamento "Parcial"
    And eu preencho o valor personalizado com o valor "fat_parcial" da massa
    And eu confirmo a forma de pagamento escolhida
    And eu digito o PIN da massa no teclado da confirmação
    Then devo ver o total das faturas diminuído após o pagamento
    And devo ver o pagamento de "Parcial" em Ver Lançamentos na Fatura Aberta

  @CT03.4 @Faturas
  Scenario: Consultar faturas e pagar valor MENOR que o minimo (Familia Parcial)
    When eu valido que a fatura pode ser paga
    And eu navego para a tela de Faturas pelo dashboard
    And eu valido que a tela de Faturas carregou com o histórico de parcelamento
    And eu capturo os valores das faturas antes do pagamento
    And eu inicio o pagamento da fatura
    And eu seleciono a forma de pagamento "Menor que o mínimo"
    And eu preencho o valor personalizado com o valor "fat_menor_min" da massa
    And eu confirmo a forma de pagamento escolhida
    And eu digito o PIN da massa no teclado da confirmação
    Then devo ver o total das faturas diminuído após o pagamento
    And devo ver o pagamento de "Parcial" em Ver Lançamentos na Fatura Aberta

  @CT03.5 @Faturas
  Scenario: Consultar faturas e pagar valor MAIOR que o minimo (Familia Parcial)
    When eu valido que a fatura pode ser paga
    And eu navego para a tela de Faturas pelo dashboard
    And eu valido que a tela de Faturas carregou com o histórico de parcelamento
    And eu capturo os valores das faturas antes do pagamento
    And eu inicio o pagamento da fatura
    And eu seleciono a forma de pagamento "Maior que o mínimo"
    And eu preencho o valor personalizado com o valor "fat_maior_min" da massa
    And eu confirmo a forma de pagamento escolhida
    And eu digito o PIN da massa no teclado da confirmação
    Then devo ver o total das faturas diminuído após o pagamento
    And devo ver o pagamento de "Parcial" em Ver Lançamentos na Fatura Aberta
