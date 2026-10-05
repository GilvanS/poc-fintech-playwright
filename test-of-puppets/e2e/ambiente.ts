/** Portas do ambiente isolado do E2E (diferentes das do uso normal, 3100/3101, para não esbarrar no que estiver aberto). */
export const PORTA_API = 3200;
export const PORTA_WEB = 3201;
export const URL_API = `http://127.0.0.1:${PORTA_API}`;
export const URL_WEB = `http://127.0.0.1:${PORTA_WEB}`;
