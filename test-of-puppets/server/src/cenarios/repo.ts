import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { ErroNegocio } from '../erros.ts';
import { gerarCsv } from './csv.ts';
import { LIMITES, type Armazenamento } from './limites.ts';
import { derivarMassa, type Cenario, type CenarioEntrada, type CenarioVisao } from './modelo.ts';

export interface ResultadoImportacao {
  criados: string[];
  atualizados: string[];
  ignorados: string[];
}

export interface RepoCenarios {
  listar(): Promise<CenarioVisao[]>;
  criar(entrada: CenarioEntrada): Promise<Cenario>;
  /** O ID não muda; `versao` é a que a pessoa viu ao abrir o cadastro. */
  atualizar(idCenario: string, entrada: CenarioEntrada, versao: number): Promise<Cenario>;
  excluir(idCenario: string): Promise<void>;
  /**
   * Grava várias linhas de uma vez, tudo ou nada (se estourar o limite, nada entra). O ID é a chave: o que já existe é
   * ignorado ou atualizado conforme `modo`.
   */
  importar(entradas: CenarioEntrada[], modo: 'ignorar' | 'atualizar'): Promise<ResultadoImportacao>;
  armazenamento(): Promise<Armazenamento>;
}

export interface OpcoesRepoCenarios {
  agora?: () => Date;
  /** `cenarios.json` da versão antiga: se existir e o banco ainda não, os cenários são migrados e o JSON vira `.migrado`. */
  caminhoJsonAntigo?: string;
  /** CSV de controle, regravado a cada mudança (é o que vai para o git). */
  caminhoCsv?: string;
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS cenarios (
    id_cenario TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    funcionalidade TEXT NOT NULL,
    feature TEXT,
    projeto TEXT,
    id_massa TEXT,
    cpf TEXT,
    passos TEXT,
    resultado_esperado TEXT,
    versao INTEGER NOT NULL,
    criado_em TEXT NOT NULL,
    atualizado_em TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS ix_cenarios_funcionalidade ON cenarios (funcionalidade);
  CREATE INDEX IF NOT EXISTS ix_cenarios_projeto ON cenarios (projeto);
`;

type Registro = Record<string, unknown>;

const texto = (v: unknown): string | undefined => (typeof v === 'string' && v !== '' ? v : undefined);

function paraCenario(r: Registro): Cenario {
  const feature = texto(r.feature);
  const projeto = texto(r.projeto);
  const idMassa = texto(r.id_massa);
  const cpf = texto(r.cpf);
  const passos = texto(r.passos);
  const resultadoEsperado = texto(r.resultado_esperado);
  return {
    idCenario: String(r.id_cenario),
    nome: String(r.nome),
    funcionalidade: String(r.funcionalidade),
    ...(feature ? { feature } : {}),
    ...(projeto ? { projeto } : {}),
    ...(idMassa ? { idMassa } : {}),
    ...(cpf ? { cpf } : {}),
    ...(passos ? { passos } : {}),
    ...(resultadoEsperado ? { resultadoEsperado } : {}),
    versao: Number(r.versao),
    criadoEm: String(r.criado_em),
    atualizadoEm: String(r.atualizado_em),
  };
}

const valores = (e: CenarioEntrada) => [
  e.idCenario,
  e.nome,
  e.funcionalidade,
  e.feature ?? null,
  e.projeto ?? null,
  e.idMassa ?? null,
  e.cpf ?? null,
  e.passos ?? null,
  e.resultadoEsperado ?? null,
];

/**
 * Cenários em SQLite (`node:sqlite`, sem pacote para instalar). Cada operação abre e fecha o banco: não sobra arquivo
 * preso (o reset do E2E apaga o `.db` sem problema no Windows) e uma operação nunca atrapalha a outra.
 */
export function criarRepoCenarios(caminho: string, { agora = () => new Date(), caminhoJsonAntigo, caminhoCsv }: OpcoesRepoCenarios = {}): RepoCenarios {
  function migrarDoJson(db: DatabaseSync, json: string): void {
    let dados: { cenarios?: Cenario[] };
    try {
      dados = JSON.parse(readFileSync(json, 'utf8')) as { cenarios?: Cenario[] };
    } catch {
      throw new Error(`Arquivo corrompido: ${json}. Corrija o JSON ou apague-o para começar do zero.`);
    }
    const inserir = db.prepare(
      'INSERT OR IGNORE INTO cenarios (id_cenario, nome, funcionalidade, feature, projeto, id_massa, cpf, passos, resultado_esperado, versao, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    );
    const instante = agora().toISOString();
    db.exec('BEGIN');
    try {
      for (const c of Array.isArray(dados.cenarios) ? dados.cenarios : []) {
        inserir.run(...valores(c), c.versao ?? 1, c.criadoEm ?? instante, c.atualizadoEm ?? instante);
      }
      db.exec('COMMIT');
    } catch (erro) {
      db.exec('ROLLBACK');
      throw erro;
    }
    renameSync(json, `${json}.migrado`);
  }

  function abrir(): DatabaseSync {
    mkdirSync(dirname(caminho), { recursive: true });
    const existia = existsSync(caminho);
    const db = new DatabaseSync(caminho);
    try {
      db.exec(SCHEMA);
      if (!existia && caminhoJsonAntigo && existsSync(caminhoJsonAntigo)) migrarDoJson(db, caminhoJsonAntigo);
    } catch (erro) {
      db.close();
      throw erro;
    }
    return db;
  }

  function comBanco<T>(tarefa: (db: DatabaseSync) => T): T {
    const db = abrir();
    try {
      return tarefa(db);
    } finally {
      db.close();
    }
  }

  function emTransacao<T>(db: DatabaseSync, tarefa: () => T): T {
    db.exec('BEGIN');
    try {
      const resultado = tarefa();
      db.exec('COMMIT');
      return resultado;
    } catch (erro) {
      db.exec('ROLLBACK');
      throw erro;
    }
  }

  const todos = (db: DatabaseSync): Cenario[] => (db.prepare('SELECT * FROM cenarios').all() as Registro[]).map(paraCenario);
  const contar = (db: DatabaseSync): number => Number((db.prepare('SELECT COUNT(*) AS n FROM cenarios').get() as Registro).n);
  const obter = (db: DatabaseSync, id: string): Cenario | undefined => {
    const r = db.prepare('SELECT * FROM cenarios WHERE id_cenario = ?').get(id) as Registro | undefined;
    return r ? paraCenario(r) : undefined;
  };

  /** Recusa gravar além dos tetos (`novos` = quantos cenários a operação acrescenta). */
  function verificarLimites(db: DatabaseSync, novos: number): void {
    if (novos <= 0) return;
    const total = contar(db);
    if (total + novos > LIMITES.maxCenarios) {
      throw new ErroNegocio('limite_cenarios', `Limite de ${LIMITES.maxCenarios} cenários cadastrados (hoje: ${total}). Exclua os que não usa mais antes de acrescentar.`);
    }
    if (statSync(caminho).size >= LIMITES.maxBytesBanco) {
      throw new ErroNegocio('limite_cenarios', `O banco de cenários chegou ao limite de ${Math.round(LIMITES.maxBytesBanco / 1024 / 1024)} MB. Exclua cenários antes de acrescentar.`);
    }
  }

  /** Regrava o CSV de controle; se não der (pasta sem permissão, por exemplo), o cadastro em si não é desfeito. */
  function sincronizarCsv(db: DatabaseSync): void {
    if (!caminhoCsv) return;
    try {
      mkdirSync(dirname(caminhoCsv), { recursive: true });
      const provisorio = `${caminhoCsv}.tmp`;
      writeFileSync(provisorio, gerarCsv(derivarMassa(todos(db))), 'utf8');
      renameSync(provisorio, caminhoCsv);
    } catch (erro) {
      console.warn(`[cenarios] não consegui regravar o CSV de controle (${caminhoCsv}):`, erro);
    }
  }

  return {
    async listar() {
      return comBanco((db) => derivarMassa(todos(db)));
    },

    async criar(entrada) {
      return comBanco((db) => {
        if (obter(db, entrada.idCenario)) throw new ErroNegocio('id_duplicado', `Já existe um cenário ${entrada.idCenario}.`);
        verificarLimites(db, 1);
        const instante = agora().toISOString();
        db.prepare(
          'INSERT INTO cenarios (id_cenario, nome, funcionalidade, feature, projeto, id_massa, cpf, passos, resultado_esperado, versao, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)',
        ).run(...valores(entrada), instante, instante);
        sincronizarCsv(db);
        return obter(db, entrada.idCenario)!;
      });
    },

    async atualizar(idCenario, entrada, versao) {
      return comBanco((db) => {
        const atual = obter(db, idCenario);
        if (!atual) throw new ErroNegocio('nao_encontrado', `Cenário ${idCenario} não encontrado.`);
        if (atual.versao !== versao) {
          throw new ErroNegocio('versao_antiga', `O cenário ${idCenario} foi alterado por outra pessoa. Recarregue antes de salvar.`);
        }
        db.prepare(
          'UPDATE cenarios SET nome = ?, funcionalidade = ?, feature = ?, projeto = ?, id_massa = ?, cpf = ?, passos = ?, resultado_esperado = ?, versao = ?, atualizado_em = ? WHERE id_cenario = ?',
        ).run(...valores({ ...entrada, idCenario }).slice(1), atual.versao + 1, agora().toISOString(), idCenario);
        sincronizarCsv(db);
        return obter(db, idCenario)!;
      });
    },

    async excluir(idCenario) {
      return comBanco((db) => {
        if (!obter(db, idCenario)) throw new ErroNegocio('nao_encontrado', `Cenário ${idCenario} não encontrado.`);
        db.prepare('DELETE FROM cenarios WHERE id_cenario = ?').run(idCenario);
        sincronizarCsv(db);
      });
    },

    async importar(entradas, modo) {
      return comBanco((db) => {
        const resultado: ResultadoImportacao = { criados: [], atualizados: [], ignorados: [] };
        emTransacao(db, () => {
          const instante = agora().toISOString();
          for (const entrada of entradas) {
            const atual = obter(db, entrada.idCenario);
            if (!atual) {
              verificarLimites(db, 1);
              db.prepare(
                'INSERT INTO cenarios (id_cenario, nome, funcionalidade, feature, projeto, id_massa, cpf, passos, resultado_esperado, versao, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)',
              ).run(...valores(entrada), instante, instante);
              resultado.criados.push(entrada.idCenario);
            } else if (modo === 'atualizar') {
              db.prepare(
                'UPDATE cenarios SET nome = ?, funcionalidade = ?, feature = ?, projeto = ?, id_massa = ?, cpf = ?, passos = ?, resultado_esperado = ?, versao = versao + 1, atualizado_em = ? WHERE id_cenario = ?',
              ).run(...valores(entrada).slice(1), instante, entrada.idCenario);
              resultado.atualizados.push(entrada.idCenario);
            } else {
              resultado.ignorados.push(entrada.idCenario);
            }
          }
        });
        if (resultado.criados.length + resultado.atualizados.length > 0) sincronizarCsv(db);
        return resultado;
      });
    },

    async armazenamento() {
      return comBanco((db) => {
        const cenarios = contar(db);
        const bytes = statSync(caminho).size;
        return {
          cenarios,
          maxCenarios: LIMITES.maxCenarios,
          bytes,
          maxBytes: LIMITES.maxBytesBanco,
          perto: cenarios >= LIMITES.avisoCenarios || bytes >= LIMITES.avisoBytesBanco,
        };
      });
    },
  };
}
