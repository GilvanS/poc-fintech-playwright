# V6 — Iterações  (modelo GitHub: Iterative development)

Cada **plano** é uma iteração. Mostra a atual, a anterior e a próxima, o **burndown** de testes
restantes, a velocidade da equipe e o **backlog priorizado** para arrastar para a próxima iteração.
Dados de exemplo: [README](README.md).

## Tela completa

```
╭────────────────────────╮   [←]  Test of Puppets   Plano [Todos ▾]   Online: Ana, Bia   [ Fundo ] [ Sino 3 ] Você: [Ana ▾]
│ NAVEGAÇÃO      [⇄] [«] │        Gestão de planos de teste
│                        │  ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
│ PLANOS & TESTES        │   ITERAÇÕES                                                                               [ ⟳ Atualizar ]
│ ▢ Planos               │
│ ▢ Lista                │   Iterações                                                              [ + Nova iteração ] (M1)
│ ▢ Kanban               │
│────────────────────────│  ┌ ANTERIOR ───────────────┐ ┌ ATUAL ──────────────────────┐ ┌ PRÓXIMA ────────────────┐
│ PLANEJAMENTO           │  │ Plano 14/09/26          │ │ Plano 28/09/26              │ │ Plano 05/10/26          │
│ ▢ Roadmap              │  │ 14/09 → 25/09           │ │ 28/09 → 13/10  dia 5 de 12  │ │ 05/10 → 20/10           │
│╭──────────────────────╮│  │ 6 de 6 concluídos       │ │ 3 de 8 concluídos           │ │ 0 testes                │
││ ▢ Iterações          ││  │ Estimado 130 min        │ │ Estimado 180 min            │ │ Capacidade 270 min      │
│╰──────────────────────╯│  │ Real     156 min (+20%) │ │ Real até agora 65 min       │ │ Meta: --                │
│ ▢ Planejamento         │  │ [Ver retro]             │ │ [Abrir plano]               │ │ [Abrir plano]           │
│────────────────────────│  └─────────────────────────┘ └─────────────────────────────┘ └─────────────────────────┘
│ QUALIDADE              │
│ ▢ Incidentes        2  │   Burndown — testes restantes (plano 28/09/26)               Velocidade média: 5,5 testes/iteração
│ ▢ Release              │   8│  ●
│ ▢ Lançamento           │   7│       ●    ·
│ ▢ Retro                │   6│            ●    ·
│────────────────────────│   5│                 ●    ●
│ MINHAS VISÕES          │   4│                           ·    ·
│ ▢ Só Faturas P1        │   3│                                     ·
│ + Nova visão           │   2│                                          ·
│────────────────────────│   1│                                               ·    ·
│ MASSA & SISTEMA        │   0│                                                         ·
│ ▢ Cenários e massa  !  │    └────────────────────────────────────────────────────────────
│ ▢ Equipe               │       28   29   30   01   02   05   06   07   08   09   12   13
│ ▢ Configurações        │   ● real   · ideal            Projeção no ritmo atual (0,6 teste/dia): termina ~15/10 (2 dias úteis após o alvo)
│                        │
╰────────────────────────╯   Backlog priorizado (12)                 Arraste para a iteração →  Mover para [Próxima 05/10/26 ▾]
                             ≡  Pri │ ID     │ Funcionalidade │ Cenário               │ Est. │ Massa
                            ────────┼────────┼────────────────┼───────────────────────┼──────┼──────
                             ≡  P1  │ CT06.1 │ Cartão         │ Bloquear cartão       │ 20m  │ 0530
                             ≡  P1  │ CT04.3 │ Pix            │ Cancelar Pix agendado │ 20m  │ 0512
                             ≡  P2  │ CT04.4 │ Pix            │ Devolver Pix          │ 25m  │ 0513
                             ≡  P2  │ CT03.4 │ Faturas        │ Parcelar fatura       │ 30m  │ 0485
                             ≡  P3  │ CT05.3 │ Cadastro       │ Editar endereço       │ 15m  │ 0522
                             ... mais 7        [ Ver todos ]
```

## Burndown vazio (iteração nova)

```
 Burndown indisponível: a iteração 05/10/26 ainda não tem testes.
 [ + Incluir testes ] (M2)  ou arraste itens do backlog para o card PRÓXIMA.
```

## Arrastar do backlog

```
 ≡ P1 CT06.1 Bloquear cartão ─────────drag────────►┌ PRÓXIMA ────────────────┐
                                                   │ Plano 05/10/26          │
                                                   │ + CT06.1 (20 min)       │
                                                   │ 1 teste · 20 de 270 min │
                                                   └─────────────────────────┘
```

Soltar sobre "ATUAL" também funciona e mostra aviso: `Adicionar à iteração em andamento aumenta o escopo (+20 min).`

## Interações

| Ação | Efeito |
|---|---|
| Arrastar ≡ (reordenar) | muda a ordem de prioridade do backlog (`ordemBacklog`) |
| Arrastar para ATUAL/PRÓXIMA | inclui o cenário no plano (equivale a M2) |
| Clique no card da iteração | abre o plano (M3) |
| "Ver retro" | abre V8 do plano anterior |
| Mudar iteração do burndown | seletor no título do gráfico |

## Regras
- Dias úteis: sem sábado/domingo. 12 dias úteis de 28/09 a 13/10.
- Ideal = reta do total inicial até 0 na previsão; real = testes ainda não concluídos no fim de cada dia.
- Velocidade = média de testes concluídos nas últimas 3 iterações encerradas.
- Capacidade da iteração = soma das capacidades da equipe × semanas do período.
- Backlog = cenários de `data/` não alocados em plano aberto; ordem fica em `dados/backlog.json`.

## Modais que abre
M1 Novo Plano · M2 Incluir testes · M3 Detalhe do plano
