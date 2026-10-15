import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pencil, Trash2, X } from 'lucide-react';
import Sobreposicao from '../../shared/Sobreposicao.tsx';
import { historicoDoTeste, ROTULO_STATUS, type HistoricoDoTeste } from '../planos/clientePlanos.ts';
import { formatarData } from '../planos/datas.ts';
import type { CenarioVisao } from './clienteApi.ts';
import { formatarCpf } from './massa.ts';

interface Props {
  cenario: CenarioVisao;
  onEditar: () => void;
  onExcluir: () => void;
  onFechar: () => void;
}

const rotulo = 'block mb-1 text-[11px] font-bold text-on-surface-variant';
const caixa = 'w-full rounded-lg border border-white/10 bg-volt-page px-2.5 py-2 text-sm text-on-surface outline-none resize-y cursor-default';

function Leitura({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div>
      <span className={rotulo}>{titulo}</span>
      <div className="text-sm break-words">{children}</div>
    </div>
  );
}

/** Texto longo só para ler: a caixa pode ser esticada pela alça do canto. */
function Longo({ titulo, texto }: { titulo: string; texto?: string }) {
  return (
    <div>
      <label className={rotulo}>
        {titulo}
        <textarea readOnly rows={3} value={texto ?? '-'} className={`${caixa} mt-1 font-normal`} />
      </label>
    </div>
  );
}

/** Detalhe de um cenário cadastrado: todos os dados, em quais planos ele já está e atalhos para editar e excluir. */
export default function CenarioDetalheModal({ cenario, onEditar, onExcluir, onFechar }: Props) {
  const [planos, setPlanos] = useState<HistoricoDoTeste[] | null>(null);
  const janela = useRef<HTMLDivElement>(null);

  useEffect(() => janela.current?.focus(), []);

  const fechar = useRef(onFechar);
  fechar.current = onFechar;
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') fechar.current();
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, []);

  useEffect(() => {
    let vivo = true;
    setPlanos(null);
    historicoDoTeste(cenario.idCenario)
      .then((h) => vivo && setPlanos(Array.isArray(h) ? h : []))
      .catch(() => vivo && setPlanos([]));
    return () => {
      vivo = false;
    };
  }, [cenario.idCenario]);

  return (
    <Sobreposicao>
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
        <div
          ref={janela}
          role="dialog"
          aria-modal="true"
          aria-label="Detalhe do cenário"
          tabIndex={-1}
          className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-3xl bg-[#1a1a1a] border border-white/10 text-on-surface outline-none"
        >
          <div className="flex items-start justify-between gap-4 p-5 pb-3">
            <div className="min-w-0">
              <h2 className="text-lg font-black tracking-tight break-words">
                <span className="font-mono text-volt-green">{cenario.idCenario}</span>
                {` · ${cenario.nome}`}
              </h2>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
                <span className="rounded-full border border-volt-green/30 bg-volt-surface px-2.5 py-0.5 font-bold text-volt-green">{cenario.funcionalidade}</span>
                {cenario.projeto && <span className="rounded-full border border-white/15 px-2.5 py-0.5 font-bold">{cenario.projeto}</span>}
              </div>
            </div>
            <button type="button" onClick={onFechar} aria-label="Fechar" className="p-1 opacity-60 hover:opacity-100 cursor-pointer">
              <X size={20} />
            </button>
          </div>

          <div className="flex flex-col gap-4 overflow-y-auto overflow-x-hidden min-h-0 px-5 pt-2 pb-1 [color-scheme:dark]">
            <div className="grid gap-4 sm:grid-cols-2">
              <Leitura titulo="ID">
                <span className="font-mono">{cenario.idCenario}</span>
              </Leitura>
              <Leitura titulo="Funcionalidade">{cenario.funcionalidade}</Leitura>
              <Leitura titulo="Feature">{cenario.feature ? <span className="font-mono">{cenario.feature}</span> : '-'}</Leitura>
              <Leitura titulo="Projeto">{cenario.projeto ?? '-'}</Leitura>
              <Leitura titulo="Massa (ID)">
                {cenario.idMassa ? <span className="font-mono">{cenario.idMassa}</span> : '-'}
                {cenario.massaCompartilhadaCom.length > 0 && (
                  <div className="text-[11px] text-on-surface-variant">{`= massa compartilhada com ${cenario.massaCompartilhadaCom.join(', ')}`}</div>
                )}
              </Leitura>
              <Leitura titulo="CPF">
                {cenario.cpf ? <span className="font-mono">{formatarCpf(cenario.cpf)}</span> : '-'}
                {cenario.cpf && <div className="text-[11px] text-on-surface-variant">CPF fictício de massa de teste (não é dado real)</div>}
              </Leitura>
              <Leitura titulo="Dependência (automática)">
                {cenario.dependeDe.length > 0 ? `Depois de ${cenario.dependeDe.join(', ')} (mesma massa)` : 'Nenhuma'}
              </Leitura>
              <Leitura titulo="Cadastro">
                <span className="text-xs text-on-surface-variant">{`Versão ${cenario.versao} · atualizado em ${formatarData(cenario.atualizadoEm.slice(0, 10))}`}</span>
              </Leitura>
            </div>
            <Longo titulo="Passos" texto={cenario.passos} />
            <Longo titulo="Resultado esperado" texto={cenario.resultadoEsperado} />

            <div>
              <h3 className="mb-1 text-xs font-black uppercase tracking-wide text-on-surface-variant">{planos ? `Planos (${planos.length})` : 'Planos'}</h3>
              {planos === null ? (
                <p className="py-2 text-sm text-on-surface-variant">Carregando…</p>
              ) : planos.length === 0 ? (
                <p className="py-2 text-sm text-on-surface-variant">Este cenário ainda não está em nenhum plano.</p>
              ) : (
                <ul className="divide-y divide-white/10 rounded-xl border border-white/10">
                  {planos.map((p) => (
                    <li key={p.planoId} data-testid={`plano-do-cenario-${p.planoId}`} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                      <span className="font-bold">{`Plano ${p.planoNome}`}</span>
                      <span className="text-xs text-on-surface-variant">
                        {`${ROTULO_STATUS[p.status]}${p.resultado ? ` · ${p.resultado === 'passou' ? 'passou' : 'falhou'}` : ''}${p.dataPlanejada ? ` · planejado ${formatarData(p.dataPlanejada)}` : ''}`}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 p-5 pt-3">
            <button
              type="button"
              onClick={onExcluir}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black bg-neon-error/20 text-neon-error border border-neon-error/40 hover:bg-neon-error/30 cursor-pointer"
            >
              <Trash2 size={14} aria-hidden />
              Excluir
            </button>
            <div className="flex gap-2">
              <button type="button" onClick={onFechar} className="px-4 py-2.5 rounded-xl text-xs font-bold bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer">
                Fechar
              </button>
              <button type="button" onClick={onEditar} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black bg-volt-green text-black cursor-pointer">
                <Pencil size={14} aria-hidden />
                Editar
              </button>
            </div>
          </div>
        </div>
      </div>
    </Sobreposicao>
  );
}
