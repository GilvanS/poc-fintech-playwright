import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { SEM_LIMITES, type Wip } from '../../config/clienteConfig.ts';
import { usePessoas } from '../../pessoas/ContextoPessoas.tsx';
import type { Agrupar } from './BarraKanban.tsx';
import CartaoKanban from './CartaoKanban.tsx';
import { ROTULO_STATUS, STATUS, type CamposItem, type ItemPlano, type Status } from './clientePlanos.ts';

interface Props {
  /** Os testes que passaram nos filtros. */
  itens: ItemPlano[];
  /** O plano inteiro: o limite de WIP conta todos os testes, não só os filtrados. */
  todos?: ItemPlano[];
  wip?: Wip;
  agrupar?: Agrupar;
  onAlterar: (item: ItemPlano, campos: CamposItem) => void;
  /** Abre o detalhe do teste (clique no ID do card). */
  onAbrir: (idCenario: string) => void;
  /** Avisa o pai quando a confirmação está aberta (o Esc dela não deve fechar a janela de trás). */
  onConfirmando?: (aberta: boolean) => void;
}

interface Raia {
  chave: string;
  /** Id da pessoa; null = "Sem dono". */
  responsavel: string | null;
  rotulo: string;
}

interface Pendente {
  item: ItemPlano;
  campos: CamposItem;
  mensagens: string[];
  confirmar: string;
}

const SEM_DONO = '__sem';

/**
 * Visão card (kanban): uma coluna por status, ou uma raia por responsável. Arrastar o card só muda status
 * (e responsável, entre raias); nada é executado. Limite de WIP é "macio": coluna cheia pede confirmação.
 */
export default function Kanban({ itens, todos = itens, wip = SEM_LIMITES, agrupar = 'nenhum', onAlterar, onAbrir, onConfirmando }: Props) {
  const { nome, ativas } = usePessoas();
  const arrastando = useRef<string | null>(null);
  const [pendente, setPendente] = useState<Pendente | null>(null);
  const [recolhidas, setRecolhidas] = useState<Set<string>>(new Set());

  useEffect(() => {
    onConfirmando?.(pendente !== null);
    return () => onConfirmando?.(false);
  }, [pendente, onConfirmando]);

  useEffect(() => {
    if (!pendente) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPendente(null);
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [pendente]);

  const noPlano = (status: Status) => todos.filter((i) => i.status === status).length;
  const cheia = (status: Status) => wip[status] !== null && noPlano(status) >= (wip[status] as number);

  /** Pede a mudança; se mexe numa coluna cheia ou troca o responsável, confirma antes. */
  const mover = (item: ItemPlano, status: Status, responsavel?: string | null) => {
    const campos: CamposItem = {};
    const mensagens: string[] = [];
    if (status !== item.status) campos.status = status;
    if (responsavel !== undefined && responsavel !== (item.responsavel ?? null)) {
      campos.responsavel = responsavel;
      mensagens.push(`Passar ${item.idCenario} de ${item.responsavel ? nome(item.responsavel) : 'ninguém'} para ${responsavel ? nome(responsavel) : 'ninguém (sem dono)'}?`);
    }
    if (Object.keys(campos).length === 0) return;
    const reatribui = campos.responsavel !== undefined;
    const lotada = campos.status !== undefined && cheia(status);
    if (lotada) {
      mensagens.push(`A coluna ${ROTULO_STATUS[status]} já tem ${noPlano(status)} de ${wip[status]} testes. Concluir algum antes ajuda o time a focar.`);
    }
    if (mensagens.length === 0) onAlterar(item, campos);
    else setPendente({ item, campos, mensagens, confirmar: reatribui && lotada ? 'Confirmar' : reatribui ? 'Passar' : 'Soltar mesmo assim' });
  };

  const soltar = (status: Status, raia?: Raia) => {
    const item = itens.find((i) => i.idCenario === arrastando.current);
    arrastando.current = null;
    if (item) mover(item, status, raia ? raia.responsavel : undefined);
  };

  const raias = useMemo<Raia[]>(() => {
    const ids = [...ativas.map((p) => p.id), ...itens.map((i) => i.responsavel).filter((r): r is string => Boolean(r))];
    const unicos = [...new Set(ids)];
    return [
      ...unicos.map((id) => ({ chave: id, responsavel: id, rotulo: nome(id) })),
      { chave: SEM_DONO, responsavel: null, rotulo: 'Sem dono' },
    ];
  }, [ativas, itens, nome]);

  const titulo = (status: Status) => {
    const limite = wip[status];
    const visiveis = itens.filter((i) => i.status === status).length;
    return limite === null ? `${ROTULO_STATUS[status]} (${visiveis})` : `${ROTULO_STATUS[status]} (${noPlano(status)}/${limite})`;
  };

  const Titulo = ({ status }: { status: Status }) => (
    <h3 className="flex flex-wrap items-center gap-1.5 text-[11px] font-black uppercase tracking-wide text-on-surface-variant">
      {titulo(status)}
      {cheia(status) && <span className="rounded-full border border-neon-error/50 px-1.5 py-0.5 text-[9px] text-neon-error">Limite</span>}
    </h3>
  );

  const estiloColuna = (status: Status) =>
    `flex flex-col gap-2 rounded-2xl border p-3 min-h-40 ${cheia(status) ? 'border-neon-error/40 bg-neon-error/5' : 'border-white/10 bg-white/5'}`;

  const cartao = (item: ItemPlano) => (
    <CartaoKanban
      key={item.idCenario}
      item={item}
      onAbrir={onAbrir}
      onAlterar={onAlterar}
      onMover={(it, status) => mover(it, status)}
      onArrastar={(id) => {
        arrastando.current = id;
      }}
    />
  );

  const alternarRaia = (chave: string) =>
    setRecolhidas((atual) => {
      const novo = new Set(atual);
      if (novo.has(chave)) novo.delete(chave);
      else novo.add(chave);
      return novo;
    });

  const colunas = (
    <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(11rem,1fr))]">
      {STATUS.map((status) => {
        const daColuna = itens.filter((i) => i.status === status);
        return (
          <div
            key={status}
            data-testid={`coluna-${status}`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              soltar(status);
            }}
            className={estiloColuna(status)}
          >
            <Titulo status={status} />
            {daColuna.length === 0 && <p className="py-4 text-center text-xs text-on-surface-variant">Nenhum teste</p>}
            {daColuna.map(cartao)}
          </div>
        );
      })}
    </div>
  );

  const comRaias = (
    <div className="overflow-x-auto">
      <div className="grid min-w-[52rem] grid-cols-[8rem_repeat(4,minmax(10rem,1fr))] gap-2">
        <div />
        {STATUS.map((status) => (
          <div key={status} data-testid={`cabecalho-${status}`} className={`rounded-xl border px-3 py-2 ${cheia(status) ? 'border-neon-error/40 bg-neon-error/5' : 'border-white/10 bg-white/5'}`}>
            <Titulo status={status} />
          </div>
        ))}
        {raias.map((raia) => {
          const daRaia = itens.filter((i) => (i.responsavel ?? null) === raia.responsavel);
          const aberta = !recolhidas.has(raia.chave);
          return (
            <div key={raia.chave} data-testid={`raia-${raia.chave}`} className="contents">
              <button
                type="button"
                onClick={() => alternarRaia(raia.chave)}
                aria-expanded={aberta}
                aria-label={`Raia ${raia.rotulo}`}
                className="flex items-start gap-1 self-start rounded-xl border border-white/10 bg-white/5 px-2 py-2 text-left text-xs font-black cursor-pointer hover:bg-white/10"
              >
                {aberta ? <ChevronDown size={14} aria-hidden /> : <ChevronRight size={14} aria-hidden />}
                <span className="min-w-0 break-words">{`${raia.rotulo} (${daRaia.length})`}</span>
              </button>
              {STATUS.map((status) => {
                const celula = daRaia.filter((i) => i.status === status);
                return (
                  <div
                    key={status}
                    data-testid={`celula-${raia.chave}-${status}`}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      soltar(status, raia);
                    }}
                    className="flex min-h-12 flex-col gap-2 rounded-xl border border-white/5 bg-white/[0.03] p-2"
                  >
                    {aberta && celula.map(cartao)}
                    {!aberta && celula.length > 0 && <p className="text-center text-[11px] text-on-surface-variant">{`${celula.length} teste(s)`}</p>}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <>
      {agrupar === 'responsavel' ? comRaias : colunas}
      {pendente && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div role="alertdialog" aria-modal="true" aria-label="Confirmar movimento" className="w-full max-w-sm p-6 rounded-3xl bg-[#1a1a1a] border border-white/10 text-on-surface">
            <div className="space-y-2 text-sm">
              {pendente.mensagens.map((m) => (
                <p key={m} className="font-bold">
                  {m}
                </p>
              ))}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setPendente(null)} className="px-4 py-2.5 rounded-xl text-xs font-bold bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer">
                Voltar
              </button>
              <button
                type="button"
                onClick={() => {
                  const { item, campos } = pendente;
                  setPendente(null);
                  onAlterar(item, campos);
                }}
                className="px-4 py-2.5 rounded-xl text-xs font-black bg-volt-green text-black cursor-pointer"
              >
                {pendente.confirmar}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
