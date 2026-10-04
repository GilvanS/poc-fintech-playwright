export interface ImagemEntrada {
  /** Caminho, URL ou dataURL da imagem. */
  src: string;
  /** Texto alternativo (leitor de tela e fallback se a imagem não carregar). */
  alt: string;
}

/**
 * ┌──────────────────────────────────────────────────────────────────────────────┐
 * │  ONDE TROCAR AS IMAGENS DA TELA INICIAL                                      │
 * │                                                                              │
 * │  1. Coloque seus arquivos em   test-of-puppets/web/public/entrada/           │
 * │     (a pasta pública do Vite; o arquivo fica em /entrada/nome.jpg).          │
 * │  2. Troque os itens de IMAGENS_ENTRADA abaixo:                               │
 * │        { src: '/entrada/minha-foto.jpg', alt: 'Descrição da foto' }          │
 * │                                                                              │
 * │  • Quantas quiser: a galeria cria um quadro para cada item.                  │
 * │  • Cada quadro é cortado em 4:5, centralizado.                               │
 * │  • Endereços https:// só dão o efeito ASCII se o servidor da imagem          │
 * │    permitir CORS; senão a foto aparece direto, sem o embaralhado.            │
 * │  • Fotos com bom contraste ficam melhores em ASCII.                          │
 * └──────────────────────────────────────────────────────────────────────────────┘
 *
 * Por enquanto são ilustrações geradas aqui mesmo, na paleta do projeto, para a tela
 * funcionar sem baixar nada. Apague-as quando colocar as suas.
 */
const PALETA = {
  verde: '#00ff9d',
  ciano: '#00e5ff',
  amarelo: '#ffd700',
  rosa: '#ff5c8d',
  lilas: '#c9bfff',
  lime: '#a2ff00',
} as const;

const moldura = (corpo: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500" viewBox="0 0 400 500">` +
  `<defs><linearGradient id="f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a2a2a"/><stop offset="1" stop-color="#131313"/></linearGradient></defs>` +
  `<rect width="400" height="500" fill="url(#f)"/>${corpo}</svg>`;

const comoImagem = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

const brilho = (cor: string) =>
  `<defs><radialGradient id="g" cx="50%" cy="45%" r="50%"><stop offset="0" stop-color="${cor}"/><stop offset="1" stop-color="${cor}" stop-opacity="0"/></radialGradient></defs>` +
  `<circle cx="200" cy="225" r="180" fill="url(#g)"/>`;

const listras = (cor: string) =>
  `<g stroke="${cor}" stroke-width="16" opacity=".85">${Array.from({ length: 12 }, (_, i) => `<line x1="${-120 + i * 60}" y1="500" x2="${80 + i * 60}" y2="0"/>`).join('')}</g>`;

const aneis = (cor: string) =>
  `<g fill="none" stroke="${cor}" stroke-width="10">${[40, 80, 120, 160].map((r) => `<circle cx="200" cy="250" r="${r}" opacity="${1.1 - r / 200}"/>`).join('')}</g>`;

const triangulo = (cor: string) =>
  `<defs><linearGradient id="t" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${cor}"/><stop offset="1" stop-color="${cor}" stop-opacity=".1"/></linearGradient></defs>` +
  `<polygon points="200,70 350,420 50,420" fill="url(#t)"/>`;

const pontos = (cor: string) =>
  Array.from({ length: 80 }, (_, i) => {
    const x = 30 + (i % 8) * 48;
    const y = 40 + Math.floor(i / 8) * 45;
    const r = Math.max(2, 20 - Math.hypot(x - 200, y - 250) / 12);
    return `<circle cx="${x}" cy="${y}" r="${r.toFixed(1)}" fill="${cor}"/>`;
  }).join('');

const ondas = (cor: string) =>
  `<g fill="none" stroke="${cor}" stroke-width="12" opacity=".9">${[120, 200, 280, 360].map((y) => `<path d="M0 ${y} Q100 ${y - 70} 200 ${y} T400 ${y}"/>`).join('')}</g>`;

const quadrados = (cor: string) =>
  `<g fill="none" stroke="${cor}" stroke-width="12">${[160, 110, 60].map((l) => `<rect x="${200 - l / 2}" y="${250 - l / 2}" width="${l}" height="${l}" transform="rotate(45 200 250)"/>`).join('')}</g>`;

const marionete = (cor: string) =>
  `<g stroke="${cor}" stroke-width="3" opacity=".9">` +
  [90, 160, 240, 310].map((x) => `<line x1="${x}" y1="0" x2="${200 + (x - 200) / 3}" y2="${x < 200 ? 190 : 200}"/>`).join('') +
  `</g><circle cx="200" cy="190" r="42" fill="${cor}"/>` +
  `<g stroke="${cor}" stroke-width="14" stroke-linecap="round"><line x1="200" y1="232" x2="200" y2="360"/><line x1="200" y1="260" x2="130" y2="330"/><line x1="200" y1="260" x2="270" y2="330"/><line x1="200" y1="360" x2="150" y2="450"/><line x1="200" y1="360" x2="250" y2="450"/></g>`;

export const IMAGENS_ENTRADA: ImagemEntrada[] = [
  { src: comoImagem(moldura(marionete(PALETA.verde))), alt: 'Marionete verde pendurada por fios' },
  { src: comoImagem(moldura(brilho(PALETA.ciano))), alt: 'Brilho ciano' },
  { src: comoImagem(moldura(listras(PALETA.amarelo))), alt: 'Listras amarelas na diagonal' },
  { src: comoImagem(moldura(aneis(PALETA.verde))), alt: 'Anéis verdes concêntricos' },
  { src: comoImagem(moldura(triangulo(PALETA.rosa))), alt: 'Triângulo rosa' },
  { src: comoImagem(moldura(pontos(PALETA.lilas))), alt: 'Pontos lilás em meio-tom' },
  { src: comoImagem(moldura(ondas(PALETA.lime))), alt: 'Ondas lime' },
  { src: comoImagem(moldura(quadrados(PALETA.ciano))), alt: 'Quadrados ciano girados' },
];
