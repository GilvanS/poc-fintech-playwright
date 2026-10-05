import type { ItemPlano } from '../pages/planos/clientePlanos.ts';

/** O teste está contando agora (em andamento e não pausado). */
export const estaRodando = (item: ItemPlano) => item.status === 'em_andamento' && item.iniciadoEm !== undefined;
/** Em andamento com o relógio parado pelo ⏸. */
export const estaPausado = (item: ItemPlano) => item.status === 'em_andamento' && item.iniciadoEm === undefined && item.acumuladoMs !== undefined;

/** Tempo contado até `agoraMs`: o que ficou acumulado nas pausas mais o trecho que está rodando. */
export function decorridoMs(item: ItemPlano, agoraMs: number): number {
  const trecho = item.iniciadoEm ? Math.max(0, agoraMs - Date.parse(item.iniciadoEm)) : 0;
  return (item.acumuladoMs ?? 0) + trecho;
}

/** 75_000 -> "01:15"; 3_725_000 -> "1:02:05". */
export function formatarDecorrido(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const dois = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${dois(m)}:${dois(s)}` : `${dois(m)}:${dois(s)}`;
}

/** Minutos para sugerir ao registrar (no mínimo 1, como o servidor). */
export const minutosMedidos = (ms: number) => Math.max(1, Math.round(ms / 60_000));
