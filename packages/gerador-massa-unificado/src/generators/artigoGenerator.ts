import { fakerPT_BR as faker } from '@faker-js/faker';
import { removerAcentos } from '../utils/stringUtils';
import type { DadosFaker } from './fakerApiData';

export interface Artigo {
  tituloArtigo: string;
  conteudoArtigo: string;
  nomeAutor: string;
  dataPublicacao: string;
}

const TEMAS_ARTIGO = [
  // HQs DC & Marvel
  'A Evolucao dos Quadrinhos da DC Comics e o Multiverso',
  'Os Arcos Mais Marcantes dos Vingadores no Universo Marvel',
  'Como Batman Se Tornou o Maior Detetive dos Quadrinhos',
  'Analise da Saga Crise nas Infinitas Terras da DC',
  'O Impacto do Homem Aranha na Historia das HQs',
  'A Filosofia e Conflitos Raciais na Saga dos X-Men',
  'Os Maiores Viloes da DC Comics do Coringa a Darkseid',
  'Como o Homem de Ferro Reconstruiu o Universo Cinematografico Marvel',
  'As Origens Secretas da Mulher Maravilha e a Ilha de Themyscira',

  // Mangás Japoneses & Manhwas Coreanos
  'A Regra dos Shonens Japoneses e o Poder da Amizade',
  'O Fenomeno dos Mangas Isekai e Mundos Paralelos',
  'Como os Manhwas Coreanos de Solo Leveling Revolucionaram os Webtoons',
  'O Sistema de Dungeons e Level Up nos Manhwas Coreanos',
  'A Influencia dos Mangas de Luta Seinen na Cultura Pop',
  'Origem dos Webtoons Coreanos e a Leitura Vertical no Celular',
  'As Melhores Sagas de Artes Marciais Murim nos Manhwas',
  'Classicos dos Mangas dos Anos 90 que Inspiraram Geracoes',

  // Filmes & Cinema
  'A Evolucao dos Efeitos Especiais no Cinema', 'Os Maiores Classicos do Cinema de Ficcao Cientifica',
  'Como o Cinema de Terror se Reinventou', 'A Influencia dos Filmes de Super-Herois na Cultura Pop',
  'Os Melhores Filmes de Suspense de Todos os Tempos', 'Analise Roteiro e Direcao em Filmes Premiados',
  'Trilhas Sonoras Inesqueciveis do Cinema', 'O Impacto das Plataformas de Streaming nos Filmes',

  // Tecnologia & Gerais
  'Produtividade e Gestao de Tempo', 'Arquitetura de Software Moderna', 'Tendencias em Inteligencia Artificial',
  'Seguranca de Dados e Privacidade', 'Estrategias de Marketing Digital', 'Desenvolvimento de APIs RESTful',
  'Boas Praticas de Testes Automatizados', 'O Futuro do Trabalho Remoto', 'Financas Pessoais para Iniciantes',
  'Metodologias Agil na Pratica', 'Design de Interface e UX', 'Engenharia de Prompt e LLMs'
];

const PREFIXOS_TITULO = [
  'Guia Completo de', 'O Impacto de', 'Como Aplicar', 'Estrategias Avancadas de',
  'Principais Beneficios de', 'Desvendando os Misterios de', 'O Futuro de',
  'Melhores Praticas em', 'Introducao a', 'Tudo sobre', 'Analise Critica de',
  'Bastidores e Curiosidades sobre', 'Panorama Atual de', 'Segredos Revelados sobre'
];

const SUFIXOS_TITULO = [
  'na Pratica', 'em 2026', 'para Iniciantes e Avancados', 'no Mundo Moderno',
  'e suas Aplicacoes', 'com Foco em Resultados', 'no Cenario Atual', 'de Forma Simples',
  'Passo a Passo', 'com Abordagem Moderna'
];

function formatarDataIso(agora: Date = new Date()): string {
  return agora.toISOString();
}

export function gerarArtigo(dadosApi: DadosFaker): Artigo {
  const prefixo = faker.helpers.arrayElement(PREFIXOS_TITULO);
  const temaBase = faker.helpers.arrayElement(TEMAS_ARTIGO);
  const sufixo = faker.helpers.arrayElement(SUFIXOS_TITULO);

  let tituloArtigo: string;
  let conteudoCru: string;

  if (dadosApi.articleTitle && dadosApi.articleTitle.trim() && dadosApi.articleContent && dadosApi.articleContent.trim()) {
    tituloArtigo = removerAcentos(`${dadosApi.articleTitle} ${sufixo}`) as string;
    conteudoCru = `Uma analise sobre ${tituloArtigo}. ${dadosApi.articleContent.replace(/\n+/g, ' ')}`;
  } else {
    const tituloBase = `${prefixo} ${temaBase} ${sufixo}`;
    tituloArtigo = removerAcentos(tituloBase) as string;

    const p1 = `Neste artigo apresentamos uma analise aprofundada sobre ${tituloArtigo}. Abordamos os principais conceitos, contexto historico e os impactos mais relevantes observados no mercado e na cultura pop.`;
    const p2 = `Alem disso, discutimos estrategias praticas, exemplos reais e recomendacoes essenciais para quem deseja se aprofundar no tema com visao critica e objetiva.`;
    conteudoCru = `${p1} ${p2}`;
  }

  const nomeAutorFromApi = dadosApi.fullName;
  const nomeAutor = nomeAutorFromApi && nomeAutorFromApi.trim()
    ? (removerAcentos(nomeAutorFromApi) as string)
    : 'Autor Desconhecido';

  return {
    tituloArtigo: tituloArtigo.substring(0, 100),
    conteudoArtigo: removerAcentos(conteudoCru) as string,
    nomeAutor,
    dataPublicacao: formatarDataIso(),
  };
}