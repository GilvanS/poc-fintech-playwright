import { armazenamentoLocal } from './preferencias.ts';

export interface ConfigFundo {
  /** Imagem do fundo (URL, caminho ou dataURL). `null` = só o mosaico em cinzas. */
  src: string | null;
  /** Visibilidade do fundo, de 0 a 0,6. */
  opacity: number;
  /** Tamanho dos quadrados do dither, em px. */
  ditherCellSize: number;
}

export const CHAVE_FUNDO = 'puppets:fundo';
export const PADRAO_FUNDO: ConfigFundo = { src: null, opacity: 0.15, ditherCellSize: 8 };

export const OPACIDADE_MAXIMA = 0.6;
export const CELULA_MINIMA = 3;
export const CELULA_MAXIMA = 24;
/** Maior lado da imagem enviada; mantém o dataURL pequeno para caber no armazenamento do navegador. */
export const LADO_MAXIMO_IMAGEM = 1600;

type Leitura = Pick<Storage, 'getItem'>;
type Escrita = Pick<Storage, 'setItem'>;

const limitar = (n: number, minimo: number, maximo: number) => Math.min(maximo, Math.max(minimo, n));
const numeroValido = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export function normalizarFundo(bruto: unknown): ConfigFundo {
  const r = (typeof bruto === 'object' && bruto !== null ? bruto : {}) as Record<string, unknown>;
  return {
    src: typeof r.src === 'string' && r.src.length > 0 ? r.src : null,
    opacity: numeroValido(r.opacity) ? limitar(r.opacity, 0, OPACIDADE_MAXIMA) : PADRAO_FUNDO.opacity,
    ditherCellSize: numeroValido(r.ditherCellSize)
      ? limitar(Math.round(r.ditherCellSize), CELULA_MINIMA, CELULA_MAXIMA)
      : PADRAO_FUNDO.ditherCellSize,
  };
}

export function lerFundo(storage: Leitura | null = armazenamentoLocal()): ConfigFundo {
  if (!storage) return { ...PADRAO_FUNDO };
  try {
    const bruto = storage.getItem(CHAVE_FUNDO);
    return bruto ? normalizarFundo(JSON.parse(bruto)) : { ...PADRAO_FUNDO };
  } catch {
    return { ...PADRAO_FUNDO };
  }
}

export function gravarFundo(config: ConfigFundo, storage: Escrita | null = armazenamentoLocal()): void {
  if (!storage) return;
  try {
    storage.setItem(CHAVE_FUNDO, JSON.stringify(config));
  } catch {
    // Cota estourada (imagem grande demais): guarda só os ajustes, sem a imagem.
    try {
      storage.setItem(CHAVE_FUNDO, JSON.stringify({ ...config, src: null }));
    } catch {
      // armazenamento indisponível: segue sem lembrar
    }
  }
}

/** Lê a imagem enviada, reduz para no máximo 1600px no lado maior e devolve um dataURL JPEG. */
export function redimensionarImagem(arquivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
    leitor.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Arquivo de imagem inválido.'));
      img.onload = () => {
        const escala = Math.min(1, LADO_MAXIMO_IMAGEM / Math.max(img.naturalWidth, img.naturalHeight));
        const largura = Math.max(1, Math.round(img.naturalWidth * escala));
        const altura = Math.max(1, Math.round(img.naturalHeight * escala));
        const canvas = document.createElement('canvas');
        canvas.width = largura;
        canvas.height = altura;
        canvas.getContext('2d')?.drawImage(img, 0, 0, largura, altura);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.src = String(leitor.result);
    };
    leitor.readAsDataURL(arquivo);
  });
}
