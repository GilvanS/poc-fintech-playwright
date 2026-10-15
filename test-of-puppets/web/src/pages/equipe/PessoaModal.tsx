import { useEffect, useRef, useState, type FormEvent } from 'react';
import { UserRound, X } from 'lucide-react';
import { ErroApi } from '../cenarios/clienteApi.ts';
import { CORES, type CamposPessoa, type Cor, type Pessoa } from '../../pessoas/clientePessoas.ts';
import { PainelTela } from '../../shared/PainelTela.tsx';

interface Props {
  /** Ausente = cadastro novo. */
  pessoa?: Pessoa;
  onSalvar: (campos: CamposPessoa, versao?: number) => Promise<void>;
  onFechar: () => void;
}

const campo =
  'w-full p-2.5 rounded-xl text-sm bg-volt-page border border-white/20 text-on-surface outline-none focus:border-volt-green/50';
const rotulo = 'block mb-1 text-[11px] font-bold text-on-surface-variant';

/** Modal M12 (versão enxuta): nome, capacidade em minutos por semana, cor e se a pessoa está ativa. */
export default function PessoaModal({ pessoa, onSalvar, onFechar }: Props) {
  const edicao = pessoa !== undefined;
  const [nome, setNome] = useState(pessoa?.nome ?? '');
  const [capacidade, setCapacidade] = useState(pessoa && pessoa.capacidadeMinSemana > 0 ? String(pessoa.capacidadeMinSemana) : '');
  const [cor, setCor] = useState<Cor>(pessoa?.cor ?? 'azul');
  const [ativa, setAtiva] = useState(pessoa?.ativa ?? true);
  const [admin, setAdmin] = useState(pessoa?.admin ?? false);
  const [erros, setErros] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  const primeiro = useRef<HTMLInputElement>(null);

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

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    const campos: CamposPessoa = { nome: nome.trim(), cor, ativa, admin };
    if (capacidade.trim() !== '') campos.capacidadeMinSemana = Number(capacidade);
    else if (edicao) campos.capacidadeMinSemana = 0;
    setErros([]);
    setSalvando(true);
    try {
      await onSalvar(campos, pessoa?.versao);
    } catch (erro) {
      setErros(erro instanceof ErroApi ? erro.mensagens : ['Não foi possível salvar a pessoa.']);
      setSalvando(false);
    }
  };

  const titulo = edicao ? `Editar ${pessoa.nome}` : 'Nova pessoa';

  return (
    <PainelTela titulo={titulo} largura="form" onFechar={onFechar}>
      <form onSubmit={enviar} className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 font-black uppercase text-sm">
            <UserRound size={18} className="text-volt-green" aria-hidden /> {titulo}
          </div>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="p-1 opacity-60 hover:opacity-100 cursor-pointer">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label htmlFor="pes-nome" className={rotulo}>Nome</label>
            <input id="pes-nome" ref={primeiro} value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="off" className={campo} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="pes-cap" className={rotulo}>Capacidade (min por semana)</label>
              <input id="pes-cap" type="number" min={0} max={6000} value={capacidade} onChange={(e) => setCapacidade(e.target.value)} className={campo} />
            </div>
            <div>
              <label htmlFor="pes-cor" className={rotulo}>Cor</label>
              <select id="pes-cor" value={cor} onChange={(e) => setCor(e.target.value as Cor)} className={campo}>
                {CORES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={ativa} onChange={(e) => setAtiva(e.target.checked)} className="accent-volt-green" />
            Ativa
          </label>
          <div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={admin} onChange={(e) => setAdmin(e.target.checked)} className="accent-volt-green" />
              Admin
            </label>
            <p className="mt-1 text-[11px] text-on-surface-variant">Admin pode excluir qualquer visão salva, inclusive as compartilhadas. Quem não é admin só exclui a própria visão pessoal. Sem ninguém escolhido em "Você", vale como admin.</p>
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
            <button type="submit" disabled={nome.trim() === '' || salvando} className="px-4 py-2.5 rounded-xl text-xs font-black bg-volt-green text-black disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed">
              Salvar pessoa
            </button>
          </div>
        </div>
      </form>
    </PainelTela>
  );
}
