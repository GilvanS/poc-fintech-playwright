import { ErroNegocio } from '../erros.ts';
import { LIMITES } from './limites.ts';
import { validarEntrada, type CenarioEntrada } from './modelo.ts';

type Campo = 'idCenario' | 'nome' | 'funcionalidade' | 'feature' | 'projeto' | 'idMassa' | 'cpf' | 'passos' | 'resultadoEsperado';

/** Colunas do CSV, na ordem em que são exportadas. Importar aceita os mesmos títulos (e variações, ver ALIAS). */
export const COLUNAS: { campo: Campo; titulo: string }[] = [
  { campo: 'idCenario', titulo: 'ID' },
  { campo: 'nome', titulo: 'Nome' },
  { campo: 'funcionalidade', titulo: 'Funcionalidade' },
  { campo: 'feature', titulo: 'Feature' },
  { campo: 'projeto', titulo: 'Projeto' },
  { campo: 'idMassa', titulo: 'Massa' },
  { campo: 'cpf', titulo: 'CPF' },
  { campo: 'passos', titulo: 'Passos' },
  { campo: 'resultadoEsperado', titulo: 'Resultado esperado' },
];

const OBRIGATORIAS: Campo[] = ['idCenario', 'nome', 'funcionalidade'];

/** Títulos aceitos na importação (sem acento, minúsculos, só letras e números separados por espaço). */
const ALIAS: Record<Campo, string[]> = {
  idCenario: ['id', 'idcenario', 'id cenario', 'id do cenario', 'id teste', 'id do teste'],
  nome: ['nome', 'cenario', 'nome do cenario', 'cenario de teste'],
  funcionalidade: ['funcionalidade'],
  feature: ['feature'],
  projeto: ['projeto'],
  idMassa: ['massa', 'idmassa', 'id massa', 'id da massa'],
  cpf: ['cpf'],
  passos: ['passos', 'passos detalhes do teste'],
  resultadoEsperado: ['resultado esperado', 'resultadoesperado'],
};

const SEPARADOR = ';';

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Planilha trata `=`, `+` e `@` no começo como fórmula: o apóstrofo impede (e a importação o tira de volta). */
const COMECA_COMO_FORMULA = /^[=+@]/;
const COM_APOSTROFO = /^'[=+@]/;

function celula(valor: string | undefined): string {
  let texto = valor ?? '';
  if (COMECA_COMO_FORMULA.test(texto)) texto = `'${texto}`;
  return /[";\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

const mascararCpf = (cpf: string) => (cpf.length === 11 ? `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}` : cpf);

/**
 * O CSV de controle: `;` como separador, UTF-8 com BOM (o Excel abre com os acentos certos) e CPF com pontuação
 * (o Excel perde o zero à esquerda de um número solto, mas não de um texto assim).
 */
export function gerarCsv(cenarios: CenarioEntrada[]): string {
  const cabecalho = COLUNAS.map((c) => c.titulo).join(SEPARADOR);
  const linhas = cenarios.map((c) =>
    COLUNAS.map(({ campo }) => celula(campo === 'cpf' && c.cpf ? mascararCpf(c.cpf) : c[campo])).join(SEPARADOR),
  );
  return `﻿${[cabecalho, ...linhas].join('\r\n')}\r\n`;
}

interface LinhaBruta {
  /** Linha do arquivo onde o registro começa (1 = cabeçalho). */
  numero: number;
  celulas: string[];
}

function escolherSeparador(cabecalho: string): string {
  const candidatos = [';', ',', '\t'];
  const contagem = candidatos.map((s) => cabecalho.split(s).length - 1);
  const maior = Math.max(...contagem);
  return maior === 0 ? SEPARADOR : candidatos[contagem.indexOf(maior)];
}

/** Lê CSV com aspas (campos com `;`, aspas duplas ou quebra de linha), `\r\n` ou `\n`, e ignora linhas em branco. */
export function lerLinhas(texto: string): LinhaBruta[] {
  const t = texto.replace(/^﻿/, '');
  const separador = escolherSeparador(t.split(/\r\n|\n|\r/, 1)[0] ?? '');
  const linhas: LinhaBruta[] = [];
  let celulas: string[] = [];
  let campo = '';
  let entreAspas = false;
  let linhaAtual = 1;
  let inicio = 1;
  let temConteudo = false;

  const fecharCampo = () => {
    celulas.push(campo);
    campo = '';
  };
  const fecharLinha = () => {
    fecharCampo();
    if (temConteudo) linhas.push({ numero: inicio, celulas });
    celulas = [];
    temConteudo = false;
  };

  for (let i = 0; i < t.length; i += 1) {
    const c = t[i];
    if (entreAspas) {
      if (c === '"') {
        if (t[i + 1] === '"') {
          campo += '"';
          i += 1;
        } else entreAspas = false;
      } else {
        if (c === '\n') linhaAtual += 1;
        campo += c;
      }
      continue;
    }
    if (c === '"' && campo === '') {
      entreAspas = true;
      temConteudo = true;
    } else if (c === separador) {
      fecharCampo();
      temConteudo = true;
    } else if (c === '\r' || c === '\n') {
      if (c === '\r' && t[i + 1] === '\n') i += 1;
      fecharLinha();
      linhaAtual += 1;
      inicio = linhaAtual;
    } else {
      campo += c;
      if (c.trim() !== '') temConteudo = true;
    }
  }
  if (entreAspas) throw new ErroNegocio('csv_invalido', `Aspas sem fechar a partir da linha ${inicio}.`);
  if (campo !== '' || celulas.length > 0) fecharLinha();
  return linhas;
}

export type SituacaoLinha = 'novo' | 'existente' | 'igual' | 'erro';

export interface LinhaAnalisada {
  linha: number;
  idCenario?: string;
  situacao: SituacaoLinha;
  mensagens: string[];
  entrada?: CenarioEntrada;
}

export interface Analise {
  linhas: LinhaAnalisada[];
  /** Títulos de coluna que a importação não conhece (ficam de fora). */
  colunasIgnoradas: string[];
}

const CAMPOS = COLUNAS.map((c) => c.campo);
const mesmos = (a: CenarioEntrada, b: CenarioEntrada) => CAMPOS.every((k) => (a[k] ?? '') === (b[k] ?? ''));

/**
 * Confere o CSV inteiro sem gravar nada. Cada linha passa pelas mesmas regras do cadastro (`validarEntrada`);
 * `existentes` diz o que já está cadastrado, para marcar novo / existente / igual.
 */
export function analisarCsv(texto: string, existentes: Map<string, CenarioEntrada>): Analise {
  const linhas = lerLinhas(texto);
  if (linhas.length === 0) throw new ErroNegocio('csv_invalido', 'O arquivo está vazio.');

  const posicao = new Map<Campo, number>();
  const colunasIgnoradas: string[] = [];
  linhas[0].celulas.forEach((titulo, indice) => {
    const chave = normalizar(titulo);
    const campo = CAMPOS.find((k) => ALIAS[k].includes(chave));
    if (!campo) {
      if (titulo.trim()) colunasIgnoradas.push(titulo.trim());
    } else if (!posicao.has(campo)) posicao.set(campo, indice);
  });
  const faltando = OBRIGATORIAS.filter((k) => !posicao.has(k)).map((k) => COLUNAS.find((c) => c.campo === k)!.titulo);
  if (faltando.length > 0) {
    throw new ErroNegocio('csv_invalido', `Faltam colunas obrigatórias no cabeçalho: ${faltando.join(', ')}. Use os títulos: ${COLUNAS.map((c) => c.titulo).join('; ')}.`);
  }

  const dados = linhas.slice(1);
  if (dados.length > LIMITES.maxLinhasCsv) {
    throw new ErroNegocio('csv_invalido', `O arquivo tem ${dados.length} linhas; o máximo por importação é ${LIMITES.maxLinhasCsv}.`);
  }

  const vistos = new Map<string, number>();
  const analisadas = dados.map(({ numero, celulas }): LinhaAnalisada => {
    const objeto: Record<string, string> = {};
    for (const [campo, indice] of posicao) {
      let valor = (celulas[indice] ?? '').trim();
      if (COM_APOSTROFO.test(valor)) valor = valor.slice(1);
      if (valor !== '') objeto[campo] = valor;
    }
    if (objeto.idCenario) objeto.idCenario = objeto.idCenario.toUpperCase();

    const validado = validarEntrada(objeto);
    if (!validado.ok) return { linha: numero, idCenario: objeto.idCenario, situacao: 'erro', mensagens: validado.mensagens };

    const id = validado.valor.idCenario;
    const antes = vistos.get(id);
    if (antes !== undefined) return { linha: numero, idCenario: id, situacao: 'erro', mensagens: [`ID repetido no arquivo (já aparece na linha ${antes}).`] };
    vistos.set(id, numero);

    const atual = existentes.get(id);
    const situacao: SituacaoLinha = !atual ? 'novo' : mesmos(atual, validado.valor) ? 'igual' : 'existente';
    return { linha: numero, idCenario: id, situacao, mensagens: [], entrada: validado.valor };
  });

  return { linhas: analisadas, colunasIgnoradas };
}
