# Referências estudadas — o que aproveitamos

> Complemento do [PLANO.md](PLANO.md) e do [VISOES.md](VISOES.md). Estudo feito em 02/10/2026 lendo
> README, estrutura de pastas e arquivos-chave pela API do GitHub (nada foi clonado nem copiado).
> Regra: aproveitamos **ideias e estrutura**. Nenhum código é copiado sem checar a licença.
>
> **Atualização (02/10/2026): sem execução por enquanto.** Os itens do TestSprite que tratam de rodar testes
> (fila, `runId`, reexecução em lote, "Verificar ambiente", pacote de falha, execução que sobrevive à tela)
> ficam **adiados** com a T7. Continuam valendo as ideias do `jira_clone` (posição decimal, estimativa,
> filtros, estrutura da API) e a de dependência entre testes, agora como regra de planejamento.

| Repositório | Licença | O que é | Serve para nós? |
|---|---|---|---|
| [oldboyxx/jira_clone](https://github.com/oldboyxx/jira_clone) | MIT | clone simplificado do Jira: React + Node/TypeScript + Postgres, testes com Cypress (parado desde 06/2024) | **Sim**: modelo de dados e Kanban |
| [TestSprite/Docs](https://github.com/TestSprite/Docs) | não informada no GitHub (o README diz MIT) | documentação de um produto comercial de teste com IA | **Só conceitos** de execução; sem código |
| [digoarthur/github-automated-repos](https://github.com/digoarthur/github-automated-repos) | MIT | biblioteca React que lê seus repositórios do GitHub para montar portfólio | **Quase nada**: padrão de busca com cache e higiene do repositório |

## 1. Do `jira_clone`

| Ideia dele | Como entra aqui | Onde |
|---|---|---|
| `listPosition` numérico: a posição do card é um número; ao soltar entre dois cards usa-se a **média dos vizinhos** | campo `posicao` (decimal) no item do plano e no backlog; arrastar não reescreve a lista inteira | [VISOES.md](VISOES.md) §3, V1, V6, V7 |
| `estimate`, `timeSpent`, `timeRemaining` | `estimativaMin` + **`tempoRealMin`** (duração do Play) + **`restanteMin`**; burndown e capacidade por minutos | [VISOES.md](VISOES.md) §3, V6, V7 |
| Filtros do quadro: busca, pessoas, "só meus", **"recentes" (alterados nos últimos 3 dias)** e contador "n de m" | acrescentar "Recentes (3 dias)" na Lista e no Kanban | V0, V1 |
| API em camadas: `controllers / entities / serializers / middleware / errors` com `asyncCatch` e validação central | modelo de pastas do `test-of-puppets/server` | [PLANO.md](PLANO.md) T3 |
| Rotina que **zera o banco e cria a conta de teste** para o Cypress | `POST /test/reset` (só em modo teste) que recria `dados/` pela semente, para o E2E partir sempre do mesmo estado | T12 |
| Componentes base: `Modal`, `ConfirmModal`, `DatePicker`, `Avatar`, `Breadcrumbs`, `Button` | lista de componentes compartilhados dos modais | T4/T5 |

Não aproveitar (o README dele mesmo admite): sem migrations (`synchronize` recria o esquema), conta de
visitante automática no lugar de autenticação, sem teste unitário, acessibilidade incompleta. O quadro usa
`react-beautiful-dnd`, que pelo que sei está descontinuado; o fork mantido é `@hello-pangea/dnd`
(**confirmar antes de usar**). O cliente é JavaScript com Babel e `styled-components`; pegamos a estrutura,
não o código. Ele não tem sprint, roadmap nem retro, então não ajuda nas visões V2, V6, V7 e V8.

## 2. Do `TestSprite/Docs`

| Conceito | Como entra aqui | Onde |
|---|---|---|
| **9 status normalizados** (`draft, ready, queued, running, passed, failed, blocked, cancelled, unknown`) | acrescentar **`na_fila`** e **`desconhecido`** aos nossos status | [PLANO.md](PLANO.md) §4 |
| **Fila em vez de bloqueio**: um segundo run espera o primeiro | com o WIP cheio, o Play não é recusado: o card vira `na_fila` e roda sozinho depois | T7, V1 |
| **Teste × Execução (`runId`)**, com histórico de runs | já era o nosso modelo; passa a ter `runId` explícito | §4, T7 |
| **Execução sobrevive à interrupção**: fechar o terminal solta a conexão, o run continua e dá para reconectar pelo `runId` | o run pertence ao servidor; fechar ou recarregar a tela não o interrompe e reabrir reconecta ao log. Só **Stop** encerra | T7 |
| **Pacote de falha**: log, evidências e análise do mesmo run reunidos | "Criar INC" anexa log + screenshot + trace + `.docx` do mesmo `runId` | T7, T8, V3 |
| **Reexecução em lote** com filtro por status e nome | botão "Reexecutar falhos" na Lista e no Kanban (entram na fila, um por vez) | T7, V0 |
| **Dependências entre testes** (quem produz o dado vem antes) | para nós é a **massa**: CT03.2 e CT03.7 usam a massa 0483; campo `dependeDe` e ordem de execução | T6 |
| **`doctor`**: verificação de ambiente antes de rodar | botão "Verificar ambiente": planilha legível, Playwright instalado, porta livre, FintechBankApp respondendo | T7 |
| **Códigos de saída estáveis** e `--output json` | modo linha de comando para rodar um plano em pipeline. **Fica para depois**, fora do MVP | §8 |
| Triagem por IA e **auto-heal** de seletor quebrado | **fora de escopo**. Combina com o caso dos locators da navbar que ficaram obsoletos; anotado para o futuro | §8 |

## 3. Do `github-automated-repos`

- **React Query**: busca com cache e atualização periódica (`refetchInterval`). Serve para a atualização
  de 5 s da presença e do quadro ("Online: Ana, Bia").
- **Higiene do repositório**: modelos de issue (bug e funcionalidade), `commitlint`, changelog e
  `.editorconfig`, se quisermos padronizar a pasta nova. Opcional.
- Resto (leitura de repositórios por tópico, banner, ícones) não se aplica.
