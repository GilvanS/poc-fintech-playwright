/**
 * Regra de cálculo monetário da fintech (FintechBankApp): valores CALCULADOS
 * (percentuais, encargos, juros, diferenças) são TRUNCADOS em 4 casas decimais —
 * nunca arredondados. Qualquer cálculo replicado nos testes precisa passar por
 * aqui, senão diverge por 1 centavo do que o app gravou (prova ao vivo
 * 2026-09-22, CT03.2: 10% da fatura R$ 4.235,05 = 423,505 → o limite subiu
 * R$ 423,50 TRUNCADO, não 423,51 arredondado).
 *
 * Exibição na UI é outra história: o app RENDERIZA com 2 casas (toLocaleString,
 * que arredonda o que mostra) — mas o valor armazenado/efetivado é o truncado.
 * Por isso o guard do modal de PIN mantém tolerância de R$ 0,011 (diferença
 * máxima de arredondamento de exibição), enquanto as validações de efeito
 * (Limite, Fatura Aberta, rótulo do lançamento) comparam com o valor truncado.
 */

/**
 * Trunca (corta, SEM arredondar) o número em `casas` decimais. Preserva o sinal.
 * Valores com módulo menor que a menor unidade representável (ex: ruído de float
 * -2.8e-14) viram 0 — elimina o "R$ -0.00" dos logs de encargos.
 */
export function truncar(valor: number, casas: number): number {
    if (!Number.isFinite(valor)) {
        return valor;
    }
    if (Math.abs(valor) < Math.pow(10, -casas)) {
        return 0;
    }
    const sinal = valor < 0 ? -1 : 1;
    const [inteira, decimais = ''] = Math.abs(valor).toString().split('.');
    return sinal * Number(`${inteira}.${(decimais + '0000').slice(0, casas)}`);
}

/** Truncamento em 4 casas — regra padrão da fintech para cálculos monetários. */
export function truncar4(valor: number): number {
    return truncar(valor, 4);
}

/**
 * Mínimo da fatura (10%) com a regra da fintech: TRUNCADO em 4 casas, nunca
 * arredondado. É o valor que o app usa como patamar do pagamento mínimo (o
 * rótulo do lançamento — Mínimo vs Parcial — depende do VALOR pago contra ESTE
 * número truncado, não do arredondado que a UI exibe no preset).
 */
export function calcularMinimoFatura(fatura: number): number {
    return truncar4(fatura * 0.1);
}
