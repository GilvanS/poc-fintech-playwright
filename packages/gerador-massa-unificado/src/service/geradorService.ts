import fs from 'node:fs';
import path from 'node:path';
import { gerarDados } from '../generators/fakerApiData';
import { gerarUsuario } from '../generators/usuarioGenerator';
import { gerarProduto } from '../generators/produtoGenerator';
import { gerarArtigo } from '../generators/artigoGenerator';
import { montarLinha } from './linhaMassa';
import { formatCsvField, carregarContagensDeArquivoExistente } from './csvFormat';

const CSV_HEADER =
  'Nome;Sobrenome;NomeCompleto;NomeUsuario;Email;Senha;Administrador;CPF;Telefone;RazaoSocial;'
  + 'CNPJ;Endereco;NumeroEndereco;Cidade;Estado;CEP;Pais;NumeroCartao;ValidadeCartao;NomeProduto;'
  + 'Preco;DescricaoProduto;Quantidade;NomeCategoria;DescricaoCategoria;TituloArtigo;'
  + 'ConteudoArtigo;NomeAutor;DataPublicacao';

export async function gerarMassaUnificada(quantidade: number, caminhoArquivo: string): Promise<void> {
  const arquivoJaExiste = fs.existsSync(caminhoArquivo) && fs.statSync(caminhoArquivo).size > 0;

  const contagensExistentes = arquivoJaExiste
    ? carregarContagensDeArquivoExistente(caminhoArquivo)
    : { categorias: new Map<string, number>(), artigos: new Map<string, number>() };

  fs.mkdirSync(path.dirname(caminhoArquivo), { recursive: true });

  const linhasParaEscrever: string[] = [];
  if (!arquivoJaExiste) {
    linhasParaEscrever.push(CSV_HEADER);
  }

  console.log(`➕ Acrescentando ${quantidade} novos registros em '${caminhoArquivo}'...`);

  for (let i = 0; i < quantidade; i++) {
    const dadosApi = await gerarDados();
    const usuario = gerarUsuario(dadosApi);
    const produto = gerarProduto();
    const artigo = gerarArtigo(dadosApi);

    const colunas = montarLinha(usuario, produto, artigo, contagensExistentes);
    linhasParaEscrever.push(colunas.map(formatCsvField).join(';'));

    console.log(`✅ Registro ${i + 1}/${quantidade} acrescentado.`);
  }

  const conteudoStr = linhasParaEscrever.join('\n') + '\n';
  fs.appendFileSync(caminhoArquivo, conteudoStr, 'utf-8');
  console.log(`🎉 Operação concluída. Massa de dados atualizada em: ${caminhoArquivo}`);
}