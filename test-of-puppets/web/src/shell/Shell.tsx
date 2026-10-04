import { useEffect, useState, type ReactNode } from 'react';
import { ArrowLeft, Image as IconeImagem } from 'lucide-react';
import MatrixDotLoader from '../shared/MatrixDotLoader.tsx';
import FundoModal from './FundoModal.tsx';
import Sidebar from './Sidebar.tsx';
import Sino from './Sino.tsx';
import type { Lembrete } from '../lembretes/clienteLembretes.ts';
import SeletorVoce from './SeletorVoce.tsx';
import { gruposComVisoes, type ChaveAtiva, type VisaoDoMenu } from './menu.ts';
import type { ConfigFundo } from './fundo.ts';
import { gravarPreferencias, lerPreferencias } from './preferencias.ts';
import type { PlanoResumido } from '../pages/planos/clientePlanos.ts';

interface Props {
  ativo: ChaveAtiva;
  onSelecionar: (chave: ChaveAtiva) => void;
  /** Planos do servidor para o seletor "Plano" do cabeçalho. */
  planos: PlanoResumido[];
  planoAtivoId: string | null;
  onPlano: (id: string) => void;
  /** Visões salvas de "Minhas visões". */
  visoes: VisaoDoMenu[];
  /** Números ao lado dos itens do menu (INC abertos, por exemplo). */
  selos?: Partial<Record<string, string>>;
  /** "Abrir" de um lembrete do sino. */
  onLembrete?: (lembrete: Lembrete) => void;
  fundo: ConfigFundo;
  onFundo: (config: ConfigFundo) => void;
  children: ReactNode;
}

const botaoCabecalho =
  'flex items-center gap-2 px-3 py-2.5 rounded-2xl border border-white/10 bg-white/5 text-sm font-bold text-on-surface hover:bg-white/10 transition-colors cursor-pointer';
const seletor =
  'rounded-xl border border-white/10 bg-volt-page px-2.5 py-2 text-xs font-bold text-on-surface outline-none focus:border-volt-green/50';

type Servidor = 'verificando' | 'online' | 'fora';

function StatusServidor() {
  const [estado, setEstado] = useState<Servidor>('verificando');

  useEffect(() => {
    let ativo = true;
    fetch('/api/saude')
      .then((r) => r.json())
      .then((j: { ok?: boolean }) => ativo && setEstado(j.ok ? 'online' : 'fora'))
      .catch(() => ativo && setEstado('fora'));
    return () => {
      ativo = false;
    };
  }, []);

  const cor = estado === 'online' ? 'bg-volt-green' : estado === 'fora' ? 'bg-neon-error' : 'bg-on-surface-variant';
  const texto = estado === 'online' ? 'Servidor online' : estado === 'fora' ? 'Servidor fora do ar' : 'Verificando servidor…';
  return (
    <span data-testid="saude" className="hidden lg:flex items-center gap-2 text-xs text-on-surface-variant">
      <span className={`h-2 w-2 rounded-full ${cor}`} aria-hidden />
      {texto}
    </span>
  );
}

/**
 * Estrutura da aplicação logada: menu lateral recolhível (esquerda por padrão), cartão de
 * cabeçalho no estilo do Admin, fileira de botões no celular e a janela "Fundo".
 * O seletor "Plano" e "Você" são reais; só os lembretes do cabeçalho ainda são de exemplo (T10, adiada).
 */
export default function Shell({ ativo, onSelecionar, planos, planoAtivoId, onPlano, visoes, selos, onLembrete, fundo, onFundo, children }: Props) {
  const [preferencias, setPreferencias] = useState(lerPreferencias);
  const [fundoAberto, setFundoAberto] = useState(false);

  useEffect(() => {
    gravarPreferencias(preferencias);
  }, [preferencias]);

  const { lado, recolhido } = preferencias;
  const menu = (
    <Sidebar
      lado={lado}
      recolhido={recolhido}
      ativo={ativo}
      visoes={visoes}
      selos={selos}
      onSelecionar={onSelecionar}
      onAlternarLado={() => setPreferencias((p) => ({ ...p, lado: p.lado === 'esquerda' ? 'direita' : 'esquerda' }))}
      onAlternarRecolhido={() => setPreferencias((p) => ({ ...p, recolhido: !p.recolhido }))}
    />
  );

  return (
    <div data-testid="shell" data-lado={lado} className="relative z-10 min-h-screen p-4 md:p-8 flex flex-col md:flex-row gap-6 font-sans text-on-surface">
      {lado === 'esquerda' && menu}

      <main className="flex-1 min-w-0 flex flex-col gap-6">
        <header className="relative overflow-hidden p-6 rounded-2xl border border-white/10 bg-volt-surface/80 backdrop-blur-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => onSelecionar('planos')}
                aria-label="Voltar"
                className="p-2 rounded-xl border border-white/10 bg-white/5 text-on-surface hover:border-volt-green/50 hover:bg-white/10 transition-all cursor-pointer"
              >
                <ArrowLeft size={20} />
              </button>
              <div>
                <h1 className="text-2xl font-black tracking-tight">Test of Puppets</h1>
                <p className="text-xs text-on-surface-variant">Gestão de planos de execução de testes</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <StatusServidor />
              <select
                aria-label="Plano"
                value={planoAtivoId ?? ''}
                disabled={planos.length === 0}
                onChange={(e) => onPlano(e.target.value)}
                className={`${seletor} disabled:opacity-60`}
              >
                {planos.length === 0 && <option value="">Nenhum plano</option>}
                {planos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {`Plano ${p.nome}${p.resumo.executado ? ' · concluído' : ''}`}
                  </option>
                ))}
              </select>
              <SeletorVoce onCadastrar={() => onSelecionar('equipe')} />
              <Sino onAbrir={onLembrete ?? (() => {})} />
              <button type="button" onClick={() => setFundoAberto(true)} aria-label="Configurar fundo" className={botaoCabecalho}>
                <IconeImagem size={16} aria-hidden />
                <span className="hidden md:inline">Fundo</span>
                {fundo.src && <span className="h-1.5 w-1.5 rounded-full bg-volt-green" aria-hidden />}
              </button>
              <span className="hidden sm:flex items-center" style={{ ['--matrix-base' as string]: 'rgba(255,255,255,0.12)', ['--matrix-active' as string]: '#00ff9d' }}>
                <MatrixDotLoader variant="scan" scale={1.5} />
              </span>
            </div>
          </div>
        </header>

        <nav aria-label="Seções" className="flex md:hidden gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {gruposComVisoes(visoes).flatMap((g) => g.itens).map(({ chave, rotulo, icone: Icone }) => (
            <button
              key={chave}
              type="button"
              onClick={() => onSelecionar(chave)}
              aria-current={chave === ativo ? 'page' : undefined}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                chave === ativo
                  ? 'bg-volt-surface text-volt-green border border-volt-green/30'
                  : 'bg-volt-surface/60 text-on-surface-variant border border-white/10'
              }`}
            >
              <Icone size={14} className="shrink-0" aria-hidden />
              {rotulo}
            </button>
          ))}
        </nav>

        {children}
      </main>

      {lado === 'direita' && menu}

      {fundoAberto && <FundoModal config={fundo} onChange={onFundo} onFechar={() => setFundoAberto(false)} />}
    </div>
  );
}
