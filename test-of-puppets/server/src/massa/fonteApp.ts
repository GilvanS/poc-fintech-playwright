import { ErroNegocio } from '../erros.ts';

/** O que o FintechBankApp diz da massa de um CPF agora (a tela nunca fala com o banco, só com a API admin dele). */
export interface DadosDaFonte {
  valores: Record<string, string>;
  origem: string;
  lidoEm: string;
}

export type FonteMassa = (cpf: string) => Promise<DadosDaFonte>;

export interface OpcoesFonteApp {
  baseUrl?: string;
  /** Token de um admin. Sem ele, usa `cpf` + `senha` para entrar. */
  token?: string;
  cpf?: string;
  senha?: string;
  fetch?: typeof fetch;
  agora?: () => Date;
}

/** CSV do FintechBankApp: separador `;`, campos entre aspas quando precisam. */
export function lerCsv(csv: string): Record<string, string>[] {
  const linhas: string[][] = [];
  let campo = '';
  let linha: string[] = [];
  let aspas = false;
  const fecharCampo = () => {
    linha.push(campo);
    campo = '';
  };
  for (let i = 0; i < csv.length; i++) {
    const c = csv[i];
    if (aspas) {
      if (c === '"' && csv[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (c === '"') aspas = false;
      else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === ';') fecharCampo();
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && csv[i + 1] === '\n') i++;
      fecharCampo();
      if (linha.some((x) => x !== '')) linhas.push(linha);
      linha = [];
    } else campo += c;
  }
  if (campo !== '' || linha.length > 0) {
    fecharCampo();
    if (linha.some((x) => x !== '')) linhas.push(linha);
  }
  const [cabecalho, ...dados] = linhas;
  if (!cabecalho) return [];
  return dados.map((l) => Object.fromEntries(cabecalho.map((nome, i) => [nome.trim(), l[i] ?? ''])));
}

const semConfiguracao = () =>
  new ErroNegocio(
    'fonte_indisponivel',
    'Sem acesso ao FintechBankApp: defina PUPPETS_APP_TOKEN (token de admin) ou PUPPETS_APP_CPF e PUPPETS_APP_SENHA ao iniciar o servidor.',
  );

/**
 * Lê `GET /api/admin/scripts/export-massas-csv?cpf=` do FintechBankApp (a mesma fonte única do CSV de massas).
 * As credenciais vêm só do ambiente do servidor; nunca vão para a tela nem para o log.
 */
export function criarFonteApp(opcoes: OpcoesFonteApp = {}): FonteMassa {
  const chamar = opcoes.fetch ?? fetch;
  const agora = opcoes.agora ?? (() => new Date());
  const base = (opcoes.baseUrl ?? process.env.PUPPETS_APP_URL ?? 'http://127.0.0.1:3001').replace(/\/+$/, '');
  const cpfAdmin = opcoes.cpf ?? process.env.PUPPETS_APP_CPF;
  const senhaAdmin = opcoes.senha ?? process.env.PUPPETS_APP_SENHA;
  let token = opcoes.token ?? process.env.PUPPETS_APP_TOKEN;

  const entrar = async (): Promise<string> => {
    if (!cpfAdmin || !senhaAdmin) throw semConfiguracao();
    const r = await chamar(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ cpf: cpfAdmin, password: senhaAdmin }),
      signal: AbortSignal.timeout(8_000),
    });
    const corpo = (await r.json().catch(() => null)) as { token?: string } | null;
    if (!r.ok || !corpo?.token) throw new ErroNegocio('fonte_indisponivel', `O FintechBankApp recusou o login do admin (HTTP ${r.status}).`);
    return corpo.token;
  };

  const buscar = (cpf: string, jwt: string) =>
    chamar(`${base}/api/admin/scripts/export-massas-csv?cpf=${encodeURIComponent(cpf)}`, {
      headers: { authorization: `Bearer ${jwt}` },
      signal: AbortSignal.timeout(15_000),
    });

  return async (cpf) => {
    try {
      token ??= await entrar();
      let r = await buscar(cpf, token);
      if (r.status === 401 && cpfAdmin && senhaAdmin) {
        token = await entrar(); // token vencido: entra de novo uma vez
        r = await buscar(cpf, token);
      }
      if (r.status === 401 || r.status === 403) throw new ErroNegocio('fonte_indisponivel', `O FintechBankApp negou o acesso (HTTP ${r.status}): o token precisa ser de um admin.`);
      const corpo = (await r.json().catch(() => null)) as { success?: boolean; data?: { csv?: string }; message?: string } | null;
      if (!r.ok || !corpo?.success || typeof corpo.data?.csv !== 'string') {
        throw new ErroNegocio('fonte_indisponivel', `O FintechBankApp não devolveu a massa (HTTP ${r.status}${corpo?.message ? `: ${corpo.message}` : ''}).`);
      }
      const linha = lerCsv(corpo.data.csv).find((l) => (l.cpf ?? '').replace(/\D/g, '') === cpf);
      if (!linha) throw new ErroNegocio('nao_encontrado', `O FintechBankApp não tem o CPF ${cpf} na exportação de massas.`);
      return { valores: linha, origem: `${base}/api/admin/scripts/export-massas-csv`, lidoEm: agora().toISOString() };
    } catch (e) {
      if (e instanceof ErroNegocio) throw e;
      throw new ErroNegocio('fonte_indisponivel', `Não foi possível falar com o FintechBankApp em ${base}. Ele está de pé?`);
    }
  };
}
