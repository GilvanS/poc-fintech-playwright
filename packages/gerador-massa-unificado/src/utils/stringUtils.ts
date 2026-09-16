export function removerAcentos(input: string | null): string | null {
  if (input === null) return null;
  return input.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function limparParaNomeSimples(input: string | null): string | null {
  if (input === null) return null;
  const semAcentos = removerAcentos(input) as string;
  const semHifenApostrofo = semAcentos.replace(/[-']/g, '');
  return semHifenApostrofo
    .replace(/[^\p{L}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function formatarParaTextoCsv(valor: unknown): string {
  if (valor === null || valor === undefined) return '';
  return `="${String(valor).replace(/"/g, '""')}"`;
}
