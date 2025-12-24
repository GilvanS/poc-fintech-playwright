Feature: Login na Fintech

    Como um usuário do sistema
    Quero acessar minha conta
    Para gerenciar minhas finanças

    Background:
        Given que acesso a página inicial

    Scenario: Login com sucesso como Admin
        When inicio o login
        And preencho o CPF "11111111111" e senha "admin999"
        Then devo ver a área logada

    Scenario: Login com sucesso como Cliente
        When inicio o login
        And preencho o CPF "999.999.999-99" e senha "admin999"
        Then devo ver a área logada

    Scenario Outline: Validar campos obrigatórios
        When inicio o login
        And preencho o CPF "<cpf>" e senha "<senha>"
        Then devo ver a mensagem de alerta "Campo obrigatório"

        Examples:
            | cpf            | senha    |
            |                |          |
            | 999.999.999-99 |          |
            |                | admin999 |
