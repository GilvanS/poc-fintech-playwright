# Plano para Geração de Massas 5.0

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) ou superpowers:executing-plans para implementar sub-partes se solicitado.

**Goal:** Reformular o gerador e consertador de massa para que utilize 100% dos *motores naturais* (controllers) da API durante o seed/injestão e adicione checagens rigorosas que impedem "massas estragadas" antes das auditorias, priorizando QUALIDADE sobre VELOCIDADE, para não congestionar a UTI de massas da aplicação.

**Architecture:** Mover de uma geração superficial (inserts cruzados sem lógica de negócio) via `scripts` puros para injeção Headless em API/Service. Implementar um Orquestrador (Migration + Seeder) que chama instâncias das engines oficiais (`invoiceController`, `adminUsersController`, `transactionController`) em vez de dar INSERT cego na base, assegurando integridade de ciclos de faturamento e parcelamentos (planos e INVOICE_INSTALLMENT corretamente atados).

**Tech Stack:** Node.js, Postgres PG, JavaScript ES6 (`pg`, API controllers internos).

**Spec:** Baseado na anomalia de transações que injetam `INVOICE_INSTALLMENT` mas esquecem o `installment_plans` (erro histórico em script puro).

## Global Constraints
- Nenhuma correção deve usar `DISABLE TRIGGER`. (Será substituído por bypasses seguros como `SET session_replication_role` ou uso de APIS legitimas).
- Os CPFs gerados em `gerador-massa-unificado` continuam lá.
- Todas as compras simuladas precisam transitar pela `business logic` real de cartões.

---

### Task 1: Refatorar Script de Simulação de Compras/Parcelamento
**Files:**
- Create: `API/scripts/gerar_massa_qualidade.cjs`

**Interfaces:**
- Consumes: Arquivo CPF CSV ou Argumento por linha de comando.
- Produces: Ciclo de fatura completo chamando funções `admin_card_purchase_open` garantindo tabela `installment_plans`.

- [ ] **Step 1: Instanciar Engines ao invés de Queries**
Importar instâncias existentes do `adminUsersController.js`.
Garantir que a função `adminCardPurchaseOpen` está refatorada ou adaptada para criar o respectivo plano na tabela `fintech.installment_plans`.

- [ ] **Step 2: Adicionar Integração Transação <-> Plano**
Atualmente a rota `adminUsersController.js` para INVOICE_INSTALLMENT (linhas 700-726) só injeta as transações filhas na tabela.
É OBRIGATÓRIO (para fugir do Anomalia 5) registrar a cabeça da cobra (o registro do TIPO_PARCELAMENTO no banco para justificar ela).
O script novo chamará uma Factory que grava em `installment_plans` `id, cpf, purchase_tx_id, ...` e suas tabelas filhas `transactions`.

### Task 2: Auditoria Profilática antes do "Nascimento" (Pre-Flight Check)
**Files:**
- Modify: `API/scripts/populate_cemiterio_teste.cjs` (substituir ou adaptar) ou onde o BDD insere a massa no banco.

- [ ] **Step 1: Rodar Auditoria de Transações Órfãs Locais**
No momento de "nascer" a massa pro Playwright, em vez de deixar ela crua, invoque a rotina importada do `services/dailyAudit.js` (especificamente `checkOrphanInstallments()`) apenas para aquele CPF.
Se estourar um array de erro, a massa deve logar erro e REVERT do seed, não entregando-a pra frente.

### Task 3: Contornar Imutabilidade Sem Destruição de Segurança (Bypass Correto)
**Files:**
- Modify: `API/scripts/fix_orphan_payment_step7.cjs` e todas ferramentas de UTI.

- [ ] **Step 1: Alterar o bypass das triggers**
Substituir todas as sintaxes de segurança `ALTER TABLE fintech.invoices DISABLE TRIGGER trg_invoices_immutable_when_closed` pelo escopo mais fechado: `SET session_replication_role = 'replica';` dentro do bloco BEGIN/COMMIT se precisar persistir curas nos legados, já que o Claude Code proíbe alteração em Triggers globais para evite desastres. 

### Task 4: Atualização BDD p/ Alertas Críticos (Nova Regra de Limites)
**Files:**
- Modify: `WEB/components/Admin/AuditSection.tsx` ou similar para hospedar os ícones.

- [ ] **Step 1: O Frontend e Motor absorvem Ícones Visuais**
Fazer o Push Notification carregar os emojis propostos: `🏥 ✅` pra UTI e cálculo livre da % residual do encargo nos popups de Faturas Mínimas ou Críticas.