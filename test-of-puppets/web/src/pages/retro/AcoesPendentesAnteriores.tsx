import { useEffect, useMemo, useState } from 'react';
import { ListChecks } from 'lucide-react';
import { usePessoas } from '../../pessoas/ContextoPessoas.tsx';
import { listarRetros, type Retro } from '../../retros/clienteRetros.ts';
import { listarPlanos } from '../planos/clientePlanos.ts';
import { formatarData, hojeISO } from '../planos/datas.ts';
import { acoesPendentesDeAnteriores } from './acoesPendentes.ts';
import { textoDoPrazo } from './calculoRetro.ts';

interface Props {
  planoId: string;
  /** Data de "hoje" (aaaa-mm-dd); só os testes passam isto. */
  hoje?: string;
  /** Leva para a retro daquele plano; sem isto o aviso só informa. */
  onAbrirRetro?: (planoId: string) => void;
}

/**
 * Ao abrir um plano, lembra das ações que ficaram pendentes nas retros dos planos anteriores ("ações pendentes de retros
 * anteriores aparecem na abertura do plano seguinte"). Não aparece quando não há nada pendente ou se o servidor falhar.
 */
export default function AcoesPendentesAnteriores({ planoId, hoje: hojeProp, onAbrirRetro }: Props) {
  const hoje = hojeProp ?? hojeISO();
  const { nome } = usePessoas();
  const [dados, setDados] = useState<{ planos: { id: string; nome: string }[]; retros: Retro[] } | null>(null);

  useEffect(() => {
    let vivo = true;
    Promise.all([listarPlanos(), listarRetros()])
      .then(([planos, retros]) => vivo && setDados({ planos: Array.isArray(planos) ? planos : [], retros: Array.isArray(retros) ? retros : [] }))
      .catch(() => vivo && setDados(null));
    return () => {
      vivo = false;
    };
  }, [planoId]);

  const pendentes = useMemo(() => (dados ? acoesPendentesDeAnteriores(planoId, dados.planos, dados.retros) : []), [dados, planoId]);
  if (pendentes.length === 0) return null;

  return (
    <section aria-label="Ações pendentes de retros anteriores" data-testid="acoes-pendentes-anteriores" className="mx-5 mb-3 rounded-2xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-xs">
      <h4 className="flex items-center gap-2 font-black uppercase tracking-wide text-amber-200">
        <ListChecks size={14} aria-hidden />
        {`Ações pendentes de retros anteriores (${pendentes.length})`}
      </h4>
      <ul className="mt-2 flex flex-col gap-1.5">
        {pendentes.map(({ planoId: origem, planoNome, acao }) => (
          <li key={acao.id} className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-bold">{acao.texto}</span>
            <span className="text-on-surface-variant">
              {[
                acao.responsavel ? nome(acao.responsavel) : 'sem responsável',
                `retro do plano ${planoNome}`,
                acao.prazo ? `até ${formatarData(acao.prazo)} (${textoDoPrazo(acao.prazo, hoje)})` : 'sem prazo',
              ].join(' · ')}
            </span>
            {onAbrirRetro && (
              <button type="button" aria-label={`Abrir a retro do plano ${planoNome}`} onClick={() => onAbrirRetro(origem)} className="font-bold text-volt-green hover:underline cursor-pointer">
                abrir retro
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
