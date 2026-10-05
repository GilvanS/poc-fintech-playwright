import { Lock } from 'lucide-react';
import BotaoExecutar from '../../execucao/BotaoExecutar.tsx';
import { useIncidentes } from '../../incidentes/ContextoIncidentes.tsx';
import { usePessoas } from '../../pessoas/ContextoPessoas.tsx';
import { ROTULO_STATUS, STATUS, type CamposItem, type ItemPlano, type Resultado, type Status } from './clientePlanos.ts';
import { formatarData } from './datas.ts';

interface Props {
  item: ItemPlano;
  onAbrir: (idCenario: string) => void;
  onAlterar: (item: ItemPlano, campos: CamposItem) => void;
  /** "Mover para" (a alternativa ao arrasto). */
  onMover: (item: ItemPlano, status: Status) => void;
  onArrastar: (idCenario: string) => void;
}

const campo =
  'w-full rounded-lg border border-white/10 bg-volt-page px-2 py-1.5 text-[11px] text-on-surface outline-none focus:border-volt-green/50';

/** Um teste no kanban: ID, nome, massa, prioridade/responsável, bloqueio por dependência e o "Mover para". */
export default function CartaoKanban({ item, onAbrir, onAlterar, onMover, onArrastar }: Props) {
  const { nome } = usePessoas();
  const incAbertos = useIncidentes().abertosDe(item.idCenario);
  const bloqueado = item.bloqueadoPor.length > 0;
  return (
    <article
      data-testid={`card-${item.idCenario}`}
      draggable
      onDragStart={() => onArrastar(item.idCenario)}
      className={`flex cursor-grab flex-col gap-1.5 rounded-xl border bg-volt-surface p-3 text-sm ${bloqueado ? 'border-volt-green/30' : 'border-white/10'}`}
    >
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => onAbrir(item.idCenario)}
          aria-label={`Abrir ${item.idCenario}`}
          className="font-mono text-xs text-volt-green underline-offset-2 hover:underline cursor-pointer"
        >
          {item.idCenario}
        </button>
        <BotaoExecutar idCenario={item.idCenario} />
      </div>
      <span className="font-bold leading-snug">{item.nome ?? '-'}</span>
      <span className="text-[11px] text-on-surface-variant">
        {item.idMassa ? `${item.funcionalidade ?? '-'} · massa ${item.idMassa}` : (item.funcionalidade ?? '-')}
      </span>
      {(item.prioridade || item.responsavel) && (
        <span className="flex flex-wrap items-center gap-1.5 text-[11px]">
          {item.prioridade && <span className="rounded-full border border-volt-green/30 px-2 py-0.5 font-black text-volt-green">{item.prioridade}</span>}
          {item.responsavel && <span className="text-on-surface-variant">{`Resp. ${nome(item.responsavel)}`}</span>}
        </span>
      )}
      {item.dataPlanejada && <span className="text-[11px] text-on-surface-variant">{`Planejada ${formatarData(item.dataPlanejada)}`}</span>}
      {bloqueado && (
        <span className="flex items-center gap-1 text-[11px] text-volt-green">
          <Lock size={11} aria-hidden />
          {`Aguardando ${item.bloqueadoPor.join(', ')} passar`}
        </span>
      )}
      {incAbertos.length > 0 && (
        <span className="flex flex-wrap gap-1">
          {incAbertos.map((inc) => (
            <span key={inc.numero} data-testid={`etiqueta-${inc.numero}`} title={inc.titulo} className="rounded-full border border-neon-error/50 px-1.5 py-0.5 font-mono text-[10px] text-neon-error">
              {inc.numero}
            </span>
          ))}
        </span>
      )}
      {item.status === 'concluido' && (
        <select
          aria-label={`Resultado de ${item.idCenario}`}
          value={item.resultado ?? ''}
          onChange={(e) => onAlterar(item, { resultado: (e.target.value || null) as Resultado | null })}
          className={campo}
        >
          <option value="">Sem resultado</option>
          <option value="passou">Passou</option>
          <option value="falhou">Falhou</option>
        </select>
      )}
      <select
        aria-label={`Mover ${item.idCenario} para`}
        value={item.status}
        onChange={(e) => onMover(item, e.target.value as Status)}
        className={campo}
      >
        {STATUS.map((s) => (
          <option key={s} value={s}>
            {ROTULO_STATUS[s]}
          </option>
        ))}
      </select>
    </article>
  );
}
