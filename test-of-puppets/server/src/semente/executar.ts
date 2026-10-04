import { copyFile, mkdir, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { criarRepos } from '../repos.ts';
import { semear, temDados } from './semente.ts';

export interface OpcoesSemente {
  dirDados: string;
  /** Substitui os dados que existem (depois de guardar uma cópia). */
  forcar: boolean;
  escrever?: (texto: string) => void;
  agora?: () => Date;
}

const ARQUIVOS = ['cenarios.json', 'pessoas.json', 'planos.json', 'incidentes.json'];

const dois = (n: number) => String(n).padStart(2, '0');
const carimbo = (d: Date) =>
  `${d.getFullYear()}${dois(d.getMonth() + 1)}${dois(d.getDate())}-${dois(d.getHours())}${dois(d.getMinutes())}${dois(d.getSeconds())}`;

/** Lógica do `npm run semear`. Devolve o código de saída: 0 deu certo, 1 recusou (nada foi alterado). */
export async function executarSemente({ dirDados, forcar, escrever = console.log, agora = () => new Date() }: OpcoesSemente): Promise<number> {
  const repos = criarRepos(dirDados);

  if (await temDados(repos)) {
    if (!forcar) {
      escrever(`Já existem dados em ${dirDados}. Nada foi alterado.`);
      escrever('Para substituir pelos dados de exemplo (guardando antes uma cópia dos atuais), rode: npm run semear -- --forcar');
      return 1;
    }
    const copia = join(dirDados, `antes-da-semente-${carimbo(agora())}`);
    await mkdir(copia, { recursive: true });
    const presentes = await readdir(dirDados);
    for (const arquivo of ARQUIVOS.flatMap((a) => [a, `${a}.bak`]).filter((a) => presentes.includes(a))) {
      await copyFile(join(dirDados, arquivo), join(copia, arquivo));
      await rm(join(dirDados, arquivo));
    }
    escrever(`Cópia dos dados anteriores guardada em ${copia}`);
  }

  const resumo = await semear(repos);
  escrever(`Semente carregada: ${resumo.cenarios} cenários, ${resumo.pessoas} pessoas, ${resumo.planos} planos e ${resumo.incidentes} incidentes em ${dirDados}.`);
  return 0;
}
