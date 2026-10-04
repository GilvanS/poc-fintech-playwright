import {
  excedente,
  itensDaSemana,
  rotuloDoDia,
  usoDaSemana,
  type ItemDoPlano,
  type LinhaPessoa,
} from './planejamentoEquipe.ts';

interface Props {
  dias: string[];
  /** Segunda-feira da semana mostrada. */
  inicio: string;
  hoje: string;
  linhas: LinhaPessoa[];
  onArrastar: (item: ItemDoPlano) => void;
  onSoltar: (linha: LinhaPessoa, dia: string) => void;
  onAbrir: (item: ItemDoPlano) => void;
}

/** Um teste na grade: ID, prioridade e minutos (ou "?" quando não tem estimativa). */
function Chip({ item, onArrastar, onAbrir }: { item: ItemDoPlano; onArrastar: (item: ItemDoPlano) => void; onAbrir: (item: ItemDoPlano) => void }) {
  const concluido = item.status === 'concluido';
  const minutos = item.estimativaMin ? `${item.estimativaMin} min` : '?';
  return (
    <button
      type="button"
      draggable={!concluido}
      onDragStart={() => onArrastar(item)}
      onClick={() => onAbrir(item)}
      aria-label={`${item.idCenario}: ${item.estimativaMin ? `${item.estimativaMin} min` : 'sem estimativa'}`}
      title={`${item.idCenario} · ${item.nome ?? '-'}\nPlano ${item.planoNome}${concluido ? '\nJá concluído: não dá para mover' : '\nArraste para outro dia ou outra pessoa'}`}
      className={`flex w-full flex-col items-start rounded-lg border px-2 py-1 text-left text-[11px] ${
        concluido ? 'border-white/10 bg-white/5 opacity-70 cursor-pointer' : 'border-volt-green/30 bg-volt-green/10 cursor-grab hover:bg-volt-green/20'
      }`}
    >
      <span className="font-mono font-black text-volt-green">
        {item.idCenario}
        {item.prioridade ? <span className="ml-1 text-on-surface">{`[${item.prioridade}]`}</span> : null}
      </span>
      <span className="text-on-surface-variant">{minutos}</span>
    </button>
  );
}

/** A semana em tabela: uma linha por pessoa, uma coluna por dia, e no fim o uso × capacidade. */
export default function GradeSemana({ dias, inicio, hoje, linhas, onArrastar, onSoltar, onAbrir }: Props) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#161616]/90">
      <table className="w-full min-w-[44rem] text-xs">
        <thead>
          <tr className="text-[11px] uppercase tracking-wide text-on-surface-variant">
            <th className="w-28 px-2 py-2 text-left" />
            {dias.map((d) => (
              <th key={d} data-testid={`dia-${d}`} className={`px-2 py-2 text-center ${d === hoje ? 'text-volt-green' : ''}`}>
                {rotuloDoDia(d)}
              </th>
            ))}
            <th className="w-32 px-2 py-2 text-right">Uso/Capacidade</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((linha) => {
            const uso = usoDaSemana(linha.itens, inicio);
            const passou = excedente(linha.capacidade, uso);
            const naSemana = itensDaSemana(linha.itens, inicio);
            return (
              <tr key={linha.chave} data-testid={`linha-pessoa-${linha.chave}`} className="border-t border-white/5 align-top">
                <th scope="row" className="px-2 py-2 text-left font-black">{linha.nome}</th>
                {dias.map((d) => (
                  <td
                    key={d}
                    data-testid={`celula-${linha.chave}-${d}`}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      onSoltar(linha, d);
                    }}
                    className={`min-h-14 min-w-28 border-l border-white/5 p-1.5 ${d === hoje ? 'bg-volt-green/5' : ''}`}
                  >
                    <div className="flex min-h-12 flex-col gap-1">
                      {naSemana
                        .filter((i) => i.dataPlanejada === d)
                        .map((i) => (
                          <Chip key={`${i.planoId}:${i.idCenario}`} item={i} onArrastar={onArrastar} onAbrir={onAbrir} />
                        ))}
                    </div>
                  </td>
                ))}
                <td data-testid={`uso-${linha.chave}`} className={`px-2 py-2 text-right font-black ${passou > 0 ? 'text-neon-error' : ''}`}>
                  {linha.capacidade > 0 ? `${uso}/${linha.capacidade} min` : `${uso} min`}
                  {passou > 0 && <div className="text-[10px]">{`EXCEDEU em ${passou} min`}</div>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
