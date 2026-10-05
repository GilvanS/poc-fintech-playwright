# Test of Puppets — tela de Planos de Execução (poc-fintech-playwright)

> **Escopo:** pasta nova `test-of-puppets/` do projeto **poc-fintech-playwright**. **Não faz parte do
> FintechBankApp** e não altera nada nele. Este documento é só o **plano**; nenhum código foi escrito.
> Cada task traz um **exemplo em ASCII** do que ela entrega, para você conferir se eu entendi.
> As **visões** inspiradas nos modelos do GitHub Projects (Kanban, Roadmap, Bug tracker, Release,
> Iterações, Lançamento, Planejamento, Retro) estão em [VISOES.md](VISOES.md) (task **T13**).
> O que aproveitamos de `jira_clone`, `TestSprite/Docs` e `github-automated-repos`: [REFERENCIAS.md](REFERENCIAS.md).
> > **Decisão de 05/10/2026 (esclarecimento):** a ferramenta **não executa testes**: só acompanha (▶ início, ⏸ pausa, ■ registro manual do resultado e do tempo). Sem Playwright e sem Excel.
> **Decisão de 02/10/2026:** o Excel (`data/MassaDados.xlsx`) é **só modelo de estrutura por enquanto**. A
> ferramenta **não lê nem grava** a planilha e tem os próprios dados em `dados/`. Onde este texto ainda
> fala em ler `data/`, vale a decisão acima ([VISOES.md](VISOES.md) §2.1).

## 0. Onde fica e de onde se alimenta

```
poc-fintech-playwright/
├── data/                         ← NÃO USADO pela ferramenta (a planilha é só modelo de campos)
│   ├── MassaDados.xlsx           TBL_CENARIOS · TBL_USUARIOS · TBL_FATURA · TBL_PIX …
│   └── tbl_de_massas.csv
├── tests/ · fixtures/ · …        ← suíte Playwright (não é tocada)
└── test-of-puppets/                 ← PASTA NOVA deste plano
    ├── PLANO.md                  este documento
    ├── package.json              independente da suíte (não entra em "workspaces")
    ├── server/                   leitor da planilha · API · runner do Playwright
    ├── web/                      a tela (React)
    └── dados/                    arquivos PRÓPRIOS da ferramenta (planos, execuções, INC, backups)
```

Regra de fluxo (**decisão de 02/10/2026**): a ferramenta **não lê nem grava `data/`**. A planilha serviu só
de modelo de campos. Cenários, planos, execuções, incidentes e retros ficam em `test-of-puppets/dados/`,
cadastrados e planejados direto no web. Detalhes, o que fica adiado e o cadastro de cenários (M16):
[VISOES.md](VISOES.md) §2.1.
Stack confirmada: **TypeScript (Node) + React**; Python foi descartado (o Playwright da suíte é TypeScript e
o servidor reaproveita o mesmo ecossistema).

## 1. O que eu entendi

Hoje o controle dos testes vive na planilha `data/MassaDados.xlsx` (aba `TBL_CENARIOS`): uma linha
por cenário (`CT03.2`…) apontando para uma massa (`ID_MASSA` + `CPF`), com a cor da linha servindo
de status informal. Você quer uma **página web** no estilo do *Test Manager* corporativo dos prints
(e do quadro *Todo / In Progress / Done* do GitHub Projects) para:

1. **Criar um Plano de Execução** (ex.: "28/09/26") e **incluir nele** cenários da planilha;
2. ver o plano em **lista** e em **cards** (Agendado → Em andamento → Refinamento → Concluído);
3. abrir cada teste (**Geral / Cenário e Datas / Execuções**), com a **massa** (ID + CPF) à vista;
4. ▶ iniciar / ⏸ pausar / ■ registrar o resultado e o tempo de cada teste, **sem** a ferramenta rodar nada *(T7, 05/10/2026)*;
5. registrar **incidentes** (INC) ligados aos testes afetados;
6. **atualizar a massa** depois do teste, sem quebrar a regra: *fatura fechada é imutável; só
   `saldo_conta`, `lim_utilizado`, `lim_disponivel`, `parcelas_a_vencer`, `fat_aberta` e o status mudam.*

### Planilha que você colou (15 linhas) — achados (histórico: a planilha não é mais usada, ver a decisão de 02/10/2026)

| Achado | Onde entra |
|---|---|
| `ID_MASSA 0483` aparece em **CT03.2** e em **CT03.7**: **proposital** (o CT03.7, "Reenvio do pagamento mínimo", reaproveita a massa do CT03.2) | vira `dependeDe` e a marca neutra "massa compartilhada"; **não é erro** |
| `SEQ` pula 7 e 9 (6 → 8 → 10) | T1 só avisa, não corrige |
| Cor da linha (verde = CT03.1; laranja = CT03.2 e CT03.7) é status informal | T11 pede o mapeamento antes de semear |
| CT03.x consomem a massa (pagamento muda saldo/limite) | T9 atualiza a massa com confirmação |

## 2. Decisões (com a minha recomendação — confirme ou troque)

| # | Decisão | Recomendação | Por quê |
|---|---|---|---|
| D1 | Stack | pasta `test-of-puppets/` com **servidor Node/TS (Express)** + **front Vite/React/TS**, `package.json` próprio | projeto já usa `tsx`/TypeScript; kanban com arrastar precisa de UI de verdade; pasta independente não mexe na suíte nem no `workspaces` |
| D2 | Fonte dos dados | **dados próprios** em `test-of-puppets/dados/*.json` (cenários, planos, execuções, INC, retros; SQLite fica como evolução). **O Excel não é lido nem gravado**, é só modelo de campos — [VISOES.md](VISOES.md) §2.1 | decisão do usuário (02/10/2026): não atrapalhar a suíte nem o Admin; JSON é fácil de versionar e restaurar |
| D3 | Escrita na planilha | **nenhuma** (T9 cancelada em 05/10/2026: o objetivo é não depender do Excel). Se um dia voltar: só via `excelTableAppender`, com diff e confirmação | regra do projeto: nunca `XLSX.writeFile` (apaga formatação de Tabela) e confirmação antes de editar massa real |
| D4 | Rodar teste **(ADIADA: sem execução por enquanto)** | **Play = `child_process.spawn`** do comando Playwright que já existe (`npm run bdd:gen` + `playwright test --grep @CT… --project=bdd-headed`) | reaproveita 100% a suíte; fallback "copiar comando" se o navegador fechar no meio |
| D5 | Segurança e uso | **substituída:** servidor compartilhado na rede interna, **sem senha**, seletor "Você" e `versao` por registro (ver [VISOES.md](VISOES.md) §2) | a ferramenta terá mais de uma pessoa; sem dado sensível novo |
| D6 | Resultado do teste | ler `output/allure-results/*-result.json` (já gerado) — decisão final na T7 após inspecionar o `summaryReporter` | evita criar um reporter novo se o que existe já basta |
| D7 | Tema e fundo | **somente dark** ("midnight"), com a paleta `volt-*` do FintechBankApp e o fundo animado `GridRevealBackdrop` do painel Admin, copiados (não importados) — ver [VISOES.md](VISOES.md) §4.1 | pedido do usuário; mesma identidade visual do Admin, sem alternância de tema |

## 3. Arquitetura

> **Atualização (02/10/2026):** o leitor de planilha (`reader.xlsx`), o `writeback` e a seta de
> `data/MassaDados.xlsx` do desenho abaixo estão **desligados**. O catálogo de testes vem do cadastro de
> cenários da própria ferramenta (`dados/cenarios.json`, modal M16). O resto da arquitetura vale igual.

```
 data/MassaDados.xlsx  (TBL_CENARIOS, TBL_USUARIOS…)        output/allure-results/*.json
        │ somente leitura (T1)                                      ▲ resultado (T7)
        ▼                                                           │
 ┌─────────────────────── test-of-puppets/server (:3100) ──────────────┴───────────┐
 │  reader.xlsx ─► catálogo de testes ─┐                                          │
 │  dados/*.json ─► planos/execuções/INC ┼─► API REST ──► runner (spawn Playwright)│
 │  writeback (T9, com confirmação) ─────┘                                         │
 └───────────────────────────────────▲────────────────────────────────────────────┘
                                     │ fetch /api/*
                    ┌────────────────┴─────────────────┐
                    │ test-of-puppets/web (:3101)          │  Planos · Lista · Cards · Teste · INC
                    └───────────────────────────────────┘
```

Reaproveita do projeto (importando por caminho relativo, sem copiar): `tests/utils/excelReader.ts`,
`tests/utils/excelTableAppender.ts`, `tests/utils/summaryReporter.ts`, `evidences/*.docx`, os
scripts `bdd:*`/`test:ct03.*`.

## 4. Modelo de dados (resumo)

```
Teste (vem de data/ — leitura)  Plano (test-of-puppets/dados)   Execução
─────────────────────────       ─────────────────────────    ──────────────────────────
idCenario  CT03.2               id        "2026-09-28"       testeId     CT03.2
nome       "Consultar…"         nome      "28/09/26"         planoId     "2026-09-28"
feature    faturas              criadoEm  2026-09-24         runId       "run_5c1d9a2b"
idMassa    0483                 previsao  2026-10-13         status      a_iniciar | na_fila | em_andamento
cpf        10740179519          testes[]  [CT03.1,CT03.2…]               | refinamento | passou | falhou
senha      (não exibir)                                                  | bloqueado | cancelado | desconhecido
                                                             iniciadoEm / terminadoEm / tempoRealMin
                                Incidente                    executadoPor, observacoes
                                ─────────────────────        evidencia   (caminho do .docx)
                                inc    INC0715802225
                                titulo "Saldo de Faturamento…"
                                status new | em_analise | resolvido
                                testesAfetados[] [CT03.1,CT03.2]
```

---

## 5. Esqueleto dos modais (visão geral — cada task detalha o seu)

Todos os modais seguem a **mesma casca**: título à esquerda, `✕` à direita, corpo com rolagem
interna, **rodapé fixo** com as ações. `Esc` fecha, o foco fica preso dentro do modal e ações
destrutivas (Excluir) ficam em vermelho e **sempre pedem confirmação** (M9).

| Modal | Abre de | Componente | Task |
|---|---|---|---|
| M1 Novo Plano | botão **+ Novo Plano** (tela Planos) | `NovoPlanoModal` | T4 |
| M2 Incluir testes | botão **+ Incluir testes** (detalhe do plano) | `IncluirTestesModal` | T5 |
| M3 Detalhe do plano | clique no card do plano | `PlanoDetalhe` | T5 |
| M4 Detalhe do teste | olho 👁 na lista / clique no card | `TesteModal` | T6 |
| M5 Log da execução **(CANCELADO: virou o modal "Registrar resultado" do cronômetro)** | **▶ Play** | `LogExecucaoModal` | T7 |
| M6 Registrar INC | **+ Registrar INC** (aba Incidentes) | `RegistrarIncModal` | T8 |
| M7 Vincular INC existente | **Vincular INC existente** | `VincularIncModal` | T8 |
| M8 Atualizar massa **(CANCELADO com a T9)** | **Atualizar massa** (teste concluído) | `AtualizarMassaModal` | T9 |
| M9 Confirmações | Excluir plano/teste · Cancelar execução · Stop | `ConfirmarModal` | T5–T7 |
| M10 Massa em conflito **(REMOVIDO)** | massa repetida é proposital; vira a marca `=` "compartilhada" | — | T6 |

**Casca comum**

```
┌─ <título do modal> ───────────────────────────────────────────────────── ✕ ┐
│                                                                            │
│  <corpo — rola por dentro; cabeçalho e rodapé ficam parados>               │
│                                                                            │
├────────────────────────────────────────────────────────────────────────────┤
│ [Ação destrutiva]  (vermelho, esquerda)           [Cancelar]  [ Principal ] │
└────────────────────────────────────────────────────────────────────────────┘
```

**M1 — Novo Plano**

```
┌─ Novo Plano ───────────────────────────────────────── ✕ ┐
│ Nome do plano     [ 12/10/26                          ] │
│ Previsão término  [ 20/10/2026                     📅 ] │
│ Criar com os testes:                                    │
│   (•) vazio                                             │
│   ( ) todos da planilha (15)                            │
│   ( ) escolher agora…  → abre o M2                      │
│ ⚠ Já existe plano com este nome.   (só se duplicado)    │
├─────────────────────────────────────────────────────────┤
│                              [Cancelar]  [ Criar plano ] │
└─────────────────────────────────────────────────────────┘
```

**M2 — Incluir testes (cenários cadastrados na ferramenta, modal M16; não vêm mais de `data/`)**

```
┌─ Incluir testes no plano 28/09/26 ─────────────────────────────────────── ✕ ┐
│ Buscar [ CT03                    ]   Funcionalidade [Todas ▾]   [ ] só os livres│
│ ┌──┬────────┬───────────────────────────────────────┬────────┬──────────────┐ │
│ │☑ │ CT03.1 │ Consultar faturas e pagar o total     │ 0340   │              │ │
│ │☑ │ CT03.2 │ Consultar faturas e pagar o mínimo    │ 0483   │ = compartilh.│ │
│ │☐ │ CT03.3 │ Pagar com valor parcial               │ 0393   │              │ │
│ │☐ │ CT03.4 │ Pagar valor menor que o mínimo        │ 0448   │ já no plano  │ │
│ │☐ │ CT03.7 │ Reenvio do pagamento mínimo           │ 0483   │ = compartilh.│ │
│ └──┴────────┴───────────────────────────────────────┴────────┴──────────────┘ │
│ Data planejada para os selecionados [ 05/10/2026 📅 ]      2 selecionados      │
├───────────────────────────────────────────────────────────────────────────────┤
│                                              [Cancelar]  [ Incluir 2 testes ]   │
└───────────────────────────────────────────────────────────────────────────────┘
```

**M3 — Detalhe do plano (casca; o conteúdo das abas está na T5)**

```
┌─ Plano: 28/09/26  [MASTER] ──────────────────────────────────────────────── ✕ ┐
│ Criado em 24/09/2026 · Previsão 13/10/2026 · ▓▓░░░░░░░░ 20% executado         │
│ Testes (5 de 45)                                         [ + Incluir testes ]   │
│ ID/cenário [____]  Funcionalidade [Todas ▾]  Status [Todos ▾]  Data [dd/mm/aaaa]│
│ [✔] Apenas hoje   [ ] Datas passadas   Limpar                                   │
│ ┌ Visão lista ┐ Visão card │ Incidentes (2)                                     │
│ ├─────────────────────────────────────────────────────────────────────────────┤
│ │  <aba ativa: tabela · kanban · lista de INC>                                  │
│ └─────────────────────────────────────────────────────────────────────────────┘
├───────────────────────────────────────────────────────────────────────────────┤
│ [ Excluir Plano ]                                                               │
└───────────────────────────────────────────────────────────────────────────────┘
```

**M4 — Detalhe do teste (casca + as 3 abas)**

```
┌─ ← CT03.2 · Consultar faturas e pagar o valor mínimo [A iniciar] · Plano 28/09/26 ─ ✕ ┐
│ [‹ Anterior]                       2 de 5 no Plano                      [Próximo ›]    │
│ ┌ Geral ┐ Cenário e Datas │ Execuções (1)                                             │
│ ├────────────────────────────────────────────────────────────────────────────────────┤
│ │ <aba ativa>                                                                         │
├──────────────────────────────────────────────────────────────────────────────────────┤
│ [ Excluir ]  [ Cancelar teste ]                              [ Salvar alterações ]   │
└──────────────────────────────────────────────────────────────────────────────────────┘

 aba Geral                                   aba Cenário e Datas
 ┌──────────────────────────────────────┐    ┌───────────────────────────────────────┐
 │ ID teste        CT03.2               │    │ Cenário   [____________________________]│
 │ Funcionalidade  Faturas              │    │ Massa     ID 0483 · CPF 123.456.789-09  │
 │ Responsável     [ Gilvan         ▾ ] │    │           (fictício)  = compartilhada   │
 │ Status (nesta execução) [A iniciar ▾]│    │ Passos    [tests/features/…#CT03.2   ]  │
 │ Prioridade      [ 1 ▾ ]              │    │ Resultado esperado  [_________________] │
 │ Plano           28/09/26             │    │ Dependência         [_________________] │
 └──────────────────────────────────────┘    │ Data planejada [05/10/2026 📅]           │
                                             │ Data execução  [dd/mm/aaaa 📅]           │
 aba Execuções (1)                           │ Observações    [_________________]       │
 ┌────────────────────────────────────────┐  └───────────────────────────────────────┘
 │ Plano     Status     Data  Por   Obs.  │
 │ 28/09/26  [A iniciar] -    -     -     │   linha clicável → mostra o resumo da
 │ Resumo da execução selecionada          │   execução e o link da evidência (.docx)
 └────────────────────────────────────────┘
```

**M5 — Log da execução (Play em andamento)**

```
┌─ Executando CT03.2 · bdd-headed ───────────────────────────────────────── ✕ ┐
│ Status ⏳ em andamento · 00:42          comando: npx playwright test --grep @CT03.2│
│ ┌ Log ─────────────────────────────────────────────────────────────────────┐ │
│ │ ✔ Given estou logado como cliente…                                       │ │
│ │ ✔ When pago o valor mínimo na tela de Faturas                            │ │
│ │ ⏳ Then valido o comprovante no extrato…                                 │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────────────────────────────┤
│ [ ■ Stop ]  [ ⏸ Standby ]                              [ Minimizar ] (✕ pede   │
│                                                         confirmação enquanto roda)│
└──────────────────────────────────────────────────────────────────────────────┘
 ao terminar:  ✔ Passou · 01:12 · [Abrir evidência .docx]  [Atualizar massa…]  [Fechar]
```

**M6 — Registrar INC**

```
┌─ Registrar INC ─────────────────────────────────────── ✕ ┐
│ Nº do INC   [ INC07158…                               ] │
│ Título      [                                         ] │
│ Status      [ new ▾ ]                                   │
│ Testes afetados                                         │
│   [CT03.1 ✕] [CT03.2 ✕]  [ + adicionar teste ▾ ]        │
├─────────────────────────────────────────────────────────┤
│                                [Cancelar]  [ Registrar ] │
└─────────────────────────────────────────────────────────┘
```

**M7 — Vincular INC existente**

```
┌─ Vincular INC existente ────────────────────────────── ✕ ┐
│ Buscar [ INC0715…              ]                         │
│ ( ) INC0715802225  Saldo de Faturamento com Valor fora…  │
│ (•) INC0715802766  Api de pagamentos não sensibiliza…    │
│ Vincular aos testes: [CT03.5 ✕] [ + adicionar teste ▾ ]  │
├──────────────────────────────────────────────────────────┤
│                                 [Cancelar]  [ Vincular ]  │
└──────────────────────────────────────────────────────────┘
```

**M8 — Atualizar massa (CANCELADO com a T9; desenho original guardado só como referência)**

```
┌─ Atualizar massa 0483 (CT03.2) ───────────────────────────────────────── ✕ ┐
│ Coluna              Antes        Depois       Regra                          │
│ saldo_conta         25.000,00    24.615,07    atualiza                       │
│ fat_fechada            384,93       384,93    🔒 imutável — não grava         │
│ … (demais colunas permitidas)                                                 │
│ ☐ Entendo que isto altera data/MassaDados.xlsx (backup em dados/backups)      │
├──────────────────────────────────────────────────────────────────────────────┤
│                                    [Cancelar]  [ Confirmar e gravar ] (desativado
│                                                 até marcar a caixa acima)      │
└──────────────────────────────────────────────────────────────────────────────┘
```

**M9 — Confirmações (uma só casca, texto muda)**

```
┌─ Excluir Plano? ───────────────────────── ✕ ┐   ┌─ Parar a execução? ─────────── ✕ ┐
│ O plano "28/09/26" e as execuções dele      │   │ O Playwright será encerrado e o   │
│ serão removidos (45 testes, 2 INC          │   │ teste volta para "Refinamento".   │
│ desvinculados). Não afeta data/.           │   │                                   │
│            [Cancelar]  [ Excluir plano ]    │   │          [Continuar]  [ ■ Parar ] │
└─────────────────────────────────────────────┘   └───────────────────────────────────┘
 também: Excluir teste do plano · Cancelar execução · Desvincular INC
```

**M10 — Massa em conflito (REMOVIDO: massa repetida é proposital, não é erro; o desenho abaixo é histórico)**

```
┌─ ⚠ Massa em conflito: 0483 ────────────────────────── ✕ ┐
│ O mesmo ID_MASSA aparece com CPFs diferentes na planilha:│
│   CT03.2  →  CPF 107.401.795-19                          │
│   CT03.7  →  CPF 176.939.111-89                          │
│ Corrija em data/MassaDados.xlsx (aba TBL_CENARIOS).      │
│ A ferramenta não altera a planilha por conta própria.    │
├──────────────────────────────────────────────────────────┤
│                                              [ Entendi ]  │
└──────────────────────────────────────────────────────────┘
```

---

## 6. Tasks

Tamanho: **P** ≈ 1–2 h · **M** ≈ meio dia · **G** ≈ 1 dia. Ordem = dependência.

### T0 — Esqueleto da pasta `test-of-puppets/` (P)

**Objetivo:** criar a pasta (server + web + dados) e o comando para subir tudo.
**Arquivos:** `test-of-puppets/package.json`, `server/src/index.ts`, `web/index.html`,
`web/src/main.tsx`; script `manager` no `package.json` raiz (`npm --prefix test-of-puppets run dev`).
**Aceite:** `npm run manager` sobe :3100 (`/api/saude` → `{ok:true}`) e :3101 (página com título);
`dados/` é criada vazia e ignorada pelo git exceto `.gitkeep`.

```
test-of-puppets/
├── package.json            scripts: dev · build · test
├── server/
│   └── src/  index.ts · routes/ · store/ · reader/ · runner/
├── web/
│   └── src/  pages/ · components/ · api.ts
└── dados/                  .gitkeep   (planos.json nasce aqui)

$ npm run manager
  [server] http://127.0.0.1:3100   GET /api/saude -> {"ok":true}   usa ../dados/ (não toca em data/)
  [web]    http://127.0.0.1:3101   "Test of Puppets"
```

### T1 — Cadastro de cenários próprio (substitui o leitor da planilha) (M)

> **Substituída em 02/10/2026:** a ferramenta **não lê `data/`**. A T1 passa a ser o cadastro de cenários
> (`dados/cenarios.json`, API e modal **M16**, ver [VISOES.md](VISOES.md) §2.1) com semente fictícia. O texto
> abaixo é o desenho antigo do leitor e fica só como modelo dos campos (`idCenario`, `nome`, `feature`,
> `idMassa`, `cpf`); as regras de "reler o .xlsx", `massa_conflito` e `seq_pulado` **não valem mais**.

**Objetivo:** ler `data/MassaDados.xlsx` aba `TBL_CENARIOS` e expor o **catálogo de testes**,
validando a massa.
**Arquivos:** `server/src/reader/cenarios.ts` (usa `readExcelSheet` de `../tests/utils`),
`server/tests/cenarios.test.ts`.
**Regras:** nunca gravar; **não** devolver `SENHA`/`PIN`; avisar `massa_conflito` quando o mesmo
`ID_MASSA` tem CPFs diferentes; avisar `seq_pulado`; reler quando o `.xlsx` mudar (data de modificação).
**Aceite:** com a sua planilha de 15 linhas, retorna 15 testes, 1 aviso `massa_conflito (0483)` e 2 `seq_pulado`.
**Atualização:** a aba real tem 24 colunas (A1:X40, 39 linhas); só viram teste as linhas com `ID_CENARIO`
no formato `CTnn.n` (a linha `cadastrar` é massa de apoio). Passa a ler também as colunas de planejamento
propostas em [VISOES.md](VISOES.md) §2.1 (`PLANO`, `PRIORIDADE`, `RESPONSAVEL`, `ESTIMATIVA_MIN`,
`DATA_PLANEJADA`); ausentes ou vazias geram aviso, nunca erro. A coluna `status` existente é o **perfil da massa**.

```
data/MassaDados.xlsx › TBL_CENARIOS                  catálogo (API)
SEQ ID_CENARIO NOME                  ID_MASSA CPF    { idCenario:"CT03.2", nome:"Consultar faturas e
 13 CT03.2     Consultar faturas…    0483     107…     pagar o valor mínimo.", feature:"faturas",
 17 CT03.7     Reenvio do pagamento… 0483     176…     idMassa:"0483", cpf:"10740179519",
                                                       avisos:["massa_conflito"] }
avisos globais:
  ⚠ massa_conflito  ID_MASSA 0483 → CPF 10740179519 (CT03.2) ≠ 17693911189 (CT03.7)
  ⚠ seq_pulado      SEQ 7 e 9 não existem
```

### T2 — Store de planos e execuções em JSON (M) — ✔ FEITA (03/10/2026, sem execuções/INC)

> **Entregue:** `dados/planos.json` = `{ "planos": [ { id "pl_xxxxxxxx", nome, criadoEm, previsao?, versao, itens[] } ] }`;
> cada item tem `idCenario, status (agendado|em_andamento|refinamento|concluido), resultado? (passou|falhou, só
> com "concluido"), prioridade?, responsavel?, estimativaMin?, tempoRealMin?, dataPlanejada?, dataExecucao?,
> observacoes?, posicao (decimal), versao`. Escrita atômica + `.bak` (`server/src/store/json.ts`), gravações em
> fila. Sem execuções (T7) nem incidentes (T8) por enquanto. Código: `server/src/planos/{modelo,regras,repo}.ts`.
> **Regras de planejamento decididas:** dependência por massa só é cobrada se a dependência **estiver no mesmo
> plano** (não está → não bloqueia); só `concluido` + `passou` libera; reabrir um teste apaga o resultado; não há
> cascata se uma dependência já usada voltar a "falhou". Nome de plano repetido é permitido (a tela só avisa).

**Objetivo:** persistir Plano, Execução e Incidente em `test-of-puppets/dados/planos.json` (escrita
atômica: grava em `.tmp` e renomeia; mantém `.bak` da versão anterior).
**Arquivos:** `server/src/store/planos.ts`, `server/tests/store.test.ts`.
**Aceite:** criar plano → reiniciar servidor → plano continua; arquivo corrompido não perde o `.bak`.

```
test-of-puppets/dados/planos.json
{
  "planos": [
    { "id":"2026-09-28", "nome":"28/09/26", "criadoEm":"2026-09-24",
      "previsao":"2026-10-13",
      "testes":[
        {"idCenario":"CT03.1","status":"passou",    "terminadoEm":"2026-09-29"},
        {"idCenario":"CT03.2","status":"a_iniciar", "planejadaPara":"2026-10-05"}
      ] } ],
  "incidentes":[ {"inc":"INC0715802225","titulo":"Saldo de Faturamento…","testesAfetados":["CT03.1"]} ]
}
planos.json.bak   ← cópia automática antes de cada gravação
```

### T3 — API REST local (M) — ✔ FEITA (03/10/2026, sem Play/INC)

> **Entregue** (`server/src/routes/planos.ts`, 88 testes do servidor): `GET /api/planos?aba=em_execucao|executados&ordem=asc|desc`
> (com resumo/percentual), `POST /api/planos` (aceita `idCenarios`), `GET|PATCH|DELETE /api/planos/:id`,
> `POST /api/planos/:id/testes` (`idCenarios`, `dataPlanejada?`; já incluídos são pulados), `DELETE /api/planos/:id/testes/:cenario`,
> `PATCH /api/planos/:id/testes/:cenario` (mandar a `versao` do teste). Erros: 400 validação/`cenario_inexistente`/`resultado_sem_conclusao`;
> 404; 409 `versao_antiga`, `dependencia_pendente` ("Aguardando CT03.2 passar…"), `data_antes_da_dependencia`, `cenario_em_uso`
> (cenário que está em plano não sai do cadastro). Não existe `.../play|stop|standby|retomar` nem `/api/incidentes` (T7/T8, adiadas).

**Objetivo:** expor catálogo, planos, execuções e incidentes.
**Arquivos:** `server/src/routes/{testes,planos,execucoes,incidentes}.ts`, `server/tests/api.test.ts` (supertest).
**Aceite:** todos os endpoints abaixo respondem e validam entrada (400 com mensagem em português).

```
GET    /api/testes                      catálogo + avisos          (T1)
GET    /api/planos?aba=em_execucao      lista com progresso
POST   /api/planos                      { nome, previsao }         → 201
GET    /api/planos/:id                  detalhe + testes + INC
DELETE /api/planos/:id                  "Excluir Plano"
POST   /api/planos/:id/testes           { idCenarios:[…], planejadaPara }   "Incluir testes"
DELETE /api/planos/:id/testes/:cenario
PATCH  /api/planos/:id/testes/:cenario  { status | observacoes | datas }
POST   /api/planos/:id/testes/:cenario/play | stop | standby | retomar      (T7)
POST   /api/incidentes · POST /api/incidentes/:inc/vincular · DELETE …/vinculo (T8)
```

### T4 — Tela "Planos de Execução" + Novo Plano (M) — ✔ FEITA (03/10/2026)

> **Entregue:** `web/src/pages/planos/{Planos,NovoPlanoModal}.tsx`: cards com progresso, abas "Em execução (n)" /
> "Executados (n)", busca pelo nome, ordem crescente/decrescente e o modal M1 (nome, previsão, "Vazio / Todos os
> cenários cadastrados (n) / Escolher agora…"; nome repetido só avisa). Clicar no card abre o detalhe (M3).

**Objetivo:** lista de planos como cards com progresso, abas e botão **+ Novo Plano**.
**Arquivos:** `web/src/pages/Planos.tsx`, `components/PlanoCard.tsx`, `components/NovoPlanoModal.tsx`.
**Aceite:** criar plano pela tela faz o card aparecer; progresso = concluídos ÷ total.
**Shell da aplicação (vale para todas as telas):** menu lateral recolhível, **no lado esquerdo por padrão**,
copiado do padrão do `AllureShell` do Admin do FintechBankApp: grupos com título, ícone + nome, item ativo
destacado, botão `[⇄]` para trocar o lado e botão `[«]` para recolher (só os ícones, nome em tooltip), e no
celular vira uma fileira de botões no topo. Lado e recolhimento ficam salvos por pessoa. **Tema só escuro**
com a paleta do projeto e o **fundo animado do Admin** (D7; detalhes em [VISOES.md](VISOES.md) §4.1). Desenho completo:
[visoes/README.md](visoes/README.md#layout). O quadro abaixo mostra só a área principal.

```
┌─ Planos ── Online: Ana, Bia ── Sino (3) ── Você: [Ana ▾] ──────────────────────┐
│ BUSCAR [ Buscar plano pelo nome…                    ]   Ordenar [Crescente ↑]  │
│                                                                                │
│ Planos de Execução (2)                                        [ + Novo Plano ] │
│ ┌ Em execução (2) ┐  Executados (0)                                            │
│ ┌──────────────────────────────┐  ┌──────────────────────────────┐            │
│ │ 28/09/26  [MASTER]           │  │ 05/10/26  [MASTER]           │            │
│ │ Criado em: 24/09/2026        │  │ Criado em: 29/09/2026        │            │
│ │ Previsão de término:13/10/26 │  │ Previsão de término: -       │            │
│ │ ▓▓░░░░░░░░░░░░ 20% executado │  │ ░░░░░░░░░░░░░░  0% executado │            │
│ │ 45 teste(s) · 36 pendente(s) │  │ 0 teste(s) · vazio           │            │
│ └──────────────────────────────┘  └──────────────────────────────┘            │
└────────────────────────────────────────────────────────────────────────────────┘

┌─ Novo Plano ───────────────────────────── ✕ ┐
│ Nome do plano   [ 12/10/26                ] │
│ Previsão término [ 20/10/2026          📅 ] │
│ Criar com os testes:                        │
│   (•) vazio   ( ) todos da planilha (15)    │
│   ( ) escolher agora…                       │
│                        [Cancelar] [ Criar ] │
└─────────────────────────────────────────────┘
```

### T5 — Detalhe do plano: Visão lista, Visão card (kanban) e filtros (G) — PARCIAL (03/10/2026)

> **Já entregue (`PlanoDetalhe.tsx`, `OrdemModal.tsx`):** Visão lista com status (4), resultado (`passou`/`falhou` ao
> concluir), data planejada, "Aguardando CT03.2 passar", tirar teste do plano e excluir plano (ambos com
> confirmação), e o **modal "Ordem de execução"** (desenho 2 aprovado em 03/10/2026): botão `⇅` no canto direito de
> cada teste (e "Ordem" no topo) abre a lista numerada com alça `≡` para arrastar, ▲▼, coluna Regra com cadeado
> ("libera o CT03.7" / "depois do CT03.2"), "Ordenar por" (Manual · Data planejada · Prioridade) e "Corrigir sozinho".
> **Cadeado bloqueia** (decisão assumida): o dependente não passa da dependência. A ordem vale só para o plano e **não
> mexe nas datas**. API: `PUT /api/planos/:id/ordem` (`{ ordem: [ids] }`; 409 `ordem_invalida` / `ordem_desatualizada`).
> **Entregue também (03/10/2026):** abas **Visão lista / Visão card**; **Visão card (kanban)** com 4 colunas
> (Agendado · Em andamento · Refinamento · Concluído), contagem no título, arrastar o card entre colunas (só muda o
> status; a regra da massa recusa com a mensagem "Aguardando…") e seletor "Mover para" como alternativa sem mouse;
> **filtros** ID/cenário, Funcionalidade, Status, Data, "Apenas hoje", "Datas passadas" (as duas caixas somam,
> hoje OU passadas; só olham a data planejada) e "Limpar", valendo nas duas visões, com "Testes (n de m)". O modal de
> ordem ignora o filtro (mostra o plano inteiro) e a coluna **Ord** da lista continua sendo a posição real.
> **Entregue também: modal M2 "Incluir testes"** (botão "+ Incluir testes" no detalhe, também em plano vazio): busca,
> funcionalidade, "só os livres", caixas de marcar (os que já estão no plano ficam travados com "já no plano"; massa
> repetida mostra "= compartilhada com…"), data planejada opcional para os marcados e botão "Incluir n testes".
> Recusa do servidor (ex.: data antes da dependência) aparece no modal. **T5 completa.**

**Objetivo:** abrir o plano em modal com abas **Visão lista · Visão card · Incidentes (n)**,
filtros e **arrastar card** entre colunas.
**Arquivos:** `web/src/pages/PlanoDetalhe.tsx`, `components/{ListaTestes,Kanban,Filtros}.tsx`.
**Regras do arrastar (sem execução):** arrastar só **muda o status** (Agendado → Em andamento → Refinamento →
Concluído); **nada é executado** e as ações Play/Standby/Stop do print ficam adiadas com a T7. Cancelar só
teste ainda não iniciado.
**Aceite:** filtro "Apenas hoje" mostra "Testes (5 de 45)"; arrastar muda status e persiste.

```
Plano: 28/09/26 [MASTER]                                                   ✕
Criado em 24/09/2026 · Previsão 13/10/2026 · ▓▓░░░░░░░░ 20% executado
Testes (5 de 45)                                          [ + Incluir testes ]
ID/cenário [______]  Funcionalidade [Todas ▾]  Status [Todos ▾]  Data [dd/mm/aaaa]
[✔] Apenas hoje   [ ] Datas passadas   Limpar
 Visão lista │ Visão card │ Incidentes (2)
─────────────────────────────────────────────────────────────────────────────────
Visão card
┌ AGENDADO (5) ───────┐ ┌ EM ANDAMENTO (0)┐ ┌ REFINAMENTO (0) ┐ ┌ CONCLUÍDO (1)───┐
│ CT03.2  [A iniciar] │ │   Nenhum teste  │ │   Nenhum teste  │ │ CT03.1 [Passou] │
│ Pagar valor mínimo  │ │                 │ │                 │ │ Pagar valor tot.│
│ Faturas · massa 0483│ │  ← arraste aqui │ │                 │ │ Exec: 29/09/26  │
│ Planejada 05/10/26  │ │   para iniciar  │ │                 │ │ INC0715802225   │
├─────────────────────┤ └─────────────────┘ └─────────────────┘ └─────────────────┘
│ CT03.7  [A iniciar] │
└─────────────────────┘
Arraste o card para mudar o status (Agendado → Em andamento → Refinamento → Concluído); nada é executado

Visão lista
ID     Funcionalidade  Cenário                         Status        Data        Ações
CT03.2 Faturas         Pagar valor mínimo              [A iniciar]   Plan.05/10  👁 🗑
CT03.1 Faturas         Pagar valor total               [Passou]      Exec.29/09  👁
```

### T6 — Detalhe do teste: Geral · Cenário e Datas · Histórico (M) — ✔ FEITA (03/10/2026)

> **Entregue** (`web/src/pages/planos/TesteModal.tsx`): abre pelo 👁 da lista ou clicando no ID do card; cabeçalho
> `CT03.2 · nome`, selo do status, "Plano …", **"n de m no plano"** com Anterior/Próximo (percorre a ordem do plano
> inteiro; com alteração pendente a navegação trava até "Salvar alterações" ou "Descartar"). Abas: **Geral** (status,
> resultado ao concluir, prioridade, responsável, estimativa, tempo real), **Cenário e Datas** (cenário, massa, CPF,
> passos, resultado esperado, dependência automática; datas planejada/execução e observações editáveis) e
> **Histórico (n)** — a aba "Execuções" do desenho virou "Histórico" porque nada é executado: lista o mesmo teste em
> cada plano onde aparece (`GET /api/cenarios/:id/planos`). Salvar manda só os campos que mudaram.
> **CPF sem máscara (decisão do usuário, 03/10/2026):** são **CPFs fictícios de massa de teste, não dados reais**, e a
> ferramenta é **local** (servidor em `127.0.0.1`). Por isso aparecem inteiros (tabela de Cenários, modal M16 e
> detalhe do teste), sempre com o aviso "CPF fictício de massa de teste (não é dado real)". Senha e PIN continuam
> nunca guardados. Não existe o botão "mostrar".

**Objetivo:** modal do teste com navegação "1 de 5 no Plano" e a **massa visível**.
**Arquivos:** `web/src/components/TesteModal.tsx` (+ 3 abas).
**Regras:** `SENHA`/`PIN` nunca aparecem; CPF **sem máscara** (fictício, ver acima); campos
corporativos do print (Squad, Bandeira, Data P.O., Data Contábil) ficam **de fora**.
**Dependência de massa (regra do usuário):** o CT03.7 usa a massa do CT03.2 **só depois que o CT03.2
executou com sucesso**. Teste que reaproveita a massa de outro ganha `dependeDe`, e só pode ir para "Em
andamento" ou "Concluído" quando todos os testes de `dependeDe` estão `passou`, nem ser planejado numa data
anterior à deles. Enquanto isso o card mostra "Aguardando CT03.2 passar" e o teste **não aparece como erro**.
Sem execução na ferramenta, o `passou` é marcado à mão por quem executou o teste fora dela.
**A detecção é automática:** o sistema compara o `idMassa` informado nos cenários; quem repete a mesma massa
forma um grupo e o `dependeDe` é preenchido sozinho (ordem padrão = numeração do ID: CT03.2 antes do
CT03.7). Não há campo obrigatório para digitar; só se edita em caso de exceção.
**Aceite:** Anterior/Próximo percorre os testes do plano; salvar observação persiste.

```
← CT03.2 · Consultar faturas e pagar o valor mínimo  [A iniciar]   · Plano 28/09/26  ✕
[‹ Anterior]                    2 de 5 no Plano                          [Próximo ›]
 Geral │ Cenário e Datas │ Histórico (1)
──────────────────────────────────────────────────────────────────────────────────────
Cenário e Datas
 Cenário de teste  [Consultar faturas e pagar o valor mínimo.                       ]
 Massa             ID 0483 · CPF 123.456.789-09 (fictício)   = massa compartilhada com CT03.7
 Passos            [tests/features/faturas.feature#CT03.2           ] (abrir arquivo)
 Resultado esperado[Pagamento mínimo registrado; dias de atraso zerados; encargos seguem]
 Dependência       [                                                                ]
 Data planejada [05/10/2026 📅]   Data execução [dd/mm/aaaa 📅]
 Observações       [                                                                ]
──────────────────────────────────────────────────────────────────────────────────────
 [ Cancelar teste ]  [ Excluir ]                                   [ Salvar alterações ]

Execuções (1)
 Plano     Status        Data   Executado por   Observações   Evidência
 28/09/26  [A iniciar]   -      -               -             -
```

### T7 — Cronômetro do teste: ▶ iniciar, ⏸ pausar, ■ registrar (P) — ✔ FEITA (05/10/2026)

> **Esclarecimento do usuário em 05/10/2026:** a ferramenta é só para **acompanhar e organizar** (sem depender do Excel no futuro). **Não
> roda teste nenhum**: o ▶ só grava a hora de início; a pessoa roda o teste por fora e, quando termina, aperta ■ e registra o resultado.
> Isso **substitui** a versão anterior da T7 (que disparava o Playwright; ficou no histórico do git, commit `ed6aae2`).
> **Como ficou:** `POST /api/planos/:id/testes/:cenario/cronometro {acao, versao, resultado?, observacoes?, tempoRealMin?}` com `acao` =
> `iniciar | pausar | retomar | finalizar`; regra em `server/src/planos/regras.ts` (`aplicarCronometro`). O servidor carimba a hora
> (`iniciadoEm`, `acumuladoMs` no item). **Iniciar** → Em andamento + hora de início (respeita a dependência da massa; refazer um concluído
> reabre o resultado). **Pausar/Retomar** → o tempo parado não conta (Standby do desenho original = pausa do cronômetro). **Finalizar** →
> Concluído com `passou`/`falhou` (obrigatório), data de hoje, `tempoRealMin` = tempo medido sem as pausas (mín. 1) **editável na hora**
> e observação. Mudar o status na mão (Kanban, lista) também começa/zera o relógio. Tela: `web/src/cronometro/*` (▶/⏸/■ + relógio
> `mm:ss` na lista e no card; modal "Registrar resultado"). Erros: `cronometro_invalido` (409).

**Objetivo:** o botão **Play** roda o cenário no Playwright e a tela mostra o resultado.
**Arquivos:** `server/src/runner/playwright.ts`, `server/src/runner/resultado.ts`, `server/tests/runner.test.ts` (com `spawn` falso).
**Fluxo:** `bdd:gen` → `playwright test --project=bdd-headed --headed --workers=1 --grep "@CT03.2"`
(executado com `cwd` na raiz do projeto) → ao terminar, ler `output/allure-results/*-result.json`
→ status `passou`/`falhou` + duração + caminho do `.docx` em `evidences/`.
**Regras:** um teste por vez; **Stop** mata o processo; logs em streaming (SSE); se o processo
cair, status volta a `refinamento` com a observação "execução interrompida".
**Aceite:** Play em CT01.3 → "Em andamento" → termina → "Passou" com link da evidência.
**Acréscimos vindos dos repositórios estudados** ([REFERENCIAS.md](REFERENCIAS.md)):
- **Fila:** com o limite de WIP cheio, um segundo Play não é recusado; o teste vira `na_fila` e roda sozinho quando o atual terminar. "Tirar da fila" devolve para Agendado.
- **A execução é do servidor** e tem `runId`. Fechar ou recarregar a tela não a interrompe; ao reabrir, a tela reconecta ao log pelo `runId`. Só **Stop** encerra.
- **Verificar ambiente** antes do Play: planilha legível, Playwright instalado, porta livre, FintechBankApp respondendo (:3000/:3001).
- **Reexecutar falhos** em lote (filtro por status e funcionalidade), sempre um por vez pela fila.
- **Pacote de falha:** log, screenshot, trace e `.docx` do mesmo `runId`, anexados ao "Criar INC" (T8).
- **Tempo real:** a duração do run grava `tempoRealMin` no item do plano.
- **Dependências:** o Play de um teste com `dependeDe` só habilita se todos os testes dos quais ele depende estão `passou` (ex.: CT03.7 só depois de o CT03.2 passar); na fila, ele aguarda e libera sozinho.

```
clique ▶ Play (CT03.2)
   │
   ├─► status: a_iniciar → em_andamento           (UI atualiza o card)
   ├─► spawn: npm run bdd:gen && npx playwright test --grep "@CT03.2" --project=bdd-headed
   │        log em tempo real ────────────────►  ┌ Log da execução ───────────────┐
   │                                             │ ✔ Given estou logado…          │
   │                                             │ ✔ When pago o valor mínimo…    │
   │                                             │ ⏳ Then valido o comprovante…  │
   │                                             └────────────────────────────────┘
   ├─► fim: lê output/allure-results/<id>-result.json
   └─► status: em_andamento → passou | falhou     (+ duração, + evidência .docx)

   [ ■ Stop ]  mata o processo → status volta a "refinamento" (obs.: execução interrompida)
```

### T8 — Incidentes (INC) (M) — ✔ FEITA (03/10/2026, sem execução)

> **Entregue:** `dados/incidentes.json` + `/api/incidentes` (listar, criar, `GET/PUT/DELETE /:numero`, `POST /:numero/vincular`,
> `DELETE /:numero/vinculo/:cenario`, `POST /:numero/comentarios`). O INC é **global** (liga a IDs de cenário, vale para todo
> plano que tiver o teste), tem status (novo · em análise · resolvido), severidade (alta · média · baixa), responsável,
> descrição, comentários e histórico estruturado (quem, o quê, de → para). Código: `server/src/incidentes/{modelo,repo}.ts`,
> `server/src/routes/incidentes.ts`; tela: `web/src/incidentes/` (aba **Incidentes (n)** do plano, M6 Registrar, M7 Vincular
> existente, desvincular com confirmação, etiqueta do INC aberto na Lista e no Kanban). A semente traz os 3 INC fictícios.
> **Ficou para a T13.5:** a tela própria de Incidentes (quadro por status, painel lateral, comentários e histórico na tela).
> Não existe "Criar INC a partir de uma falha" (depende da execução, T7).

**Objetivo:** aba **Incidentes (n)** do plano: registrar, vincular existente e desvincular, com
chips dos testes afetados.
**Arquivos:** `web/src/components/Incidentes.tsx`, `server/src/routes/incidentes.ts`.
**Regra:** teste com INC aberto aparece com a etiqueta do INC nos cards/lista (como no print).
**Aceite:** vincular INC a 3 testes mostra 3 chips e a etiqueta nos 3 cards.

```
Incidentes do Plano                        [ + Registrar INC ] [ Vincular INC existente ]
INC            Título                             Status  Registro    Testes afetados  Ações
INC0715802225  Saldo de Faturamento com Valor…    [new]   29/09/2026  [21299][21302]… 👁 [Desvincular]
INC0715802766  Api de pagamentos não sensibiliza… [new]   29/09/2026  [21305]          👁 [Desvincular]

┌ + Registrar INC ──────────────── ✕ ┐
│ Nº do INC  [INC07158…           ]  │
│ Título     [                    ]  │
│ Testes afetados  [CT03.1 ✕][CT03.2 ✕] [+ adicionar]
│                     [Cancelar][Salvar]
└────────────────────────────────────┘
```

### T9 — Atualizar a massa em `data/` depois do teste, com confirmação (M) — ✘ CANCELADA (05/10/2026)

> **Cancelada em 05/10/2026** (decisão do usuário): o objetivo é **não depender do Excel** no futuro; a ferramenta volta a nunca ler nem
> gravar `data/MassaDados.xlsx`. Foi implementada em 04/10 (commit `ed6aae2`: diff, backup, confirmação, só XML de células) e removida;
> o histórico do git guarda o código caso a transição para fora do Excel precise dele. O estado da massa, no futuro, passa a viver nos
> dados da própria ferramenta.

**Objetivo:** depois de um teste que consome massa (CT03.x), propor a atualização **só** das
colunas permitidas, mostrar o diff e gravar **somente após confirmação**. É a única task que
escreve em `data/`.
**Arquivos:** `server/src/writeback/massa.ts` (usa `appendRowsPreservingFormat`/utilitários de
`excelTableAppender`), `web/src/components/AtualizarMassaModal.tsx`, `server/tests/writeback.test.ts`.
**Regras (suas):** **`fat_fechada` nunca muda**; atualiza `saldo_conta`, `lim_utilizado`,
`lim_disponivel`, `parcelas_a_vencer`, `fat_aberta` e `status_fat_fechada` (de `VIGENTE` para
`PAGO_MIN`/`PAGO_PARCIAL`/`PAGO_TOTAL`, os que já existem); valores novos vêm do endpoint admin do
FintechBankApp (`/admin/audit-csv-consistency`/export) lido por HTTP — a tela **não** acessa o banco;
antes de gravar, backup em `test-of-puppets/dados/backups/MassaDados.<data>.xlsx`; se o Excel estiver
aberto (`data/~$MassaDados.xlsx`), bloqueia.
**Aceite:** diff mostra só as 6 colunas; negar não altera o arquivo (hash igual); aceitar mantém a
formatação de Tabela.

```
┌ Atualizar massa 0483 (CT03.2) ───────────────────────────────────── ✕ ┐
│ Fonte: FintechBankApp /api/admin/…  (lido agora, 10:42)               │
│ Coluna              Antes        Depois       Regra                   │
│ saldo_conta         25.000,00    24.615,07    atualiza                │
│ lim_utilizado        1.477,29     1.157,26    atualiza                │
│ lim_disponivel      13.522,71    13.842,74    atualiza                │
│ parcelas_a_vencer    1.026,48       898,17    atualiza                │
│ fat_aberta             450,81       194,19    atualiza                │
│ status_fat_fechada   VIGENTE    PAGO_PARCIAL  atualiza (status da regra)
│ fat_fechada            384,93       384,93    🔒 imutável — não grava  │
│ Backup: test-of-puppets/dados/backups/MassaDados.2026-10-01.xlsx         │
│ ⚠ Isto altera data/MassaDados.xlsx.  [Cancelar]  [ Confirmar e gravar ]│
└───────────────────────────────────────────────────────────────────────┘
```

### T10 — Lembretes e sino de notificações (P) — ✔ FEITA (04/10/2026)

> **Como ficou:** os lembretes são **calculados** no servidor (`server/src/lembretes/modelo.ts`, `GET /api/lembretes?voce=`)
> a partir de planos, INC e retros — nada é copiado; só "lida" fica em `dados/lembretes.json` por pessoa
> (`POST /api/lembretes/lidas`, com `lida:false` para desfazer). Quatro tipos: teste planejado para hoje, plano com previsão
> vencida e ainda aberto, INC aberto (Alta primeiro) e ação pendente de retro. Cada pessoa vê o que é dela ou de ninguém
> (sem responsável); sem "Você", vê tudo. A chave do lembrete leva a data (teste de hoje) ou o motivo, então "lida" vale
> só enquanto o motivo existir e é apagada depois. O sino (`web/src/shell/Sino.tsx`) atualiza ao abrir, a cada minuto e ao
> voltar para a aba; "Abrir" leva ao Lista (teste), Release (plano vencido), Incidentes ou Retro (ação).

**Objetivo:** o sino (🔔) mostra lembretes: teste planejado para hoje, plano com previsão vencida,
INC aberto. "Marcar como lida" persiste em `dados/`.
**Arquivos:** `web/src/components/Sino.tsx`, `server/src/routes/lembretes.ts`.
**Aceite:** com CT03.2 planejado para hoje, o sino mostra 1 item; marcar como lida zera o contador.

```
🔔(2) ▾
┌───────────────────────────────────────────┐
│ Teste de hoje · Plano 28/09/26            │
│ CT03.2 — Pagar valor mínimo               │
│ [Abrir]                  [Marcar como lida]│
├───────────────────────────────────────────┤
│ INC aberto · INC0715802225 (3 testes)     │
│ [Abrir]                  [Marcar como lida]│
└───────────────────────────────────────────┘
```

### T11 — Semente fictícia de cenários e planos (P) — ✔ FEITA (03/10/2026)

> **Entregue:** os dados de [visoes/README.md](visoes/README.md), todos **fictícios** (CPFs de exemplo, sem dados
> reais), em `server/src/semente/dados.ts`: **8 cenários** (CT03.1, 03.2, 03.3, 03.7, 04.1, 04.2, 05.1, 05.2, com
> massa, CPF, passos e resultado esperado; CT03.7 reaproveita a massa 0483 do CT03.2 de propósito), **3 pessoas**
> (Ana 120, Bia 90, Carlos 60 min/semana) e **3 planos**: `14/09/26` (executado), `28/09/26` (8 testes, 3 de 8
> executados = 38%, uma falha, CT03.2 em andamento, CT04.2 em refinamento) e `05/10/26` (vazio). Sem Excel e sem INC
> (T8 adiada). Entra pelos próprios repositórios, então vale tudo que vale no dia a dia.
> **Dois jeitos de carregar:** `npm run semear` (e `npm run semear -- --forcar`, que antes guarda uma cópia em
> `dados/antes-da-semente-aaaammdd-hhmmss/`) e o botão **"Carregar dados de exemplo"** na tela de Planos quando tudo
> está vazio (`POST /api/semente`). **Nunca sobrescreve**: qualquer cenário, pessoa ou plano já existente recusa
> (409 `ja_tem_dados`). Texto antigo abaixo (planilha, cor da linha) não vale mais.
> **Atualizada em 04/10/2026:** a semente também traz os 3 INC, a **retro** do plano `14/09/26` (4 notas votadas por
> Ana, Bia e Carlos; ação "Ordenar CT03.2 antes do CT03.7" pendente da Ana até 20/10 e "Revisar as estimativas…" feita
> pelo Carlos) e uma **decisão NO-GO** da Ana no Release do plano `28/09/26` (critérios 1 a 5 abertos). Por isso o
> sino da Ana já nasce com o INC dela e a ação pendente da retro. Dados em `RETRO_SEMENTE` e `DECISAO_SEMENTE`
> (`server/src/semente/dados.ts`); as horas das notas e da decisão são as de quando se semeia (os repositórios carimbam).
> O `--forcar` agora guarda e troca também `retros.json` e `lembretes.json`; `temDados` conta retros.

**Objetivo (atualizado em 02/10/2026):** criar dados **fictícios** (os 8 testes, 3 pessoas e 3 INC de
[visoes/README.md](visoes/README.md)) para a ferramenta abrir já com conteúdo e para os testes da T12.
**Não lê a planilha.** O texto abaixo, sobre as 15 linhas e a cor da linha, é histórico e não vale mais.
**Pré-requisito (preciso de você):** o que significa a **cor da linha** na planilha para virar
status — proposta: verde = `passou`, laranja = `bloqueado` (com INC), sem cor = `a_iniciar`.
**Arquivos:** `server/scripts/semear-plano.ts`.
**Aceite:** plano criado com 15 testes; CT03.1 `passou`; CT03.2 e CT03.7 `bloqueado`; aviso de
massa em conflito visível no CT03.2/CT03.7.

```
Plano "Piloto" (semente)                 progresso ▓▓▓░░░░░░░ 1 passou · 2 bloqueados · 12 a iniciar
SEQ  Cenário  Nome                                     Massa  Status
  1  cadastrar Criar um novo usuário e validar login…  C_0226 [A iniciar]
  2  CT01.2   Fazer login como Admin                   0098   [A iniciar]
 …
 12  CT03.1   Consultar faturas e pagar o valor total  0340   [Passou]      (verde)
 13  CT03.2   Consultar faturas e pagar o valor mínimo 0483   [Bloqueado] ⚠ (laranja)
 17  CT03.7   Reenvio do pagamento mínimo…             0483   [Bloqueado] ⚠ (laranja)
```

### T12 — Testes e verificação final (M) — ✔ FEITA (03/10/2026, escopo sem execução)

> **Entregue:** 141 testes do servidor + 243 da tela + **8 E2E** (`npm run test:e2e`, Playwright, ~55 s) que cobrem
> entrada sem senha, cenários com massa repetida e dependência automática, regra da massa na prática, kanban
> (arrastar grava), cadeado da ordem, detalhe do teste com CPF fictício inteiro, Equipe/Você/lote e o botão de
> exemplo. O E2E sobe servidor próprio (:3200) e tela (:3201) com `PUPPETS_DADOS` apontando para pasta temporária e
> `PUPPETS_MODO_TESTE=1`; só nesse modo existe `POST /api/teste/reset` (recusa `dados/` real com 403
> `reset_proibido`; `{semente:true}` re-semeia). `type-check` limpo, `build` ok, `npm audit --omit=dev` 0 achados.
> **Intacto depois de tudo:** `data/MassaDados.xlsx` (tamanho e data), `data/tbl_de_massas.csv` (hash) e a pasta
> `tests/` do projeto-pai (hash); `dados/` real só com `.gitkeep`. Não se aplicam (sem execução): runner, writeback,
> INC. Pendência: `server/tests/planos.api.test.ts` tem 613 linhas (regra de 500) — dividir quando mexer nele.

**Objetivo:** garantir que a ferramenta se sustenta sozinha.
- Unitários (`node --test` ou vitest, o mesmo estilo do gerador): reader (T1), store (T2), API (T3), runner (T7), writeback (T9).
- **E2E da própria tela com Playwright** (o projeto já tem): criar plano → incluir testes → arrastar card → abrir teste → vincular INC.
- Rota `POST /test/reset` (só com `NODE_ENV=test`) que recria `dados/` a partir da semente (T11), para o E2E partir sempre do mesmo estado (padrão do `jira_clone`).
- `npm run type-check` limpo; nenhuma alteração em `tests/steps`, `tests/features` ou nos testes existentes; `data/` intacto (hash do `.xlsx` igual) depois de toda a suíte, exceto no teste da T9 com cópia temporária.
**Aceite:** a suíte `bdd` atual continua passando igual (nada foi tocado) e os novos testes passam.

```
$ npm run type-check                    ✔ 0 erros
$ npm --prefix test-of-puppets test        ✔ reader 6 · store 5 · api 12 · runner 4 · writeback 5
$ npx playwright test tests/e2e/test-of-puppets.spec.ts
   ✔ cria plano e inclui testes
   ✔ arrasta card Agendado → Em andamento (Play simulado)
   ✔ vincula INC a 3 testes e mostra chips
$ npm run test:bdd                      ✔ igual a antes (suíte do FintechBankApp intacta)
```

### T13 — Visões estilo GitHub Projects + uso por várias pessoas (G, dividida em T13.1–T13.11)

**Objetivo:** além de Lista e Card, o plano ganha um **menu lateral de visões** (lado esquerdo, recolhível) com **todos** os 8 modelos
adaptados (Kanban com WIP, Roadmap, Incidentes, Release, Lançamento, Iterações, Planejamento e Retro),
visões salvas, a galeria "+ Nova visão" (M11; M12–M15 nas visões que precisam) e o suporte a
**mais de uma pessoa** (Pessoas, "Você", presença, aviso de edição simultânea).
**Decidido pelo usuário:** todas as visões e todos os campos novos entram.
**Detalhe e sub-tasks:** [VISOES.md](VISOES.md). **Tela completa de cada visão (ASCII):** [visoes/](visoes/README.md).
**Regra:** campos novos (prioridade, responsável, estimativa, severidade, capacidade, WIP) são
opcionais e ficam em `dados/`, nunca em `data/`.

```
 NAVEGAÇÃO [⇄] [«]    PLANOS & TESTES › Planos · Lista · Kanban
                      PLANEJAMENTO › Roadmap · Iterações · Planejamento
                      QUALIDADE › Incidentes · Release · Lançamento · Retro
                      MINHAS VISÕES › visões salvas · + Nova visão
                      MASSA & SISTEMA › Massa · Equipe · Configurações
```

---

## 7. Ordem e dependências

```
T0 ─► T1 ─► T2 ─► T3 ─► T4 ─► T5 ─► T6 ─► T13.1/13.2 ─► T11 ─► T12 ─► T13.3 … T13.11
                                  (T7 cronômetro, T8 INC e T10 lembretes: fora do MVP, feitas depois; T9 massa cancelada)
```

**Andamento (03/10/2026), branch `feat/test-of-puppets`, nada commitado:** T0 ✔ (servidor :3100, tela :3101,
`npm run dev`/`test`/`type-check`/`build`), **shell visual** ✔ (tela de entrada sem senha com galeria ASCII,
menu lateral recolhível à esquerda com troca de lado, cabeçalho do Admin, janela "Fundo", tema escuro, fundo
animado) e **T1 ✔ cadastro de cenários** (item "Cenários e massa": lista com busca, modal M16 para criar/editar,
exclusão com confirmação; `GET/POST /api/cenarios`, `PUT/DELETE /api/cenarios/:id`; grava em `dados/cenarios.json`
com escrita atômica + `.bak` e `versao` por registro; massa repetida detectada sozinha, marca neutra
"= compartilhada com…" e "Depende de…"; senha/PIN nunca guardados). 118 testes (38 servidor + 80 tela).
**Adiantou parte da T2** (`server/src/store/json.ts`: leitura/gravação atômica com `.bak`, que o store de planos
vai reaproveitar). **T2 e T3 ✔ (planos, itens, regras de dependência/datas e API; 88 testes do servidor).**
**T4 ✔ (tela de Planos + Novo Plano), T5 ✔ (lista, kanban, filtros, modal "Ordem de execução", M2 "Incluir
testes") e T6 ✔ (detalhe do teste; CPF fictício sem máscara); 97 testes do servidor + 201 da tela.** O projeto é
**local** (servidor só em `127.0.0.1`; as massas são CPFs fictícios de teste). **T13.1 ✔ (Equipe + "Você") e T13.2 ✔
(Pri/Resp./Est. na linha, filtros de responsável/prioridade/"Só meus", lote, totais); 122 testes do servidor + 240 da
tela.** O responsável de um teste é o `id` da pessoa (`ana`); pessoa que tem teste atribuído não é excluída (só
desativada). **T11 ✔ (semente fictícia: `npm run semear` e botão na tela de Planos); 133 testes do servidor + 243 da
tela.** **T12 ✔ (verificação final: 141 + 243 + 8 E2E com `npm run test:e2e`).** **T13.3 ✔ (seletor "Plano" real no
cabeçalho, Lista/Kanban do menu como página do plano escolhido, visões salvas em `dados/visoes.json` com
`/api/visoes` e o modal M11 "Nova visão"; 148 testes do servidor + 266 da tela + 10 E2E).** **T13.4 ✔ (Kanban com
limite de WIP macio em `dados/config.json` + modal M13, raias por responsável com reatribuição ao soltar e cadeado de
dependência; 152 testes do servidor + 289 da tela + 12 E2E; filtro "Recentes" ficou de fora).** **T13.6 ✔ (Roadmap:
linha do tempo Mensal/Trimestral, barras de plano e de teste, arrastar muda `dataPlanejada`/`previsao`, carga prevista
por semana; 152 testes do servidor + 322 da tela + 13 E2E).** **T13.8 ✔ (Lançamento: quadro Funcionalidade/Responsável/
Prioridade × status, pronto por área, bloqueios e clique abrindo a Lista filtrada, com o novo filtro "Resultado";
152 testes do servidor + 350 da tela + 14 E2E).** **T13.10 ✔ (Planejamento: grade semanal por pessoa, uso × capacidade,
backlog, soltar grava dia e responsável com aviso de capacidade excedida; 152 testes do servidor + 384 da tela + 15
E2E).** **T13.9 ✔ (Iterações: cards anterior/atual/próxima, burndown com projeção, velocidade média e backlog do
catálogo movível para uma iteração; 152 testes do servidor + 417 da tela + 16 E2E).** **T8 ✔ (Incidentes: API e dados
globais, aba "Incidentes (n)" no plano, M6/M7, desvincular e etiqueta do INC; semente com 3 INC; 167 testes do servidor +
435 da tela + 17 E2E).** **T13.5 ✔ (tela Incidentes: quadro por status, tabela, resumo, filtros, painel lateral com
histórico e comentários, e o selo real de INC abertos no menu; 167 testes do servidor + 465 da tela + 18 E2E).**
**T13.7 ✔ (Release: 7 critérios calculados dos dados, prontidão por prioridade/pessoa, pendências em ordem de impacto e
decisão GO/NO-GO/GO com exceção (M15) gravada em `decisoes[]` do plano, com "Reavaliar" se um teste mudar depois do GO;
173 testes do servidor + 502 da tela + 19 E2E).** **T13.11 ✔ (Retro: `dados/retros.json` por plano, notas Foi bem/Pode
melhorar com voto e modo anônimo, sugestões automáticas, ações M14 com responsável, prazo e INC opcional, fechar/reabrir;
185 testes do servidor + 529 da tela + 20 E2E).** **T13 completa.** **T10 ✔ (sino de lembretes real: teste de hoje, plano
vencido, INC aberto e ação de retro, "lida" por pessoa em `dados/lembretes.json`; 194 testes do servidor + 547 da tela +
21 E2E).** **Configurações ✔ (04/10/2026: a página deixou de ser provisória — limites de WIP pelo mesmo modal M13 e quais
tipos de lembrete aparecem no sino, em `dados/config.json`; `PUT /api/config` aceita `wip` e/ou `lembretes` e
`/api/lembretes` filtra pelos tipos ligados; sem "planilha lida", por causa da decisão de não ler o Excel; 202 testes do
servidor + 555 da tela + 22 E2E).** **Release e Retro, pontas fechadas (04/10/2026):** INC aberto depois do GO reavalia,
"abrir teste" nos critérios e pendências clicáveis, e aviso de ações pendentes de retros anteriores ao abrir um plano
(`AcoesPendentesAnteriores`, com "abrir retro"). **Build sem aviso de tamanho** (`vite.config.ts` separa `react`, `icones`
e `gsap` do pacote principal: o maior bloco caiu de 602 kB para 280 kB; conferido abrindo o `dist` no Chromium).
**Sobras de fases antigas fechadas (04/10/2026):** "Mover para plano" em lote
(T13.2), modal M12 "Equipe e capacidade" dentro do Planejamento (capacidade, cor, ativa, adicionar e excluir pessoa) e a
presença "Online: …" no cabeçalho (T13.1). T7 virou o cronômetro (05/10/2026) e a T9 foi cancelada;
a T11 traz os cenários de exemplo (hoje a lista nasce vazia).
Use o PowerShell para `npm install`/`npm test`/`npm run dev`.
**Escopo atual (decisão do usuário, 02/10/2026): SEM EXECUÇÃO.** Por enquanto a ferramenta só **planeja e
visualiza**, para organizar o plano antes de executar qualquer teste. Isso **substitui** a decisão anterior de
incluir o Play no MVP. **MVP = T0–T6 + T13.1/T13.2 (pessoas e campos novos) + T11 (semente fictícia) + T12
(testes da ferramenta)**: cadastrar cenários, montar planos, acompanhar em lista e cards, abrir o teste e
organizar por prioridade, responsável, estimativa e data. O status (Agendado, Em andamento, Refinamento,
Concluído) e o resultado (`passou`/`falhou`) são marcados **à mão**. A dependência automática de massa continua,
mas como regra de **planejamento** (bloqueia mover o dependente e a data anterior), não de execução. As demais
visões (T13.3 em diante) vêm em seguida, na ordem do [VISOES.md](VISOES.md) §6.
**Antes adiadas:** T7 (agora o cronômetro manual, 05/10/2026 — sem rodar Playwright, sem fila, sem log, sem leitura do Allure), T8 (incidentes, feita), T9 (massa, **cancelada**) e T10 (lembretes, feita). A frase "SEM EXECUÇÃO" acima continua valendo: a ferramenta não executa nada.
Visões e uso em equipe: **T13** inteira (ordem em [VISOES.md](VISOES.md) §6: T13.1 → T13.2 → T13.3 → resto).
Como a ferramenta terá várias pessoas, **D5 (sem login, só 127.0.0.1) é substituída** pela seção 2 de
[VISOES.md](VISOES.md): servidor compartilhado na rede, seletor "Você", `versao` por registro.
Atualização de massa: **T9 cancelada** (05/10/2026): a ferramenta nunca grava em `data/`.

## 8. Fora de escopo (de propósito)

- Qualquer alteração no **FintechBankApp** (WEB, API, banco).
- Sincronizar com o **GitHub Projects** (o quadro serviu só de referência visual).
- Senha/login de verdade (haverá só seletor de pessoa), deploy em nuvem, campos corporativos do print (Squad, Bandeira, Data P.O., Data Contábil, Sistemas Envolvidos).
- Reescrever a planilha inteira; qualquer `XLSX.writeFile`.

## 9. Perguntas que ainda dependem de você

1. **D1–D6** acima estão bons ou troca algum? (principalmente D1: React + Express, pasta independente.)
2. ~~Cor da linha → status (T11)~~ **Cancelada** (a planilha não é mais usada).
3. ~~`ID_MASSA 0483` com dois CPFs~~ **Respondida:** a massa repetida é proposital (teste específico que
   reaproveita a massa de outro). Modelada como `dependeDe` + marca neutra "compartilhada", sem alerta.
   **Confirmado:** o CT03.7 usa a massa **depois que o CT03.2 executou com sucesso** (`passou`); regra na T6.
4. ~~O MVP inclui o Play (T7)?~~ **Respondido (02/10/2026): NÃO.** Sem execução por enquanto; o MVP é só planejamento e visualização — ver §7.
5. ~~Quais visões e campos novos?~~ **Respondido: todas as visões e todos os campos entram.**
   Também respondidos: menu à **esquerda** por padrão e recolhível, tema **só dark** com o fundo do Admin,
   **cores dos status** aprovadas, **TypeScript + React**, e (02/10/2026) **o Excel é só modelo**: a
   ferramenta usa dados próprios e não lê nem grava a planilha ([VISOES.md](VISOES.md) §2.1).
   **Resolvido por consequência:** as colunas de planejamento na `TBL_CENARIOS`, o "Sincronizar" e o risco do
   `testPlanningXlsx.cjs` do Admin deixam de afetar este projeto (a seção "Planejamento de Testes" do Admin
   não é tocada).
6. Perguntas novas do uso em equipe (onde roda o servidor, token, nomes reais, rótulos, critérios de
   go/no-go, retro anônima): ver [VISOES.md](VISOES.md) §7.
