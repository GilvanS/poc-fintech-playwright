# Visões — exemplos ASCII completos

> Plano apenas. Cada arquivo abaixo é **uma tela inteira** de uma visão, com dados de exemplo,
> estados (vazio, limite, conflito), interações e os modais que ela abre.
> Visão geral, campos novos e tasks: [../VISOES.md](../VISOES.md). Plano principal: [../PLANO.md](../PLANO.md).

| Arquivo | Visão | Modelo do GitHub Projects |
|---|---|---|
| [V0-lista.md](V0-lista.md) | Lista (tabela) | — (já existia na T5) |
| [V1-kanban.md](V1-kanban.md) | Kanban com limite de WIP | Kanban |
| [V2-roadmap.md](V2-roadmap.md) | Linha do tempo (Gantt) | Roadmap |
| [V3-incidentes.md](V3-incidentes.md) | Incidentes (INC) | Bug tracker |
| [V4-release.md](V4-release.md) | Prontidão go/no-go | Feature release |
| [V5-lancamento.md](V5-lancamento.md) | Funcionalidade × Status | Product launch |
| [V6-iteracoes.md](V6-iteracoes.md) | Iterações e burndown | Iterative development |
| [V7-planejamento.md](V7-planejamento.md) | Backlog × semana × capacidade | Team planning |
| [V8-retro.md](V8-retro.md) | Retrospectiva | Team retrospective |

## Dados de exemplo (os mesmos em todas as telas)

Hoje = **sexta 02/10/2026**. Usuário logado no exemplo = **Ana**. Equipe de 3 pessoas.

> Estes dados servem **só para os desenhos e para a semente fictícia (T11)**. A ferramenta **não lê** a
> planilha `MassaDados.xlsx` (decisão de 02/10/2026, [VISOES.md](../VISOES.md) §2.1). Nomes de cenários,
> IDs de massa aqui são ilustrativos. **Massa repetida é proposital**: alguns testes reaproveitam a massa
> de outro de propósito (ex.: o CT03.7 continua de onde o CT03.2 parou). Isso aparece como a marca
> neutra `=` "massa compartilhada" e vira a ordem de execução (`dependeDe`); **não é erro nem conflito**.
> O modal de "massa em conflito" (M10) foi removido e o critério de "massa atualizada" do Release foi
> adiado porque dependia da planilha.

```
Pessoa   Capacidade (min/semana de teste)
Ana      120
Bia       90
Carlos    60
```

Plano **28/09/26** [MASTER] — criado 24/09, previsão 13/10, 8 testes:

```
ID      Func.     Cenário                Resp.   Pri  Est.  Planejada  Execução  Status       Massa
CT03.1  Faturas   Pagar valor total      Ana     P1   20m   29/09      29/09     Passou       0481
CT03.2  Faturas   Pagar valor mínimo     Ana     P1   30m   02/10      -         Em andamento 0483 (compartilhada)
CT03.3  Faturas   Pagar valor parcial    Bia     P2   25m   05/10      -         Agendado     0484
CT03.7  Faturas   Pagar fatura vencida   Bia     P2   30m   06/10      -         Agendado     0483 (compartilhada, depende do CT03.2)
CT04.1  Pix       Enviar Pix por chave   Carlos  P1   20m   07/10      -         Agendado     0510
CT04.2  Pix       Agendar Pix            Carlos  P2   25m   08/10      -         Refinamento  0511
CT05.1  Cadastro  Cadastro PF            Bia     P3   15m   30/09      30/09     Passou       0520
CT05.2  Cadastro  Cadastro duplicado     Bia     P3   15m   01/10      01/10     Falhou       0521
```

Incidentes:

```
INC            Sev.   Status      Afeta          Resp.  Aberto
INC0715799001  Média  Novo        CT05.2         Bia    01/10
INC0715802225  Alta   Em análise  CT03.1 CT03.2  Ana    29/09
INC0715790010  Baixa  Resolvido   CT05.1         Bia    28/09 (resolvido 30/09)
```

Outros planos: **14/09/26** (anterior, 6 de 6 concluídos, 130 min estimados / 156 min reais) e
**05/10/26** (próximo, vazio, previsão 20/10). Backlog (cenários cadastrados que ainda não estão em nenhum plano):
12 itens, 5 mostrados em V6 e V7.

Situações propositais nos dados (para cada visão ter algo a mostrar): massa **0483 compartilhada** de
propósito entre CT03.2 e CT03.7 (o segundo depende do primeiro), uma falha (CT05.2), dois INC abertos e um teste em Standby (CT04.2: parou em
01/10 aguardando massa e foi replanejado para 08/10; o Gantt marca o atraso de 01 a 02/10).

## Legenda usada nos desenhos

```
[Passou] [Falhou] [Andamento] [A iniciar] [Standby]   status do teste (marcados à mão)
[P1] [P2] [P3]                                          prioridade
=                                                       massa compartilhada de propósito (neutra, não é erro)
▓ cheio   ░ vazio                                       barras de progresso e capacidade
██ dia de execução   ▒▒ planejado futuro   ▓▓ atrasado  Gantt
ok  XX                                                  passou / falhou no Gantt
┆                                                       hoje
◆                                                       data de previsão
▾ ▸                                                     grupo aberto / fechado
```

<a id="layout"></a>
## Layout: menu lateral recolhível (padrão do Admin do FintechBankApp)

O shell segue o `AllureShell` do Admin (`WEB/components/shared/AllureShell.tsx`): **menu lateral
com grupos e ícones**, no lado **esquerdo** por padrão (como no Admin), com dois botões no topo do menu. Isso
**substitui** a barra de abas que aparecia no topo dos desenhos antigos. **Cada tela `V0…V8` agora é
desenhada com o shell completo**: o menu à esquerda (item ativo dentro de uma pílula, como no Admin), o
cabeçalho com o botão de voltar e a área principal com o título da seção e o botão "Atualizar".
As telas ficam largas (uns 150 caracteres); no painel de arquivos use a rolagem horizontal.

### Menu expandido (largura de 14 rem), lado esquerdo

```
┌──────────────────────────┬───────────────────────────────────────────────────────────┐
│ NAVEGAÇÃO     [⇄] [«]    │ Kanban                                                    │
│ ──────────────────────── │ Plano [28/09/26 ▾] MASTER   Online: Ana, Bia              │
│ PLANOS & TESTES          │ Sino (3)   Você: [Ana ▾]                                  │
│  ▢ Planos                │ Criado 24/09/2026 · Previsão 13/10/2026 · 38% executado   │
│  ▢ Lista                 │────────────────────────────────────────────────────────── │
│ ▌▢ Kanban                │                                                           │
│ ──────────────────────── │ (conteúdo da visão — ver V1-kanban.md, V2-roadmap.md…)    │
│ PLANEJAMENTO             │                                                           │
│  ▢ Roadmap               │                                                           │
│  ▢ Iterações             │                                                           │
│  ▢ Planejamento          │                                                           │
│ ──────────────────────── │                                                           │
│ QUALIDADE                │                                                           │
│  ▢ Incidentes         2  │                                                           │
│  ▢ Release               │                                                           │
│  ▢ Lançamento            │                                                           │
│  ▢ Retro                 │                                                           │
│ ──────────────────────── │                                                           │
│ MINHAS VISÕES            │                                                           │
│  ▢ Só Faturas P1         │                                                           │
│  + Nova visão            │                                                           │
│ ──────────────────────── │                                                           │
│ MASSA & SISTEMA          │                                                           │
│  ▢ Cenários e massa   !  │                                                           │
│  ▢ Equipe                │                                                           │
│  ▢ Configurações         │                                                           │
└──────────────────────────┴───────────────────────────────────────────────────────────┘
 ▌ = item ativo (no tema midnight fica verde com borda verde)   2 = incidentes abertos   ! = alerta
```

### Menu recolhido (só os ícones, largura de 4 rem)

Clicar em `[«]` recolhe: somem os textos, o rótulo do grupo vira `·` e o nome do item aparece como dica
(tooltip) ao passar o mouse. O botão vira `[»]` para expandir de novo. O conteúdo ganha o espaço.

```
┌───────┬───────────────────────────────────────────────────────────┐
│  [»]  │ Kanban                                                    │
│ ───── │ Plano [28/09/26 ▾] MASTER   Online: Ana, Bia              │
│   ·   │ Sino (3)   Você: [Ana ▾]                                  │
│  ▢    │ Criado 24/09/2026 · Previsão 13/10/2026 · 38% executado   │
│  ▢    │────────────────────────────────────────────────────────── │
│ ▌▢ ◄──┼ passar o mouse: ┌────────┐                                │
│ ───── │ (conteúdo da visão — ver V1-kanban.md…)  │ Kanban │       │
│   ·   │                 └────────┘                                │
│  ▢    │                                                           │
└───────┴───────────────────────────────────────────────────────────┘
 (demais ícones: um por item; títulos de grupo viram "·")
```

### Os dois botões do topo do menu (iguais aos do Admin)

| Botão | Efeito |
|---|---|
| `[⇄]` Mover menu para a esquerda/direita | troca o lado do menu; padrão **esquerda**. Com o menu à direita os desenhos ficam espelhados |
| `[«]` / `[»]` Recolher / Expandir menu | alterna entre largura cheia e só ícones (animação de 300 ms) |

No Admin atual essas duas escolhas **não são lembradas** ao recarregar. Aqui o lado e o recolhimento
ficam salvos **por pessoa** no navegador (`localStorage`), com a tela funcionando mesmo se o
armazenamento falhar.

### Itens do menu e onde cada um abre

| Grupo | Item | Abre | Arquivo |
|---|---|---|---|
| PLANOS & TESTES | Planos | lista de planos e "Novo Plano" (M1) | PLANO.md T4 |
| | Lista | tabela do plano | [V0-lista.md](V0-lista.md) |
| | Kanban | quadro por status | [V1-kanban.md](V1-kanban.md) |
| PLANEJAMENTO | Roadmap | linha do tempo | [V2-roadmap.md](V2-roadmap.md) |
| | Iterações | iterações e burndown | [V6-iteracoes.md](V6-iteracoes.md) |
| | Planejamento | semana × capacidade | [V7-planejamento.md](V7-planejamento.md) |
| QUALIDADE | Incidentes (n) | quadro de INC | [V3-incidentes.md](V3-incidentes.md) |
| | Release | go/no-go | [V4-release.md](V4-release.md) |
| | Lançamento | Funcionalidade × Status | [V5-lancamento.md](V5-lancamento.md) |
| | Retro | retrospectiva | [V8-retro.md](V8-retro.md) |
| MINHAS VISÕES | (visões salvas) | filtros + agrupamento salvos; `+ Nova visão` abre M11 | VISOES.md §4 |
| MASSA & SISTEMA | Cenários e massa | cadastro de cenários e da massa informada (M16); sem ler planilha | [VISOES.md](../VISOES.md) §2.1 |
| | Equipe | pessoas e capacidade (M12) | [V7-planejamento.md](V7-planejamento.md) |
| | Configurações | limites de WIP (M13), planilha lida, ambiente | VISOES.md §5 |

### No celular (tela estreita)

O menu lateral some e vira uma **fileira de botões rolável** no topo, como no Admin:

```
 [Planos] [Lista] [Kanban] [Roadmap] [Iterações] [Planejamento] [Incidentes 2] [Release] …  →
```

### Cabeçalho da área principal (comum a todas as telas)

- `Online: Ana, Bia` mostra quem está com a tela aberta (atualização a cada 5 s).
- `Você: [Ana ▾]` escolhe quem você é (sem senha, lembrado no navegador). Toda alteração grava o autor.
- `Plano [28/09/26 ▾]` troca o plano em que todas as visões trabalham; `Sino (3)` são os lembretes (T10).
- Os mesmos elementos do cabeçalho do Admin, adaptados: `[←]` voltar, título e subtítulo, **`[ Fundo ]`**
  (imagem, opacidade e célula do dither, por pessoa) e, em cada seção, **`[ ⟳ Atualizar ]`**.
  **Não há botão de execução** (Play, "Execução ao vivo"): por enquanto a ferramenta só planeja e visualiza.
- O seletor **Normal / Dark** do Admin **não existe aqui**: o tema é só escuro (D7).

> No FintechBankApp já existe a seção **"Planejamento de Testes"** (grupo TESTES do Admin), que também
> lê a `TBL_CENARIOS`. O Test of Puppets é uma ferramenta separada do projeto poc-fintech-playwright;
> convém decidir depois se uma substitui a outra ou se convivem.
