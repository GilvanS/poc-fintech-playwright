import { Calendar, Flag, Lock } from 'lucide-react';
import BotaoCronometro from '../../cronometro/BotaoCronometro.tsx';
import { useIncidentes } from '../../incidentes/ContextoIncidentes.tsx';
import { usePessoas } from '../../pessoas/ContextoPessoas.tsx';
import { CLASSE_COR } from '../../pessoas/clientePessoas.ts';
import { ROTULO_STATUS, STATUS, type CamposItem, type ItemPlano, type Prioridade, type Resultado, type Status } from './clientePlanos.ts';
import { hojeISO } from './datas.ts';

interface Props {
  item: ItemPlano;
  onAbrir: (idCenario: string) => void;
  onAlterar: (item: ItemPlano, campos: CamposItem) => void;
  /** "Mover para" (a alternativa ao arrasto). */
  onMover: (item: ItemPlano, status: Status) => void;
  onArrastar: (idCenario: string) => void;
}

const campo =
  'rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-[11px] text-on-surface outline-none focus:border-volt-green/50';

/** Cores da prioridade (confirmadas pelo usuário): P1 rosa, P2 amarelo, P3 cinza-verde. */
const COR_PRIORIDADE: Record<Prioridade, string> = { P1: '#FF5C8D', P2: '#FFD700', P3: '#b9cbbc' };
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** "2026-10-03" -> "3 out". */
const dataCurta = (iso: string) => `${Number(iso.slice(8, 10))} ${MESES[Number(iso.slice(5, 7)) - 1] ?? ''}`;

const iniciais = (texto: string) =>
  texto
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');

const chip = 'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold';

/** Um teste no kanban: funcionalidade, ID, nome, chips de prioridade/data/massa, bloqueio, INC, responsável e o "Mover para". */
export default function CartaoKanban({ item, onAbrir, onAlterar, onMover, onArrastar }: Props) {
  const { nome, pessoas } = usePessoas();
  const incAbertos = useIncidentes().abertosDe(item.idCenario);
  const bloqueado = item.bloqueadoPor.length > 0;
  const hoje = hojeISO();
  const atrasado = item.dataPlanejada !== undefined && item.dataPlanejada < hoje && item.status !== 'concluido';
  const ehHoje = item.dataPlanejada === hoje;
  const dono = item.responsavel ? pessoas.find((p) => p.id === item.responsavel) : undefined;

  return (
    <article
      data-testid={`card-${item.idCenario}`}
      draggable
      onDragStart={() => onArrastar(item.idCenario)}
      className={`flex cursor-grab flex-col gap-2 rounded-2xl border bg-white/[0.07] p-3 text-sm shadow-[0_2px_12px_rgba(0,0,0,0.25)] backdrop-blur-md transition-colors hover:bg-white/[0.1] ${bloqueado ? 'border-volt-green/30' : 'border-white/10'}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 text-[10px] font-bold text-on-surface-variant">
          <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-volt-green" />
          <span className="truncate">{item.funcionalidade ?? '-'}</span>
        </span>
        <BotaoCronometro item={item} />
      </div>

      <button
        type="button"
        onClick={() => onAbrir(item.idCenario)}
        aria-label={`Abrir ${item.idCenario}`}
        className="self-start font-mono text-xs text-volt-green underline-offset-2 hover:underline cursor-pointer"
      >
        {item.idCenario}
      </button>
      <span className="font-bold leading-snug">{item.nome ?? '-'}</span>

      <div className="flex flex-wrap items-center gap-1.5">
        {item.prioridade && (
          <span className={`${chip} bg-white/10`} style={{ color: COR_PRIORIDADE[item.prioridade] }}>
            <Flag size={10} aria-hidden />
            {item.prioridade}
          </span>
        )}
        {item.dataPlanejada && (
          <span
            title={`Planejada ${item.dataPlanejada.split('-').reverse().join('/')}`}
            className={`${chip} ${ehHoje ? 'bg-volt-green text-black' : atrasado ? 'bg-neon-error/80 text-black' : 'bg-white/10 text-on-surface-variant'}`}
          >
            <Calendar size={10} aria-hidden />
            {ehHoje ? 'Hoje' : dataCurta(item.dataPlanejada)}
          </span>
        )}
        {item.idMassa && <span className={`${chip} bg-white/10 text-on-surface-variant`}>{`massa ${item.idMassa}`}</span>}
        {incAbertos.map((inc) => (
          <span key={inc.numero} data-testid={`etiqueta-${inc.numero}`} title={inc.titulo} className={`${chip} border border-neon-error/50 font-mono text-neon-error`}>
            {inc.numero}
          </span>
        ))}
      </div>

      {bloqueado && (
        <span className="flex items-center gap-1 text-[11px] text-volt-green">
          <Lock size={11} aria-hidden />
          {`Aguardando ${item.bloqueadoPor.join(', ')} passar`}
        </span>
      )}

      {item.responsavel && (
        <span className="flex items-center gap-2 text-[11px] text-on-surface-variant">
          <span aria-hidden className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-black text-black ${dono ? CLASSE_COR[dono.cor] : 'bg-white/30'}`}>
            {iniciais(nome(item.responsavel))}
          </span>
          <span>{`Resp. ${nome(item.responsavel)}`}</span>
        </span>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        {item.status === 'concluido' && (
          <select
            aria-label={`Resultado de ${item.idCenario}`}
            value={item.resultado ?? ''}
            onChange={(e) => onAlterar(item, { resultado: (e.target.value || null) as Resultado | null })}
            className={`${campo} flex-1`}
          >
            <option value="">Sem resultado</option>
            <option value="passou">Passou</option>
            <option value="falhou">Falhou</option>
          </select>
        )}
        <select aria-label={`Mover ${item.idCenario} para`} value={item.status} onChange={(e) => onMover(item, e.target.value as Status)} className={`${campo} flex-1`}>
          {STATUS.map((s) => (
            <option key={s} value={s}>
              {ROTULO_STATUS[s]}
            </option>
          ))}
        </select>
      </div>
    </article>
  );
}
