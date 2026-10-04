# V7 — Planejamento da equipe  (modelo GitHub: Team planning)

Distribui testes entre as pessoas, **semana a semana**, comparando o tempo estimado com a capacidade
de cada uma. É a visão de quem organiza o time. Dados de exemplo: [README](README.md).

## Tela completa

```
╭────────────────────────╮   [←]  Test of Puppets   Plano [Todos ▾]   Online: Ana, Bia   [ Fundo ] [ Sino 3 ] Você: [Ana ▾]
│ NAVEGAÇÃO      [⇄] [«] │        Gestão de planos de teste
│                        │  ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
│ PLANOS & TESTES        │   PLANEJAMENTO                                                                            [ ⟳ Atualizar ]
│ ▢ Planos               │
│ ▢ Lista                │   Planejamento da equipe      ◀ Semana 05/10 – 09/10/2026 ▶   [Esta semana]       [⚙ Equipe e capacidade] (M12)
│ ▢ Kanban               │   Plano [05/10/26 ▾]   Pessoas [Todas ▾]   [ ] Mostrar fins de semana
│────────────────────────│
│ PLANEJAMENTO           │             │  Seg 05/10   │  Ter 06/10   │  Qua 07/10   │  Qui 08/10   │  Sex 09/10   │ Uso/Capacidade
│ ▢ Roadmap              │  ───────────┼──────────────┼──────────────┼──────────────┼──────────────┼──────────────┼────────────────
│ ▢ Iterações            │   Ana       │              │              │              │              │              │ 0/120 min
│╭──────────────────────╮│             │              │              │              │              │              │
││ ▢ Planejamento       ││  ───────────┼──────────────┼──────────────┼──────────────┼──────────────┼──────────────┼────────────────
│╰──────────────────────╯│   Bia       │ CT03.3 [P2]  │ CT03.7 [P2]  │              │              │              │ 55/90 min
│────────────────────────│             │ 25 min       │ 30 min       │              │              │              │
│ QUALIDADE              │  ───────────┼──────────────┼──────────────┼──────────────┼──────────────┼──────────────┼────────────────
│ ▢ Incidentes        2  │   Carlos    │              │              │ CT04.1 [P1]  │ CT04.2 [P2]  │              │ 45/60 min
│ ▢ Release              │             │              │              │ 20 min       │ 25 min       │              │
│ ▢ Lançamento           │  ───────────┼──────────────┼──────────────┼──────────────┼──────────────┼──────────────┼────────────────
│ ▢ Retro                │   Sem dono  │              │              │              │              │              │ 0 min
│────────────────────────│             │              │              │              │              │              │
│ MINHAS VISÕES          │
│ ▢ Só Faturas P1        │   Capacidade da semana
│ + Nova visão           │    Ana       ░░░░░░░░░░░░░░░░░░░░   0 de 120 min   disponível: 120 min
│────────────────────────│    Bia       ▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░  55 de  90 min   disponível:  35 min
│ MASSA & SISTEMA        │    Carlos    ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░  45 de  60 min   disponível:  15 min
│ ▢ Cenários e massa  !  │    Equipe    ▓▓▓▓▓▓▓▓░░░░░░░░░░░░ 100 de 270 min   (37%)
│ ▢ Equipe               │
│ ▢ Configurações        │   Backlog — arraste para um dia da pessoa
│                        │   ≡  Pri │ ID     │ Funcionalidade │ Cenário               │ Est. │ Massa
╰────────────────────────╯  ────────┼────────┼────────────────┼───────────────────────┼──────┼──────
                             ≡  P1  │ CT06.1 │ Cartão         │ Bloquear cartão       │ 20m  │ 0530
                             ≡  P1  │ CT04.3 │ Pix            │ Cancelar Pix agendado │ 20m  │ 0512
                             ≡  P2  │ CT04.4 │ Pix            │ Devolver Pix          │ 25m  │ 0513
                             ≡  P2  │ CT03.4 │ Faturas        │ Parcelar fatura       │ 30m  │ 0485
                             ≡  P3  │ CT05.3 │ Cadastro       │ Editar endereço       │ 15m  │ 0522
                             ... mais 7        [ Ver todos ]
```

## Soltar além da capacidade

Arrastar `CT06.1 (20 min)` para o Carlos na Sexta:

```
  Carlos    ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ 65 de 60 min  EXCEDEU em 5 min        (barra vermelha)

┌─ Capacidade excedida ──────────────────────────────────────────┐
│ Carlos ficaria com 65 min para 60 min de capacidade.           │
│ Quem tem folga nesta semana:  Ana (120 min)   Bia (35 min)     │
│            [ Colocar na Ana ]   [ Manter no Carlos ]  [Cancelar]│
└────────────────────────────────────────────────────────────────┘
```

## Teste sem dono

```
 Sem dono  │ CT04.4 [P2]  │              │              │              │              │ 25 min
           │ 25 min       │              │              │              │              │
 ! 1 teste sem responsável — arraste para uma pessoa ou use "Atribuir" na Lista.
```

## Modal M12 — Equipe e capacidade

```
┌─ Equipe e capacidade ──────────────────────────────────────── ✕ ─┐
│ Pessoa          Capacidade (min/semana)    Cor      Ativa          │
│ Ana             [ 120 ]                    [azul]   [x]      🗑    │
│ Bia             [  90 ]                    [verde]  [x]      🗑    │
│ Carlos          [  60 ]                    [laranja][x]      🗑    │
│ + Adicionar pessoa                                                 │
│ Pessoa inativa some das listas de atribuição, mas o histórico fica.│
│                                      [ Cancelar ]  [ Salvar ]      │
└────────────────────────────────────────────────────────────────────┘
```

## Interações

| Ação | Efeito |
|---|---|
| Arrastar chip para dia/pessoa | grava `responsavel` e `dataPlanejada` do teste |
| Arrastar chip entre pessoas | reatribui; recalcula as duas barras |
| Clique no chip | abre o teste (M4) |
| ◀ ▶ | navega semanas; "Esta semana" volta para hoje |
| Plano [▾] | mostra só testes daquele plano (ou "Todos") |

## Regras
- Uso = soma de `estimativaMin` dos testes da pessoa na semana; teste sem estimativa conta 0 e mostra `?`.
- Fins de semana desligados por padrão; ligar mostra as colunas Sáb/Dom.
- Capacidade fica em `dados/pessoas.json`; mudar não altera semanas passadas já fechadas.
- Duas pessoas mexendo no mesmo teste: vale o primeiro a salvar, o segundo recebe aviso.

## Modais que abre
M12 Equipe e capacidade · M4 Detalhe do teste · M2 Incluir testes
