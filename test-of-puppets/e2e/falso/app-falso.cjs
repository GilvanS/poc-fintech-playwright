// FintechBankApp FALSO, só para o E2E do "Atualizar massa": responde o login do admin e o export de massas.
// Não há banco, nem dados reais: devolve sempre a mesma linha fictícia do CPF do cenário CT03.1 da semente.
const http = require('node:http');

const PORTA = Number(process.env.PORTA_APP_FALSO || 3202);
const CPF = process.env.CPF_E2E_MASSA || '11144477735';
const TOKEN = 'tk-e2e';

const CSV =
  'cpf;saldo_conta;limite_utilizado;limite_disponivel;fatura_fechada;fatura_aberta;status_fatura_fechada;parcelas_a_vencer\n' +
  `${CPF};24615,07;1157,26;13842,74;999,99;194,19;PAGO_PARCIAL;898,17\n`;

const responder = (res, status, corpo) => {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(corpo));
};

http
  .createServer((req, res) => {
    const url = new URL(req.url, 'http://local');
    if (url.pathname === '/saude') return responder(res, 200, { ok: true });
    if (req.method === 'POST' && url.pathname === '/api/auth/login') return responder(res, 200, { success: true, token: TOKEN });
    if (req.method === 'GET' && url.pathname === '/api/admin/scripts/export-massas-csv') {
      if (req.headers.authorization !== `Bearer ${TOKEN}`) return responder(res, 401, { success: false });
      return responder(res, 200, { success: true, data: { csv: CSV, count: 1 } });
    }
    return responder(res, 404, { success: false });
  })
  .listen(PORTA, '127.0.0.1');
