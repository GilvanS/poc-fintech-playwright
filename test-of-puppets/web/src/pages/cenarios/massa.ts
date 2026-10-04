/** Mostra o CPF aos poucos (123.456.789-09) enquanto se digita; guarda-se só os dígitos. */
export function formatarCpf(texto: string): string {
  const d = texto.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

const FORMATO_ID = /^CT(\d+)\.(\d+)$/;

function ordem(id: string): [number, number] | null {
  const m = FORMATO_ID.exec(id);
  return m ? [Number(m[1]), Number(m[2])] : null;
}

function comparar(a: string, b: string): number {
  const oa = ordem(a);
  const ob = ordem(b);
  if (!oa || !ob) return a.localeCompare(b);
  return oa[0] - ob[0] || oa[1] - ob[1];
}

export interface MassaCompartilhada {
  /** Os outros cenários que já usam a mesma massa. */
  usadaPor: string[];
  /** Entre eles, os de numeração menor: o cenário em edição só anda depois deles. */
  dependeDe: string[];
}

/**
 * Prévia do que o servidor calcula ao salvar (mesma regra): massa repetida é proposital e a
 * dependência é automática. Usada só para avisar na hora, dentro do modal.
 */
export function massaCompartilhada(
  cenarios: { idCenario: string; idMassa?: string }[],
  idMassa: string,
  idAtual: string,
): MassaCompartilhada {
  const massa = idMassa.trim();
  if (!massa) return { usadaPor: [], dependeDe: [] };
  const usadaPor = cenarios
    .filter((c) => c.idMassa === massa && c.idCenario !== idAtual)
    .map((c) => c.idCenario)
    .sort(comparar);
  const dependeDe = ordem(idAtual) ? usadaPor.filter((id) => comparar(id, idAtual) < 0) : [];
  return { usadaPor, dependeDe };
}
