# V0 — Lista

Tabela do plano, a visão mais densa. Serve para ordenar, filtrar e agir em **lote**
(atribuir responsável, mudar prioridade, mover para outro plano).
Dados: todos os campos do teste no plano. Dados de exemplo: [README](README.md).

## Tela completa

```
╭────────────────────────╮   [←]  Test of Puppets   Plano [28/09/26 ▾] MASTER   Online: Ana, Bia   [ Fundo ] [ Sino 3 ] Você: [Ana ▾]
│ NAVEGAÇÃO      [⇄] [«] │        Gestão de planos de teste
│                        │        Criado 24/09/2026 · Previsão 13/10/2026 · 3 de 8 executados  ▓▓▓░░░░░ 38%
│ PLANOS & TESTES        │  ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
│ ▢ Planos               │   LISTA                                                                                   [ ⟳ Atualizar ]
│╭──────────────────────╮│
││ ▢ Lista              ││   Testes (8 de 8)                                                                     [ + Incluir testes ]
│╰──────────────────────╯│   Buscar [__________]  Func. [Todas ▾]  Resp. [Todos ▾]  Pri. [Todas ▾]  Status [Todos ▾]  Data [dd/mm/aaaa]
│ ▢ Kanban               │   [ ] Só meus (Ana)  [ ] Recentes (3 dias)  [ ] Só massa compartilhada  [ ] Só com INC aberto   Limpar filtros
│────────────────────────│
│ PLANEJAMENTO           │   Visão salva: [Padrão ▾]   [ Salvar visão ]                                    Colunas [⚙]   Exportar [CSV]
│ ▢ Roadmap              │  ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
│ ▢ Iterações            │   [ ] │ ID ▲   │ Funcionalidade │ Cenário              │ Pri │ Resp.  │ Status       │ Plan. │ Exec. │ Est. │ Massa  │ INC           │ Ações
│ ▢ Planejamento         │  ─────┼────────┼────────────────┼──────────────────────┼─────┼────────┼──────────────┼───────┼───────┼──────┼────────┼───────────────┼──────
│────────────────────────│   [ ] │ CT03.1 │ Faturas        │ Pagar valor total    │ P1  │ Ana    │ [Passou]     │ 29/09 │ 29/09 │ 20m  │ 0481   │ INC0715802225 │ 👁 ✏
│ QUALIDADE              │   [ ] │ CT03.2 │ Faturas        │ Pagar valor mínimo   │ P1  │ Ana    │ [Andamento]  │ 02/10 │ -     │ 30m  │ 0483 = │ INC0715802225 │ 👁 ✏
│ ▢ Incidentes        2  │   [ ] │ CT03.3 │ Faturas        │ Pagar valor parcial  │ P2  │ Bia    │ [A iniciar]  │ 05/10 │ -     │ 25m  │ 0484   │ -             │ 👁 ✏ 🗑
│ ▢ Release              │   [ ] │ CT03.7 │ Faturas        │ Pagar fatura vencida │ P2  │ Bia    │ [A iniciar]  │ 06/10 │ -     │ 30m  │ 0483 = │ -             │ 👁 ✏ 🗑
│ ▢ Lançamento           │   [ ] │ CT04.1 │ Pix            │ Enviar Pix por chave │ P1  │ Carlos │ [A iniciar]  │ 07/10 │ -     │ 20m  │ 0510   │ -             │ 👁 ✏ 🗑
│ ▢ Retro                │   [ ] │ CT04.2 │ Pix            │ Agendar Pix          │ P2  │ Carlos │ [Standby]    │ 08/10 │ -     │ 25m  │ 0511   │ -             │ 👁 ✏ 🗑
│────────────────────────│   [ ] │ CT05.1 │ Cadastro       │ Cadastro PF          │ P3  │ Bia    │ [Passou]     │ 30/09 │ 30/09 │ 15m  │ 0520   │ INC0715790010 │ 👁 ✏
│ MINHAS VISÕES          │   [ ] │ CT05.2 │ Cadastro       │ Cadastro duplicado   │ P3  │ Bia    │ [Falhou]     │ 01/10 │ 01/10 │ 15m  │ 0521   │ INC0715799001 │ 👁 ✏
│ ▢ Só Faturas P1        │  ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
│ + Nova visão           │   Total estimado: 180 min (3 h)   Executado: 3 de 8   Falhas: 1         Linhas por página [25 ▾]   ‹ 1 ›
│────────────────────────│   Legenda: = massa compartilhada de propósito · 👁 abrir (M4) · ✏ editar · 🗑 remover do plano
│ MASSA & SISTEMA        │
│ ▢ Cenários e massa  !  │
│ ▢ Equipe               │
│ ▢ Configurações        │
│                        │
╰────────────────────────╯
```

## Com linhas selecionadas (barra de lote)

```
 [x] │ ID ▲   │ Funcionalidade │ Cenário              │ Pri │ Resp.  │ Status
─────┼────────┼────────────────┼──────────────────────┼─────┼────────┼───────────
 [x] │ CT03.3 │ Faturas        │ Pagar valor parcial  │ P2  │ Bia    │ [A iniciar]
 [x] │ CT03.7 │ Faturas        │ Pagar fatura vencida │ P2  │ Bia    │ [A iniciar]
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ 2 selecionados   Atribuir a [Carlos ▾]  Prioridade [P1 ▾]  Mover para plano [05/10/26 ▾]  ✕  │
│                  [ Aplicar ]                                          [ Remover do plano ]  │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

"Remover do plano" abre a confirmação M9. Só aparece para testes que ainda não iniciaram.

## Estados

```
 Sem testes no plano                          Filtro sem resultado
┌───────────────────────────────────────┐    ┌───────────────────────────────────────┐
│  Este plano ainda não tem testes.     │    │  Nenhum teste com esses filtros.      │
│  [ + Incluir testes ]  (abre M2)      │    │  [ Limpar filtros ]                   │
└───────────────────────────────────────┘    └───────────────────────────────────────┘
```

## Interações

| Ação | Efeito |
|---|---|
| Clicar no cabeçalho de coluna | ordena (▲/▼); segunda coluna com Shift |
| Duplo clique na linha ou 👁 | abre o detalhe do teste (M4) |
| Atribuir / Prioridade em lote | grava `responsavel` / `prioridade` nos testes escolhidos |
| "Só meus" | filtra `responsavel = você` |
| Exportar CSV | gera arquivo da visão filtrada (somente leitura) |
| Recentes (3 dias) | mostra só testes alterados nos últimos 3 dias |

## Regras
- `Pri`, `Resp.`, `Est.` são campos novos; sem valor aparecem como `-` e podem ser editados na própria célula.
- Massa repetida (`=`) **não é erro**: alguns testes reaproveitam a mesma massa de propósito (ex.: o CT03.7
  continua de onde o CT03.2 parou). É só uma marca neutra; passar o mouse mostra "0483 também usada por
  CT03.7" e o campo `dependeDe` garante a ordem: o CT03.7 só pode ir para "Em andamento" depois que o CT03.2 passou.
- Edição simultânea: se outra pessoa alterou a mesma linha, o salvar mostra o aviso de conflito (M9 variante).

## Modais que abre
M2 Incluir testes · M4 Detalhe do teste · M9 Confirmações · M16 Cenário
