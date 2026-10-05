import { useEffect, useState } from 'react';
import { ArrowDownUp, Eye, Trash2 } from 'lucide-react';
import BotaoExecutar from '../../execucao/BotaoExecutar.tsx';
import { useIncidentes } from '../../incidentes/ContextoIncidentes.tsx';
import { usePessoas } from '../../pessoas/ContextoPessoas.tsx';
import { ROTULO_STATUS, STATUS, type CamposItem, type ItemPlano, type Prioridade, type Resultado, type Status } from './clientePlanos.ts';

interface Props {
  itens: ItemPlano[];
  /** Posição de cada teste na ordem de execução do plano inteiro (não muda com o filtro). */
  numeros: Map<string, number>;
  podeOrdenar: boolean;
  selecionados: Set<string>;
  onSelecionar: (idCenario: string) => void;
  /** Marca (ou desmarca) todos os testes que estão na tela. */
  onSelecionarTodos: (marcar: boolean) => void;
  onAlterar: (item: ItemPlano, campos: CamposItem) => void;
  onTirar: (idCenario: string) => void;
  onOrdem: () => void;
  /** Abre o detalhe do teste (olho). */
  onVer: (idCenario: string) => void;
}

const campo =
  'rounded-lg border border-white/10 bg-volt-page px-2 py-1.5 text-xs text-on-surface outline-none focus:border-volt-green/50 disabled:opacity-50';
const botaoIcone =
  'p-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer';

/** Estimativa em minutos, editável na célula: grava ao sair do campo ou com Enter, e só se mudou. */
function CelulaEstimativa({ item, onAlterar }: { item: ItemPlano; onAlterar: Props['onAlterar'] }) {
  const original = item.estimativaMin === undefined ? '' : String(item.estimativaMin);
  const [texto, setTexto] = useState(original);
  useEffect(() => setTexto(original), [original]);

  const confirmar = () => {
    if (texto === original) return;
    const numero = Number(texto);
    if (texto.trim() !== '' && (!Number.isInteger(numero) || numero < 0 || numero > 100000)) {
      setTexto(original); // valor inválido: volta ao que estava
      return;
    }
    onAlterar(item, { estimativaMin: texto.trim() === '' ? null : numero });
  };

  return (
    <input
      type="number"
      min={0}
      aria-label={`Estimativa de ${item.idCenario}`}
      value={texto}
      onChange={(e) => setTexto(e.target.value)}
      onBlur={confirmar}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      className={`${campo} w-20`}
    />
  );
}

/** Visão lista: uma linha por teste, com prioridade, responsável, estimativa, status, resultado, data e as ações. */
export default function ListaTestes({ itens, numeros, podeOrdenar, selecionados, onSelecionar, onSelecionarTodos, onAlterar, onTirar, onOrdem, onVer }: Props) {
  const { ativas, nome } = usePessoas();
  const { abertosDe } = useIncidentes();
  const todosMarcados = itens.length > 0 && itens.every((i) => selecionados.has(i.idCenario));

  return (
    <table className="w-full text-left text-sm">
      <thead>
        <tr className="text-[11px] uppercase tracking-wide text-on-surface-variant">
          <th className="py-2 pr-2 w-6">
            <input
              type="checkbox"
              aria-label="Selecionar todos os testes visíveis"
              checked={todosMarcados}
              onChange={(e) => onSelecionarTodos(e.target.checked)}
              className="accent-volt-green"
            />
          </th>
          <th className="py-2 pr-2 font-bold w-8">Ord</th>
          <th className="py-2 pr-3 font-bold">ID</th>
          <th className="py-2 pr-3 font-bold">Funcionalidade</th>
          <th className="py-2 pr-3 font-bold">Cenário</th>
          <th className="py-2 pr-3 font-bold">Pri</th>
          <th className="py-2 pr-3 font-bold">Resp.</th>
          <th className="py-2 pr-3 font-bold">Est.</th>
          <th className="py-2 pr-3 font-bold">Status</th>
          <th className="py-2 pr-3 font-bold">Data planejada</th>
          <th className="py-2 font-bold">
            <span className="sr-only">Ações</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {itens.map((item) => {
          // Quem já é responsável continua na lista mesmo se foi desativado depois.
          const opcoesResp = item.responsavel && !ativas.some((p) => p.id === item.responsavel) ? [{ id: item.responsavel, nome: nome(item.responsavel) }] : [];
          return (
            <tr key={item.idCenario} data-testid={`teste-${item.idCenario}`} className="border-t border-white/10 align-top">
              <td className="py-3 pr-2">
                <input
                  type="checkbox"
                  aria-label={`Selecionar ${item.idCenario}`}
                  checked={selecionados.has(item.idCenario)}
                  onChange={() => onSelecionar(item.idCenario)}
                  className="accent-volt-green"
                />
              </td>
              <td className="py-3 pr-2 font-mono text-volt-green">{numeros.get(item.idCenario)}</td>
              <td className="py-3 pr-3 font-mono text-xs whitespace-nowrap">{item.idCenario}</td>
              <td className="py-3 pr-3">{item.funcionalidade ?? '-'}</td>
              <td className="py-3 pr-3">
                <div>{item.nome ?? '-'}</div>
                {item.massaCompartilhadaCom.length > 0 && (
                  <div className="text-[11px] text-on-surface-variant">
                    {`= massa ${item.idMassa ?? ''} compartilhada com ${item.massaCompartilhadaCom.join(', ')}`}
                  </div>
                )}
                {item.bloqueadoPor.length > 0 && (
                  <div className="text-[11px] text-volt-green">{`Aguardando ${item.bloqueadoPor.join(', ')} passar`}</div>
                )}
                {abertosDe(item.idCenario).length > 0 && (
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    {abertosDe(item.idCenario).map((inc) => (
                      <span key={inc.numero} data-testid={`etiqueta-${inc.numero}`} title={inc.titulo} className="rounded-full border border-neon-error/50 px-1.5 py-0.5 font-mono text-[10px] text-neon-error">
                        {inc.numero}
                      </span>
                    ))}
                  </div>
                )}
              </td>
              <td className="py-3 pr-3">
                <select
                  aria-label={`Prioridade de ${item.idCenario}`}
                  value={item.prioridade ?? ''}
                  onChange={(e) => onAlterar(item, { prioridade: (e.target.value || null) as Prioridade | null })}
                  className={campo}
                >
                  <option value="">-</option>
                  <option value="P1">P1</option>
                  <option value="P2">P2</option>
                  <option value="P3">P3</option>
                </select>
              </td>
              <td className="py-3 pr-3">
                <select
                  aria-label={`Responsável de ${item.idCenario}`}
                  value={item.responsavel ?? ''}
                  onChange={(e) => onAlterar(item, { responsavel: e.target.value || null })}
                  className={campo}
                >
                  <option value="">Sem responsável</option>
                  {[...ativas, ...opcoesResp].map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </select>
              </td>
              <td className="py-3 pr-3">
                <CelulaEstimativa item={item} onAlterar={onAlterar} />
              </td>
              <td className="py-3 pr-3">
                <div className="flex flex-col gap-1.5">
                  <select
                    aria-label={`Status de ${item.idCenario}`}
                    value={item.status}
                    onChange={(e) => onAlterar(item, { status: e.target.value as Status })}
                    className={campo}
                  >
                    {STATUS.map((s) => (
                      <option key={s} value={s}>
                        {ROTULO_STATUS[s]}
                      </option>
                    ))}
                  </select>
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
                </div>
              </td>
              <td className="py-3 pr-3">
                <input
                  type="date"
                  aria-label={`Data planejada de ${item.idCenario}`}
                  value={item.dataPlanejada ?? ''}
                  onChange={(e) => onAlterar(item, { dataPlanejada: e.target.value || null })}
                  className={campo}
                />
              </td>
              <td className="py-3">
                <div className="flex items-center justify-end gap-1">
                  <BotaoExecutar idCenario={item.idCenario} />
                  <button type="button" onClick={() => onVer(item.idCenario)} aria-label={`Ver detalhes de ${item.idCenario}`} className={botaoIcone}>
                    <Eye size={14} aria-hidden />
                  </button>
                  <button type="button" onClick={() => onTirar(item.idCenario)} aria-label={`Tirar ${item.idCenario} do plano`} className={`${botaoIcone} hover:bg-neon-error/20`}>
                    <Trash2 size={14} aria-hidden />
                  </button>
                  <button type="button" onClick={onOrdem} disabled={!podeOrdenar} aria-label={`Ordem de execução de ${item.idCenario}`} className={botaoIcone}>
                    <ArrowDownUp size={14} aria-hidden />
                  </button>
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
