# V5 — Lançamento (Funcionalidade × Status)  (modelo GitHub: Product launch)

Cruza **áreas** (funcionalidades: Faturas, Pix, Cadastro…) com o andamento. Responde "qual área
está atrasada e quem cuida dela". Dados de exemplo: [README](README.md).

## Tela completa

```
╭────────────────────────╮   [←]  Test of Puppets   Plano [28/09/26 ▾] MASTER   Online: Ana, Bia   [ Fundo ] [ Sino 3 ] Você: [Ana ▾]
│ NAVEGAÇÃO      [⇄] [«] │        Gestão de planos de teste
│                        │        Criado 24/09/2026 · Previsão 13/10/2026 · 3 de 8 executados  ▓▓▓░░░░░ 38%
│ PLANOS & TESTES        │  ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
│ ▢ Planos               │   LANÇAMENTO                                                                              [ ⟳ Atualizar ]
│ ▢ Lista                │
│ ▢ Kanban               │   Lançamento do plano 28/09/26      Próximo marco: previsão 13/10 (7 dias úteis)      Pronto: ▓▓░░░░░░ 25%
│────────────────────────│   Linhas [Funcionalidade ▾]   Colunas [Status ▾]   Valor [Qtd de testes ▾]   Resp. [Todos ▾]
│ PLANEJAMENTO           │
│ ▢ Roadmap              │   Funcionalidade │ Resp. principal │ Agendado │ Em and. │ Refin. │ Passou │ Falhou │ Pronto │ INC abertos
│ ▢ Iterações            │  ────────────────┼─────────────────┼──────────┼─────────┼────────┼────────┼────────┼────────┼────────────
│ ▢ Planejamento         │   Faturas        │ Ana             │ 2        │ 1       │ 0      │ 1      │ 0      │ 25%    │ 1
│────────────────────────│   Pix            │ Carlos          │ 1        │ 0       │ 1      │ 0      │ 0      │ 0%     │ 0
│ QUALIDADE              │   Cadastro       │ Bia             │ 0        │ 0       │ 0      │ 1      │ 1      │ 50%    │ 1
│ ▢ Incidentes        2  │  ────────────────┼─────────────────┼──────────┼─────────┼────────┼────────┼────────┼────────┼────────────
│ ▢ Release              │   TOTAL          │                 │ 3        │ 1       │ 1      │ 2      │ 1      │ 25%    │ 2
│╭──────────────────────╮│
││ ▢ Lançamento         ││   Pronto por funcionalidade
│╰──────────────────────╯│    Faturas   ▓▓▓▓░░░░░░░░░░░░ 25%   Ana      1 de 4 passaram    = massa 0483 compartilhada (CT03.2 → CT03.7)
│ ▢ Retro                │    Pix       ░░░░░░░░░░░░░░░░  0%   Carlos   0 de 2 passaram    standby: CT04.2
│────────────────────────│    Cadastro  ▓▓▓▓▓▓▓▓░░░░░░░░ 50%   Bia      1 de 2 passaram    INC0715799001 aberto
│ MINHAS VISÕES          │
│ ▢ Só Faturas P1        │   Bloqueios
│ + Nova visão           │    Faturas   INC0715802225 [Alta] · CT03.7 espera o CT03.2 (mesma massa 0483)
│────────────────────────│    Pix       CT04.2 em Standby: aguarda massa
│ MASSA & SISTEMA        │    Cadastro  CT05.2 falhou → INC0715799001 [Média]
│ ▢ Cenários e massa  !  │
│ ▢ Equipe               │
│ ▢ Configurações        │
│                        │
╰────────────────────────╯
```

## Clicar numa célula filtra

Clicar em `Faturas × Agendado (2)` abre a Lista já filtrada:

```
 Lista · filtro: Funcionalidade = Faturas, Status = Agendado           [ Limpar ]
 CT03.3  Faturas  Pagar valor parcial     P2  Bia  [A iniciar]  05/10
 CT03.7  Faturas  Pagar fatura vencida    P2  Bia  [A iniciar]  06/10
```

## Trocar linhas por pessoa

```
 Resp.  │ Agendado │ Em and. │ Refin. │ Passou │ Falhou │ Pronto
────────┼──────────┼─────────┼────────┼────────┼────────┼────────
 Ana    │ 0        │ 1       │ 0      │ 1      │ 0      │ 50%
 Bia    │ 2        │ 0       │ 0      │ 1      │ 1      │ 25%
 Carlos │ 1        │ 0       │ 1      │ 0      │ 0      │ 0%
```

## Interações

| Ação | Efeito |
|---|---|
| Clique na célula | abre a Lista filtrada pela combinação |
| Clique no nome da funcionalidade | abre a Lista só dela |
| Mudar linhas/colunas | Funcionalidade, Responsável, Prioridade × Status |
| Valor | Qtd de testes, Minutos estimados ou % do total |
| Barra "Pronto" | passou ÷ total da funcionalidade |

## Regras
- `Resp. principal` = pessoa com mais testes da funcionalidade no plano; empate mostra os dois nomes.
- "Bloqueios" junta INC abertos, testes que esperam outro por causa da massa compartilhada e testes em Standby da funcionalidade.
- Sem funcionalidade definida no cenário → linha `(sem funcionalidade)`.

## Modais que abre
Nenhum próprio; abre V0 Lista filtrada, M4 e M6/M7 pelos atalhos de bloqueio.
