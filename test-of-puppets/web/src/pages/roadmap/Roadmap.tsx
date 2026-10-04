import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { usePessoas } from '../../pessoas/ContextoPessoas.tsx';
import { itemPorChave } from '../../shell/menu.ts';
import { ErroApi } from '../cenarios/clienteApi.ts';
import { alterarTeste, editarPlano, listarPlanos, obterPlano, type DetalhePlano } from '../planos/clientePlanos.ts';
import { hojeISO } from '../planos/datas.ts';
import { SEM_VALOR } from '../planos/filtros.ts';
import PlanoDetalhe from '../planos/PlanoDetalhe.tsx';
import GradeRoadmap, { type Arrasto } from './GradeRoadmap.tsx';
import { deslocar, ehFimDeSemana, inicioPara, montarJanela, rotuloDoPeriodo, type Zoom } from './linhaDoTempo.ts';

interface Props {
  /** Data de "hoje" (aaaa-mm-dd); só os testes passam isto. */
  hoje?: string;
  onIrParaPlanos: () => void;
}

const botao =
  'flex items-center gap-2 px-3 py-2 rounded-full border border-white/10 bg-white/5 text-sm font-bold text-on-surface-variant hover:bg-white/10 disabled:opacity-60 cursor-pointer';
const campo = 'rounded-lg border border-white/10 bg-volt-page px-2.5 py-2 text-xs text-on-surface outline-none focus:border-volt-green/50';

const mensagemDe = (e: unknown) => (e instanceof ErroApi ? e.message : 'Erro inesperado.');

/**
 * Roadmap (V2): linha do tempo dos planos e, abrindo o plano, dos testes. Arrastar a barra de um teste muda a
 * data planejada; arrastar o ◆ do plano muda a previsão. Nada é executado e nada vai para a planilha.
 */
export default function Roadmap({ hoje: hojeProp, onIrParaPlanos }: Props) {
  const hoje = hojeProp ?? hojeISO();
  const { rotulo, icone: Icone } = itemPorChave('roadmap');
  const { ativas, nome } = usePessoas();
  const [zoom, setZoom] = useState<Zoom>('mensal');
  const [inicio, setInicio] = useState(() => inicioPara('mensal', hoje));
  const [permitirFds, setPermitirFds] = useState(false);
  const [responsavel, setResponsavel] = useState('');
  const [recolhidos, setRecolhidos] = useState<Set<string>>(new Set());
  const [planos, setPlanos] = useState<DetalhePlano[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [atualizando, setAtualizando] = useState(false);
  const [aberto, setAberto] = useState<{ planoId: string; idCenario?: string } | null>(null);
  const arrastando = useRef<Arrasto | null>(null);

  const carregar = useCallback(async () => {
    setAtualizando(true);
    try {
      const resumos = await listarPlanos();
      setPlanos(await Promise.all(resumos.map((p) => obterPlano(p.id))));
      setErro(null);
    } catch (e) {
      setErro(mensagemDe(e));
    } finally {
      setAtualizando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const janela = useMemo(() => montarJanela(zoom, inicio), [zoom, inicio]);

  const mudarZoom = (novo: Zoom) => {
    setZoom(novo);
    setInicio(inicioPara(novo, hoje));
  };

  /** Roda a gravação, mostra o motivo se o servidor recusar e sempre relê (a regra de datas pode ter pesado). */
  const gravar = async (acao: () => Promise<unknown>) => {
    setAviso(null);
    try {
      await acao();
    } catch (e) {
      setAviso(mensagemDe(e));
    }
    await carregar();
  };

  const soltar = (planoId: string, dia: string) => {
    const arrasto = arrastando.current;
    arrastando.current = null;
    if (!arrasto || arrasto.planoId !== planoId) return;
    if (!permitirFds && ehFimDeSemana(dia)) {
      setAviso('Fins de semana estão desligados: marque "Fins de semana" para planejar num sábado ou domingo.');
      return;
    }
    const detalhe = planos?.find((p) => p.plano.id === planoId);
    if (!detalhe) return;
    if (arrasto.tipo === 'previsao') {
      if (detalhe.plano.previsao !== dia) void gravar(() => editarPlano(planoId, detalhe.plano.versao, { previsao: dia }));
      return;
    }
    const item = detalhe.itens.find((i) => i.idCenario === arrasto.idCenario);
    if (item && item.dataPlanejada !== dia) void gravar(() => alterarTeste(planoId, item.idCenario, item.versao, { dataPlanejada: dia }));
  };

  const alternar = (planoId: string) =>
    setRecolhidos((atual) => {
      const novo = new Set(atual);
      if (novo.has(planoId)) novo.delete(planoId);
      else novo.add(planoId);
      return novo;
    });

  const fecharDetalhe = useCallback(() => setAberto(null), []);

  const responsaveis = useMemo(() => {
    const ids = new Set<string>(ativas.map((p) => p.id));
    for (const p of planos ?? []) for (const i of p.itens) if (i.responsavel) ids.add(i.responsavel);
    return [...ids];
  }, [ativas, planos]);

  return (
    <section aria-label={rotulo} className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="flex items-center gap-3 text-xl font-black uppercase tracking-tight text-on-surface">
          <Icone size={22} className="text-volt-green" aria-hidden />
          {rotulo}
        </h2>
        <button type="button" onClick={() => void carregar()} disabled={atualizando} className={botao}>
          <RefreshCw size={16} className={atualizando ? 'animate-spin' : ''} aria-hidden />
          Atualizar
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs">
        <div role="group" aria-label="Zoom" className="flex overflow-hidden rounded-lg border border-white/10">
          {(['mensal', 'trimestral'] as const).map((z) => (
            <button
              key={z}
              type="button"
              aria-pressed={zoom === z}
              onClick={() => mudarZoom(z)}
              className={`px-3 py-2 font-bold cursor-pointer ${zoom === z ? 'bg-volt-surface text-volt-green' : 'bg-white/5 text-on-surface-variant hover:bg-white/10'}`}
            >
              {z === 'mensal' ? 'Mensal' : 'Trimestral'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setInicio(deslocar(zoom, inicio, -1))} aria-label="Período anterior" className="p-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 cursor-pointer">
            <ChevronLeft size={14} aria-hidden />
          </button>
          <span data-testid="periodo" className="min-w-28 text-center font-black">{rotuloDoPeriodo(janela)}</span>
          <button type="button" onClick={() => setInicio(deslocar(zoom, inicio, 1))} aria-label="Próximo período" className="p-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 cursor-pointer">
            <ChevronRight size={14} aria-hidden />
          </button>
        </div>
        <button type="button" onClick={() => setInicio(inicioPara(zoom, hoje))} className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 font-bold hover:bg-white/10 cursor-pointer">
          Hoje
        </button>
        <label className="flex items-center gap-2 font-bold text-on-surface-variant">
          Resp.
          <select value={responsavel} onChange={(e) => setResponsavel(e.target.value)} className={campo}>
            <option value="">Todos</option>
            <option value={SEM_VALOR}>Sem responsável</option>
            {responsaveis.map((id) => (
              <option key={id} value={id}>
                {nome(id)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 font-bold text-on-surface-variant">
          <input type="checkbox" checked={permitirFds} onChange={(e) => setPermitirFds(e.target.checked)} className="accent-volt-green" />
          Fins de semana
        </label>
      </div>

      {erro && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-neon-error/40 bg-neon-error/10 p-4 text-sm text-neon-error">
          <span>{`Não foi possível carregar o roadmap. ${erro}`}</span>
          <button type="button" onClick={() => void carregar()} className={botao}>
            Tentar de novo
          </button>
        </div>
      )}
      {aviso && (
        <p role="alert" className="rounded-xl border border-neon-error/40 bg-neon-error/10 px-3 py-2 text-xs text-neon-error">
          {aviso}
        </p>
      )}

      {planos && planos.length === 0 && (
        <div className="rounded-3xl border border-white/10 bg-volt-surface/80 p-8 text-center text-sm text-on-surface-variant flex flex-col items-center gap-3">
          <p>Nenhum plano ainda.</p>
          <button type="button" onClick={onIrParaPlanos} className="px-4 py-2 rounded-full border border-volt-green/40 bg-volt-green/10 text-sm font-black text-volt-green hover:bg-volt-green/20 cursor-pointer">
            Ir para Planos
          </button>
        </div>
      )}

      {planos && planos.length > 0 && (
        <>
          <GradeRoadmap
            janela={janela}
            hoje={hoje}
            planos={planos}
            recolhidos={recolhidos}
            responsavel={responsavel}
            arrastavel={zoom === 'mensal'}
            onAlternar={alternar}
            onArrastar={(a) => {
              arrastando.current = a;
            }}
            onSoltar={soltar}
            onAbrir={(planoId, idCenario) => setAberto({ planoId, idCenario })}
          />
          <p className="text-xs text-on-surface-variant">
            {zoom === 'mensal'
              ? 'Arraste a barra de um teste para mudar o dia planejado, ou o ◆ do plano para mudar a previsão. '
              : 'Para arrastar datas use o zoom Mensal. '}
            Legenda: ok passou · XX falhou · tracejado planejado · amarelo atrasado · faixa cinza fim de semana · linha verde hoje.
          </p>
        </>
      )}

      {aberto && (
        <PlanoDetalhe
          key={`${aberto.planoId}:${aberto.idCenario ?? ''}`}
          id={aberto.planoId}
          testeInicial={aberto.idCenario}
          onFechar={fecharDetalhe}
          onMudou={() => void carregar()}
        />
      )}
    </section>
  );
}
