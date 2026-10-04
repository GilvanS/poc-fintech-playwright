# V3 — Incidentes  (modelo GitHub: Bug tracker)

Triagem de INC: quem cuida, qual a gravidade, quais testes trava e há quanto tempo está aberto.
Quadro por status + tabela + painel lateral do INC selecionado. Dados de exemplo: [README](README.md).

## Tela completa

```
╭────────────────────────╮   [←]  Test of Puppets   Plano [28/09/26 ▾] MASTER   Online: Ana, Bia   [ Fundo ] [ Sino 3 ] Você: [Ana ▾]
│ NAVEGAÇÃO      [⇄] [«] │        Gestão de planos de teste
│                        │        Criado 24/09/2026 · Previsão 13/10/2026 · 3 de 8 executados  ▓▓▓░░░░░ 38%
│ PLANOS & TESTES        │  ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
│ ▢ Planos               │   INCIDENTES                                                                              [ ⟳ Atualizar ]
│ ▢ Lista                │
│ ▢ Kanban               │   Incidentes (3)       [ + Registrar INC ] (M6)   [ Vincular INC existente ] (M7)
│────────────────────────│   Buscar [________]  Severidade [Todas ▾]  Resp. [Todos ▾]  [x] Mostrar resolvidos   [ ] Só meus
│ PLANEJAMENTO           │
│ ▢ Roadmap              │  ┌ NOVO (1) ────────────────┐ ┌ EM ANÁLISE (1) ──────────┐ ┌ RESOLVIDO (1) ───────────┐
│ ▢ Iterações            │  │ INC0715799001  Média     │ │ INC0715802225  Alta      │ │ INC0715790010  Baixa     │
│ ▢ Planejamento         │  │ Cadastro duplicado       │ │ Saldo de Faturamento     │ │ Botão sem foco           │
│────────────────────────│  │ aceita CPF repetido      │ │ difere do extrato        │ │ no cadastro PF           │
│ QUALIDADE              │  │ Afeta: CT05.2            │ │ Afeta: CT03.1 CT03.2     │ │ Afeta: CT05.1            │
│╭──────────────────────╮│  │ Resp.: Bia · há 1 dia    │ │ Resp.: Ana · há 3 dias   │ │ Resolvido 30/09 · Bia    │
││ ▢ Incidentes        2 ││  └──────────────────────────┘ └──────────────────────────┘ └──────────────────────────┘
│╰──────────────────────╯│
│ ▢ Release              │   INC            │ Sev.  │ Status     │ Título                      │ Afeta         │ Resp. │ Aberto │ Há
│ ▢ Lançamento           │  ────────────────┼───────┼────────────┼─────────────────────────────┼───────────────┼───────┼────────┼─────────────────
│ ▢ Retro                │   INC0715799001  │ Média │ Novo       │ Cadastro duplicado          │ CT05.2        │ Bia   │ 01/10  │ 1 dia
│────────────────────────│   INC0715802225  │ Alta  │ Em análise │ Saldo de Faturamento difere │ CT03.1 CT03.2 │ Ana   │ 29/09  │ 3 dias
│ MINHAS VISÕES          │   INC0715790010  │ Baixa │ Resolvido  │ Botão sem foco no cadastro  │ CT05.1        │ Bia   │ 28/09  │ resolvido 30/09
│ ▢ Só Faturas P1        │
│ + Nova visão           │   Resumo: abertos 2 · Alta 1 · Média 1 · tempo médio de resolução 2 dias · testes travados 3
│────────────────────────│
│ MASSA & SISTEMA        │
│ ▢ Cenários e massa  !  │
│ ▢ Equipe               │
│ ▢ Configurações        │
│                        │
╰────────────────────────╯
```

## Painel lateral (clicar num INC)

```
┌─ INC0715802225 ─────────────────────────────────────────────── ✕ ─┐
│ Saldo de Faturamento difere do extrato           Sev. [Alta ▾]     │
│ Status [Em análise ▾]      Resp. [Ana ▾]      Aberto 29/09 (3 d)   │
│ Testes afetados:  CT03.1 [Passou]   CT03.2 [Executando]  [ + testes]│
│ Descrição                                                          │
│ [ O valor "fatura aberta" na tela não bate com o extrato após o   ]│
│ [ pagamento mínimo. Massa 0483.                                   ]│
│ Histórico                                                          │
│   02/10 09:14  Ana    mudou status: Novo → Em análise              │
│   29/09 16:02  Ana    vinculou CT03.2                              │
│   29/09 15:40  Ana    registrou o INC                              │
│ Comentários                                                        │
│   Bia 01/10: reproduzi com a massa 0484 também.                    │
│   [ escrever comentário…                                  ] [Enviar]│
│                              [ Excluir INC ]      [ Salvar ]       │
└────────────────────────────────────────────────────────────────────┘
```

## Criar INC a partir de uma falha

Em V0/V1, um teste `[Falhou]` ganha o botão **"Criar INC"**, que abre M6 já preenchido:

```
┌─ Registrar INC ─────────────────────────────────────────── ✕ ─┐
│ Número do INC   [INC__________]                                │
│ Título          [Cadastro duplicado aceita CPF repetido   ]    │
│ Severidade      (•) Média   ( ) Alta   ( ) Baixa               │
│ Responsável     [Bia ▾]                                        │
│ Testes afetados [x] CT05.2 [Falhou]   [ ] CT05.1   [ ] CT03.1  │
│ Evidência       anexar o último .docx do CT05.2  [x]           │
│                                  [ Cancelar ]  [ Registrar ]   │
└────────────────────────────────────────────────────────────────┘
```

## Interações

| Ação | Efeito |
|---|---|
| Arrastar INC entre colunas | muda o status (Resolvido pede data, usa hoje) e grava o autor |
| Clicar no card ou na linha | abre o painel lateral |
| Chip do teste afetado | abre o teste (M4) |
| "Vincular INC existente" | M7 (busca por número e escolhe testes) |
| Notificação | quem é o responsável recebe o aviso no sino ao ser atribuído |

## Regras
- Gravidade (`severidade`) é campo novo: alta / média / baixa. Ordem do quadro: Alta primeiro.
- Teste com INC aberto mostra o selo do INC no card do Kanban e conta como pendência no Release (V4).
- Sem INC: coluna mostra "Nenhum incidente" e o resumo mostra 0.

## Modais que abre
M6 Registrar INC · M7 Vincular INC existente · M4 Detalhe do teste · M9 Confirmações
