# Refatoração do Motor de Massas 5.0 e Painel de Acompanhamento (Todo List)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refatorar o orquestrador de geração de massas para usar os conectores oficiais da API de cartão ao invés de INSERTs cruzados em banco (priorizando qualidade sobre velocidade), acompanhado de um painel "Todo List" expansivo que empurra o conteúdo da tela para baixo validando a saúde da massa etapa por etapa em tempo real.

**Architecture:** 
- O frontend adotará uma expansão via CSS Flex/Grid (`Accordion`/`Collapsible` pattern) para o componente de Todo List das massas, evitando overlays/popups (`position: absolute/fixed`) e garantindo que o fluxo não sobreponha itens abaixo. 
- O backend (`MainMassCreatorFlow.tsx` ou equivalente que faz fetch nas apis de seed/mock) passa a orquestrar via polling as etapas (nascimento -> autorização do plano -> rodagem do ciclo -> auditoria pre-flight) refletidas em tempo real.

**Tech Stack:** React, Tailwind CSS, Node.js, PostgreSQL (API endpoints).

**Spec:** Baseado na anomalia `TRANSACAO_ORFA` da aplicação e requisito de UX "nada de popup, tem que empurrar para baixo, ver processo passo a passo".

## Global Constraints
- Nenhuma correção/script deve usar `DISABLE TRIGGER` ou manipulação destrutiva da segurança no banco de dados. Usar chamadas da API oficial ou bypass aceitável de testes via `session_replication_role`.
- Sem `absolute` position ou z-index no painel de Todo; usar flow do documento (layout em flex column).
- Exibir os ícones solicitados com claridade de progresso (🏥, ✅, ⚠️).

---

### Task 1: Refatorar MassCreationTodoSheet.tsx do Frontend (Sem Popup)

**Files:**
- Modify: `F:\GITHUB\FintechBankApp\WEB\components\Admin\MassCreationTodoSheet.tsx`

**Interfaces:**
- Consumes: `open: boolean`, `snapshot`: estados de orquestração.
- Produces: Um layout que altera de um `fixed` ou `absolute` right-panel para um container block encravado no fluxo do `MainMassCreatorFlow.tsx` ou do dashboard pai.

- [ ] **Step 1: Write the failing test / Preparar Modificação**
Observar se o componente usa Tailwind classes como `fixed`, `inset-y-0`, `right-0`. Remover essas classes.

- [x] **Step 2: Refatorar Layout para Standard Flow**

```tsx
// Substituir a estrutura do Dialog / Sheet overlay por um Collapsible ou container simples animado com Height
<div className={`transition-all duration-300 overflow-hidden ${open ? 'max-h-screen mb-4 border rounded-xl' : 'max-h-0'}`}>
    <div className="p-4 bg-gray-50/10 dark:bg-zinc-900/40">
        <h3 className="text-lg font-semibold flex items-center gap-2">
            <ListTodo className="size-5" /> Progresso da Geração em Tempo Real
        </h3>
        {/* Lista de Todo Tasks rodando e empurrando o resto */}
    </div>
</div>
```

- [x] **Step 3: Ajustar as classes de exibição Real-Time Steps**
Garantir que a task renderize marcadores claros informando validações de banco e integrações:
  - 🔄 Criando Cadastro
  - 🔄 Lançando transações nativas...
  - 🔄 Pre-flight audit validator
  - ✅ Massa prontas para uso.

- [x] **Step 4: Commit**

```bash
git add F:/GITHUB/FintechBankApp/WEB/components/Admin/MassCreationTodoSheet.tsx
git commit -m "feat(admin): transformar TodoList de popup em componente expansivo (empurra conteúdo)"
```

### Task 2: Modificar a Rota Backend de Seed para Usar API Nativa em Vez de INSERT Bruto

**Files:**
- Modify: Endpoint de criação referenciado pelo Painel (provavelmente `API/src/controllers/adminUsersController.js` na função de criação de compras ou o script de injestão acoplado no `API/routes`).

**Interfaces:**
- Consumes: Request com parâmetros de "quantidade de ciclos, compras à vista ou parceladas".
- Produces: Múltiplas etapas assíncronas chamando o serviço real da Fatura e gerando logs. Restitui Server-Sent Events (SSE) ou polling com respostas de progresso.

- [x] **Step 1: Mapear a Engine**
Encontrar a geração que dava insert na `transactions` e inserir a chamada cruzada para atrelar a `fintech.installment_plans`.

- [ ] **Step 1.5: Fuzzing de Valores (Variação por Ciclo)**
Garantir que as faturas fechadas nunca tenham valor repetido. Adicionar variador (ex: rand() de offsets) para simular gasto orgânico diferente a cada mês. Fatura 1 ≠ Fatura 2.

- [x] **Step 2: Adicionar O Pre-Flight Audit**
Como passo final dentro do backend do Gerador, chamar pontualmente o check do `dailyAudit.js` contra o novo CPF:

```javascript
// Exemplo pseudocódigo - deve ser adaptado no controlador 
const auditErrors = await dailyAudit.checkOrphanInstallments(cpfGerado);
if (auditErrors.length > 0) {
    // Reverta no Cemitério em caso de falha silenciosa para avisar o front
    throw new Error('Falha no Pre-flight audit: ' + auditErrors[0].details);
}
```

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(backend): injetar validação de auditoria na esteira de geração de massa mock"
```

### Task 3: Unir Frontend e Backend (Acompanhamento em Tempo Real)

**Files:**
- Modify: `F:\GITHUB\FintechBankApp\WEB\components\Admin\MainMassCreatorFlow.tsx`

**Interfaces:**
- Consumes: A ação de click "Gerar Massa".
- Produces: Expande imediatamente o TodoList em bloco abaixo e interroga o backend (via polling leve) pelo andamento. Ao finalizar (se sucesso ou UTI), apresenta "🏥 Entrou na UTI" ou "✅ Pronta".

- [x] **Step 1: O botão Action muda estado do Expand**
Ao clicar, abrir o contêiner Todo list sem obstruir a tela. O layout empurrará tudo pra baixo.

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(UX): vincular status poller do backend ao TodoList step-by-step expansivo"
```