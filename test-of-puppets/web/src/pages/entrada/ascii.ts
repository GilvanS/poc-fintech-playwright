/**
 * Lógica da galeria ASCII da tela inicial (porte do exemplo "ASCII Gallery"): cada foto é
 * reduzida a uma grade de 25×22 caracteres; claro = espaço, escuro = caractere denso.
 */
export const COLUNAS = 25;
export const LINHAS = 22;
/** Moldura 4:5 (largura:altura) de cada quadro. */
export const RAZAO_QUADRO = 4 / 5;
/** Rampa do mais claro (espaço) ao mais escuro (@). */
export const CARACTERES_ASCII = ' .:-=+*#%@';
/** Caracteres que "embaralham" antes de assentar no caractere final. */
export const CARACTERES_EMBARALHAR = '#%@=+*';

export interface Recorte {
  x: number;
  y: number;
  largura: number;
  altura: number;
}

export function brilhoParaChar(brilho: number): string {
  const limitado = Math.min(1, Math.max(0, brilho));
  return CARACTERES_ASCII[Math.round((1 - limitado) * (CARACTERES_ASCII.length - 1))];
}

/** Recorte centralizado da foto na proporção da moldura. `null` se a imagem ainda não tem tamanho. */
export function calcularRecorte(larguraNatural: number, alturaNatural: number, razao = RAZAO_QUADRO): Recorte | null {
  if (!(larguraNatural > 0) || !(alturaNatural > 0)) return null;
  if (larguraNatural / alturaNatural > razao) {
    const largura = alturaNatural * razao;
    return { x: (larguraNatural - largura) / 2, y: 0, largura, altura: alturaNatural };
  }
  const altura = larguraNatural / razao;
  return { x: 0, y: (alturaNatural - altura) / 2, largura: larguraNatural, altura };
}

/** RGBA (colunas × linhas × 4) → um caractere por pixel, pela média de R, G e B. */
export function mapearPixels(dados: ArrayLike<number>, colunas = COLUNAS, linhas = LINHAS): string[] {
  const esperado = colunas * linhas * 4;
  if (dados.length !== esperado) {
    throw new RangeError(`Esperava ${esperado} valores (${colunas}×${linhas} pixels RGBA), recebi ${dados.length}.`);
  }
  const chars: string[] = [];
  for (let i = 0; i < colunas * linhas; i++) {
    const p = i * 4;
    chars.push(brilhoParaChar((dados[p] + dados[p + 1] + dados[p + 2]) / 3 / 255));
  }
  return chars;
}

/** Desenha a foto reduzida num canvas e converte em caracteres. `null` se o navegador não deixar (sem canvas ou imagem de outro domínio sem CORS). */
export function gerarAscii(imagem: HTMLImageElement): string[] | null {
  const recorte = calcularRecorte(imagem.naturalWidth, imagem.naturalHeight);
  if (!recorte) return null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = COLUNAS;
    canvas.height = LINHAS;
    const contexto = canvas.getContext('2d');
    if (!contexto) return null;
    contexto.drawImage(imagem, recorte.x, recorte.y, recorte.largura, recorte.altura, 0, 0, COLUNAS, LINHAS);
    return mapearPixels(contexto.getImageData(0, 0, COLUNAS, LINHAS).data);
  } catch {
    return null;
  }
}

/** Quem pediu menos movimento no sistema vê as fotos direto, sem o embaralhado. */
export function prefereMenosMovimento(): boolean {
  try {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  } catch {
    return false;
  }
}

/** O embaralhado precisa de decode() e canvas; sem isso (ex.: jsdom) as fotos aparecem direto. */
export function podeAnimar(): boolean {
  return typeof HTMLImageElement !== 'undefined' && typeof HTMLImageElement.prototype.decode === 'function' && !prefereMenosMovimento();
}
