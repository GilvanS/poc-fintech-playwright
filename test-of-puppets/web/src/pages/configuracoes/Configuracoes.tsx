import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { obterConfig, salvarConfig, SEM_LIMITES, TIPOS_LEMBRETE, TODOS_LIGADOS, type Config, type Lembretes, type TipoLembrete, type Wip } from '../../config/clienteConfig.ts';
import { useLembretes } from '../../lembretes/ContextoLembretes.tsx';
import { itemPorChave } from '../../shell/menu.ts';
import { ErroApi } from '../cenarios/clienteApi.ts';
import LimitesWipModal from '../planos/LimitesWipModal.tsx';

const botao =
  'flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/5 text-sm font-bold text-on-surface-variant hover:bg-white/10 disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed';
const cartao = 'rounded-3xl border border-white/10 bg-volt-surface/80 backdrop-blur-sm p-5 flex flex-col gap-3';

const TEXTO_LEMBRETE: Record<TipoLembrete, { titulo: string; descricao: string }> = {
  teste_hoje: { titulo: 'Teste de hoje', descricao: 'Teste planejado para hoje que ainda não foi concluído.' },
  plano_vencido: { titulo: 'Plano vencido', descricao: 'Plano que passou da previsão e ainda tem testes pendentes.' },
  inc_aberto: { titulo: 'INC aberto', descricao: 'Incidente ainda não resolvido que afeta algum teste.' },
  acao_retro: { titulo: 'Ação da retro', descricao: 'Ação de retrospectiva que ainda não foi feita.' },
};

const limite = (v: number | null) => (v === null ? 'sem limite' : String(v));

/**
 * Configurações: o que vale para todos os planos e pessoas — limites de WIP do Kanban (os mesmos do M13) e quais tipos de
 * lembrete aparecem no sino. Fica em `dados/config.json`.
 */
export default function Configuracoes() {
  const { rotulo, icone: Icone } = itemPorChave('configuracoes');
  const { recarregar: recarregarSino } = useLembretes();
  const [config, setConfig] = useState<Config | null>(null);
  const [rascunho, setRascunho] = useState<Lembretes>(TODOS_LIGADOS);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [editandoWip, setEditandoWip] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const c = await obterConfig();
      setConfig(c);
      setRascunho({ ...TODOS_LIGADOS, ...c.lembretes });
      setErro(null);
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Erro inesperado.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const wip: Wip = { ...SEM_LIMITES, ...config?.wip };
  const salvosLembretes: Lembretes = { ...TODOS_LIGADOS, ...config?.lembretes };
  const mudou = TIPOS_LEMBRETE.some((t) => rascunho[t] !== salvosLembretes[t]);

  const salvarLembretes = async () => {
    setSalvando(true);
    setAviso(null);
    try {
      const nova = await salvarConfig({ lembretes: rascunho });
      setConfig(nova);
      setRascunho({ ...TODOS_LIGADOS, ...nova.lembretes });
      setErro(null);
      setAviso('Configurações salvas.');
      await recarregarSino();
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Não foi possível salvar.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <section aria-label={rotulo} className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="flex items-center gap-3 text-xl font-black uppercase tracking-tight text-on-surface">
          <Icone size={22} className="text-volt-green" aria-hidden />
          {rotulo}
        </h2>
        <button type="button" onClick={() => void carregar()} disabled={carregando} className={botao}>
          <RefreshCw size={16} className={carregando ? 'animate-spin' : ''} aria-hidden />
          Atualizar
        </button>
      </div>

      {erro && (
        <p role="alert" className="rounded-xl border border-neon-error/40 bg-neon-error/10 px-3 py-2 text-xs text-neon-error">
          {erro}
        </p>
      )}

      {config && (
        <>
          <div className={cartao}>
            <h3 className="text-sm font-black uppercase tracking-wide">Limites de WIP do Kanban</h3>
            <p data-testid="wip-resumo" className="text-sm">
              {`Em andamento: ${limite(wip.em_andamento)} · Refinamento: ${limite(wip.refinamento)} · Agendado e Concluído: sem limite`}
            </p>
            <p className="text-xs text-on-surface-variant">Limite “macio”: passou do número, a coluna avisa e o card ainda pode ser solto. Vale para todos os planos.</p>
            <button type="button" onClick={() => setEditandoWip(true)} className={`${botao} self-start`}>
              Editar limites
            </button>
          </div>

          <div className={cartao}>
            <h3 className="text-sm font-black uppercase tracking-wide">Lembretes do sino</h3>
            <p className="text-xs text-on-surface-variant">
              Escolha o que aparece no sino e no contador. Vale para todo mundo; cada pessoa só vê o que é dela ou de ninguém.
            </p>
            <ul className="flex flex-col gap-2">
              {TIPOS_LEMBRETE.map((tipo) => (
                <li key={tipo}>
                  <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rascunho[tipo]}
                      onChange={(e) => {
                        setAviso(null);
                        setRascunho((r) => ({ ...r, [tipo]: e.target.checked }));
                      }}
                      className="mt-1 cursor-pointer"
                    />
                    <span className="flex flex-col">
                      <span className="font-bold">{TEXTO_LEMBRETE[tipo].titulo}</span>
                      <span className="text-xs text-on-surface-variant">{TEXTO_LEMBRETE[tipo].descricao}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => void salvarLembretes()} disabled={!mudou || salvando} className={botao}>
                Salvar
              </button>
              {aviso && (
                <span role="status" className="text-xs font-bold text-volt-green">
                  {aviso}
                </span>
              )}
            </div>
          </div>
        </>
      )}

      {editandoWip && (
        <LimitesWipModal
          wip={wip}
          onFechar={() => setEditandoWip(false)}
          onSalvar={async (novo) => {
            const nova = await salvarConfig({ wip: novo });
            setConfig(nova);
            setEditandoWip(false);
          }}
        />
      )}
    </section>
  );
}
