/** 90 -> "90 min (1,5 h)". */
export function formatarMinutos(min: number): string {
  return `${min} min (${String(Math.round(min / 6) / 10).replace('.', ',')} h)`;
}

/** Data local de hoje como 'aaaa-mm-dd' (não a data em UTC, que vira o dia errado à noite no Brasil). */
export function hojeISO(agora: Date = new Date()): string {
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`;
}

/** 'aaaa-mm-dd' (data) ou data/hora ISO -> 'dd/mm/aaaa'. Vazio vira '-'. */
export function formatarData(valor?: string): string {
  if (!valor) return '-';
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) return valor.split('-').reverse().join('/');
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return '-';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}
