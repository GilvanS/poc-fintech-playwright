# Bug Report — Erro `ECONNRESET` após Confirmar o PIN, com pagamento EFETIVADO no banco

| Campo | Valor |
|---|---|
| **Componente** | FintechBankApp — API (`invoiceController.pay`) + WEB (`InvoicesAllureView` + proxy Vite) |
| **Endpoint** | `POST /api/cards/invoice/pay` (`API/src/routes/invoice.routes.js:22` → `API/src/controllers/invoiceController.js`, função `pay`) |
| **Severidade** | **Alta** — sucesso "falso negativo" para o usuário + risco de dupla cobrança em retry (ver bug irmão) |
| **Reportado por** | Suíte E2E poc-fintech-playwright — família CT03 (CT03.1, pagamento Total) |
| **Data** | 22/09/2026 |
| **Bugs relacionados** | `docs/BUG-REPORT-IDEMPOTENCIA-INVOICE-PAY.md` (débito duplo por ausência de idempotência — o bug deste relatório **amplifica** aquele) |

## Resumo

Ao confirmar o PIN de pagamento, o backend **grava o pagamento no banco** (transação, saldo,
limite, notificação), mas a **resposta HTTP nunca chega ao browser**: o proxy do Vite devolve
`502 ECONNRESET` e a UI exibe um alerta dizendo que a operação "pode NÃO ter sido processada".
O modal de PIN **permanece aberto** (só fecha no success), o cliente acredita que falhou — e se
clicar "Tentar novamente" (opção que a própria UI oferece), a idempotência inexistente da API
(transforma o retry em **segunda cobrança**, bug já reportado separadamente).

Contradição central: **erro na tela, dinheiro debitado, fatura quitada**.

## Linha do tempo da execução (CT03.1, 22/09/2026)

| Hora | Evento |
|---|---|
| 07:38:34 | Massa CT03.1 carregada: CPF `15607750841`, fatura fechada **R$ 6.813,59**, saldo **R$ 8.363,76**, limite disponível **R$ 889,67** |
| 07:39:23 | Step "eu digito o PIN da massa" inicia (PIN 9898, dígito a dígito) |
| ~07:39:27 | Clique no botão **Confirmar** — **1 único clique** (guard anti-duplo-clique da suíte) |
| **07:39:33** | **Transação `INVOICE_PAYMENT` de −R$ 6.813,59 GRAVADA no banco** (6–10s após o clique) |
| ~07:40:00 *(inferido)* | Proxy Vite corta a conexão → alerta `ECONNRESET` renderizado na UI |
| 07:41:03 | Teste falha após esperar 60s: `[PIN] Modal de PIN não fechou 60s após digitar o PIN: o botão de finalizar foi clicado (1×) e o modal permaneceu aberto` |
| — | Resultado da suíte: **4 passed / 1 failed** — CT03.2–05 passaram no MESMO endpoint/tela → falha **intermitente** (depende de carga/estado), não determinística |

## Evidência 1 — Alerta exibido na UI (snapshot do Playwright, `error-context.md`)

Capturado no instante da falha, com o modal de PIN ainda aberto e o valor correto nele:

```yaml
- generic:
  - heading "Confirmar Pagamento da Fatura"
  - paragraph: "Digite seu PIN transacional para confirmar o pagamento de R$ 6.813,59."
  - button "Confirmar"
- alert "Notificação de erro":
  "Não foi possível falar com a API (ECONNRESET). A operação pode NÃO ter sido
   processada — confira antes de tentar de novo."
```

A mensagem vem do **handler de erro do proxy do Vite** (`F:\GITHUB\FintechBankApp\WEB\vite.config.ts`,
bloco `proxy.on('error')`), que responde `502` com `{ success: false, code: 'API_UNREACHABLE', message: ... }`.

## Evidência 2 — Pagamento gravado no banco (Postgres `fintechbank`)

Consulta feita minutos após a execução (SELECT only):

```
fintech.transactions (CPF 15607750841):
  2026-09-22 07:39:33 | INVOICE_PAYMENT | "Pagamento fatura" | -6813.59

fintech.users:
  balance                     8363.76 → 1550.17   (−6813.59 ✓ exato)
  credit_card_available_limit  889.67 → 7703.26   (+6813.59 ✓ exato)
  account_status               'adimplente'
```

A matemática fecha **ao centavo** com o valor exibido no modal (R$ 6.813,59). Ou seja: toda a
escrita do `pay()` foi persistida — apenas a resposta se perdeu.

## Evidência 3 — Instabilidade do processo da API (mesma manhã)

Durante a investigação (≈08:00–08:10):

- 07:5x — API escutando em `:3001` sob PID **28596**;
- ~08:05 — PID 28596 **inexistia mais**; `:3001` sob PID **19864, criado às 08:02:41**;
- Vite (`:3000`, PID 14520) no ar ininterruptamente desde 21/09 10:11 — quem morre/reinicia é a **API**.

Em `F:\GITHUB\FintechBankApp\API\index.cjs` (linhas 40–48):

```js
process.on('unhandledRejection', (erro) => registrarCrash('unhandledRejection', erro));
process.on('uncaughtException', (erro) => {
    registrarCrash('uncaughtException', erro);
    process.exit(1);   // ← qualquer exceção derruba respostas em voo
});
```

`registrarCrash` escreve só no **stdout do terminal** — os arquivos `*.log` da API estão parados
desde julho, então o stack trace do crash não fica registrado em arquivo para auditoria.

## Cadeia completa do erro

| # | Etapa | Arquivo |
|---|---|---|
| 1 | WEB chama `POST /api/cards/invoice/pay` pelo proxy Vite (`:3000` → `:3001`) | `WEB/services/api.ts` → `payCreditCardInvoice` |
| 2 | API valida PIN/saldo, grava `INVOICE_PAYMENT`, `balance`, `limit`, `billing_charges`, notificação | `API/src/controllers/invoiceController.js` → `pay()` (branchs parcial ~900–1000 / total ~1041–1130) |
| 3 | **Depois de gravar e ANTES de responder**, o controller ainda executa: `enrichUserCreditCardData` (montagem do `user` fresco), envio de comprovante PDF/Telegram, SSE, `refreshAccountStatus` | mesmo arquivo |
| 4 | Enquanto isso, a conexão cai — por **um dos dois mecanismos abaixo** — e o proxy devolve `502 API_UNREACHABLE (ECONNRESET)` | `WEB/vite.config.ts` (timeout/proxyTimeout `30000` + `proxy.on('error')`) |
| 5 | No catch, a UI mostra o alerta e **não fecha o modal de PIN** (só fecha no branch `res.success`); oferece "Tentar novamente" | `WEB/components/Invoices/InvoicesAllureView.tsx` → `handleConfirmPassword` (~linha 239) |
| 6 | Suíte espera 60s por fechamento do modal (1 clique, nunca re-clica) e falha com causa explícita | `poc-fintech-playwright/tests/pages/components/PinModalComponent.ts:103–119` |

### Mecanismos possíveis do corte (passo 4)

**A) Processo da API morre entre a gravação e a resposta** (mais consistente com o timing desta
execução: banco gravado aos ~6–10s, bem antes do timeout de 30s do proxy):
qualquer `uncaughtException` dispara `process.exit(1)` (`API/index.cjs:46–48`) e mata o socket
→ `ECONNRESET` no proxy → 502. A instabilidade observada (Evidência 3) mostra a API morrendo e
renascendo na própria manhã do teste. Candidatos a origem da exceção: envio do comprovante
(PDF/Telegram), SSE, enrich — tudo executado dentro do request, após a escrita.

**B) Resposta ultrapassa `proxyTimeout: 30000` do Vite** (`F:\GITHUB\FintechBankApp\WEB\vite.config.ts`):
o `pay()` faz trabalho pesado pós-gravação antes do `res.json()`; o próprio comentário do
`PinModalComponent.ts` (linha ~100, ajuste de 21/09/2026) registra que o
`enrichUserCreditCardData` "ainda pode passar de 30s sob carga (volume de dados de teste
acumulado)". O cliente de teste foi esticado para 60s, **mas o proxy corta aos 30s** — o corte
acontece antes de qualquer espera do teste terminar. Timeout do http-proxy também se manifesta
como `ECONNRESET` no handler de erro.

## Correções sugeridas (em ordem de prioridade)

1. **API — responder cedo (fix raiz, ataca os dois mecanismos):** em `pay()`, persistir tudo que
   é pagamento e enviar `res.json()` **imediatamente**; mover para *depois* da resposta
   (fire-and-forget com `.catch()`, como já é feito com `sendPaymentReceipt`):
   `enrichUserCreditCardData`, notificações, comprovante, SSE. O `user` fresco para a UI pode ser
   buscado pelo front no `getUserByCpf` subsequente (que hoje já existe como fallback em
   `InvoicesAllureView.handleConfirmPassword`).
2. **API — idempotência real no endpoint:** `Idempotency-Key` (header) ou `idempotencyKey` no body
   com tabela de deduplicação + unique constraint; request repetida retorna o resultado da 1ª.
   Detalhado em `docs/BUG-REPORT-IDEMPOTENCIA-INVOICE-PAY.md`. **Enquanto isso não existir, o
   botão "Tentar novamente" desta tela é uma armadilha de dupla cobrança.**
3. **API — estabilidade/observabilidade:** avaliar degradar `uncaughtException` de `exit(1)` para
   log + continuar (ou isolar as operações pós-gravação em workers/filas); persistir
   `registrarCrash` em **arquivo** (com timestamp + stack) e não só no stdout, para permitir
   correlacionar crash × request perdida.
4. **WEB — retry consciente do estado:** no catch `API_UNREACHABLE` de
   `InvoicesAllureView.handleConfirmPassword`, antes de oferecer "Tentar novamente", reconsultar
   `getUserByCpf`: se a fatura já estiver quitada (ou o valor pago registrado), mostrar
   **sucesso** com o comprovante em vez de erro. Retry cego hoje = risco de dupla cobrança.
5. **WEB (paliativo):** subir `timeout`/`proxyTimeout` do proxy Vite (> 60s) — elimina o corte
   do mecanismo B durante o enrich lento, mas **não** protege contra o mecanismo A (crash) nem
   corrige a raiz.
6. **WEB — UX do modal:** no erro, o modal de PIN deveria fechar (ou ao menos refletir um estado
   "indeterminado — verifique o extrato"), já que manter aberto induz o usuário a re-digitar o
   PIN e re-submeter.

## Como reproduzir / discriminar os mecanismos

1. Executar `npm run test:ct03.1` (poc-fintech-playwright) com a massa CT03.1 válida.
2. Se o modal travar com o alerta ECONNRESET: **não re-clicar**; consultar o banco
   (`fintech.transactions` do CPF) — o pagamento estará lá.
3. Para separar A de B: com o terminal da API visível no momento do teste, um crash imprime o
   stack e reinicia o processo (mecanismo A); se nada cair e a resposta chegar após ~30s, foi o
   `proxyTimeout` (mecanismo B). Alternativa: subir o `proxyTimeout` para 90s e reexecutar —
   se o erro sumir, era B; se persistir com o processo reiniciando, é A.

## Contexto do teste que revelou o bug

- Suíte: `poc-fintech-playwright` (Playwright + playwright-bdd), cenário **CT03.1** —
  `Consultar faturas e pagar o valor total`, projeto `bdd-headed`, execução de 22/09/2026 07:38–07:46
  (8min, 4 passed / 1 failed).
- O cliente de teste clicou **Confirmar exatamente 1 vez** (guard anti-duplo-clique do
  `PinModalComponent` — introduzido após o incidente CT03.3 de débito duplo) e, ao perceber o
  modal travado, **falhou explicitamente sem re-submeter** — comportamento correto: pagamento não
  efetivado é recuperável; débito duplicado não.
- Log completo da execução: `%TEMP%\ct03_debug.log`; snapshot do erro:
  `test-results/tests-features-faturas.fea-...-valor-total-bdd-headed/error-context.md`;
  evidência visual: `evidences/consultar_faturas_e_pagar_o_valor_total_1790073664987.docx`.
- **Atenção ao checkout do app:** o WEB/API servindo `localhost:3000/3001` roda a partir de
  `F:\GITHUB\FintechBankApp` (confirmado via CommandLine do processo `vite`), **não** da cópia
  `A:\Workspace\FintechBankApp`. Corrigir no checkout certo.
