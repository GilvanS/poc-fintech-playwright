# Bug Report — Ausência de idempotência em `POST /cards/invoice/pay`

| Campo | Valor |
|---|---|
| **Componente** | API do FintechBankApp (`invoiceController.pay`) |
| **Endpoint** | `POST /api/cards/invoice/pay` (`API/src/routes/invoice.routes.js:22` → `API/src/controllers/invoiceController.js:582`) |
| **Severidade** | **Alta** (débito duplo de cliente em produção) |
| **Reportado por** | Suíte E2E poc-fintech-playwright — família CT03 (pagamento de faturas) |
| **Data** | 15/09/2026 |

## Resumo

O endpoint de pagamento de faturas **não possui nenhum mecanismo de idempotência**. Uma mesma
requisição de pagamento enviada duas vezes (duplo clique, retry de rede, re-submit de teste) é
processada **duas vezes**, debitando o saldo do cliente duas vezes. Nosso cenário E2E induziu
esse estado e a API aceitou o 2º pagamento **sobre uma fatura já quitada**, levando o residual
da fatura a **valor negativo**.

## Evidência (execução real, CT03.3)

Pagamento parcial de **R$ 3.667,39** submetido 2× por defeito no cliente de teste (duplo clique
em "Confirmar"):

| Dado no banco | Antes | Depois | Esperado |
|---|---|---|---|
| `balance` | R$ 14.669,55 | R$ 7.334,77 | R$ 11.002,16 |
| Débito total | — | **R$ 7.334,78 = 2 × R$ 3.667,39 exato** | R$ 3.667,39 |
| `closedInvoiceTotal` | R$ 3.870,86 | R$ 0,00 | R$ 203,47 |
| Residual | R$ 3.870,86 | **−R$ 3.463,92** (negativo) | ≥ 0 |

O 2º pagamento foi aceito mesmo com a fatura já quitada: o excedente virou "saldo credor"
negativo no residual — e esse comportamento de no-cap é **intencional** no código (ver abaixo),
o que amplifica o impacto do double-submit.

## Análise do código (`invoiceController.js`, função `pay`, linhas 582–721)

1. **Sem chave de idempotência**: o handler lê apenas `{ cpf, pin, amount }` (linha 583).
   Não existe header `Idempotency-Key` nem campo equivalente no payload.
2. **ID de transação não é dedup**: `payId` é um **UUID novo gerado por request**
   (`dbService.generateUUID()`, linha 120 dentro de `persistPaymentDistribution`) — cada
   submissão cria uma transação `INVOICE_PAYMENT` distinta, sem qualquer verificação de
   duplicidade.
3. **Únicos guards pré-pagamento**:
   - `totalDue <= 0` → 400 "Nenhuma fatura em aberto" (linha ~624);
   - `balance < payAmount` → 400 "Saldo insuficiente" (linha ~640).
   Nenhum deles impede **pagamento repetido sobre débito residual** enquanto houver saldo.
4. **No-cap intencional agrava**: comentário no código (linhas ~634–636): *"NÃO capar ao total
   devido: pagamento acima do devido é aceito e o excedente vira saldo credor
   (closedInvoiceResidual negativo)"*. Resultado: o 2º submit foi aceito integralmente e o
   residual foi a **negativo**, sem erro.
5. **Débito e escrita não são transacionais**: `persistPaymentDistribution` (INSERT) e
   `usersRepo.updateBalance` (UPDATE) são chamados em sequência, sem transação/lock — concorrência
   (double-submit quase simultâneo) também pode ler o mesmo `balance` e debitar 2× mesmo sem
   residual negativo.

## Reprodução mínima (curl)

```bash
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"cpf":"SEU_CPF","password":"SENHA"}' | jq -r .token)

BODY='{"cpf":"SEU_CPF","pin":"9898","amount":100.00}'

# 1ª chamada: 200, debita R$ 100,00
curl -s -X POST http://localhost:3001/api/cards/invoice/pay \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d "$BODY"

# 2ª chamada idêntica: TAMBÉM 200 e debita de novo (aqui está o bug)
curl -s -X POST http://localhost:3001/api/cards/invoice/pay \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d "$BODY"
```

Resultado observado: saldo debitado 2 × R$ 100,00; residual pode ficar negativo quando o 2º
pagamento excede o que resta devedor.

## Impacto

- **Financeiro direto**: débito duplicado na conta do cliente (nosso teste produziu
  **−R$ 3.463,92** de residual com débito duplo real).
- **Confiabilidade**: qualquer retry de rede/gateway/UX (duplo clique) pode multiplicar pagamentos.
- **Auditoria**: duas transações `INVOICE_PAYMENT` legítimas para uma única intenção de pagamento,
  sem forma de reconciliar qual é a "real".

## Recomendações (em ordem de prioridade)

1. **Idempotency-Key obrigatória** (padrão de mercado): aceitar header `Idempotency-Key`
   (ou campo `idempotencyKey` no body); persistir em tabela própria
   (`(key, cpf, request_hash, response_snapshot, created_at)`) com unique constraint; 2ª request
   com a mesma chave dentro da janela (ex.: 24h) retorna a resposta da 1ª sem reprocessar.
2. **Guard server-side de regra de negócio** (defesa em profundidade, mesmo com idempotência):
   rejeitar pagamento quando `totalDue <= 0` **após** considerar pagamentos já registrados na
   request corrente — e explicitamente **não aceitar** `payAmount > totalDue` sem flag
   deliberada (hoje o no-cap transforma qualquer duplicata em saldo credor negativo).
3. **Transação + lock de linha**: envolver leitura de saldo/débito e escritas
   (INSERT `INVOICE_PAYMENT` + UPDATE `balance`/`credit_card_available_limit`) em transação com
   `SELECT ... FOR UPDATE` no usuário, eliminando a janela de corrida de saldo.
4. **Constraint de sanidade**: impedir residual negativo (`closedInvoiceResidual >= 0`) em nível
   de banco ou validação central, tornando o estado "fatura paga e saldo credor negativo"
   impossível por construção.

## Contexto do teste que revelou o bug

- Suíte: `poc-fintech-playwright` (Playwright + BDD), cenário **CT03.3** — pagamento parcial com
  valor personalizado.
- O cliente de teste submetia o PIN com duplo clique em "Confirmar" (defeito nosso, já corrigido
  em `tests/pages/components/PinModalComponent.ts` — commit `14742ac`). Mesmo com o defeito do
  cliente, **a API não deveria processar o 2º pagamento** — é exatamente o papel da idempotência
  no servidor.
- Correção do lado do teste: clique único escopado ao modal + **nunca re-clicar** (modal aberto
  > 30s falha com causa explícita em vez de re-submeter).
