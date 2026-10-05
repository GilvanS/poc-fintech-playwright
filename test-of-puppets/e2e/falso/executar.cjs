// Comando FALSO usado só pelo E2E no lugar do `bdd:gen` e do `playwright test` do projeto de testes:
//   node executar.cjs gerar            -> finge gerar os specs
//   node executar.cjs rodar CT03.1     -> finge rodar o teste e grava o resultado do Allure + a evidência na pasta atual
// Regras fixas para o E2E: CT05.1 falha, CT04.1 fica 60 s rodando (dá tempo de apertar Stop), os demais passam.
const fs = require('node:fs');
const path = require('node:path');

const [modo, id] = process.argv.slice(2);

if (modo === 'gerar') {
  console.log('bdd:gen falso: specs gerados');
  process.exit(0);
}

console.log(`Rodando ${id} (falso)`);
const espera = id === 'CT04.1' ? 60_000 : 1_500;

setTimeout(() => {
  const falhou = id === 'CT05.1';
  const raiz = process.cwd();
  const dir = path.join(raiz, 'output', 'allure-results');
  fs.mkdirSync(dir, { recursive: true });
  fs.mkdirSync(path.join(raiz, 'evidences'), { recursive: true });
  const anexos = falhou ? [{ name: 'trace', source: `${id}-trace.zip`, type: 'application/zip' }] : [];
  if (falhou) fs.writeFileSync(path.join(dir, `${id}-trace.zip`), 'trace falso');
  fs.writeFileSync(
    path.join(dir, `${id}-result.json`),
    JSON.stringify({ status: falhou ? 'failed' : 'passed', start: Date.now() - espera, stop: Date.now(), labels: [{ name: 'tag', value: id }], attachments: anexos }),
  );
  fs.writeFileSync(path.join(raiz, 'evidences', `${id}.docx`), 'evidência falsa');
  console.log(`${id} ${falhou ? 'falhou' : 'passou'}`);
  process.exit(falhou ? 1 : 0);
}, espera);
