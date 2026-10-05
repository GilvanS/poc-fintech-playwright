import { useCallback, useEffect, useRef, useState } from 'react';
import { Lock, X } from 'lucide-react';
import { ErroApi } from '../pages/cenarios/clienteApi.ts';
import { confirmarAtualizacaoDeMassa, proporAtualizacaoDeMassa, type LinhaDiff, type PropostaMassa, type ResultadoGravacao } from './clienteMassa.ts';

interface Props {
  cpf: string;
  idCenario: string;
  onFechar: () => void;
}

const mensagemDe = (e: unknown) => (e instanceof ErroApi ? e.message : 'Erro inesperado.');
const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

function Regra({ linha }: { linha: LinhaDiff }) {
  if (linha.regra === 'atualiza') return <span className="text-volt-green">atualiza</span>;
  if (linha.regra === 'igual') return <span className="text-on-surface-variant">sem mudança</span>;
  if (linha.regra === 'imutavel') {
    return (
      <span className="flex items-center gap-1 text-on-surface-variant">
        <Lock size={12} aria-hidden />
        {linha.motivo ?? 'imutável — não grava'}
      </span>
    );
  }
  return <span className="text-on-surface-variant">{`não grava: ${linha.motivo ?? 'fora da regra'}`}</span>;
}

/**
 * M8 — Atualizar massa. Passo 1: mostra o diff (nada é gravado). Passo 2: só o "Confirmar e gravar" grava, depois de
 * uma cópia de segurança. Cancelar ou fechar deixa a planilha exatamente como estava.
 */
export default function AtualizarMassaModal({ cpf, idCenario, onFechar }: Props) {
  const [proposta, setProposta] = useState<PropostaMassa | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [gravando, setGravando] = useState(false);
  const [gravado, setGravado] = useState<ResultadoGravacao | null>(null);
  const janela = useRef<HTMLDivElement>(null);

  const carregar = useCallback(async () => {
    setErro(null);
    setProposta(null);
    try {
      setProposta((await proporAtualizacaoDeMassa(cpf)).proposta);
    } catch (e) {
      setErro(mensagemDe(e));
    }
  }, [cpf]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    janela.current?.focus();
    // O Esc fecha só este modal (captura na window: o detalhe do teste, por baixo, não recebe o mesmo Esc).
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onFechar();
    };
    window.addEventListener('keydown', aoTeclar, true);
    return () => window.removeEventListener('keydown', aoTeclar, true);
  }, [onFechar]);

  const confirmar = async () => {
    if (!proposta) return;
    setGravando(true);
    setErro(null);
    try {
      setGravado((await confirmarAtualizacaoDeMassa(proposta.propostaId)).resultado);
    } catch (e) {
      setErro(mensagemDe(e));
    }
    setGravando(false);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div
        ref={janela}
        role="dialog"
        aria-modal="true"
        aria-label="Atualizar massa"
        tabIndex={-1}
        className="w-full max-w-2xl max-h-[92vh] overflow-y-auto flex flex-col gap-4 rounded-3xl bg-[#1a1a1a] border border-white/10 p-6 text-on-surface outline-none"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-lg font-black tracking-tight">{`Atualizar massa (${idCenario})`}</h2>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="p-1 opacity-60 hover:opacity-100 cursor-pointer">
            <X size={20} />
          </button>
        </div>

        {erro && (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neon-error/40 bg-neon-error/10 px-3 py-2 text-xs text-neon-error">
            <span>{erro}</span>
            {!gravado && (
              <button type="button" onClick={() => void carregar()} className="rounded-lg border border-neon-error/40 px-2 py-1 font-bold cursor-pointer">
                Ver o diff de novo
              </button>
            )}
          </div>
        )}

        {!proposta && !erro && <p className="text-sm text-on-surface-variant">Lendo a planilha e o FintechBankApp…</p>}

        {proposta && (
          <>
            <p className="text-xs text-on-surface-variant">{`Fonte: ${proposta.fonte.origem} (lido às ${hora(proposta.fonte.lidoEm)})`}</p>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-on-surface-variant">
                  <th className="py-2 pr-3 font-bold">Coluna</th>
                  <th className="py-2 pr-3 font-bold">Antes</th>
                  <th className="py-2 pr-3 font-bold">Depois</th>
                  <th className="py-2 font-bold">Regra</th>
                </tr>
              </thead>
              <tbody>
                {proposta.linhas.map((l) => (
                  <tr key={l.coluna} data-testid={`massa-${l.coluna}`} className="border-t border-white/10">
                    <td className="py-2 pr-3 font-mono text-xs">{l.coluna}</td>
                    <td className="py-2 pr-3 font-mono text-xs">{l.antes || '-'}</td>
                    <td className={`py-2 pr-3 font-mono text-xs ${l.regra === 'atualiza' ? 'text-volt-green' : ''}`}>{l.depois || '-'}</td>
                    <td className="py-2 text-xs">
                      <Regra linha={l} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <p className="text-xs text-on-surface-variant">{`Backup antes de gravar: ${proposta.backup}`}</p>
            {proposta.bloqueio && (
              <p role="alert" className="rounded-xl border border-neon-error/40 bg-neon-error/10 px-3 py-2 text-xs text-neon-error">
                {proposta.bloqueio}
              </p>
            )}
            {!proposta.temMudanca && !gravado && <p className="text-xs text-on-surface-variant">A planilha já está igual à fonte: não há o que gravar.</p>}
            {gravado && (
              <p role="status" className="rounded-xl border border-volt-green/40 bg-volt-green/10 px-3 py-2 text-xs text-volt-green">
                {`Massa atualizada (${gravado.gravadas.length} colunas). Backup em ${gravado.backup}`}
              </p>
            )}

            <p className="text-xs font-bold text-volt-green">{`⚠ Isto altera ${proposta.planilha}.`}</p>
          </>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onFechar} className="px-4 py-2.5 rounded-xl text-xs font-bold bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer">
            {gravado ? 'Fechar' : 'Cancelar'}
          </button>
          {!gravado && (
            <button
              type="button"
              onClick={() => void confirmar()}
              disabled={!proposta?.temMudanca || Boolean(proposta?.bloqueio) || gravando}
              className="px-4 py-2.5 rounded-xl text-xs font-black bg-volt-green text-black disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            >
              Confirmar e gravar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
