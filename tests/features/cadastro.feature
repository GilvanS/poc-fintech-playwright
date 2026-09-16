@Cadastro
Feature: Cadastro de novo usuário na Fintech
  Como um visitante do site
  Eu quero criar uma conta com meus dados
  Para acessar os serviços da Fintech

  # Form real de aquisição (SignUp/NewOnboardView). Cada campo tem seu próprio step,
  # preenchido a partir da linha ID_MASSA de TBL_CADASTRO (MassaDados.xlsx ->
  # TBL_CENARIOS/'cadastrar'). Campos condicionais (Data de Nascimento, Celular,
  # endereço, cartão, PIX) são ignorados pelo step se não existirem na tela ou
  # se a massa não tiver valor.

  @cadastrar @CT00 @Cadastro
  Scenario: Cadastrar novo usuário, logar e validar perfil
    Given que tenho uma massa de cadastro nova
    And que acesso a landing page
    When eu vou para a tela de cadastro
    # --- Dados pessoais ---
    And eu preencho o campo "Nome Completo" com o nome completo do cenário na tela de Cadastro
    And eu preencho o campo "CPF" com o CPF do cenário na tela de Cadastro
    And eu preencho o campo "Data de Nascimento" com a data de nascimento do cenário na tela de Cadastro
    And eu preencho o campo "E-mail" com o email do cenário na tela de Cadastro
    And eu preencho o campo "Celular" com o celular do cenário na tela de Cadastro
    And eu preencho o campo "Senha" com a senha do cenário na tela de Cadastro
    And eu preencho o campo "Confirme a Senha" com a senha do cenário na tela de Cadastro

    # --- Endereço ---
    And eu preencho o campo "CEP" com o CEP do cenário na tela de Cadastro
    And eu preencho o campo "Logradouro" com o logradouro do cenário na tela de Cadastro
    And eu preencho o campo "Número" com o número do cenário na tela de Cadastro
    And eu preencho o campo "Cidade" com a cidade do cenário na tela de Cadastro
    And eu preencho o campo "Bairro" com o bairro do cenário na tela de Cadastro
    And eu preencho o campo "UF" com o estado do cenário na tela de Cadastro

    # --- Cartão (abertura de conta) ---
    And eu seleciono a bandeira do cartão do cenário na tela de Cadastro
    And eu seleciono a categoria do cartão do cenário na tela de Cadastro
    And eu seleciono o dia de vencimento do cartão do cenário na tela de Cadastro
    And eu seleciono o plano de conta do cenário na tela de Cadastro

    # --- PIX ---
    And eu preencho o campo "Chave PIX Inicial (Opcional)" com a chave PIX do cenário na tela de Cadastro

    And eu confirmo o cadastro
    Then devo ver o modal de confirmação com os dados do cenário
    When eu fecho o modal de confirmação
    And eu realizo login com o CPF e senha da massa cadastrada
    Then devo ver o nome do usuário no dashboard
    And devo ver o saldo inicial em conta
    And devo ver o limite de crédito inicial
    When eu vou para o Meu Perfil
    Then devo ver o nome completo e o email no perfil
    When eu saio da conta

  # Campo obrigatório: validação nativa do browser (atributo HTML `required`), não alert
  # customizado. O submit reporta só o PRIMEIRO campo vazio em ordem de DOM (Nome Completo
  # -> CPF -> E-mail -> Senha -> Confirmar Senha) — por isso cada cenário preenche os campos
  # ANTERIORES ao alvo e deixa o resto em branco, isolando qual campo é validado.

  @CT00.1 @Cadastro
  Scenario: Validar campo obrigatório de Nome Completo
    Given que tenho uma massa de cadastro nova
    And que acesso a landing page
    When eu vou para a tela de cadastro
    And eu confirmo o cadastro
    Then devo ver a mensagem de campo obrigatório para Nome Completo no cadastro

  @CT00.2 @Cadastro
  Scenario: Validar campo obrigatório de CPF
    Given que tenho uma massa de cadastro nova
    And que acesso a landing page
    When eu vou para a tela de cadastro
    And eu preencho o campo "Nome Completo" com o nome completo do cenário na tela de Cadastro
    And eu confirmo o cadastro
    Then devo ver a mensagem de campo obrigatório para CPF no cadastro

  @CT00.3 @Cadastro
  Scenario: Validar campo obrigatório de E-mail
    Given que tenho uma massa de cadastro nova
    And que acesso a landing page
    When eu vou para a tela de cadastro
    And eu preencho o campo "Nome Completo" com o nome completo do cenário na tela de Cadastro
    And eu preencho o campo "CPF" com o CPF do cenário na tela de Cadastro
    And eu confirmo o cadastro
    Then devo ver a mensagem de campo obrigatório para E-mail no cadastro

  @CT00.4 @Cadastro
  Scenario: Validar campo obrigatório de Senha
    Given que tenho uma massa de cadastro nova
    And que acesso a landing page
    When eu vou para a tela de cadastro
    And eu preencho o campo "Nome Completo" com o nome completo do cenário na tela de Cadastro
    And eu preencho o campo "CPF" com o CPF do cenário na tela de Cadastro
    And eu preencho o campo "E-mail" com o email do cenário na tela de Cadastro
    And eu confirmo o cadastro
    Then devo ver a mensagem de campo obrigatório para Senha no cadastro

  @CT00.5 @Cadastro
  Scenario: Validar campo obrigatório de Confirmar Senha
    Given que tenho uma massa de cadastro nova
    And que acesso a landing page
    When eu vou para a tela de cadastro
    And eu preencho o campo "Nome Completo" com o nome completo do cenário na tela de Cadastro
    And eu preencho o campo "CPF" com o CPF do cenário na tela de Cadastro
    And eu preencho o campo "E-mail" com o email do cenário na tela de Cadastro
    And eu preencho o campo "Senha" com a senha do cenário na tela de Cadastro
    And eu confirmo o cadastro
    Then devo ver a mensagem de campo obrigatório para Confirmar Senha no cadastro
