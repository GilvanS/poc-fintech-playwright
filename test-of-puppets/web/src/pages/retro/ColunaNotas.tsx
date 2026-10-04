import { useState } from 'react';
import { ListPlus, Plus, ThumbsUp, X } from 'lucide-react';
import type { ColunaNota, Nota } from '../../retros/clienteRetros.ts';
import { autorVisivel, ordenarNotas, quemVotou, totalVotos } from './calculoRetro.ts';

interface Props {
  coluna: ColunaNota;
  titulo: string;
  notas: Nota[];
  anonimas: boolean;
  idVoce: string | null;
  nome: (id?: string) => string;
  /** Retro fechada: só leitura. */
  fechada: boolean;
  onNova: (texto: string) => Promise<void>;
  onVotar: (nota: Nota) => void;
  onVirarAcao: (nota: Nota) => void;
  onExcluir: (nota: Nota) => void;
}

/** Uma coluna de notas (Foi bem / Pode melhorar): notas com voto, "virar ação" e o formulário inline de nota nova. */
export default function ColunaNotas({ coluna, titulo, notas, anonimas, idVoce, nome, fechada, onNova, onVotar, onVirarAcao, onExcluir }: Props) {
  const [escrevendo, setEscrevendo] = useState(false);
  const [texto, setTexto] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const podeEscrever = !fechada && idVoce !== null;

  const salvar = async () => {
    if (!texto.trim()) {
      setErro('Escreva a nota.');
      return;
    }
    try {
      await onNova(texto.trim());
      setTexto('');
      setErro(null);
      setEscrevendo(false);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar a nota.');
    }
  };

  const cancelar = () => {
    setEscrevendo(false);
    setTexto('');
    setErro(null);
  };

  return (
    <section aria-label={titulo} data-testid={`coluna-retro-${coluna}`} className="flex flex-col gap-3 rounded-3xl border border-white/10 bg-volt-surface/80 p-4">
      <h3 className="text-sm font-black uppercase tracking-wide">{`${titulo} (${notas.length})`}</h3>

      <ul className="flex flex-col gap-2">
        {ordenarNotas(notas).map((n) => {
          const autor = autorVisivel(n, anonimas, idVoce, nome);
          const votou = idVoce !== null && n.votos.includes(idVoce);
          const quem = quemVotou(n, anonimas, nome);
          return (
            <li key={n.id} data-testid={`nota-${n.id}`} className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm">
              <p>{n.texto}</p>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-on-surface-variant">
                <button
                  type="button"
                  aria-pressed={votou}
                  aria-label={`${votou ? 'Tirar o voto de' : 'Votar em'}: ${n.texto}`}
                  disabled={fechada || idVoce === null}
                  onClick={() => onVotar(n)}
                  className={`flex items-center gap-1 rounded-full border px-2 py-0.5 font-black disabled:opacity-50 ${votou ? 'border-volt-green/50 bg-volt-green/15 text-volt-green' : 'border-white/10 hover:bg-white/10'} cursor-pointer disabled:cursor-not-allowed`}
                >
                  <ThumbsUp size={12} aria-hidden />
                  {`+${totalVotos(n)}`}
                </button>
                {quem && <span>{`(${quem})`}</span>}
                {autor && <span className="font-bold">{autor}</span>}
                <span className="flex-1" />
                <button type="button" onClick={() => onVirarAcao(n)} aria-label={`Virar ação: ${n.texto}`} className="flex items-center gap-1 font-bold text-volt-green hover:underline cursor-pointer">
                  <ListPlus size={12} aria-hidden />
                  Virar ação
                </button>
                {!fechada && (
                  <button type="button" onClick={() => onExcluir(n)} aria-label={`Excluir a nota: ${n.texto}`} className="opacity-60 hover:opacity-100 hover:text-neon-error cursor-pointer">
                    <X size={14} />
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {escrevendo ? (
        <div className="flex flex-col gap-2">
          <textarea
            aria-label={`Escreva a nota (${titulo})`}
            autoFocus
            rows={2}
            maxLength={300}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-volt-page px-2.5 py-2 text-sm text-on-surface outline-none focus:border-volt-green/50"
          />
          {erro && <p role="alert" className="text-xs text-neon-error">{erro}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => void salvar()} className="rounded-xl bg-volt-green px-3 py-2 text-xs font-black text-black cursor-pointer">Salvar</button>
            <button type="button" onClick={cancelar} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold hover:bg-white/10 cursor-pointer">Cancelar</button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={!podeEscrever}
          onClick={() => setEscrevendo(true)}
          title={fechada ? 'Retro fechada' : idVoce === null ? 'Escolha "Você" no cabeçalho' : undefined}
          className="flex items-center gap-2 self-start rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold hover:bg-white/10 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
        >
          <Plus size={14} aria-hidden />
          {`Nova nota (${titulo})`}
        </button>
      )}
    </section>
  );
}
