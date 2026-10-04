# Test of Puppets — Visões (modelos do GitHub Projects adaptados)

> Complemento do [PLANO.md](PLANO.md). Só plano, nenhum código.
> **Decisão do usuário:** entram **todas** as visões e os **campos novos**, porque a ferramenta terá
> **mais de uma pessoa** usando. O ASCII completo de cada tela está em [visoes/](visoes/README.md).
> Ideias tiradas de outros repositórios (fila, tempo real, posição decimal, pacote de falha): [REFERENCIAS.md](REFERENCIAS.md).

## 1. As visões (9 itens do menu lateral = Lista + 8 modelos do GitHub)

| Item do menu | Modelo GitHub | O que mostra | Tela completa |
|---|---|---|---|
| Lista | — | tabela com ações em lote | [V0](visoes/V0-lista.md) |
| Kanban | Kanban | colunas por status, limite de WIP, raias por pessoa | [V1](visoes/V1-kanban.md) |
| Roadmap | Roadmap | Gantt de planos e testes | [V2](visoes/V2-roadmap.md) |
| Incidentes | Bug tracker | quadro de INC com severidade e triagem | [V3](visoes/V3-incidentes.md) |
| Release | Feature release | 7 critérios go/no-go calculados + decisão | [V4](visoes/V4-release.md) |
| Lançamento | Product launch | matriz Funcionalidade × Status | [V5](visoes/V5-lancamento.md) |
| Iterações | Iterative development | planos como iterações, burndown, backlog priorizado | [V6](visoes/V6-iteracoes.md) |
| Planejamento | Team planning | semana × pessoa × capacidade | [V7](visoes/V7-planejamento.md) |
| Retro | Team retrospective | foi bem / melhorar / ações com voto | [V8](visoes/V8-retro.md) |

Não há sincronização com o GitHub Projects: copiamos só o **formato** das visões.

## 2. Várias pessoas usando — o que isso muda

Antes (D5 do PLANO.md): uma pessoa, `127.0.0.1`, sem login. Com equipe:

| Tema | Como fica |
|---|---|
| Quem sou eu | cadastro de **Pessoas** (`dados/pessoas.json`); seletor `Você: [Ana ▾]` no topo, sem senha, lembrado no navegador |
| Autoria | toda alteração grava `por: <pessoa>` e hora; aparece no histórico do teste/INC e nos avisos |
| Servidor | **local** (decisão de 03/10/2026): roda nesta máquina em `127.0.0.1` (porta 3100/3101), sem deploy. Dividir na rede (`PUPPETS_HOST=0.0.0.0`) fica como opção futura, desligada por padrão |
| Execução | **adiada** (decisão de 02/10/2026): por enquanto a ferramenta só planeja e visualiza; nenhum teste é executado por ela |
| Edição ao mesmo tempo | cada registro tem `versao`; salvar com versão antiga mostra "alguém alterou, recarregar/sobrescrever" |
| Atualização | a tela consulta a cada 5 s (ou SSE) e mostra `Online: Ana, Bia`; mudanças de outros viram aviso curto |
| Entrada | tela inicial só com o botão **Entrar**, **sem senha por enquanto** (decisão do usuário); a ferramenta não usa `data/` |
| Segurança | sem senha (rede interna); opcional um token no `.env` do servidor |

Isso substitui D5. Ver a pergunta 7 na seção 7.

## 2.1 Dados próprios; o Excel é só modelo (decisão de 02/10/2026)

**Decisão do usuário:** "vamos usar só como base por enquanto, não use mais os dados do Excel, para não
atrapalhar". Isso **substitui** a ideia anterior de planejar no Excel (Fase 1 / Fase 2) e de criar colunas
de planejamento na `TBL_CENARIOS`.

- A ferramenta **não lê nem grava** `data/MassaDados.xlsx` (nem qualquer `.xlsx`). A planilha serviu **só
  de modelo**: dela vêm os nomes dos campos (`ID_CENARIO`, `NOME`, `FEATURE`, `ID_MASSA`, `CPF`…) que o
  **cadastro de cenários da própria ferramenta** imita.
- Cenários, planos, execuções, INC, retros e pessoas ficam em `test-of-puppets/dados/` (JSON; SQLite
  como evolução).
- **Todo o planejamento é feito no web desde o início**: criar plano, incluir/remover/mover teste, data,
  responsável, prioridade e estimativa. Nenhuma ação das visões é só leitura.
- Os dados dos desenhos e da semente são **fictícios**.
- **Sem execução por enquanto (decisão de 02/10/2026):** a ferramenta só **planeja e visualiza** para organizar
  o plano antes de executar qualquer teste. Fora do escopo agora: Play/Stop, fila de execução, "Verificar
  ambiente", "Reexecutar falhos", log ao vivo, leitura do resultado do Allure e pacote de falha. O status
  (Agendado, Em andamento, Refinamento, Concluído) e o resultado (`passou`/`falhou`) são marcados à mão.

**Novo: cadastro de cenários (item "Cenários e massa" do menu, modal M16).** Como não há planilha para
ler, os cenários são cadastrados aqui (um a um; importação em lote só se você pedir depois).

```
┌─ Cenário (novo / editar) ───────────────────────────────────── ✕ ─┐
│ ID do cenário      [ CT03.8                  ]  (formato CTnn.n)   │
│ Nome               [ Pagar fatura com cartão bloqueado       ]     │
│ Funcionalidade     [ Faturas ▾ ]   ou nova [ ________ ]            │
│ Massa (ID)         [ 0483 ]   CPF (opcional) [ 000.000.000-00 ]    │
│                    CPF fictício de massa de teste (não é dado real)│
│ Passos             [ tests/features/faturas.feature#CT03.8  ]      │
│ Resultado esperado [ Pagamento recusado com mensagem clara  ]      │
│ Dependência        automática: roda depois de CT03.2 (mesma massa) │
│ = Massa 0483 já usada pelo CT03.2 (detectado sozinho)              │
│                             [ Cancelar ]   [ Salvar cenário ]      │
└────────────────────────────────────────────────────────────────────┘
```

A massa passa a ser só **informação digitada** (ID da massa e CPF opcional, **sem máscara**: são CPFs fictícios de massa de teste, a ferramenta é local). Senha e PIN nunca
são guardados. Teste com a mesma massa recebe `dependeDe` e roda em ordem (continua valendo, agora a partir
do que a pessoa informa).

**Massa repetida é permitida e esperada.** Mais de um cenário pode apontar para a mesma massa de propósito
(ex.: o CT03.7, "Reenvio do pagamento mínimo", continua de onde o CT03.2 parou). A ferramenta não trata isso
como erro: mostra a marca neutra `=` "massa compartilhada com CT03.2" e **detecta sozinha** o grupo (mesmo ID de massa) e preenche `dependeDe` sem ninguém digitar (por padrão a ordem é a numeração do ID: o CT03.7 só pode ir para "Em andamento" depois que o CT03.2 passou, nem ser planejado numa data anterior à dele; até lá o card mostra "Aguardando CT03.2 passar"), para a
ordem do plano ficar certa (quem deixa o estado vem antes). Nenhum alerta vermelho e nenhuma pendência no Release
só por a massa se repetir.

**Fica de fora por enquanto (dependia da planilha)**

| Item | Situação |
|---|---|
| T9 Atualizar massa e modal M8 | adiados |
| M10 "Massa em conflito" e o selo `!` | **removidos**: massa repetida é proposital (um teste específico reaproveita a massa de outro), não é erro. Vira a marca neutra `=` "massa compartilhada" + `dependeDe` |
| Release, critérios de massa | "Massa atualizada" (T9) e "Sem massa em conflito" foram trocados por "Dependências de massa respeitadas" e "Todos os testes com responsável e estimativa"; continua com 7 critérios |
| "Sincronizar", leitor do `.xlsx` (T1 antiga) e colunas de planejamento na `TBL_CENARIOS` | cancelados |

**Para o futuro, se você pedir uma importação:** seria manual e pontual, com prévia, e antes disso é preciso
resolver um risco já encontrado: `API/utils/testPlanningXlsx.cjs` (seção "Planejamento de Testes" do Admin do
FintechBankApp) grava no mesmo arquivo com `json_to_sheet` + `XLSX.writeFile`, o que apaga a Tabela do Excel e
colunas ainda vazias. A ferramenta nova **não mexe** nessa tela nem na planilha.

## 3. Campos novos (todos opcionais, em `test-of-puppets/dados/`, nunca em `data/`)

| Campo | Onde | Tipo / valores | Quem edita | Usado em |
|---|---|---|---|---|
| `prioridade` | item do plano | `P1` · `P2` · `P3` | qualquer pessoa | V0 V1 V4 V6 V7 |
| `responsavel` | item do plano | id de Pessoa | qualquer pessoa | V0 V1 V2 V5 V7 |
| `estimativaMin` | item do plano | inteiro (minutos) | qualquer pessoa | V0 V6 V7 |
| `tempoRealMin`, `restanteMin` | item do plano | inteiros (min); real = tempo gasto, **informado à mão** (opcional); restante = estimativa − real | qualquer pessoa | V6 V7 |
| `dependeDe` | item do plano | lista de `idCenario`, **calculada automaticamente** a partir do mesmo `idMassa` (ordem padrão = numeração do ID); só se edita numa exceção | sistema | V1 (bloqueia mover), V2/V7 (datas) |
| `runId` | execução | **adiado** junto com a execução | — | — |
| `dataPlanejada` | item do plano | data ISO | arrastar no Roadmap/Planejamento | V1 V2 V7 |
| `versao` | todo registro | inteiro, +1 a cada gravação | sistema | edição simultânea |
| `severidade` | INC | `alta` · `media` · `baixa` | quem registra | V3 V4 |
| `responsavel`, `comentarios[]`, `historico[]` | INC | id; lista de `{por, em, texto}` | qualquer pessoa | V3 |
| `nome`, `capacidadeMinSemana`, `cor`, `ativa` | Pessoa | texto; inteiro; cor; bool | M12 | V7 e todos os filtros |
| `limiteWip` | config | `{ em_andamento: 1, refinamento: 3 }` | M13 | V1 |
| `posicao` | item do plano e backlog | número decimal; ao soltar entre dois itens vale a média dos vizinhos (ideia do `jira_clone`) | arrastar card ou ≡ | V1 V6 V7 |
| `decisoes[]` | plano | `{decisao, justificativa, por, em, criterios[]}` | M15 | V4 |
| `iteracao` | plano | nome opcional (ex.: "Sprint 12") | M1 | V6 |
| `notas[]`, `acoes[]` | retro | ver abaixo | V8 | V8 |
| `visoes[]` | visão salva | `{id, tipo, nome, dono, compartilhada, filtros, agrupar, ordenar}` | qualquer pessoa | barra de visões |

Exemplos (valores sintéticos, datas em ISO no arquivo e `dd/mm/aaaa` na tela):

```jsonc
// dados/pessoas.json
[ { "id": "ana", "nome": "Ana", "capacidadeMinSemana": 120, "cor": "azul", "ativa": true } ]

// dados/planos.json  (um item do plano)
{ "planoId": "2026-09-28", "testeId": "CT03.2", "status": "em_andamento",
  "prioridade": "P1", "responsavel": "ana", "estimativaMin": 30,
  "dataPlanejada": "2026-10-02", "versao": 4,
  "historico": [ { "por": "ana", "em": "2026-10-02T09:14:00", "acao": "status: agendado -> em_andamento" } ] }

// dados/incidentes.json
{ "inc": "INC0715802225", "titulo": "Saldo de Faturamento difere do extrato",
  "status": "em_analise", "severidade": "alta", "responsavel": "ana",
  "testesAfetados": ["CT03.1", "CT03.2"], "abertoEm": "2026-09-29", "versao": 2 }

// dados/config.json
{ "limiteWip": { "em_andamento": 1, "refinamento": 3 } }

// dados/retros.json
{ "planoId": "2026-09-14", "status": "aberta",
  "notas": [ { "coluna": "melhorar", "texto": "Reuso de massa sem ordem", "autor": "ana", "votos": ["ana","bia","carlos"] } ],
  "acoes": [ { "texto": "Ordenar CT03.2 antes do CT03.7", "responsavel": "ana", "prazo": "2026-10-20", "feito": false, "incId": "INC0715802225" } ] }
```

Sem preencher um campo, a visão mostra `-` e avisa o que falta (ex.: "3 testes sem estimativa").

## 4. Menu lateral e visões salvas

Uma visão = tipo + filtros + agrupamento + ordenação. Pode ser **pessoal** ou **compartilhada** com a
equipe. Padrão ao abrir o plano: Kanban. Menu lateral recolhível (lado esquerdo por padrão, igual ao Admin do FintechBankApp), com os botões
`[⇄]` trocar de lado e `[«]` recolher para só ícones: [visoes/README.md](visoes/README.md#layout).
As visões salvas aparecem no grupo **MINHAS VISÕES** e `+ Nova visão` abre o M11.

## 4.1 Tema escuro (só dark) e fundo animado do Admin

**Decisão do usuário:** usar a paleta do FintechBankApp **somente no modo escuro** ("midnight") e o
**mesmo fundo de tela** que já funciona no painel Admin. Não existe tema claro nem alternância.

**Paleta** (tokens de `WEB/styles/global.css` do FintechBankApp, copiados como variáveis do Tailwind):

| Uso | Token | Cor |
|---|---|---|
| Fundo da página (Admin) | `bg-[#0f0f0f]` | `#0f0f0f` |
| Fundo base / superfícies | `volt-dark` · `volt-surface` · `-low` · `-high` · `-top` | `#131313` · `#201f1f` · `#1c1b1b` · `#2a2a2a` · `#353534` |
| Texto | `on-surface` · `on-surface-variant` | `#e5e2e1` · `#b9cbbc` |
| Acento principal | `volt-green` (e o escuro `primary`) | `#00ff9d` · `#00e38b` |
| Apoio | cyan · lime · amarelo · rosa | `#00E5FF` · `#A2FF00` · `#FFD700` · `#FF5C8D` |
| Neon | secundário · contorno · erro | `#c9bfff` · `#849587` · `#ffb4ab` |
| Fontes | `Inter` (texto) · `Space Grotesk` (títulos) · `JetBrains Mono` (dados e código) | |

Padrões visuais já usados no Admin: cartões `bg-volt-surface/80` com borda `white/10` e cantos
`rounded-2xl`; item de menu ativo em verde com borda `volt-green/30`; botão de destaque
`bg-volt-green/15 text-volt-green`.

**Cores dos status (confirmadas pelo usuário em 02/10/2026)**

| Status / marca | Cor |
|---|---|
| `Passou` | verde `#00ff9d` |
| `Falhou` | erro `#ffb4ab` |
| `Executando` | cyan `#00E5FF` |
| `A iniciar` | cinza-verde `#b9cbbc` |
| `Standby` | amarelo `#FFD700` |
| `Na fila` | (adiado com a execução) |
| `Bloqueado` | rosa `#FF5C8D` |
| Prioridade P1 · P2 · P3 | rosa `#FF5C8D` · amarelo `#FFD700` · cinza-verde `#b9cbbc` |
| Severidade Alta · Média · Baixa | erro `#ffb4ab` · amarelo `#FFD700` · lime `#A2FF00` |

**Fundo animado.** É o `GridRevealBackdrop` do Admin (`components/shared/GridRevealBackdrop.tsx`, 556
linhas, mais `utils/ditherEffects.ts`, 99, e o `MatrixDotLoader.tsx`, 87, que enfeita o cabeçalho):
um mosaico de células que se dividem sozinhas. Fica **fixo, atrás de tudo e sem receber cliques**.
Sem imagem, o mosaico roda em cinzas e "respira"; com imagem, a foto emerge e volta num ciclo de uns 9 s.

```
 camada 0   GridRevealBackdrop       fixo, atrás de tudo, pointer-events: none
 camada 1   fundo #0f0f0f            fica transparente enquanto o backdrop está ligado
 camada 2   menu lateral + cartões   bg #201f1f a 80% + borda branca 10%  (deixa o mosaico aparecer)
 camada 3   modais                   bg-black/70 + blur no fundo
```

Ajustes que o Admin já tem (botão **"Fundo"** no cabeçalho, com um ponto verde quando há imagem):
enviar imagem ou colar uma URL, **opacidade** (padrão 15 %), **tamanho da célula do dither** (padrão
8 px, cor `#00ff9d`) e remover. A escolha fica salva no navegador. Aqui fica salva **por pessoa**.

Como entra no projeto novo: copiar os três arquivos para `test-of-puppets/web/src/shared/` (os projetos
são separados, então **não se importa** de um para o outro) e declarar os tokens acima. Sem imagem o
componente degrada para o mosaico cinza, inclusive em teste (jsdom).

> Ponto de atenção: o caminho padrão da imagem no Admin é `/FintechBankApp/img/admin-backdrop.jpg`, mas
> **não existe** pasta `WEB/public/img` no repositório. Portanto o fundo que você vê funcionando é o
> mosaico, mais qualquer imagem que você tenha enviado, e essa fica guardada **no `localStorage` do seu
> navegador**. Ela não vem junto na cópia: no Test of Puppets é preciso enviar de novo (ou colocar o
> arquivo na pasta `public` do projeto).

### M11 — Nova visão (galeria, espelha o "Featured" do GitHub)

```
┌─ Nova visão ────────────────────────────────────────────────────────────── ✕ ─┐
│ Escolha um modelo                                      Nome [Kanban – Faturas ] │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐           │
│ │ Kanban       │ │ Roadmap      │ │ Bug tracker  │ │ Feature      │           │
│ │ status e WIP │ │ linha do tempo│ │ incidentes   │ │ release go/no│           │
│ └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘           │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐           │
│ │ Product      │ │ Iterative    │ │ Team         │ │ Team         │           │
│ │   launch     │ │   development│ │   planning   │ │   retro      │           │
│ └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘           │
│ Filtros iniciais: Funcionalidade [Faturas ▾]  Responsável [Todos ▾]            │
│ Compartilhar com a equipe [x]                                                  │
│                                              [ Cancelar ]  [ Criar visão ]     │
└────────────────────────────────────────────────────────────────────────────────┘
```

## 4.2 Tela inicial: botão Entrar + galeria ASCII  (feita)

A primeira tela tem só o título, o botão **Entrar** (sem senha) e, embaixo, a **galeria ASCII**: cada foto
aparece primeiro como uma grade de 25×22 caracteres que "embaralha" até assentar (verde `#00ff9d` sobre o
fundo escuro da paleta) e depois some, revelando a foto. Porte da lógica do exemplo "ASCII Gallery" com GSAP
(`ScrambleTextPlugin`). Sem canvas/`decode()`, ou com "reduzir movimento" ligado no sistema, a foto aparece
direto. Entrar fica lembrado enquanto a aba estiver aberta; uma aba nova mostra a entrada de novo.

> **Onde trocar as imagens: `test-of-puppets/web/src/pages/entrada/imagens.ts`**, lista `IMAGENS_ENTRADA`
> (`{ src, alt }`). Coloque os arquivos em `test-of-puppets/web/public/entrada/` e use `/entrada/nome.jpg`.
> Hoje são 8 ilustrações geradas no próprio arquivo, na paleta do projeto, até você pôr as suas.

## 5. Modais novos (mesma casca do PLANO.md §5)

| Modal | Para quê | Desenho |
|---|---|---|
| M11 Nova visão | galeria + filtros iniciais | acima |
| M12 Equipe e capacidade | pessoas e minutos por semana | [V7](visoes/V7-planejamento.md) |
| M13 Limites de WIP | número por coluna | abaixo |
| M14 Nota/ação da retro | texto, responsável, prazo, "criar INC" | [V8](visoes/V8-retro.md) |
| M15 Registrar decisão GO/NO-GO | decisão, justificativa, critérios | [V4](visoes/V4-release.md) |

```
┌─ Limites de WIP ──────────────────────────────── ✕ ─┐
│ Coluna          Limite                                │
│ Agendado        sem limite                            │
│ Em andamento    [ 3 ]    (limite "macio": só avisa)    │
│ Refinamento     [ 3 ]                                 │
│ Concluído       sem limite                            │
│ Vale para todos os planos.                            │
│                        [ Cancelar ]  [ Salvar ]       │
└───────────────────────────────────────────────────────┘
```

## 6. Tasks (T13 do PLANO.md) — todas entram

| Task | Entrega | Tam. | Depende de |
|---|---|---|---|
| T13.1 | ✔ (03/10/2026) Pessoas (`dados/pessoas.json`, `/api/pessoas`), tela Equipe, seletor "Você" real e `versao`/aviso de conflito. **Presença ("Online: Ana, Bia") ficou de fora**: o projeto é local, na mesma máquina | M | T3 |
| T13.2 | ✔ (03/10/2026) Colunas Pri/Resp./Est. editáveis na linha, filtros Responsável/Prioridade/"Só meus", lote (atribuir, prioridade, remover do plano; `PATCH /api/planos/:id/testes`) e total estimado no rodapé. **"Mover para plano" em lote ficou de fora** | M | T13.1, T5 |
| T13.3 | ✔ (03/10/2026) Menu lateral já existia; entregue: seletor "Plano" real no cabeçalho (lembrado em `puppets:plano`), **Lista** e **Kanban** do menu abrem o plano escolhido como página (sem abas), visões salvas (`dados/visoes.json`, `/api/visoes`: listar/criar/excluir; pessoal do dono ou compartilhada) em "Minhas visões" e o modal M11 (9 modelos; só Lista e Kanban habilitados, os outros "Em breve" até a tarefa deles). Sem "Você" a visão nasce compartilhada. **Ficou de fora:** editar/renomear visão e "salvar os filtros de agora como visão" | M | T13.2 |
| T13.4 | ✔ (03/10/2026) V1 Kanban: WIP "macio" (`dados/config.json`, `GET/PUT /api/config`; padrão Em andamento 3 e Refinamento 3; contador `atual/limite`, coluna marcada "Limite" e aviso "Soltar mesmo assim"), M13 "Limites de WIP" (botão "Editar limites"), "Agrupar: Responsável" em raias (soltar em outra raia pergunta "Passar CTxx de A para B?" e reatribui; raia recolhível; "Sem dono") e cadeado nos cards bloqueados por dependência. **Ficou de fora:** filtro "Recentes (3 dias)" (o teste não guarda data de atualização), menu ⋯ do card, aviso de alteração de outra pessoa e "(Ana editando)" | M | T13.3 |
| T13.5 | ✔ (03/10/2026) V3 Incidentes: quadro Novo · Em análise · Resolvido (arrastar ou seletor do card muda o status e grava o autor), tabela com Alta primeiro e "há N dias", filtros (busca, severidade, responsável, mostrar resolvidos, só meus), resumo ("abertos 2 · Alta 1 · Média 1 · tempo médio de resolução 2 dias · testes travados 3"), painel lateral (editar título/severidade/status/responsável/testes/descrição, histórico, comentários, excluir com confirmação), Registrar e Vincular existente (M6/M7) e **selo real** de INC abertos no menu. **Ficou de fora:** chip do teste afetado abrir o teste (o INC é global, o teste depende de um plano), "Criar INC a partir de uma falha" (precisa da execução, T7) e o aviso no sino ao atribuir (T10) | M | T8, T13.3 |
| T13.6 | ✔ (03/10/2026) V2 Roadmap: zoom Mensal (28 dias) e Trimestral (13 semanas) com ◀ ▶ e "Hoje"; uma linha por plano (criação → previsão, ◆ da previsão) que recolhe e, aberta, uma por teste (planejado tracejado, atrasado amarelo, `ok`/`XX` concluído); faixa "Sem data (n)"; filtro por responsável; "Fins de semana" desmarcado recusa soltar em sáb/dom; arrastar a barra do teste muda `dataPlanejada` e o ◆ muda `previsao` (só no Mensal; o servidor ainda aplica a regra de datas da dependência); linha "Carga prevista (min)" no Trimestral; clicar abre o detalhe do teste/plano. **Ficou de fora:** "Agrupar por Responsável/Funcionalidade", duplo clique na linha para criar teste e o aviso de edição simultânea | G | T13.3 |
| T13.7 | ✔ (04/10/2026) V4 Release: do plano escolhido no cabeçalho; os 7 critérios saem dos dados (testes executados, nenhum Falhou, nenhum INC aberto afetando o plano, P1 todos passaram, dependências de massa, responsável + estimativa, dentro do prazo) com "Atual", Cumprido/Pendente e "ver" que lista o que falta (INC com "abrir INC" que leva à tela Incidentes). Prontidão por prioridade e por pessoa; pendências em ordem de impacto (P1/INC Alta primeiro, quem espera outro depois; 5 + "Ver todos"). M15 "Registrar decisão": GO só com 7 de 7, GO com exceção só com critério pendente, NO-GO sempre; justificativa obrigatória; autor = "Você" (ou escolhe na lista); `POST /api/planos/:id/decisoes` grava em `dados/planos.json` (`decisoes[]`, só acrescenta, não mexe na `versao` do plano). Histórico mais novo primeiro, selo "Liberado em … por …", e "Reavaliar" (com aviso a quem decidiu) se um teste mudar depois do GO. **Fechado em 04/10/2026** (antes estavam de fora): um **INC aberto depois do GO** que afeta o plano e ainda não foi resolvido também volta para "Reavaliar" (o aviso diz "CT01.1 mudou e INC… foi aberto depois"); cada item de critério tem **"abrir teste"** e cada pendência de teste é um botão — os dois abrem a **Lista com o detalhe (M4) daquele teste já aberto**; a pendência de INC leva a Incidentes; a do prazo não é botão | M | T13.5 |
| T13.8 | ✔ (03/10/2026) V5 Lançamento: quadro do plano escolhido no cabeçalho, linhas por Funcionalidade, Responsável ou Prioridade × colunas de status (Agendado, Em andamento, Refinamento, Passou, Falhou; "Concluído sem resultado" só se existir), valor em Qtd, Minutos estimados ou % do total, filtro de responsável, linha TOTAL, "Resp. principal" (empate mostra os dois), "Próximo marco" em dias úteis, "Pronto" (passou ÷ total) por área, nota de massa compartilhada e Bloqueios (testes esperando outro por causa da massa). Clicar numa célula ou no nome da área abre a **Lista já filtrada** (novo filtro "Resultado" na Lista: passou/falhou/sem resultado). Só leitura. **Ficou de fora:** coluna "INC abertos" e bloqueios de INC (dependem da T8) e "Standby" (não existe esse status) | P | T13.3 |
| T13.9 | ✔ (03/10/2026) V6 Iterações: cada plano é uma iteração, ordenada pela previsão (anterior = último concluído; atual e próxima = os dois primeiros abertos). Cards com período, "dia N de M" em dias úteis, concluídos, estimado, real (e variação % na anterior) e capacidade da equipe na próxima; burndown em SVG (ideal tracejado × real por `dataExecucao`; concluído sem data conta só a partir de hoje, com aviso) com seletor de iteração, projeção no ritmo atual ("termina ~15/10, 2 dias úteis após o alvo") e velocidade média das 3 últimas encerradas; backlog = cenários do catálogo fora de plano aberto (prioridade e estimativa do último plano em que apareceram), "Mover para" e arrastar para o card; soltar na iteração em andamento pede confirmação do aumento de escopo. **Ficou de fora:** reordenar o backlog (`dados/backlog.json`), "Ver retro" (depende da V8/T13.11) e "Meta" | G | T13.3 |
| T13.10 | ✔ (03/10/2026) V7 Planejamento: semana a semana (◀ ▶, "Esta semana", fins de semana desligados por padrão), filtros de plano e de pessoa, uma linha por pessoa ativa mais "Sem dono", testes como chips por dia, "Uso/Capacidade" (`55/90 min`, `EXCEDEU em N min`), barras "Capacidade da semana" com total da Equipe, backlog por prioridade (5 + "Ver todos"). Arrastar chip ou item do backlog para o dia de uma pessoa grava `dataPlanejada` e `responsavel`; ao estourar a capacidade abre "Capacidade excedida" com "Colocar na X" (quem tem folga), "Manter" e "Cancelar". Teste sem estimativa mostra `?` e conta 0; pessoa sem capacidade nunca estoura. **M12 não foi refeito:** o botão "Equipe e capacidade" leva à tela Equipe, que já edita capacidade/cor/ativa. **Ficou de fora:** duplo clique/M2 para incluir teste direto na grade e "semanas passadas já fechadas" (a capacidade vale igual para todas as semanas) | G | T13.2 |
| T13.11 | ✔ (04/10/2026) V8 Retro: uma retro por plano em `dados/retros.json` (`/api/retros/:planoId`: notas, votos, ações, estado). Só abre com o plano concluído (senão a tela explica "ainda está em andamento (n de m)" e oferece "Retros anteriores"; o servidor recusa nota/voto/fechar com 409 `retro_indisponivel`). Colunas Foi bem · Pode melhorar · Ações; nota inline, voto (+1 por pessoa, segundo clique tira; mais votada sobe), "Notas anônimas" (some o nome de autor e de quem votou; só a própria nota diz "(sua nota)"), excluir nota. Sugestões automáticas calculadas na hora (falhas, estimado × real, INC resolvidos/abertos, massa reutilizada, prazo) que viram nota com um clique. M14 Ação: texto, origem (nota), responsável (padrão "Você"), prazo, "Criar também um INC" (número informado + severidade; cria o INC e liga na ação); marcar feita grava quem e quando; editar/excluir pelo clique no texto. Fechar trava notas e votos (409 `retro_fechada`), mostra resumo de ações pendentes/concluídas "faltam N dias"; as ações continuam editáveis; Reabrir pede confirmação dizendo quem fechou. **Fechado depois** (04/10/2026): ações pendentes aparecem no sino (T10) e, ao abrir um plano, num aviso "Ações pendentes de retros anteriores (n)" com "abrir retro" (só planos criados antes; some quando a ação é feita). **Ficou de fora**: sugestão "falhou e foi reexecutado" (não há histórico de tentativas), retro de plano cancelado (não existe status cancelado) e dados de exemplo da retro na semente | M | T13.5 |

Ordem sugerida: T13.1 → T13.2 → T13.3 → (T13.4, T13.5, T13.6) → (T13.7, T13.8) → (T13.9, T13.10) → T13.11.
Teste de cada visão: renderiza com a semente do [README](visoes/README.md), filtros e agrupamentos
funcionam, estado vazio mostra aviso, dois usuários alterando o mesmo item geram o aviso de conflito,
nenhum clique grava em `data/`.

## 7. Perguntas que ainda dependem de você

1. **Onde roda o servidor?** (a) uma máquina compartilhada na rede, todos acessam pelo navegador
   — recomendado (todos veem o mesmo plano); (b) cada pessoa roda o seu e `dados/` fica numa pasta
   compartilhada/Git — mais simples, mas sujeito a conflito de arquivo.
2. Rede interna sem senha serve, ou quer um **token simples** no `.env`?
3. Lista de pessoas inicial: **Ana, Bia, Carlos** são só exemplo; quais nomes reais e capacidade em min/semana?
4. Prioridade P1/P2/P3 e severidade alta/média/baixa são os rótulos certos para a equipe?
5. Os **7 critérios de go/no-go** do Release servem, ou quer trocar/acrescentar algum?
6. Retro: notas **anônimas** por padrão ou com nome?
