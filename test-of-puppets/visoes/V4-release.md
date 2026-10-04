# V4 — Release (go/no-go)  (modelo GitHub: Feature release)

Mostra se o plano está **pronto para liberar**. Os critérios são calculados sozinhos a partir dos
dados; ninguém marca à mão, exceto a **decisão final**, que fica registrada com autor e justificativa.
Dados de exemplo: [README](README.md).

## Tela completa

```
╭────────────────────────╮   [←]  Test of Puppets   Plano [28/09/26 ▾] MASTER   Online: Ana, Bia   [ Fundo ] [ Sino 3 ] Você: [Ana ▾]
│ NAVEGAÇÃO      [⇄] [«] │        Gestão de planos de teste
│                        │        Criado 24/09/2026 · Previsão 13/10/2026 · 3 de 8 executados  ▓▓▓░░░░░ 38%
│ PLANOS & TESTES        │  ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
│ ▢ Planos               │   RELEASE                                                                                 [ ⟳ Atualizar ]
│ ▢ Lista                │
│ ▢ Kanban               │   Release do plano 28/09/26                       Alvo 13/10/2026 (7 dias úteis)     Situação: NO-GO
│────────────────────────│
│ PLANEJAMENTO           │   Critérios cumpridos  2 de 7   ▓▓░░░░░░░░░░░░ 29%
│ ▢ Roadmap              │
│ ▢ Iterações            │   Critério                                          Atual                           Estado
│ ▢ Planejamento         │  ─────────────────────────────────────────────────────────────────────────────────────────────
│────────────────────────│   1  Todos os testes executados                     3 de 8                          ✖  ver
│ QUALIDADE              │   2  Nenhum teste Falhou                            1 falha (CT05.2)                ✖  ver
│ ▢ Incidentes        2  │   3  Nenhum INC aberto afetando o plano             2 abertos (Alta 1, Média 1)     ✖  ver
│╭──────────────────────╮│   4  Todos os testes P1 passaram                    1 de 3 (CT03.2, CT04.1 pendem)  ✖  ver
││ ▢ Release            ││   5  Dependências de massa respeitadas              CT03.7 espera o CT03.2 (0483)   ✖  ver
│╰──────────────────────╯│   6  Todos os testes com responsável e estimativa   8 de 8                          ✔
│ ▢ Lançamento           │   7  Dentro do prazo                                alvo em 7 dias úteis            ✔
│ ▢ Retro                │
│────────────────────────│   Prontidão por prioridade                      Prontidão por pessoa
│ MINHAS VISÕES          │    P1  ▓▓▓▓▓░░░░░░░░░ 1/3                        Ana     ▓▓▓▓▓▓▓░░░ 1/2 passou
│ ▢ Só Faturas P1        │    P2  ░░░░░░░░░░░░░░ 0/3                        Bia     ▓▓▓▓░░░░░░ 1/3 passou (1 falha)
│ + Nova visão           │    P3  ▓▓▓▓▓▓▓░░░░░░░ 1/2                        Carlos  ░░░░░░░░░░ 0/2 passou
│────────────────────────│
│ MASSA & SISTEMA        │   Pendências para liberar (ordem de impacto)
│ ▢ Cenários e massa  !  │    1. CT03.2 [P1] Ana      concluir o teste (em andamento)
│ ▢ Equipe               │    2. INC0715802225 [Alta] Ana     resolver o INC "Saldo de Faturamento difere"
│ ▢ Configurações        │    3. CT04.1 [P1] Carlos   executar (planejado 07/10)
│                        │    4. CT05.2 [P3] Bia      reexecutar após INC0715799001
╰────────────────────────╯    5. CT03.7 [P2] Bia      aguardar o CT03.2 passar (mesma massa 0483)
                              ... 3 itens a mais  [Ver todos]

                             Decisão
                              Situação atual: NO-GO — critérios 1 a 6 não atendidos.
                              [ Registrar decisão GO/NO-GO ]   (GO só habilita com 7 de 7, exceto com exceção justificada)

                             Histórico de decisões
                              (nenhuma ainda)
```

## "ver" expande o critério (exemplo do critério 3)

```
 3  Nenhum INC aberto afetando o plano             2 abertos (Alta 1, Média 1)     ✖  ocultar
      INC0715802225  Alta   Em análise  Ana   afeta CT03.1 CT03.2    [abrir INC]
      INC0715799001  Média  Novo        Bia   afeta CT05.2           [abrir INC]
```

## Modal M15 — Registrar decisão

```
┌─ Decisão do release — Plano 28/09/26 ─────────────────────────── ✕ ─┐
│ Decisão       ( ) GO         (•) NO-GO         ( ) GO com exceção     │
│ Critérios não atendidos: 1, 2, 3, 4, 5, 6                             │
│ Justificativa (obrigatória)                                           │
│ [ Aguardar correção do INC0715802225 e reexecução do CT05.2.       ]  │
│ Decidido por  Ana (você)            Data  02/10/2026 14:05            │
│                                        [ Cancelar ]  [ Registrar ]    │
└───────────────────────────────────────────────────────────────────────┘
```

Depois de registrada, aparece em "Histórico de decisões":

```
  02/10/2026 14:05  NO-GO   Ana   "Aguardar correção do INC0715802225 e reexecução do CT05.2."
```

## Estado "Pronto para liberar" (todos os critérios ✔)

```
 Critérios cumpridos  7 de 7   ▓▓▓▓▓▓▓▓▓▓▓▓▓▓ 100%             Situação: GO
 [ Registrar decisão GO ]   → o plano ganha o selo "Liberado em dd/mm/aaaa por <pessoa>".
```

## Regras
- Os 7 critérios são fixos na primeira versão; cada um aponta o que falta e quem é o dono.
- "GO com exceção" exige justificativa e fica destacado no histórico.
- Alterar um teste depois do GO volta a situação para "Reavaliar" e avisa quem decidiu.
- Nada disso grava em `data/`; a decisão vai para `dados/planos.json` (`decisoes[]`).

## Modais que abre
M15 Registrar decisão · M4 Detalhe do teste · M16 Cenário
