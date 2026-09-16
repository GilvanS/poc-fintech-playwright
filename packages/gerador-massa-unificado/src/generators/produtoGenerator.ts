import { fakerPT_BR as faker } from '@faker-js/faker';
import { removerAcentos } from '../utils/stringUtils';

export interface Produto {
  nomeProduto: string;
  preco: string;
  descricaoProduto: string;
  quantidade: number;
  nomeCategoria: string;
  descricaoCategoria: string;
}

/**
 * As categorias são agrupadas por tema porque o produto e a descrição saem
 * delas. O `faker.commerce` não serve aqui: `productDescription()` não tem
 * tradução pt-BR e cai no inglês, e nome e descrição vinham de sorteios
 * independentes — daí sair "Teclado" descrito como "Pizza".
 */
interface GrupoTematico {
  categorias: string[];
  /** O que de fato se vende naquele tema. */
  formatos: string[];
  /** Complemento de descrição plausível para o tema. */
  detalhes: string[];
}

const GRUPOS: GrupoTematico[] = [
  {
    categorias: [
      'Quadrinhos DC Comics', 'Quadrinhos Marvel Comics', 'HQs da LIGA DA JUSTICA', 'HQs dos VINGADORES',
      'HQs do BATMAN e Gotham City', 'HQs do HOMEM DE FERRO', 'HQs do HOMEM ARANHA', 'HQs do SUPERMAN',
      'HQs dos X-MEN e Mutantes', 'HQs do THOR e Asgard', 'HQs da MULHER MARAVILHA', 'HQs do CAPITAO AMERICA',
      'HQs do CORINGA e Viloes DC', 'HQs do QUARTETO FANTASTICO', 'HQs do FLASH e Multiverso',
      'HQs do DOUTOR ESTRANHO', 'HQs do LANTERNA VERDE', 'HQs do PANTERA NEGRA',
      'Graphic Novels DC Vertigo', 'Graphic Novels Marvel Knights',
    ],
    formatos: [
      'Encadernado', 'Box Colecionador', 'Edicao Especial', 'Graphic Novel',
      'Omnibus', 'Revista em Quadrinhos', 'Volume Unico',
    ],
    detalhes: [
      'capa dura e papel couche', 'arte restaurada a partir dos originais',
      'traducao revisada e notas de rodape', 'paginas extras com bastidores da producao',
      'galeria de capas alternativas', 'posfacio escrito pelo roteirista',
    ],
  },
  {
    categorias: [
      'Mangas Shonen Japoneses', 'Mangas Seinen Adultos', 'Mangas Shojo e Romance', 'Mangas Isekai e Fantasia',
      'Mangas de Luta e Artes Marciais', 'Mangas Mecha e Robos', 'Mangas Classicos dos Anos 90',
      'Mangas Slice of Life', 'Manhwas Coreanos de Acao', 'Manhwas Coreanos de Reencarnacao',
      'Manhwas Coreanos de Dungeon e System', 'Webtoons Coreanos Populares',
      'Manhwas de Artes Marciais Murim', 'Mangas de Misterio e Suspense',
    ],
    formatos: [
      'Volume', 'Box Completo', 'Edicao Definitiva', 'Colecao Encadernada',
      'Volume Duplo', 'Edicao de Luxo',
    ],
    detalhes: [
      'leitura no sentido original, da direita para a esquerda',
      'sobrecapa ilustrada e marcador exclusivo', 'primeiras paginas coloridas',
      'glossario de termos japoneses', 'formato maior que a edicao regular',
      'seccao extra com rascunhos do autor',
    ],
  },
  {
    categorias: [
      'Cinema e Filmes', 'Filmes de Ficcao Cientifica', 'Filmes de Acao e Aventura',
      'Filmes de Terror e Suspense', 'Filmes de Drama', 'Filmes de Comedia', 'Filmes de Animacao',
      'Filmes de Fantasia', 'Filmes Documentarios', 'Filmes Classicos', 'Cinema Cult', 'Cinema Nacional',
      'Series e Streaming', 'Franquias de Cinema', 'Trilha Sonora de Filmes', 'Efeitos Especiais em Filmes',
    ],
    formatos: [
      'Blu-ray', 'DVD', 'Box de Colecao', 'Steelbook', 'Edicao Remasterizada',
      'Blu-ray 4K', 'Colecao Completa',
    ],
    detalhes: [
      'audio em portugues e legendas em tres idiomas', 'cenas estendidas e finais alternativos',
      'making of e comentarios do diretor', 'imagem remasterizada a partir do negativo',
      'livreto com fotos de bastidores', 'trilha sonora em faixa isolada',
    ],
  },
  {
    categorias: [
      'Tecnologia', 'Informatica', 'Eletronicos', 'Hardware', 'Perifericos', 'Desenvolvimento',
      'Engenharia de Software', 'DevOps', 'Cloud Computing', 'Inteligencia Artificial', 'Ciencia de Dados',
      'Seguranca da Informacao', 'Automacao', 'Redes', 'Sistemas Operacionais', 'Mobile', 'Frontend',
      'Backend', 'Arquitetura de Software', 'Banco de Dados', 'Qualidade de Software',
      'Financas', 'Investimentos', 'Economia', 'Gestao', 'Negocios', 'Saude', 'Bem Estar', 'Nutricao',
      'Esportes', 'Educacao', 'Ciencia', 'Astronomia', 'Fisica', 'Historia', 'Filosofia', 'Arte',
      'Design', 'Musica', 'Literatura', 'Fotografia', 'Jogos', 'Cultura Pop', 'Viagens', 'Gastronomia',
    ],
    formatos: [
      'Livro', 'Guia Pratico', 'Manual de Referencia', 'Curso em Video',
      'Apostila', 'Colecao de Estudo', 'Ebook',
    ],
    detalhes: [
      'exercicios resolvidos ao final de cada capitulo', 'exemplos praticos comentados passo a passo',
      'conteudo revisado nesta edicao', 'estudos de caso do mercado brasileiro',
      'acesso ao material complementar online', 'indice remissivo e sugestoes de leitura',
    ],
  },
];

const QUALIFICADORES = [
  'Avancado', 'Moderno', 'Digital', 'Essencial', 'Pratico', 'Integrado',
  'Corporativo', 'Especializado', 'Inovador', 'Completo', 'Classico', 'Retro',
  'Premiado', 'Contemporaneo', 'Epico', 'Inesquecivel', 'Imperdivel', 'Independente',
  'Raro', 'Edicao de Colecionador', 'Volume Especial', 'Edicao Deluxe', 'Limitado',
];

/** Cada template cita o formato e a categoria, para a descrição nunca perder o vínculo. */
const TEMPLATES_DESCRICAO: Array<(formato: string, categoria: string, detalhe: string) => string> = [
  (formato, categoria, detalhe) => `${formato} da linha ${categoria}, com ${detalhe}.`,
  (formato, categoria, detalhe) => `Edicao de ${categoria} no formato ${formato}, traz ${detalhe}.`,
  (formato, categoria, detalhe) => `${formato} voltado para quem acompanha ${categoria}. Destaque para ${detalhe}.`,
  (formato, categoria, detalhe) => `Titulo de ${categoria} publicado como ${formato}, com ${detalhe}.`,
  (formato, categoria, detalhe) => `${formato} de ${categoria}. Inclui ${detalhe}.`,
];

export function gerarProduto(): Produto {
  const grupo = faker.helpers.arrayElement(GRUPOS);
  const categoriaBase = faker.helpers.arrayElement(grupo.categorias);
  const qualificador = faker.helpers.arrayElement(QUALIFICADORES);
  const formato = faker.helpers.arrayElement(grupo.formatos);
  const detalhe = faker.helpers.arrayElement(grupo.detalhes);
  const montarDescricao = faker.helpers.arrayElement(TEMPLATES_DESCRICAO);

  const nomeCategoria = removerAcentos(`${categoriaBase} ${qualificador}`) as string;
  const nomeProduto = removerAcentos(`${formato} ${categoriaBase}`) as string;
  const descricaoProduto = removerAcentos(montarDescricao(formato, categoriaBase, detalhe)) as string;

  return {
    nomeProduto,
    preco: faker.commerce.price({ min: 50, max: 5000, dec: 2 }),
    descricaoProduto,
    quantidade: faker.number.int({ min: 1, max: 100 }),
    nomeCategoria,
    descricaoCategoria: removerAcentos(`Descricao para a categoria ${nomeCategoria}`) as string,
  };
}
