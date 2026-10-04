# V8 — Retrospectiva  (modelo GitHub: Team retrospective)

Liberada quando o plano termina. Reúne o time para registrar **o que foi bem, o que melhorar e as
ações**, já com sugestões automáticas tiradas dos dados. Ações viram tarefas com responsável e prazo
(e podem virar INC). Dados de exemplo: [README](README.md); a retro usa o plano **14/09/26** (concluído).

## Tela completa

```
╭────────────────────────╮   [←]  Test of Puppets   Plano [14/09/26 ▾] CONCLUÍDO   Online: Ana, Bia, Carlos   [ Fundo ] [ Sino 3 ] Você: [Ana ▾]
│ NAVEGAÇÃO      [⇄] [«] │        Gestão de planos de teste
│                        │        Concluído em 25/09/2026 · 6 de 6 executados  ▓▓▓▓▓▓▓▓ 100%
│ PLANOS & TESTES        │  ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
│ ▢ Planos               │   RETRO                                                                                   [ ⟳ Atualizar ]
│ ▢ Lista                │
│ ▢ Kanban               │   Retrospectiva — Plano 14/09/26                 Status: ABERTA        [ ] Notas anônimas      [ Fechar retro ]
│────────────────────────│
│ PLANEJAMENTO           │   Sugestões automáticas ▾  (clique para virar nota)
│ ▢ Roadmap              │     • 1 teste falhou e foi reexecutado (CT02.3 passou na 2ª tentativa)         [+ nota "Pode melhorar"]
│ ▢ Iterações            │     • Estimado 130 min, real 156 min (+20%)                                    [+ nota "Pode melhorar"]
│ ▢ Planejamento         │     • 1 INC aberto e resolvido em 2 dias                                       [+ nota "Foi bem"]
│────────────────────────│     • Massa 0483 reutilizada por 2 testes (CT03.2 → CT03.7)                    [+ nota "Pode melhorar"]
│ QUALIDADE              │
│ ▢ Incidentes        2  │  ┌ FOI BEM (2) ───────────────┐ ┌ PODE MELHORAR (2) ─────────┐ ┌ AÇÕES (2) ─────────────────┐
│ ▢ Release              │  │ Kanban com WIP evitou      │ │ Reuso de massa sem ordem   │ │ [ ] Ordenar CT03.2 → CT03.7│
│ ▢ Lançamento           │  │ 2 execuções ao mesmo       │ │ gerou 2 reexecuções.       │ │ Resp.: Ana · até 20/10     │
│╭──────────────────────╮│  │ tempo.                     │ │ +4  (Ana Bia Carlos +1)    │ │ (sem INC)                  │
││ ▢ Retro              ││  │ +3  (Ana Bia Carlos)       │ ├────────────────────────────┤ ├────────────────────────────┤
│╰──────────────────────╯│  ├────────────────────────────┤ │ Estimativa 20% abaixo      │ │ [x] Revisar estimativas    │
│────────────────────────│  │ Evidência .docx gerada     │ │ do tempo real.             │ │ Resp.: Carlos · 28/09      │
│ MINHAS VISÕES          │  │ sozinha.                   │ │ +1  (Carlos)               │ │                            │
│ ▢ Só Faturas P1        │  │ +2  (Ana Carlos)           │ │                            │ │                            │
│ + Nova visão           │  └────────────────────────────┘ └────────────────────────────┘ └────────────────────────────┘
│────────────────────────│   [ + Nova nota ]                [ + Nova nota ]                [ + Nova ação ] (M14)
│ MASSA & SISTEMA        │   +N = votos · clique para votar (1 voto por pessoa por nota; segundo clique tira o voto)
│ ▢ Cenários e massa  !  │
│ ▢ Equipe               │
│ ▢ Configurações        │
│                        │
╰────────────────────────╯
```

## Adicionando uma nota (inline)

```
┌ FOI BEM (3) ─────────────────┐
│ ...                          │
├──────────────────────────────┤
│ [ Escreva a nota…          ] │
│ [ Salvar ]  [ Cancelar ]     │
└──────────────────────────────┘
```

Com "Notas anônimas" ligado, o autor some; só a pessoa que escreveu vê `(sua nota)`.

## Modal M14 — Ação da retro

```
┌─ Nova ação ───────────────────────────────────────────────── ✕ ─┐
│ Ação        [ Ordenar CT03.7 após o CT03.2 (massa 0483)       ]   │
│ Origem      nota "Reuso de massa sem ordem" (+4)                  │
│ Responsável [Ana ▾]               Prazo [20/10/2026 📅]           │
│ [x] Criar também um INC     Severidade [Alta ▾]                   │
│                                   [ Cancelar ]  [ Salvar ação ]   │
└──────────────────────────────────────────────────────────────────┘
```

## Retro fechada (somente leitura)

```
 Retrospectiva — Plano 14/09/26          Status: FECHADA em 26/09/2026 por Ana     [ Reabrir ]
 Ações pendentes (1):  [ ] Ordenar CT03.2 → CT03.7 — Ana — até 20/10 (faltam 12 dias)
 Ações concluídas (1): [x] Revisar estimativas — Carlos — 28/09
```

Ações pendentes de retros anteriores aparecem como lembrete no sino (T10) e na abertura do plano seguinte.

## Retro indisponível (plano em andamento)

```
 Plano 28/09/26 ainda está em andamento (3 de 8).
 A retrospectiva abre quando todos os testes estiverem concluídos ou cancelados.
 Retros anteriores: [14/09/26 ▾]
```

## Interações

| Ação | Efeito |
|---|---|
| Sugestão automática | cria a nota já escrita na coluna indicada |
| Votar | +1 por pessoa por nota; guarda quem votou |
| Nota → ação | botão "Virar ação" abre M14 |
| Marcar ação feita | `feito=true` com data e autor |
| Fechar retro | trava notas e votos; ações continuam editáveis |

## Regras
- Dados em `dados/retros.json`: `notas[{coluna,texto,autor,votos[]}]`, `acoes[{texto,responsavel,prazo,feito,incId?}]`.
- Sugestões são calculadas na hora (não são salvas até virarem nota).
- Só aparece a partir de plano concluído; reabrir exige a mesma pessoa que fechou ou qualquer uma com aviso.

## Modais que abre
M14 Nota/ação da retro · M6 Registrar INC (quando marcada a caixa) · M9 Confirmações
