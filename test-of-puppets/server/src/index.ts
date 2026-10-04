import { createApp } from './app.ts';

// Até decidir a proteção de acesso em rede (token), o servidor só escuta o próprio computador.
const HOST = process.env.PUPPETS_HOST ?? '127.0.0.1';
const PORT = Number(process.env.PUPPETS_PORT ?? 3100);
// Só o E2E muda estas duas: pasta de dados temporária e a rota de reset. Em uso normal ficam vazias.
const DADOS = process.env.PUPPETS_DADOS || undefined;
const MODO_TESTE = process.env.PUPPETS_MODO_TESTE === '1';

createApp({ dirDados: DADOS, modoTeste: MODO_TESTE }).listen(PORT, HOST, () => {
  console.log(`[server] http://${HOST}:${PORT}   GET /api/saude${MODO_TESTE ? '   (modo de teste)' : ''}`);
});
