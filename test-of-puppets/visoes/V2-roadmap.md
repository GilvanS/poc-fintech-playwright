# V2 — Roadmap (linha do tempo)  (modelo GitHub: Roadmap)

Gantt dos **planos** (criação → previsão) e, abrindo o plano, dos **testes** (dia planejado → dia de
execução). Serve para ver prazos, atrasos e a carga por semana. Dados de exemplo: [README](README.md).

## Tela completa (zoom Mensal)

```
╭────────────────────────╮   [←]  Test of Puppets   Plano [Todos ▾]   Online: Ana, Bia   [ Fundo ] [ Sino 3 ] Você: [Ana ▾]
│ NAVEGAÇÃO      [⇄] [«] │        Gestão de planos de teste
│                        │  ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
│ PLANOS & TESTES        │   ROADMAP                                                                                 [ ⟳ Atualizar ]
│ ▢ Planos               │
│ ▢ Lista                │   Zoom [ Mensal │ Trimestral ]   ◀ set–out/2026 ▶   [Hoje]    Agrupar [Plano ▾]   Resp. [Todos ▾]   [x] Fins de semana
│ ▢ Kanban               │
│────────────────────────│                      set/26               out/26
│ PLANEJAMENTO           │                      24 25 26 27 28 29 30 01 02 03 04 05 06 07 08 09 10 11 12 13 14 15 16 17 18 19 20
│╭──────────────────────╮│                      Q  S  S  D  S  T  Q  Q  S  S  D  S  T  Q  Q  S  S  D  S  T  Q  Q  S  S  D  S  T
││ ▢ Roadmap            ││  v Plano 28/09/26    █████████████████████████████████████████████████████████◆           ░░ ░░
│╰──────────────────────╯│     CT03.1 Ana             ░░ ░░    ██ ok    ┆  ░░ ░░                ░░ ░░                ░░ ░░
│ ▢ Iterações            │     CT05.1 Bia             ░░ ░░       ██ ok ┆  ░░ ░░                ░░ ░░                ░░ ░░
│ ▢ Planejamento         │     CT05.2 Bia             ░░ ░░          ██ XX ░░ ░░                ░░ ░░                ░░ ░░
│────────────────────────│     CT04.2 Carlos          ░░ ░░          ▓▓▓▓▓ ░░ ░░                ░░ ░░                ░░ ░░
│ QUALIDADE              │     CT03.2 Ana             ░░ ░░             ██ ░░ ░░                ░░ ░░                ░░ ░░
│ ▢ Incidentes        2  │     CT03.3 Bia             ░░ ░░             ┆  ░░ ░░ ▒▒             ░░ ░░                ░░ ░░
│ ▢ Release              │     CT03.7 Bia             ░░ ░░             ┆  ░░ ░░    ▒▒          ░░ ░░                ░░ ░░
│ ▢ Lançamento           │     CT04.1 Carlos          ░░ ░░             ┆  ░░ ░░       ▒▒       ░░ ░░                ░░ ░░
│ ▢ Retro                │  v Plano 05/10/26          ░░ ░░             ██████████████████████████████████████████████████████◆
│────────────────────────│     (sem testes)           ░░ ░░             ┆  ░░ ░░                ░░ ░░                ░░ ░░
│ MINHAS VISÕES          │     + Adicionar plano
│ ▢ Só Faturas P1        │
│ + Nova visão           │   Legenda: ██ dia de execução · ▒▒ planejado · ▓▓ atrasado · ok passou · XX falhou · ░░ fim de semana
│────────────────────────│            ┆ hoje (02/10) · ◆ previsão do plano
│ MASSA & SISTEMA        │   CT04.2 está em Standby desde 01/10 (barra atrasada) e foi replanejado para 08/10.
│ ▢ Cenários e massa  !  │
│ ▢ Equipe               │
│ ▢ Configurações        │
│                        │
╰────────────────────────╯
```

Na tela real a coluna de rótulos mostra também a prioridade, ex.: `CT03.1 P1 Ana`.

## Zoom Trimestral (semanas)

```
                   out/26                          nov/26                         dez/26
                   S40   S41   S42   S43   S44     S45   S46   S47   S48   S49    S50  S51  S52
 v Plano 14/09/26  ████████◆ (concluído 25/09)
 v Plano 28/09/26        ████████████◆
 v Plano 05/10/26              ██████████████◆
   Carga prevista  ▓▓▓▓  ▓▓▓▓▓▓  ▓▓░░   (minutos planejados por semana: 95 · 135 · 0)
```

## Tooltip ao passar o mouse na barra

```
┌───────────────────────────────────────────┐
│ CT03.7 · Pagar fatura vencida  [P2]       │
│ Resp.: Bia · Est.: 30 min                 │
│ Planejado: 06/10/2026 (terça)             │
│ = Massa 0483 compartilhada com CT03.2     │
│ Arraste a barra para mudar a data         │
└───────────────────────────────────────────┘
```

## Interações

| Ação | Efeito |
|---|---|
| Arrastar a barra de um teste | muda `dataPlanejada` (não permite fim de semana se "[ ] fins de semana" estiver desmarcado) |
| Arrastar a ponta da barra do plano | muda `previsao` do plano |
| Clicar na barra | abre o teste (M4) ou o plano (M3) |
| `▾`/`▸` no plano | recolhe/expande os testes |
| Agrupar por Responsável/Funcionalidade | troca as linhas por Ana/Bia/Carlos ou Faturas/Pix/Cadastro |
| Duplo clique em área vazia da linha do plano | cria teste na data (abre M2 já com a data) |

## Estados
```
 Sem planos                                  Teste sem data planejada
┌────────────────────────────────────┐      CT04.4  (sem data)  [ definir data ]
│ Nenhum plano ainda.                │      aparece numa faixa "Sem data (n)" no fim da lista,
│ [ + Novo Plano ] (abre M1)         │      sem barra.
└────────────────────────────────────┘
```

## Regras
- Atrasado (▓▓) = data planejada passou e o teste não terminou (CT04.2 no exemplo).
- Edição de data por duas pessoas ao mesmo tempo: vale a última salva, com aviso ao outro (toast).
- A barra não altera a planilha; datas ficam em `dados/planos.json`.

## Modais que abre
M1 Novo Plano · M2 Incluir testes · M3 Detalhe do plano · M4 Detalhe do teste
