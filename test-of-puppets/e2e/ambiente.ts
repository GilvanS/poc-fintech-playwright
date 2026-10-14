/** Portas do ambiente isolado do E2E (diferentes das do uso normal, 3100/3101, para não esbarrar no que estiver aberto). */
export const PORTA_API = 3200;
export const PORTA_WEB = 3201;
export const URL_API = `http://127.0.0.1:${PORTA_API}`;
export const URL_WEB = `http://127.0.0.1:${PORTA_WEB}`;
/** "Hoje" do E2E: a semente tem datas fixas, então o servidor de teste (PUPPETS_HOJE) e os specs que dependem do dia usam esta data. */
export const HOJE_E2E = '2026-10-05';
