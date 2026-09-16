import { toRoman } from '../utils/romanNumeral';
import { proximaContagem } from './dedup';
import type { Usuario } from '../generators/usuarioGenerator';
import type { Produto } from '../generators/produtoGenerator';
import type { Artigo } from '../generators/artigoGenerator';

export interface Contadores {
  categorias: Map<string, number>;
  artigos: Map<string, number>;
}

export function criarContadores(): Contadores {
  return { categorias: new Map(), artigos: new Map() };
}

function aplicarDedupCategoria(produto: Produto, mapa: Map<string, number>): Produto {
  const nomeBase = produto.nomeCategoria;
  const contagem = proximaContagem(mapa, nomeBase);
  if (contagem <= 1) return produto;
  const novoNome = `${nomeBase} ${toRoman(contagem)}`;
  return {
    ...produto,
    nomeCategoria: novoNome,
    descricaoCategoria: `Descricao para a categoria ${novoNome}`,
  };
}

function aplicarDedupArtigo(artigo: Artigo, mapa: Map<string, number>): Artigo {
  const tituloBase = artigo.tituloArtigo;
  const contagem = proximaContagem(mapa, tituloBase);
  if (contagem <= 1) return artigo;
  const novoTitulo = `${tituloBase} ${toRoman(contagem)}`;
  return {
    ...artigo,
    tituloArtigo: novoTitulo,
    conteudoArtigo: artigo.conteudoArtigo.split(tituloBase).join(novoTitulo),
  };
}

export function montarLinha(usuario: Usuario, produto: Produto, artigo: Artigo, contadores: Contadores): string[] {
  const produtoFinal = aplicarDedupCategoria(produto, contadores.categorias);
  const artigoFinal = aplicarDedupArtigo(artigo, contadores.artigos);
  return [
    usuario.nome, usuario.sobrenome, usuario.nomeCompleto, usuario.nomeUsuario, usuario.email, usuario.senha,
    String(usuario.administrador), usuario.cpf, usuario.telefone, usuario.razaoSocial, usuario.cnpj,
    usuario.addressLine, usuario.numeroEndereco, usuario.city, usuario.stateRegion, usuario.zipCode, usuario.country,
    usuario.cardNumber, usuario.expiryDate,
    produtoFinal.nomeProduto, produtoFinal.preco, produtoFinal.descricaoProduto, String(produtoFinal.quantidade),
    produtoFinal.nomeCategoria, produtoFinal.descricaoCategoria,
    artigoFinal.tituloArtigo, artigoFinal.conteudoArtigo, artigoFinal.nomeAutor, artigoFinal.dataPublicacao,
  ];
}
