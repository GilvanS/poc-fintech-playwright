import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Gavel, X } from 'lucide-react';
import type { Pessoa } from '../../pessoas/clientePessoas.ts';
import { ErroApi } from '../cenarios/clienteApi.ts';
import type { TipoDecisao } from '../planos/clientePlanos.ts';
import { cumpridos, listarCriterios, naoAtendidos, ROTULO_DECISAO, TOTAL_CRITERIOS, type Criterio } from './calculoRelease.ts';

export interface EntradaDecisao {
  decisao: TipoDecisao;
  justificativa: string;
  por: string;
  criterios: number[];
}

interface Props {
  planoNome: string;
  criterios: Criterio[];
  /** Pessoas que podem decidir (as ativas da Equipe). */
  pessoas: Pessoa[];
  /** A pessoa escolhida em "Você"; null se ninguém escolheu. */
  voce: Pessoa | null;
  /** Instante mostrado em "Data" (o servidor carimba o de verdade). */
  agora?: Date;
  onRegistrar: (entrada: EntradaDecisao) => Promise<void>;
  onFechar: () => void;
}

const campo = 'w-full rounded-lg border border-white/10 bg-volt-page px-2.5 py-2 text-sm text-on-surface outline-none focus:border-volt-green/50';
const OPCOES: TipoDecisao[] = ['go', 'no_go', 'go_excecao'];

/**
 * Modal M15 — Registrar decisão do Release. GO só habilita com 7 de 7; GO com exceção só com critério pendente
 * (e justificativa, como toda decisão). A decisão fica no histórico do plano e não se edita.
 */
export default function DecisaoModal({ planoNome, criterios, pessoas, voce, agora = new Date(), onRegistrar, onFechar }: Props) {
  const pendentes = naoAtendidos(criterios);
  const tudoOk = cumpridos(criterios) === TOTAL_CRITERIOS;
  const [decisao, setDecisao] = useState<TipoDecisao>(tudoOk ? 'go' : 'no_go');
  const [justificativa, setJustificativa] = useState('');
  const [por, setPor] = useState(voce?.id ?? '');
  const [erros, setErros] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  const primeiro = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    primeiro.current?.focus();
  }, []);

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFechar();
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [onFechar]);

  const habilitada = (d: TipoDecisao) => (d === 'go' ? tudoOk : d === 'go_excecao' ? !tudoOk : true);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    const faltando: string[] = [];
    if (!justificativa.trim()) faltando.push('Justificativa é obrigatória.');
    if (!por) faltando.push('Escolha quem está decidindo.');
    if (faltando.length > 0) {
      setErros(faltando);
      return;
    }
    setErros([]);
    setSalvando(true);
    try {
      await onRegistrar({ decisao, justificativa: justificativa.trim(), por, criterios: pendentes });
    } catch (erro) {
      setErros(erro instanceof ErroApi ? erro.mensagens : ['Não foi possível registrar a decisão.']);
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <form
        role="dialog"
        aria-modal="true"
        aria-label={`Decisão do release — Plano ${planoNome}`}
        onSubmit={enviar}
        className="w-full max-w-lg p-6 rounded-3xl bg-[#1a1a1a] border border-white/10 text-on-surface"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 font-black uppercase text-sm">
            <Gavel size={18} className="text-volt-green" aria-hidden /> {`Decisão do release — Plano ${planoNome}`}
          </div>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="p-1 opacity-60 hover:opacity-100 cursor-pointer">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <fieldset className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <legend className="mb-1 text-xs font-bold uppercase tracking-wide text-on-surface-variant">Decisão</legend>
            {OPCOES.map((d) => (
              <label key={d} className={`flex items-center gap-2 ${habilitada(d) ? 'cursor-pointer' : 'opacity-40 cursor-not-allowed'}`}>
                <input type="radio" name="decisao" value={d} checked={decisao === d} disabled={!habilitada(d)} onChange={() => setDecisao(d)} />
                {ROTULO_DECISAO[d]}
              </label>
            ))}
          </fieldset>

          <p className="text-xs text-on-surface-variant">
            {tudoOk ? 'Todos os critérios cumpridos.' : `Critérios não atendidos: ${listarCriterios(pendentes)}.`}
            {!tudoOk && ' GO só habilita com 7 de 7; sem isso use GO com exceção.'}
          </p>

          <div className="flex flex-col gap-1 text-sm">
            <label htmlFor="decisao-justificativa" className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">
              Justificativa (obrigatória)
            </label>
            <textarea
              id="decisao-justificativa"
              ref={primeiro}
              rows={3}
              maxLength={1000}
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              className={campo}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">Decidido por</span>
              {voce ? (
                <span className="py-2 font-bold">{`${voce.nome} (você)`}</span>
              ) : (
                <select aria-label="Decidido por" value={por} onChange={(e) => setPor(e.target.value)} className={campo}>
                  <option value="">Escolha…</option>
                  {pessoas.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">Data</span>
              <span className="py-2 font-bold">{agora.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span>
            </div>
          </div>

          {erros.length > 0 && (
            <div role="alert" className="rounded-xl border border-neon-error/40 bg-neon-error/10 px-3 py-2 text-xs text-neon-error">
              <ul className="list-disc pl-4 space-y-0.5">
                {erros.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onFechar} className="px-4 py-2.5 rounded-xl text-xs font-bold bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer">
              Cancelar
            </button>
            <button type="submit" disabled={salvando} className="px-4 py-2.5 rounded-xl text-xs font-black bg-volt-green text-black disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed">
              Registrar
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
