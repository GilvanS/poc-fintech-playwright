import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { gerarMassaUnificada } from '../src/service/geradorService';
import { habilitarModoOffline } from '../src/generators/fakerApiData';

test('gerarMassaUnificada cria o CSV com header de 29 colunas e N linhas de dados', async () => {
  habilitarModoOffline();
  const arquivo = path.join(os.tmpdir(), `gerar-massa-teste-${Date.now()}-${Math.random()}.csv`);
  await gerarMassaUnificada(3, arquivo);

  const conteudo = fs.readFileSync(arquivo, 'utf-8');
  const linhas = conteudo.trim().split(/\r?\n/);
  assert.equal(linhas.length, 4); // header + 3 linhas
  assert.equal(
    linhas[0],
    'Nome;Sobrenome;NomeCompleto;NomeUsuario;Email;Senha;Administrador;CPF;Telefone;RazaoSocial;'
    + 'CNPJ;Endereco;NumeroEndereco;Cidade;Estado;CEP;Pais;NumeroCartao;ValidadeCartao;NomeProduto;'
    + 'Preco;DescricaoProduto;Quantidade;NomeCategoria;DescricaoCategoria;TituloArtigo;'
    + 'ConteudoArtigo;NomeAutor;DataPublicacao',
  );
  for (const linha of linhas.slice(1)) {
    assert.equal(linha.split(';').length, 29, `linha sem 29 colunas: ${linha}`);
    assert.ok(linha.startsWith('="'), 'cada linha deve começar com o wrapper ="..."');
  }

  if (fs.existsSync(arquivo)) fs.rmSync(arquivo);
});

test('gerarMassaUnificada em modo append acrescenta linhas sem duplicar o header', async () => {
  habilitarModoOffline();
  const arquivo = path.join(os.tmpdir(), `gerar-massa-append-${Date.now()}-${Math.random()}.csv`);
  await gerarMassaUnificada(2, arquivo);
  await gerarMassaUnificada(2, arquivo);

  const conteudo = fs.readFileSync(arquivo, 'utf-8');
  const linhas = conteudo.trim().split(/\r?\n/);
  assert.equal(linhas.length, 5); // 1 header + 4 linhas de dados
  const linhasHeader = linhas.filter((l) => l.startsWith('Nome;'));
  assert.equal(linhasHeader.length, 1);

  if (fs.existsSync(arquivo)) fs.rmSync(arquivo);
});