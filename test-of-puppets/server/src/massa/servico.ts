import { randomBytes } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { ErroNegocio } from '../erros.ts';
import type { FonteMassa } from './fonteApp.ts';
import { ABA_MASSA, calcularProposta, COLUNAS_GRAVAVEIS, type Escrita, type LinhaDiff } from './modelo.ts';
import { gravarCelulas, hashDoArquivo, lerLinhaPorCpf } from './xlsx.ts';

export interface PropostaMassa {
  propostaId: string;
  cpf: string;
  /** De onde vieram os valores novos e quando foram lidos. */
  fonte: { origem: string; lidoEm: string };
  linhas: LinhaDiff[];
  temMudanca: boolean;
  /** Preenchido quando não dá para gravar agora (ex.: Excel aberto). A tela mostra e desliga o "Confirmar". */
  bloqueio?: string;
  /** Onde a cópia de segurança será guardada se a pessoa confirmar. */
  backup: string;
  planilha: string;
}

export interface ResultadoGravacao {
  cpf: string;
  backup: string;
  gravadas: Escrita[];
}

export interface ServicoMassa {
  /** Só lê (planilha e FintechBankApp) e monta o diff. Não escreve nada. */
  propor(cpf: string): Promise<PropostaMassa>;
  /** Grava o que foi proposto. Faz cópia de segurança antes e confere depois que nada além do combinado mudou. */
  confirmar(propostaId: string): Promise<ResultadoGravacao>;
}

export interface DepsMassa {
  /** Caminho de `data/MassaDados.xlsx`. */
  planilha: string;
  /** `dados/backups`. */
  dirBackups: string;
  fonte: FonteMassa;
  agora?: () => Date;
}

/** `PUPPETS_PLANILHA` ou `<raiz do projeto de testes>/data/MassaDados.xlsx`. */
export const planilhaPadrao = (raiz: string): string => process.env.PUPPETS_PLANILHA || join(raiz, 'data', 'MassaDados.xlsx');

const VALIDADE_PROPOSTA_MS = 15 * 60_000;
const TIPOS = Object.fromEntries(COLUNAS_GRAVAVEIS.map((c) => [c.coluna, c.tipo])) as Record<string, 'valor' | 'status'>;
const pad = (n: number) => String(n).padStart(2, '0');

export function criarServicoMassa(deps: DepsMassa): ServicoMassa {
  const agora = deps.agora ?? (() => new Date());
  const propostas = new Map<string, { cpf: string; escritas: Escrita[]; hash: string; criadaEm: number }>();
  // Excel cria `~$NomeDoArquivo.xlsx` ao lado enquanto o arquivo está aberto.
  const travaDoExcel = join(dirname(deps.planilha), `~$${basename(deps.planilha)}`);

  const caminhoBackup = () => {
    const d = agora();
    const dia = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const base = join(deps.dirBackups, `MassaDados.${dia}.xlsx`);
    // Mais de um backup no dia: acrescenta a hora, para nunca sobrescrever um backup anterior.
    return existsSync(base) ? join(deps.dirBackups, `MassaDados.${dia}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.xlsx`) : base;
  };

  const exigirPlanilha = () => {
    if (!existsSync(deps.planilha)) throw new ErroNegocio('nao_encontrado', `A planilha de massa não foi encontrada em ${deps.planilha}.`);
  };

  return {
    async propor(cpf) {
      exigirPlanilha();
      const atual = lerLinhaPorCpf(deps.planilha, cpf);
      if (!atual) throw new ErroNegocio('nao_encontrado', `O CPF ${cpf} não está na aba ${ABA_MASSA} da planilha.`);
      const fonte = await deps.fonte(cpf);
      const { linhas, escritas } = calcularProposta(atual.valores, fonte.valores);

      for (const [id, p] of propostas) if (Date.now() - p.criadaEm > VALIDADE_PROPOSTA_MS) propostas.delete(id);
      const propostaId = `pm_${randomBytes(4).toString('hex')}`;
      propostas.set(propostaId, { cpf, escritas, hash: hashDoArquivo(deps.planilha), criadaEm: Date.now() });

      return {
        propostaId,
        cpf,
        fonte: { origem: fonte.origem, lidoEm: fonte.lidoEm },
        linhas,
        temMudanca: escritas.length > 0,
        bloqueio: existsSync(travaDoExcel) ? 'O Excel está com a planilha aberta (existe ~$MassaDados.xlsx). Feche o Excel antes de gravar.' : undefined,
        backup: caminhoBackup(),
        planilha: deps.planilha,
      };
    },

    async confirmar(propostaId) {
      const proposta = propostas.get(propostaId);
      if (!proposta || Date.now() - proposta.criadaEm > VALIDADE_PROPOSTA_MS) {
        propostas.delete(propostaId);
        throw new ErroNegocio('nao_encontrado', 'Esta proposta não existe mais (vence em 15 minutos). Abra "Atualizar massa" de novo.');
      }
      exigirPlanilha();
      if (existsSync(travaDoExcel)) throw new ErroNegocio('planilha_bloqueada', 'O Excel está com a planilha aberta (existe ~$MassaDados.xlsx). Feche o Excel antes de gravar.');
      if (hashDoArquivo(deps.planilha) !== proposta.hash) {
        propostas.delete(propostaId);
        throw new ErroNegocio('planilha_mudou', 'A planilha mudou depois que o diff foi montado. Abra "Atualizar massa" de novo para ver o diff atual.');
      }
      if (proposta.escritas.length === 0) throw new ErroNegocio('sem_mudanca', 'Não há nada a gravar: a planilha já está igual à fonte.');

      const antes = lerLinhaPorCpf(deps.planilha, proposta.cpf)!;
      mkdirSync(deps.dirBackups, { recursive: true });
      const backup = caminhoBackup();
      copyFileSync(deps.planilha, backup);

      try {
        gravarCelulas(deps.planilha, proposta.cpf, proposta.escritas, TIPOS);
        const depois = lerLinhaPorCpf(deps.planilha, proposta.cpf);
        const permitidas = new Set(proposta.escritas.map((e) => e.coluna));
        const alteradas = depois ? Object.keys(antes.brutos).filter((c) => !permitidas.has(c) && antes.brutos[c] !== depois.brutos[c]) : ['(linha sumiu)'];
        if (alteradas.length > 0) throw new Error(`A gravação mexeu em colunas que não deveria: ${alteradas.join(', ')}`);
      } catch (e) {
        copyFileSync(backup, deps.planilha); // desfaz: a planilha volta exatamente ao que era
        throw e;
      }

      propostas.delete(propostaId);
      return { cpf: proposta.cpf, backup, gravadas: proposta.escritas };
    },
  };
}
