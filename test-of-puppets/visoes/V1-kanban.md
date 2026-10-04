# V1 — Kanban com limite de WIP  (modelo GitHub: Kanban)

Visualiza o andamento e **limita o trabalho em progresso**. Quatro colunas: Agendado → Em andamento →
Refinamento → Concluído. Arrastar um card muda o status; nada é executado por aqui (por enquanto só planejamento).
Dados de exemplo: [README](README.md).

## Tela completa

```
╭────────────────────────╮   [←]  Test of Puppets   Plano [28/09/26 ▾] MASTER   Online: Ana, Bia   [ Fundo ] [ Sino 3 ] Você: [Ana ▾]
│ NAVEGAÇÃO      [⇄] [«] │        Gestão de planos de teste
│                        │        Criado 24/09/2026 · Previsão 13/10/2026 · 3 de 8 executados  ▓▓▓░░░░░ 38%
│ PLANOS & TESTES        │  ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
│ ▢ Planos               │   KANBAN                                                                                  [ ⟳ Atualizar ]
│ ▢ Lista                │
│╭──────────────────────╮│   Buscar [________]  Func. [Todas ▾]  Resp. [Todos ▾]  Pri. [Todas ▾]  [ ] Só meus  [ ] Recentes (3 dias)  Agrupar [Nenhum ▾]
││ ▢ Kanban             ││
│╰──────────────────────╯│   Limite WIP:  Em andamento 1 · Refinamento 3   [⚙ editar (M13)]            Atualizado há 3 s por Bia
│────────────────────────│
│ PLANEJAMENTO           │  ┌ AGENDADO (3) ──────────┐ ┌ EM ANDAMENTO (1/1) ────┐ ┌ REFINAMENTO (1/3) ─────┐ ┌ CONCLUÍDO (3) ─────────┐
│ ▢ Roadmap              │  │ CT03.3  [P2]  Bia      │ │ CT03.2  [P1]  Ana      │ │ CT04.2  [P2]  Carlos   │ │ CT03.1  [P1]  Ana      │
│ ▢ Iterações            │  │ Pagar valor parcial    │ │ Pagar valor mínimo     │ │ Agendar Pix            │ │ Pagar valor total      │
│ ▢ Planejamento         │  │ Faturas · massa 0484   │ │ = massa 0483 (c/CT03.7)│ │ Standby desde 01/10    │ │ [Passou]  29/09        │
│────────────────────────│  │ Plan. 05/10 · 25 min   │ │ Iniciado em 02/10      │ │ Motivo: aguarda massa  │ │ INC0715802225          │
│ QUALIDADE              │  ├────────────────────────┤ │ Resp.: Ana             │ │                        │ ├────────────────────────┤
│ ▢ Incidentes        2  │  │ CT03.7  [P2]  Bia      │ │                        │ │                        │ │ CT05.1  [P3]  Bia      │
│ ▢ Release              │  │ Pagar fatura vencida   │ │                        │ │                        │ │ Cadastro PF            │
│ ▢ Lançamento           │  │ = massa 0483 (c/CT03.2)│ │                        │ │                        │ │ [Passou]  30/09        │
│ ▢ Retro                │  │ Plan. 06/10 · 30 min   │ │                        │ │                        │ │ INC0715790010          │
│────────────────────────│  ├────────────────────────┤ │                        │ │                        │ ├────────────────────────┤
│ MINHAS VISÕES          │  │ CT04.1  [P1]  Carlos   │ │                        │ │                        │ │ CT05.2  [P3]  Bia      │
│ ▢ Só Faturas P1        │  │ Enviar Pix por chave   │ │                        │ │                        │ │ Cadastro duplicado     │
│ + Nova visão           │  │ Pix · massa 0510       │ │                        │ │                        │ │ [Falhou]  01/10        │
│────────────────────────│  │ Plan. 07/10 · 20 min   │ │                        │ │                        │ │ INC0715799001          │
│ MASSA & SISTEMA        │  └────────────────────────┘ └────────────────────────┘ └────────────────────────┘ └────────────────────────┘
│ ▢ Cenários e massa  !  │   Arraste o card para mudar o status (Agendado → Em andamento → Refinamento → Concluído); nada é executado
│ ▢ Equipe               │            cancelar só testes que ainda não iniciaram (menu ⋯ do card)
│ ▢ Configurações        │
│                        │
╰────────────────────────╯
```

## Agrupar por Responsável (raias)

```
              │ AGENDADO (3)  │ EM ANDAMENTO (1/1) │ REFINAMENTO (1/3) │ CONCLUÍDO (3)
──────────────┼───────────────┼────────────────────┼───────────────────┼────────────────
▾ Ana    (2)  │               │ CT03.2  [P1]       │                   │ CT03.1  [P1]
──────────────┼───────────────┼────────────────────┼───────────────────┼────────────────
▾ Bia    (4)  │ CT03.3  [P2]  │                    │                   │ CT05.1  [P3]
              │ CT03.7  [P2]  │                    │                   │ CT05.2  [P3]
──────────────┼───────────────┼────────────────────┼───────────────────┼────────────────
▾ Carlos (2)  │ CT04.1  [P1]  │                    │ CT04.2  [P2]      │
──────────────┼───────────────┼────────────────────┼───────────────────┼────────────────
▸ Sem dono (0)│               │                    │                   │
```

Soltar um card em outra raia **reatribui** o responsável (com confirmação leve "Passar CT03.3 de Bia
para Carlos?").

## Limite de WIP cheio → aviso (limite "macio")

Sem execução, o limite de WIP é só **organização do time**: evita deixar testes demais "em andamento" ao
mesmo tempo. Passou do limite, a coluna fica vermelha e o card pode ser solto mesmo assim, depois de um aviso.

```
┌ EM ANDAMENTO (3/3) ── LIMITE ┐        Ao soltar o CT03.3 aqui:
│ CT03.2  [P1]  Ana            │       ┌────────────────────────────────────────────┐
│ CT04.1  [P1]  Carlos         │       │ A coluna já tem 3 de 3 testes em andamento.│
│ CT05.2  [P3]  Bia            │       │ Concluir algum antes ajuda o time a focar. │
└──────────────────────────────┘       │        [ Soltar mesmo assim ] [ Voltar ]   │
                                       └────────────────────────────────────────────┘
```

Limites padrão: Em andamento = 3, Refinamento = 3 (editáveis em M13). A fila de execução (`na_fila`) e a
verificação de ambiente ficam adiadas junto com a execução.

## Menu do card (⋯)

```
┌─────────────────────────┐
│ Abrir detalhe       (M4)│
│ Reatribuir ▸  Ana Bia Carlos
│ Prioridade ▸  P1 P2 P3  │
│ Ver massa          (M10)│
│ Cancelar teste          │   (só se não iniciou → M9)
│ Remover do plano    (M9)│
└─────────────────────────┘
```

## Vários usuários ao mesmo tempo
- Alteração de outra pessoa aparece em até 5 s e um aviso curto: `Bia moveu CT03.3 para Agendado`.
- Dois movendo o mesmo card: vale o primeiro a salvar; o segundo vê "CT03.3 já foi movido por Bia — recarregar".
- Card em edição mostra a inicial de quem abriu: `CT03.3 [P2] Bia  (Ana editando)`.

## Regras
- WIP padrão: Em andamento = 3, Refinamento = 3, demais sem limite; editável em M13 e salvo em `dados/config.json`.
- O contador `(atual/limite)` só aparece nas colunas com limite.
- Card Concluído mostra `[Passou]`/`[Falhou]`, a data e o INC vinculado.
- Teste com `dependeDe` (ex.: CT03.7 depende do CT03.2): enquanto o CT03.2 não estiver `passou`, o card mostra
  "Aguardando CT03.2" e **não pode ir para "Em andamento" nem "Concluído"** (o arrasto explica o motivo). Também
  não pode ser planejado numa data anterior à do CT03.2. Isso não é erro nem conta como pendência. O `passou` é
  marcado à mão por quem executou o teste fora da ferramenta.

## Modais que abre
M4 Detalhe do teste · M9 Confirmações · M13 Limites de WIP · M16 Cenário
