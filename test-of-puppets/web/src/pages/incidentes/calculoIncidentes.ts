import { estaAberto, ROTULO_SEVERIDADE, ROTULO_STATUS_INC, type EntradaHistorico, type Incidente, type Severidade, type StatusInc } from '../../incidentes/clienteIncidentes.ts';
import { diasEntre } from '../roadmap/linhaDoTempo.ts';

/** Funções puras da tela Incidentes (V3): filtros, resumo, "há N dias" e o texto do histórico. */

export interface FiltroInc {
  texto: string;
  severidade: '' | Severidade;
  /** Id da pessoa, ou '' para todos. */
  responsavel: string;
  mostrarResolvidos: boolean;
  somenteMeus: boolean;
}

export const SEM_FILTRO_INC: FiltroInc = { texto: '', severidade: '', responsavel: '', mostrarResolvidos: true, somenteMeus: false };

const ORDEM_SEVERIDADE: Record<Severidade, number> = { alta: 0, media: 1, baixa: 2 };

/** Alta primeiro; dentro da mesma gravidade, o mais recente primeiro. */
export const ordenarIncidentes = (incs: Incidente[]): Incidente[] =>
  [...incs].sort((a, b) => ORDEM_SEVERIDADE[a.severidade] - ORDEM_SEVERIDADE[b.severidade] || b.abertoEm.localeCompare(a.abertoEm));

export function filtrarIncidentes(incs: Incidente[], f: FiltroInc, voce: string | null): Incidente[] {
  const termo = f.texto.trim().toLowerCase();
  return incs.filter((i) => {
    if (!f.mostrarResolvidos && !estaAberto(i)) return false;
    if (f.severidade && i.severidade !== f.severidade) return false;
    if (f.responsavel && i.responsavel !== f.responsavel) return false;
    if (f.somenteMeus && voce && i.responsavel !== voce) return false;
    if (termo && !`${i.numero} ${i.titulo} ${i.testesAfetados.join(' ')}`.toLowerCase().includes(termo)) return false;
    return true;
  });
}

const dia = (iso: string) => iso.slice(0, 10);

/** Dias inteiros entre a abertura e `hoje` (aaaa-mm-dd). */
export const diasAberto = (inc: Pick<Incidente, 'abertoEm'>, hoje: string): number => Math.max(0, diasEntre(dia(inc.abertoEm), hoje));

/** "há 3 dias", "há 1 dia", "hoje"; resolvido mostra "resolvido 30/09". */
export function haQuanto(inc: Pick<Incidente, 'abertoEm' | 'status' | 'resolvidoEm'>, hoje: string): string {
  if (inc.status === 'resolvido' && inc.resolvidoEm) return `resolvido ${dia(inc.resolvidoEm).slice(8)}/${dia(inc.resolvidoEm).slice(5, 7)}`;
  const n = diasAberto(inc, hoje);
  return n === 0 ? 'hoje' : `há ${n} ${n === 1 ? 'dia' : 'dias'}`;
}

export interface ResumoInc {
  abertos: number;
  porSeveridade: Record<Severidade, number>;
  /** Média, em dias, entre abrir e resolver; null se nenhum foi resolvido. */
  tempoMedioDias: number | null;
  /** Testes diferentes afetados por INC ainda aberto. */
  testesTravados: number;
}

export function resumirIncidentes(incs: Incidente[]): ResumoInc {
  const abertos = incs.filter(estaAberto);
  const porSeveridade: Record<Severidade, number> = { alta: 0, media: 0, baixa: 0 };
  for (const i of abertos) porSeveridade[i.severidade] += 1;
  const resolvidos = incs.filter((i) => i.status === 'resolvido' && i.resolvidoEm);
  const tempoMedioDias =
    resolvidos.length === 0
      ? null
      : Math.round((resolvidos.reduce((s, i) => s + Math.max(0, diasEntre(dia(i.abertoEm), dia(i.resolvidoEm as string))), 0) / resolvidos.length) * 10) / 10;
  return { abertos: abertos.length, porSeveridade, tempoMedioDias, testesTravados: new Set(abertos.flatMap((i) => i.testesAfetados)).size };
}

/** "Resumo: abertos 2 · Alta 1 · Média 1 · tempo médio de resolução 2 dias · testes travados 3". */
export function textoDoResumo(r: ResumoInc): string {
  const sev = (['alta', 'media', 'baixa'] as const).filter((s) => r.porSeveridade[s] > 0).map((s) => `${ROTULO_SEVERIDADE[s]} ${r.porSeveridade[s]}`);
  const tempo = r.tempoMedioDias === null ? 'sem INC resolvido' : `${String(r.tempoMedioDias).replace('.', ',')} ${r.tempoMedioDias === 1 ? 'dia' : 'dias'}`;
  return ['Resumo: abertos ' + r.abertos, ...sev, `tempo médio de resolução ${tempo}`, `testes travados ${r.testesTravados}`].join(' · ');
}

const rotuloStatus = (v?: string | null) => (v ? (ROTULO_STATUS_INC[v as StatusInc] ?? v) : '-');
const rotuloSeveridade = (v?: string | null) => (v ? (ROTULO_SEVERIDADE[v as Severidade] ?? v) : '-');

/** O texto de uma entrada do histórico, com o nome das pessoas. */
export function textoDoHistorico(h: EntradaHistorico, nome: (id?: string) => string): string {
  switch (h.tipo) {
    case 'registro':
      return 'registrou o INC';
    case 'status':
      return `mudou status: ${rotuloStatus(h.de)} → ${rotuloStatus(h.para)}`;
    case 'severidade':
      return `mudou severidade: ${rotuloSeveridade(h.de)} → ${rotuloSeveridade(h.para)}`;
    case 'responsavel':
      return h.para ? `atribuiu a ${nome(h.para)}` : 'tirou o responsável';
    case 'vinculo':
      return `vinculou ${h.para}`;
    case 'desvinculo':
      return `desvinculou ${h.de}`;
    case 'titulo':
      return 'mudou o título';
    case 'descricao':
      return 'editou a descrição';
  }
}

/** "02/10 09:14" a partir de um instante ISO (no fuso de quem olha). */
export function dataHora(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  const dois = (n: number) => String(n).padStart(2, '0');
  return `${dois(d.getDate())}/${dois(d.getMonth() + 1)} ${dois(d.getHours())}:${dois(d.getMinutes())}`;
}
