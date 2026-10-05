/** Portas do ambiente isolado do E2E (diferentes das do uso normal, 3100/3101, para não esbarrar no que estiver aberto). */
export const PORTA_API = 3200;
export const PORTA_WEB = 3201;
export const URL_API = `http://127.0.0.1:${PORTA_API}`;
export const URL_WEB = `http://127.0.0.1:${PORTA_WEB}`;
/** FintechBankApp de mentira (e2e/falso/app-falso.cjs): só responde o login e o export de massas usados pelo "Atualizar massa". */
export const PORTA_APP_FALSO = 3202;
export const URL_APP_FALSO = `http://127.0.0.1:${PORTA_APP_FALSO}`;
/** CPF fictício do cenário CT03.1 da semente: é a linha que a planilha sintética do E2E tem. */
export const CPF_E2E_MASSA = '11144477735';
