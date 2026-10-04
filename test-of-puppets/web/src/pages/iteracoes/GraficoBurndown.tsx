import type { Burndown } from './calculoIteracoes.ts';

interface Props {
  titulo: string;
  bd: Burndown;
}

const L = 640;
const A = 240;
const MARGEM = { esq: 34, dir: 14, topo: 12, base: 30 };

/** Burndown em SVG: reta ideal (tracejada) e o real (verde) até hoje. O eixo vai de 0 ao total inicial. */
export default function GraficoBurndown({ titulo, bd }: Props) {
  const n = bd.dias.length;
  const largura = L - MARGEM.esq - MARGEM.dir;
  const altura = A - MARGEM.topo - MARGEM.base;
  const maximo = Math.max(bd.total, 1);
  const x = (i: number) => MARGEM.esq + (n <= 1 ? largura / 2 : (i * largura) / (n - 1));
  const y = (v: number) => MARGEM.topo + altura * (1 - v / maximo);
  const pontosReais = bd.real.flatMap((v, i) => (v === null ? [] : [{ i, v }]));
  const restantes = pontosReais.length > 0 ? pontosReais[pontosReais.length - 1].v : bd.total;
  const passo = Math.max(1, Math.ceil(n / 14));
  const ticks = [...new Set([0, Math.round(maximo / 2), maximo])];

  return (
    <svg viewBox={`0 0 ${L} ${A}`} role="img" aria-label={`${titulo}: ${bd.total} testes no início, ${restantes} restantes hoje`} className="w-full max-w-3xl">
      <title>{titulo}</title>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={MARGEM.esq} x2={L - MARGEM.dir} y1={y(t)} y2={y(t)} stroke="currentColor" strokeOpacity={0.12} />
          <text x={MARGEM.esq - 6} y={y(t) + 3} textAnchor="end" fontSize="10" fill="currentColor" fillOpacity={0.6}>
            {t}
          </text>
        </g>
      ))}
      {bd.dias.map((d, i) =>
        i % passo === 0 ? (
          <text key={d} x={x(i)} y={A - 10} textAnchor="middle" fontSize="10" fill="currentColor" fillOpacity={0.6}>
            {d.slice(8)}
          </text>
        ) : null,
      )}
      <polyline data-testid="burndown-ideal" fill="none" stroke="currentColor" strokeOpacity={0.45} strokeDasharray="4 4" points={bd.ideal.map((v, i) => `${x(i)},${y(v)}`).join(' ')} />
      <polyline data-testid="burndown-real" fill="none" stroke="#00ff9d" strokeWidth={2} points={pontosReais.map((p) => `${x(p.i)},${y(p.v)}`).join(' ')} />
      {pontosReais.map((p) => (
        <circle key={p.i} cx={x(p.i)} cy={y(p.v)} r={3} fill="#00ff9d" />
      ))}
    </svg>
  );
}
