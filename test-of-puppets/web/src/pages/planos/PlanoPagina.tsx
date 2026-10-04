import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { TipoVisao } from '../../visoes/clienteVisoes.ts';
import type { PlanoResumido } from './clientePlanos.ts';
import type { Filtros } from './filtros.ts';
import PlanoDetalhe from './PlanoDetalhe.tsx';

interface Props {
  titulo: string;
  icone: LucideIcon;
  tipo: TipoVisao;
  /** O plano escolhido no cabeçalho; null quando ainda não existe nenhum. */
  plano: PlanoResumido | null;
  filtrosIniciais?: Filtros;
  /** Abre já o detalhe deste teste (o "abrir teste" do Release). */
  testeInicial?: string;
  /** "abrir retro" do aviso de ações pendentes de retros anteriores. */
  onAbrirRetro?: (planoId: string) => void;
  /** Botões ao lado do título (ex.: "Excluir visão"). */
  acoes?: ReactNode;
  /** Muda quando a visão muda, para os filtros recomeçarem do que a visão guardou. */
  chaveReinicio: string;
  onIrParaPlanos: () => void;
  /** Algo mudou no plano (ou ele foi excluído): o cabeçalho e a lista de planos precisam reler. */
  onMudou: () => void;
}

/**
 * Página de "Lista", "Kanban" e das visões salvas: o plano escolhido no cabeçalho em tela cheia,
 * já na visão do menu (lista ou cards) e com os filtros que a visão guardou.
 */
export default function PlanoPagina({ titulo, icone: Icone, tipo, plano, filtrosIniciais, testeInicial, onAbrirRetro, acoes, chaveReinicio, onIrParaPlanos, onMudou }: Props) {
  return (
    <section aria-label={titulo} className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="flex items-center gap-3 text-xl font-black uppercase tracking-tight text-on-surface">
          <Icone size={22} className="text-volt-green" aria-hidden />
          {titulo}
        </h2>
        {acoes}
      </div>

      {plano ? (
        <PlanoDetalhe
          key={`${chaveReinicio}:${plano.id}`}
          id={plano.id}
          modo="pagina"
          visaoInicial={tipo === 'kanban' ? 'card' : 'lista'}
          filtrosIniciais={filtrosIniciais}
          testeInicial={testeInicial}
          onAbrirRetro={onAbrirRetro}
          onFechar={onMudou}
          onMudou={onMudou}
        />
      ) : (
        <div className="rounded-3xl border border-white/10 bg-volt-surface/80 backdrop-blur-sm p-8 text-center text-sm text-on-surface-variant flex flex-col items-center gap-3">
          <p>Nenhum plano para mostrar. Crie um plano e escolha-o no cabeçalho.</p>
          <button
            type="button"
            onClick={onIrParaPlanos}
            className="px-4 py-2 rounded-full border border-volt-green/40 bg-volt-green/10 text-sm font-black text-volt-green hover:bg-volt-green/20 cursor-pointer"
          >
            Ir para Planos
          </button>
        </div>
      )}
    </section>
  );
}
