# Bug Report — Sucesso falso na janela de idempotência: pagamento respondido como sucesso sem débito (CT03.2)

| Campo | Valor |
|---|---|
| **Componente** | FintechBankApp — API (`invoiceController.pay`, guarda de idempotência do branch parcial) + WEB (`InvoicesAllureView.handleConfirmPassword`) |
| **Endpoint** | `POST /api/cards/invoice/pay` (`API/src/controllers/invoiceController.js`) |
| **Severidade** | **Alta** — a API responde sucesso para um pagamento que NÃO foi debitado; cliente e testes não conseguem distinguir débito novo de reenvio ignorado |
| **Reportado por** | Suíte E2E poc-fintech-playwright — CT03.2 (pagamento mínimo), 8 execuções |
| **Data** | 25/09/2026 |
| **Bugs relacionados** | `docs/BUG-REPORT-ECONNRESET-PAGAMENTO-EFETIVADO.md` (sucesso falso-negativo), `docs/BUG-REPORT-IDEMPOTENCIA-INVOICE-PAY.md` (débito duplo — esta guarda é a mitigação daquele) |

> **Nota de revisão (25/09/2026):** a primeira versão deste relatório sugeria exibir o saldo
> devedor (residual da cascata) no card da fatura fechada e realocar o lançamento do pagamento
> para a fechada. **Ambas as sugestões foram CANCELADAS**: a imutabilidade da fatura fechada é
> **regra de negócio mundial** — o extrato fechado não se altera, em nenhuma tela e sob nenhuma
> forma (nem valor original, nem saldo, nem linha informativa). O app já calcula e expõe o
> saldo devedor corretamente em `closedInvoiceResidual`, consumido pela fatura aberta e pelo
> painel admin. O defeito real evidenciado pela investigação é outro: **a janela de
> idempotência descarta pagamentos respondendo sucesso**, indistinguível de um débito novo.

## Resumo

No CT03.2 (pagamento do **mínimo** da fatura **fechada**), 8 execuções em 2 massas mostraram o
comportamento do app ponta a ponta. O backend funciona conforme desenhado: debita o saldo,
grava 1 transação `INVOICE_PAYMENT`, restaura o limite e a dívida real da fatura fechada cai
por **cascata derivada na leitura** (mais antiga primeiro). O card da fatura fechada continuar
mostrando o **valor original** é **regra de negócio preservada** — não é defeito.

O defeito está na **guarda de idempotência de 90s** (proteção contra dupla cobrança do bug
irmão): quando chega um pagamento de mesmo cpf+valor dentro da janela, ela **não debita, não
grava transação e não gera lançamento — mas responde `success: true`** (com `idempotent: true`
no payload, que o front ignora). Na prática observada, **2 de 8 pagamentos foram descartados
assim** (runs 3 e 5 da massa 1), e nem a UI nem a suíte perceberam: o teste chegou a logar
`encargos embutidos no pagamento: R$ 51.95` — na verdade era ausência de débito.

**Estado real da dívida (derivada no banco) ao fim das execuções** — prova de que a baixa
funciona quando o débito acontece:

- Massa 1 (CPF 46945365409): dívida real 519,51 → **311,71** (4 débitos × 51,95 = 207,80).
- Massa 2 (CPF 34310951783): dívida real 546,84 → **364,56** (3 débitos × 60,76 = 182,28).
- Em ambos, o card da fechada segue mostrando o valor original (519,51 / 607,60) — **correto
  pela regra de imutabilidade**.

Contradição central: **a API diz "sucesso" para um pagamento que não debitou nada — e nem o
usuário nem a suíte têm como saber.**

## Reprodução em números

### Massa 1 — CPF 46945365409 (5 rodadas em sequência, 22:31–22:37, intervalos 55–66s)

| Run | Fatura FECHADA (UI) | Fatura ABERTA (UI) | Limite antes → depois | Δ Limite | Débito real | Tx gravada |
|---|---|---|---|---|---|---|
| 1 | R$ 519,51 | R$ 481,10 | 19.148,04 → 19.199,99 | +51,95 | −51,95 | ✅ 01:32:05 |
| 2 | R$ 519,51 | R$ 429,15 | 19.199,99 → 19.251,94 | +51,95 | −51,95 | ✅ 01:34:02 |
| 3 | R$ 519,51 | R$ 377,20 | 19.251,94 → 19.251,94 | **+0,00** | **−0,00** | ❌ **não gravada** |
| 4 | R$ 519,51 | R$ 377,20 | 19.251,94 → 19.303,89 | +51,95 | −51,95 | ✅ 01:36:17 |
| 5 | R$ 519,51 | R$ 325,25 | 19.303,89 → 19.303,89 | **+0,00** | **−0,00** | ❌ **não gravada** |

- Fatura fechada imutável nas 5 rodadas — **comportamento correto** (regra de negócio).
- Runs 3 e 5: **nenhum débito** (guarda de idempotência), mas resposta `success: true` → a UI
  exibiu sucesso e o teste passou como se o pagamento tivesse ocorrido.
- Nas runs com débito, a fatura aberta baixa ~51,95 por rodada (481,10 → 325,25): o app exibe
  o efeito do pagamento parcial no total da aberta (que herda encargos/saldo por design) — o
  valor permanece coerente com a dívida real caindo.

### Massa 2 — CPF 34310951783 (3 rodadas com 100s de intervalo, fora da janela, 23:18–23:24)

| Run | Fatura FECHADA (UI) | Fatura ABERTA (UI) | Limite antes → depois | Δ Limite | Débito real |
|---|---|---|---|---|---|
| 1 | R$ 607,60 | R$ 652,20 | 9.463,79 → 9.524,55 | +60,76 | −60,76 |
| 2 | R$ 607,60 | R$ 591,44 | 9.524,55 → 9.585,31 | +60,76 | −60,76 |
| 3 | R$ 607,60 | R$ 530,68 | 9.585,31 → 9.646,07 | +60,76 | −60,76 |

- Com intervalo acima dos 90s, **todas as rodadas debitaram** — confirmando que a janela de
  idempotência é o gatilho dos descartes da massa 1 (e não instabilidade da API).

## Evidência 1 — Banco (Postgres `fintechbank`, SELECT only)

**CPF 46945365409** — faturas FECHADA em aberto (card mostra 519,51 = 404,06 + 115,45):

```
fintech.invoices:
  4e7739a6... due 2026-08-05 | status FECHADA | valor_total 404.06 | valor_pago 0.00
  0ac5da6b... due 2026-09-06 | status FECHADA | valor_total 115.45 | valor_pago 0.00

fintech.transactions (INVOICE_PAYMENT):
  2026-09-26 01:32:05 | -51.95 | "Pagamento minimo de fatura" | invoice_id 0ac5da6b...
  2026-09-26 01:34:02 | -51.95 | "Pagamento minimo de fatura" | invoice_id 0ac5da6b...
  2026-09-26 01:36:17 | -51.95 | "Pagamento minimo de fatura" | invoice_id 0ac5da6b...
  (runs 22:34 e 22:37: SEM transação)

fintech.users: balance 11471.30 | limite 19303.89 | status 'adimplente'
```

Dívida real derivada (cascata `planDistribution`; pago = `ABS(amount) − applied_to_charges`):
**207,80 pagos → 311,71 devedor** (de 519,51). ✔ backend consistente.

**CPF 34310951783** — 1 fatura FECHADA (607,60): cascata **243,04** (3 novas + 1 antiga de
17/08) → **364,56 devedor**. ✔ consistente.

## Evidência 2 — O código (onde está o defeito e onde está o design correto)

`API/src/controllers/invoiceController.js`:

1. **Guarda de idempotência (defeito de comunicação):**
   ```js
   if (pagamentoRecenteIgual.length > 0) {
       console.warn(`[pay][idempotencia] ... reenvio ignorado, NÃO cobrando de novo.`);
       ...
       return res.json({ success: true, idempotent: true,
           message: 'Pagamento já processado.', amountPaid: payAmount, user: freshUserIdem });
   }
   ```
   `success: true` + `amountPaid: payAmount` para um pagamento **não debitado**. O flag
   `idempotent: true` existe no payload, mas o front (`InvoicesAllureView`) trata a resposta
   como sucesso genérico — o usuário vê a mesma tela de "pago" que veria num débito real.
   O `amountPaid` ainda por cima informa o valor NÃO pago.
2. **Trade-off da janela fixa de 90s (comentário do próprio código):** *"dois pagamentos
   legítimos de valor idêntico em menos de 90s são tratados como reenvio — para pagamento de
   fatura, esse é o lado seguro do erro."* O lado seguro contra dupla cobrança criou o
   sucesso falso: para o mínimo mensal (valor recorrente), dois pagamentos legítimos de mesmo
   valor em <90s são plausíveis (ex.: operador reprocessando, cliente pagando mínimo e depois
   completando o mesmo valor).
3. **Design correto preservado (não alterar):** `summary(type=fechada)` exibe o valor
   ORIGINAL (`_closedInvoiceValorTotal`) — *"a fatura fechada nunca altere seu valor após
   pagamento parcial"*; `closedInvoiceResidual` (saldo devedor real) já é calculado e exposto
   pelo enrich (`index.cjs`), consumido pela fatura aberta/`InvoiceSummarySheet`/admin.
   Imutabilidade mantida: card da fechada 519,51/607,60 do início ao fim, com a dívida real
   caindo no banco.
4. **Log enganoso para quem observa:** o `console.warn` `[pay][idempotencia]` vai só para o
   stdout da API; no lado WEB/suíte não há sinal nenhum além de um sucesso idêntico ao real.

## Cadeia completa do comportamento observado

| # | Etapa | Arquivo |
|---|---|---|
| 1 | Teste paga o mínimo → `pay()` valida saldo, grava 1 transação, debita, restaura limite | branch parcial do `pay()` |
| 2 | Pagamento de mesmo cpf+valor em <90s → guarda **não debita/não grava** e responde `success: true, idempotent: true` | guarda de idempotência do `pay()` |
| 3 | Front trata `success` genérico → exibe confirmação de pagamento indistinguível do débito real | `InvoicesAllureView.handleConfirmPassword` |
| 4 | Dívida real da fechada cai por cascata derivada na leitura (só quando houve débito) | `getClosedInvoiceDebt` + `utils/invoiceMath.js` |
| 5 | Card da fechada segue com o valor original (regra de imutabilidade) — dado de extrato, não de saldo | design intencional, preservado |
| 6 | Suíte valida por cruzamento Limite/Aberta; sem débito, `encargos embutidos` mascara o descarte | `faturas.steps.ts` / `FaturasPage.ts` |

## Impacto

- **Cliente**: a API confirma um pagamento que não aconteceu. O cliente acredita ter pago o
  mínimo; os encargos continuam acumulando sobre o residual e o risco de negativação/cobrança
  permanece — pior do que um erro explícito, porque a falsa certeza impede a ação.
- **Operação/suporte**: sem sinal no lado WEB, o suporte não consegue distinguir "pagou e o
  front engoliu" de "não pagou"; o único rastro é o stdout da API.
- **Monitoramento/testes**: qualquer verificação que confie no 2xx (como o CT03.2 fez) é
  cega ao descarte — 2 de 8 pagamentos da amostra passaram por isso.
- **Não é impacto**: o valor da fatura fechada não mudar na UI é regra de negócio correta e
  permanece; a dívida real cai no backend quando o débito ocorre.

## Correções sugeridas (em ordem de prioridade)

1. ✅ **IMPLEMENTADO (26/09/2026) — API — resposta do reenvio ignorado inequívoca**: a guarda
   foi mantida (proteção contra dupla cobrança) e a resposta agora é
   `success: true, idempotent: true, debitado: false, amountPaid: 0, paymentId: <id da tx
   original>, originalPaymentDate` + mensagem "Pagamento já processado — nenhum novo débito
   foi realizado.". Verificado ao vivo: 2 requisições idênticas em <2s → 1ª debita
   (`idempotent: false, amountPaid: 10`), 2ª é descartada com o payload novo
   (`debitado: false, amountPaid: 0, paymentId` preenchido).
   `API/src/controllers/invoiceController.js` (guarda de idempotência do branch parcial).
2. ✅ **IMPLEMENTADO (26/09/2026) — WEB — `idempotent: true` tratado distinctamente**: em
   `InvoicesAllureView.handleConfirmPassword`, resposta idempotente fecha o modal de PIN,
   revalida o usuário e exibe toast informativo "Pagamento já processado (data/hora) — nenhum
   novo valor foi debitado" — sem o modal de "Pagamento realizado" com o valor (que fingia
   débito novo). Tipo de retorno de `payCreditCardInvoice` estendido com os campos novos
   (`idempotent/debitado/amountPaid/originalPaymentDate`).
3. **API — reavaliar a janela/chave de idempotência**: 90s fixa por cpf+valor descarta
   pagamentos legítimos recorrentes (mínimo igual mês a mês, reprocessamento operacional).
   Alternativas: exigir `Idempotency-Key` explícita do front (retry só com a mesma key),
   ou janela menor + confirmação secundária para segundo pagamento de mesmo valor.
4. **API — coerência do payload**: não retornar `amountPaid: payAmount` num pagamento não
   debitado (hoje induz qualquer consumidor a erro); alinhar todos os campos ao fato real.
5. ✅ **IMPLEMENTADO (26/09/2026) — Suíte (poc-fintech-playwright) — assert de dívida
   derivada**: o step "eu capturo os valores das faturas antes do pagamento" agora lê
   `closedInvoiceResidual` (dívida derivada) via API (:3001, mesmo padrão do Pix) e o Then
   "devo ver o total das faturas diminuído após o pagamento" (família parcial) asserta que a
   dívida caiu **exatamente o valor pago** — sem débito, o teste falha com causa explícita
   apontando a guarda de idempotência. Rodada de validação: dívida 757,20 → 681,48 (queda
   75,72 = pago) e `1 passed`. Sem captura prévia ou sem API, falha explícita (sem fallback
   silencioso), na convenção do repo.

**Fora de escopo (regra de negócio):** qualquer alteração de exibição da fatura fechada.
O valor original permanece imutável em todas as telas — não é lacuna, é regra.

## Como reproduzir

1. `npm run test:ct03.2` (poc-fintech-playwright) com massa CT03.2 válida (fechada > 0).
2. Rodar 2× com **menos de 90s** entre o clique de confirmar de uma run e da próxima
   (pagamento de mesmo valor, mesmo CPF): a 2ª run responde sucesso na UI, **sem** transação
   no banco (limite não restaura, aberta não baixa).
3. Rodar com intervalo > 90s: todas as rodadas debitam — isola a janela de idempotência como
   gatilho.
4. Verificação (SELECT only): transações `INVOICE_PAYMENT` do CPF + dívida derivada por
   cascata; script pronto em `F:\GITHUB\FintechBankApp\API\debug_allocacao_ct032.js`.

## Contexto do teste que revelou o comportamento

- Suíte: `poc-fintech-playwright` (Playwright + playwright-bdd), cenário **CT03.2** —
  "Consultar faturas e pagar o valor mínimo", projeto `bdd-headed`.
- **Massa 1** (aba `tbl_de_massas` do `MassaDados.xlsx`, ID_MASSA 0095 — CPF 46945365409):
  5 execuções em sequência, 25/09/2026 22:31–22:37, **5 passed** (2 sem débito real).
- **Massa 2** (TBL_CENARIOS linha CT03.2 — CPF 34310951783): 3 execuções com 100s de
  intervalo, 23:18–23:24, **3 passed** (todas com débito).
- Logs: `output/ct03_run_1..5.log` (massa 1) e `output/ct032_massa2_run1..3.log` (massa 2).
- Evidências DOCX: `evidences/consultar_faturas_e_pagar_o_valor_m_nimo_*.docx`.
- Script de diagnóstico no banco (SELECT only): `F:\GITHUB\FintechBankApp\API\debug_allocacao_ct032.js`.
- **Atenção ao checkout do app:** WEB/API servindo `localhost:3000/3001` rodam a partir de
  `F:\GITHUB\FintechBankApp`. Corrigir lá.

## Revalidação pós-correção (26/09/2026)

Duas baterias executadas com as correções 1, 2 e 5 já em produção no checkout
`F:\GITHUB\FintechBankApp` (WEB :3000 / API :3001). Em ambos os dias a suíte rodou com o
app servindo do F:; a cópia `A:\Workspace\FintechBankApp` está desatualizada (sem a guarda)
e não participou dos testes.

### Bateria A — 6 execuções puras, débito em todas (massa 3: CPF 824.995.726-12)

Fatura fechada R$ 1.338,01 (imutável na UI em todas as rodadas); mínimo = 10% → **R$ 133,80**.
Intervalos naturais entre cliques de ~100–116s (fora da janela de 90s). **6/6 passed.**

| Run | Tx INVOICE_PAYMENT (hora local) | Card FECHADA (UI) antes → depois | Limite Disponível antes → depois | Dívida derivada (API) antes → depois | Débito |
|---|---|---|---|---|---|
| 1 | 07:45:46 | 1.338,01 → 1.338,01 | 12.297,82 → 12.431,62 (+133,80) | 1.338,01 → 1.204,21 (−133,80) | ✅ |
| 2 | 07:47:42 | 1.338,01 → 1.338,01 | 12.431,62 → 12.565,42 (+133,80) | 1.204,21 → 1.070,41 (−133,80) | ✅ |
| 3 | 07:49:26 | 1.338,01 → 1.338,01 | 12.565,42 → 12.699,22 (+133,80) | 1.070,41 → 936,61 (−133,80) | ✅ |
| 4 | 07:51:14 | 1.338,01 → 1.338,01 | 12.699,22 → 12.833,02 (+133,80) | 936,61 → 802,81 (−133,80) | ✅ |
| 5 | 07:53:02 | 1.338,01 → 1.338,01 | 12.833,02 → 12.966,82 (+133,80) | 802,81 → 669,01 (−133,80) | ✅ |
| 6 | 07:54:46 | 1.338,01 → 1.338,01 | 12.966,82 → 13.100,62 (+133,80) | 669,01 → 535,21 (−133,80) | ✅ |

Prova no banco (`debug_allocacao_ct032.js 82499572612`): **6 transações −133,80**, uma por
run, nenhuma descartada. Card da fechada imutável do início ao fim (regra preservada).
Logs: `output/ct032_v2_run1..6.log`.

### Bateria B — reenvio dentro da janela de 90s, agora detectável e honesto (massa 4: CPF 875.888.466-15)

Fatura fechada R$ 1.286,75; mínimo = **R$ 128,68**. O intervalo natural entre cliques da
suíte (~100s+) fica FORA da janela de 90s — para disparar a guarda de forma determinística,
o pagamento ORIGINAL foi injetado via API (`POST /cards/invoice/pay`) e o reenvio veio pela
UI (suíte ou script) segundos depois.

| Etapa | O que aconteceu | Evidência |
|---|---|---|
| Run 1 (UI pura) | Débito real −128,68; dívida derivada 1.286,75 → 1.158,07; **passed** | Tx 08:10:20 no banco; `output/ct032_idem_run1.log` |
| Run 2 (injeção API + clique UI em <90s) | Guarda descartou o reenvio da UI: Limite subiu +0,00 e a suíte **falhou com causa explícita**: `[Dívida não baixou o valor pago] Dívida fechada derivada: R$ 1029.39 → R$ 1029.39 (queda R$ 0.00), esperado R$ 128.68` — antes do fix, este cenário passava como sucesso falso | `output/ct032_idem_run2.log`; banco ficou com apenas 2 txs (08:10:20 UI + 08:13:24 injeção) |
| Verificação do TOAST (`scripts/validar-toast-idempotencia.ts`) | UI parada no modal de PIN → injeção via API → PIN digitado: **toast informativo exibido**: "Este pagamento já havia sido processado (26/09/2026, 08:37:19) — nenhum novo valor foi debitado. Confira o extrato para conferir o lançamento."; modal "Pagamento realizado com sucesso!" **não apareceu**; histórico de pagamentos cresceu exatamente 1 (só a injeção); residual 772,03 → 643,35 (queda = valor da injeção) | `output/toast-idempotencia.png`; execução com exit 0 |

**Conclusão da revalidação:** a tríade API (resposta `idempotent/debitado:false`) + WEB
(toast, sem modal falso) + suíte (assert de dívida derivada) funciona de ponta a ponta:
débito real é confirmado, reenvio é descartado **sem transação** e com sinal inequívoco para
o usuário. Falha da suíte no reenvio é o comportamento desejado (sem sucesso falso).
Nota: as injeções da Bateria B são débitos REAIS e legítimos no banco (4 × 128,68 no total,
registrados em `paymentHistory`); a massa 4 segue utilizável com residual 643,35.

**Verificação determinística do toast:** automatizada como cenário BDD permanente
`@CT03.6` (faturas.feature, poc-fintech-playwright) — `npm run test:ct03.6`. Leva a UI até
o modal de PIN antes de injetar o pagamento original via API (elimina a corrida dos 90s),
valida o toast visível, a ausência do modal falso e que o histórico de pagamentos cresceu
exatamente 1. (O script one-off `scripts/validar-toast-idempotencia.ts` que fez a primeira
verificação foi removido — o cenário cobre o mesmo fluxo.)
