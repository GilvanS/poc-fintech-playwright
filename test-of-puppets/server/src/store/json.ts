import { copyFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

function semArquivo(erro: unknown): boolean {
  return (erro as NodeJS.ErrnoException)?.code === 'ENOENT';
}

/**
 * Lê um arquivo JSON. Arquivo ausente devolve `padrao`; arquivo quebrado lança erro claro
 * (nunca devolve `padrao`, senão a próxima gravação apagaria os dados sem ninguém perceber).
 */
export async function lerJson<T>(caminho: string, padrao: T): Promise<T> {
  let texto: string;
  try {
    texto = await readFile(caminho, 'utf8');
  } catch (erro) {
    if (semArquivo(erro)) return padrao;
    throw erro;
  }
  try {
    return JSON.parse(texto) as T;
  } catch {
    throw new Error(`Arquivo corrompido: ${caminho}. Restaure a cópia ${caminho}.bak ou corrija o JSON.`);
  }
}

/** Só guarda no .bak o que ainda é JSON válido, para um arquivo quebrado não substituir a cópia boa. */
async function guardarCopia(caminho: string): Promise<void> {
  let texto: string;
  try {
    texto = await readFile(caminho, 'utf8');
  } catch (erro) {
    if (semArquivo(erro)) return;
    throw erro;
  }
  try {
    JSON.parse(texto);
  } catch {
    return;
  }
  await copyFile(caminho, `${caminho}.bak`);
}

/**
 * Grava de forma atômica: escreve num arquivo temporário e renomeia por cima do destino,
 * depois de guardar a versão anterior em `<arquivo>.bak`. Quem chama deve serializar as gravações.
 */
export async function gravarJson(caminho: string, dados: unknown): Promise<void> {
  await mkdir(dirname(caminho), { recursive: true });
  await guardarCopia(caminho);
  const temporario = `${caminho}.${process.pid}.tmp`;
  await writeFile(temporario, `${JSON.stringify(dados, null, 2)}\n`, 'utf8');
  await rename(temporario, caminho);
}
