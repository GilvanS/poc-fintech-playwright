import type { CSSProperties, ReactNode } from 'react';
import { ChevronDown, ChevronRight, Diamond } from 'lucide-react';
import { usePessoas } from '../../pessoas/ContextoPessoas.tsx';
import type { DetalhePlano, ItemPlano } from '../planos/clientePlanos.ts';
import { formatarData } from '../planos/datas.ts';
import { barraDoTeste, cargaPorColuna, faixaNaJanela, type EstadoBarra, type Janela } from './linhaDoTempo.ts';

/** O que está sendo arrastado: a barra de um teste (muda a data) ou o ◆ de um plano (muda a previsão). */
export type Arrasto = { tipo: 'teste'; planoId: string; idCenario: string } | { tipo: 'previsao'; planoId: string };

interface Props {
  janela: Janela;
  hoje: string;
  planos: DetalhePlano[];
  recolhidos: Set<string>;
  /** '' = todos; id da pessoa; ou '__sem' = sem responsável. */
  responsavel: string;
  /** Só o zoom Mensal tem uma coluna por dia, então só nele dá para arrastar. */
  arrastavel: boolean;
  onAlternar: (planoId: string) => void;
  onArrastar: (arrasto: Arrasto) => void;
  onSoltar: (planoId: string, dia: string) => void;
  onAbrir: (planoId: string, idCenario?: string) => void;
}

const ROTULO_ESTADO: Record<EstadoBarra, string> = {
  ok: 'passou',
  falhou: 'falhou',
  concluido: 'concluído',
  atrasado: 'atrasado',
  planejado: 'planejado',
  sem_data: 'sem data',
};

const ESTILO_ESTADO: Record<EstadoBarra, string> = {
  ok: 'bg-volt-green text-black',
  falhou: 'bg-neon-error text-black',
  concluido: 'bg-white/50 text-black',
  atrasado: 'bg-[#FFD700]/30 border border-[#FFD700]/70 text-[#FFD700]',
  planejado: 'bg-white/10 border border-dashed border-white/40 text-on-surface-variant',
  sem_data: '',
};

const TEXTO_BARRA: Partial<Record<EstadoBarra, string>> = { ok: 'ok', falhou: 'XX' };

const dataDoPlano = (p: DetalhePlano['plano']) => p.criadoEm.slice(0, 10);

/**
 * A grade do Roadmap: uma linha por plano (criação → previsão) e, com o plano aberto, uma por teste.
 * As colunas são dias (Mensal) ou semanas (Trimestral); cada linha repete a mesma grade para as barras alinharem.
 */
export default function GradeRoadmap({ janela, hoje, planos, recolhidos, responsavel, arrastavel, onAlternar, onArrastar, onSoltar, onAbrir }: Props) {
  const { nome } = usePessoas();
  const n = janela.unidades.length;
  const modelo: CSSProperties = { gridTemplateColumns: `15rem repeat(${n}, minmax(${janela.zoom === 'mensal' ? '1.75rem' : '3.5rem'}, 1fr))` };
  const doFiltro = (i: ItemPlano) => !responsavel || (responsavel === '__sem' ? !i.responsavel : i.responsavel === responsavel);
  const emColuna = (c: number): CSSProperties => ({ gridColumn: c + 2, gridRow: 1 });
  const ocupa = (de: number, ate: number): CSSProperties => ({ gridColumn: `${de + 2} / ${ate + 3}`, gridRow: 1 });

  const fundoDasColunas = (planoId?: string) =>
    janela.unidades.map((u, i) => {
      const ehHoje = hoje >= u.inicio && hoje <= u.fim;
      return (
        <div
          key={u.inicio}
          data-dia={u.inicio}
          style={emColuna(i)}
          onDragOver={(e) => arrastavel && planoId && e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (arrastavel && planoId) onSoltar(planoId, u.inicio);
          }}
          className={`min-h-9 ${u.fimDeSemana ? 'bg-white/[0.04]' : ''} ${ehHoje ? 'border-l-2 border-volt-green/70 bg-volt-green/5' : 'border-l border-white/5'}`}
        />
      );
    });

  const linha = (testid: string, rotulo: ReactNode, barras: ReactNode, planoId?: string) => (
    <div key={testid} data-testid={testid} style={modelo} className="grid items-stretch border-t border-white/5">
      <div className="sticky left-0 z-20 flex items-center gap-1.5 bg-[#161616] px-2 py-1 text-xs">{rotulo}</div>
      {fundoDasColunas(planoId)}
      {barras}
    </div>
  );

  const barraDoPlano = (d: DetalhePlano) => {
    const ini = dataDoPlano(d.plano);
    const fim = d.plano.previsao && d.plano.previsao >= ini ? d.plano.previsao : ini;
    const faixa = faixaNaJanela(janela, ini, fim);
    if (!faixa) return null;
    const dica = `Plano ${d.plano.nome}\nCriado em ${formatarData(ini)} · Previsão ${formatarData(d.plano.previsao)}`;
    const alcaDoFim = d.plano.previsao && !faixa.cortadaNaDireita;
    return (
      <>
        <button
          type="button"
          style={ocupa(faixa.de, faixa.ate)}
          onClick={() => onAbrir(d.plano.id)}
          aria-label={`Abrir plano ${d.plano.nome}`}
          title={dica}
          className="z-10 m-1 self-center h-5 rounded-md border border-volt-green/50 bg-volt-green/20 text-[10px] font-black text-volt-green cursor-pointer hover:bg-volt-green/30"
        >
          {faixa.ate - faixa.de >= 3 ? `${d.resumo.percentual}%` : ''}
        </button>
        {alcaDoFim && (
          <button
            type="button"
            style={emColuna(faixa.ate)}
            draggable={arrastavel}
            onDragStart={() => onArrastar({ tipo: 'previsao', planoId: d.plano.id })}
            aria-label={`Previsão do plano ${d.plano.nome}: ${formatarData(d.plano.previsao)}`}
            title={`Previsão: ${formatarData(d.plano.previsao)}${arrastavel ? '\nArraste para mudar a previsão' : ''}`}
            className={`z-20 self-center justify-self-end text-volt-green ${arrastavel ? 'cursor-grab' : 'cursor-default'}`}
          >
            <Diamond size={12} fill="currentColor" aria-hidden />
          </button>
        )}
      </>
    );
  };

  const barraDoItem = (planoId: string, item: ItemPlano) => {
    const { estado, data } = barraDoTeste(item, hoje);
    if (!data) return null;
    const faixa = faixaNaJanela(janela, data, data);
    if (!faixa) return null;
    const concluido = item.status === 'concluido';
    const dica = [
      `${item.idCenario} · ${item.nome ?? '-'}${item.prioridade ? `  [${item.prioridade}]` : ''}`,
      `Resp.: ${nome(item.responsavel)} · Est.: ${item.estimativaMin ? `${item.estimativaMin} min` : '-'}`,
      `${concluido ? 'Executado' : 'Planejado'}: ${formatarData(data)} (${ROTULO_ESTADO[estado]})`,
      item.massaCompartilhadaCom.length > 0 ? `= massa ${item.idMassa ?? ''} compartilhada com ${item.massaCompartilhadaCom.join(', ')}` : '',
      !concluido && arrastavel ? 'Arraste a barra para mudar a data' : '',
    ]
      .filter(Boolean)
      .join('\n');
    const podeArrastar = arrastavel && !concluido;
    return (
      <button
        type="button"
        style={ocupa(faixa.de, faixa.ate)}
        draggable={podeArrastar}
        onDragStart={() => onArrastar({ tipo: 'teste', planoId, idCenario: item.idCenario })}
        onClick={() => onAbrir(planoId, item.idCenario)}
        aria-label={`${item.idCenario}: ${ROTULO_ESTADO[estado]} em ${formatarData(data)}`}
        title={dica}
        className={`z-10 m-1 self-center h-5 rounded text-[10px] font-black ${ESTILO_ESTADO[estado]} ${podeArrastar ? 'cursor-grab' : 'cursor-pointer'}`}
      >
        {TEXTO_BARRA[estado] ?? ''}
      </button>
    );
  };

  const linhasDoPlano = (d: DetalhePlano) => {
    const aberto = !recolhidos.has(d.plano.id);
    const itens = d.itens.filter(doFiltro);
    const comData = itens.filter((i) => barraDoTeste(i, hoje).estado !== 'sem_data');
    const semData = itens.filter((i) => barraDoTeste(i, hoje).estado === 'sem_data');
    const linhas: ReactNode[] = [
      linha(
        `linha-plano-${d.plano.id}`,
        <>
          <button
            type="button"
            onClick={() => onAlternar(d.plano.id)}
            aria-expanded={aberto}
            aria-label={`${aberto ? 'Recolher' : 'Expandir'} plano ${d.plano.nome}`}
            className="p-0.5 rounded hover:bg-white/10 cursor-pointer"
          >
            {aberto ? <ChevronDown size={14} aria-hidden /> : <ChevronRight size={14} aria-hidden />}
          </button>
          <span className="min-w-0 truncate font-black">{`Plano ${d.plano.nome}`}</span>
        </>,
        barraDoPlano(d),
        d.plano.id,
      ),
    ];
    if (!aberto) return linhas;
    if (d.itens.length === 0) {
      linhas.push(linha(`vazio-${d.plano.id}`, <span className="pl-6 text-on-surface-variant">(sem testes)</span>, null));
    }
    for (const item of comData) {
      linhas.push(
        linha(
          `linha-teste-${d.plano.id}-${item.idCenario}`,
          <span className="min-w-0 truncate pl-6">
            <span className="font-mono text-volt-green">{item.idCenario}</span>
            {item.prioridade ? <span className="ml-1.5 font-black">{item.prioridade}</span> : null}
            <span className="ml-1.5 text-on-surface-variant">{item.responsavel ? nome(item.responsavel) : ''}</span>
          </span>,
          barraDoItem(d.plano.id, item),
          d.plano.id,
        ),
      );
    }
    if (semData.length > 0) {
      linhas.push(
        <div key={`sem-data-${d.plano.id}`} data-testid={`sem-data-${d.plano.id}`} className="flex flex-wrap items-center gap-2 border-t border-white/5 px-2 py-1.5 pl-8 text-xs">
          <span className="font-bold text-on-surface-variant">{`Sem data (${semData.length})`}</span>
          {semData.map((i) => (
            <button
              key={i.idCenario}
              type="button"
              onClick={() => onAbrir(d.plano.id, i.idCenario)}
              aria-label={`Definir data de ${i.idCenario}`}
              className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 font-mono text-[11px] hover:bg-white/10 cursor-pointer"
            >
              {`${i.idCenario} · definir data`}
            </button>
          ))}
        </div>,
      );
    }
    return linhas;
  };

  const carga = cargaPorColuna(janela, planos.flatMap((p) => p.itens.filter(doFiltro)));

  return (
    <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#161616]/90">
      <div className="min-w-[56rem]">
        <div style={modelo} className="grid text-[10px] font-black uppercase text-on-surface-variant">
          <div className="sticky left-0 z-20 bg-[#161616]" />
          {janela.meses.map((m, i) => (
            <div
              key={`${m.rotulo}-${i}`}
              style={{ gridColumn: `span ${m.colunas}` }}
              className="border-l border-white/10 px-1.5 py-1"
            >
              {m.rotulo}
            </div>
          ))}
        </div>
        <div style={modelo} className="grid text-center text-[10px] text-on-surface-variant">
          <div className="sticky left-0 z-20 bg-[#161616]" />
          {janela.unidades.map((u) => (
            <div
              key={u.inicio}
              data-testid={`coluna-${u.inicio}`}
              className={`border-l border-white/5 py-1 ${u.fimDeSemana ? 'bg-white/[0.04]' : ''} ${hoje >= u.inicio && hoje <= u.fim ? 'font-black text-volt-green' : ''}`}
            >
              <div>{u.rotulo}</div>
              {u.sub && <div>{u.sub}</div>}
            </div>
          ))}
        </div>

        {planos.flatMap(linhasDoPlano)}

        {janela.zoom === 'trimestral' &&
          linha(
            'linha-carga',
            <span className="font-bold text-on-surface-variant">Carga prevista (min)</span>,
            carga.map((minutos, i) => (
              <div key={janela.unidades[i].inicio} style={emColuna(i)} className="z-10 flex items-center justify-center text-[11px] font-black">
                {minutos > 0 ? minutos : <span className="text-on-surface-variant/50">·</span>}
              </div>
            )),
          )}
      </div>
    </div>
  );
}
