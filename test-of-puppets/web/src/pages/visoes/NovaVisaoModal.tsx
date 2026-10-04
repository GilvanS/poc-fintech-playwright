import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Bookmark, X } from 'lucide-react';
import { usePessoas } from '../../pessoas/ContextoPessoas.tsx';
import { ErroApi, listarCenarios } from '../cenarios/clienteApi.ts';
import { SEM_VALOR } from '../planos/filtros.ts';
import type { NovaVisao, TipoVisao } from '../../visoes/clienteVisoes.ts';

interface Props {
  onCriar: (entrada: NovaVisao) => Promise<void>;
  onFechar: () => void;
}

interface Modelo {
  nome: string;
  descricao: string;
  /** Tipo que a galeria cria hoje; os demais modelos aparecem desabilitados até a tarefa que os entrega. */
  tipo?: TipoVisao;
  tarefa?: string;
}

const MODELOS: Modelo[] = [
  { nome: 'Lista', descricao: 'tabela com todos os testes', tipo: 'lista' },
  { nome: 'Kanban', descricao: 'colunas por status', tipo: 'kanban' },
  { nome: 'Roadmap', descricao: 'linha do tempo', tarefa: 'T13.6' },
  { nome: 'Incidentes', descricao: 'falhas e severidade', tarefa: 'T13.5' },
  { nome: 'Release', descricao: 'go / no-go', tarefa: 'T13.7' },
  { nome: 'Lançamento', descricao: 'funcionalidade × status', tarefa: 'T13.8' },
  { nome: 'Iterações', descricao: 'burndown e velocidade', tarefa: 'T13.9' },
  { nome: 'Planejamento', descricao: 'capacidade da semana', tarefa: 'T13.10' },
  { nome: 'Retro', descricao: 'notas, votos e ações', tarefa: 'T13.11' },
];

const campo =
  'w-full rounded-lg border border-white/10 bg-volt-page px-2.5 py-2 text-sm text-on-surface outline-none focus:border-volt-green/50';
const rotulo = 'block mb-1 text-[11px] font-bold text-on-surface-variant';

/** Modal M11 — Nova visão: escolhe o modelo, dá nome, define os filtros iniciais e decide se a Equipe também vê. */
export default function NovaVisaoModal({ onCriar, onFechar }: Props) {
  const { ativas, voce } = usePessoas();
  const [tipo, setTipo] = useState<TipoVisao>('kanban');
  const [nome, setNome] = useState('');
  const [funcionalidade, setFuncionalidade] = useState('');
  const [responsavel, setResponsavel] = useState('');
  const [prioridade, setPrioridade] = useState('');
  const [compartilhar, setCompartilhar] = useState(false);
  const [funcionalidades, setFuncionalidades] = useState<string[]>([]);
  const [erros, setErros] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  const campoNome = useRef<HTMLInputElement>(null);

  useEffect(() => {
    campoNome.current?.focus();
  }, []);

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFechar();
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [onFechar]);

  useEffect(() => {
    let vivo = true;
    listarCenarios()
      .then((r) => vivo && setFuncionalidades(r.funcionalidades))
      .catch(() => undefined); // sem o catálogo a lista de funcionalidades fica só com "Todas"
    return () => {
      vivo = false;
    };
  }, []);

  const nomeLimpo = nome.trim();
  // Sem "Você" a visão não teria dono para vê-la depois: ela nasce compartilhada.
  const compartilhada = voce ? compartilhar : true;

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setErros([]);
    setSalvando(true);
    try {
      await onCriar({ nome: nomeLimpo, tipo, dono: voce?.id ?? null, compartilhada, filtros: { funcionalidade, responsavel, prioridade } });
    } catch (erro) {
      setErros(erro instanceof ErroApi ? erro.mensagens : ['Não foi possível criar a visão.']);
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <form
        role="dialog"
        aria-modal="true"
        aria-label="Nova visão"
        onSubmit={enviar}
        className="w-full max-w-2xl max-h-[92vh] overflow-y-auto p-6 rounded-3xl bg-[#1a1a1a] border border-white/10 text-on-surface"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 font-black uppercase text-sm">
            <Bookmark size={18} className="text-volt-green" aria-hidden /> Nova visão
          </div>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="p-1 opacity-60 hover:opacity-100 cursor-pointer">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="visao-nome" className={rotulo}>Nome</label>
            <input id="visao-nome" ref={campoNome} value={nome} onChange={(e) => setNome(e.target.value)} maxLength={40} placeholder="Ex.: Só Faturas P1" autoComplete="off" className={campo} />
          </div>

          <div>
            <span id="visao-modelo" className={rotulo}>Escolha um modelo</span>
            <div role="radiogroup" aria-labelledby="visao-modelo" className="grid gap-2 grid-cols-2 sm:grid-cols-3">
              {MODELOS.map((m) => {
                const disponivel = m.tipo !== undefined;
                const marcado = disponivel && m.tipo === tipo;
                return (
                  <button
                    key={m.nome}
                    type="button"
                    role="radio"
                    aria-checked={marcado}
                    disabled={!disponivel}
                    onClick={() => m.tipo && setTipo(m.tipo)}
                    className={`text-left rounded-xl border p-3 transition-colors ${
                      marcado
                        ? 'border-volt-green/50 bg-volt-green/10 cursor-pointer'
                        : disponivel
                          ? 'border-white/10 bg-white/5 hover:bg-white/10 cursor-pointer'
                          : 'border-white/5 bg-white/[0.02] opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <span className="block text-sm font-black">{m.nome}</span>
                    <span className="block text-[11px] text-on-surface-variant">{m.descricao}</span>
                    {!disponivel && <span className="block mt-1 text-[10px] font-bold text-on-surface-variant">{`Em breve (${m.tarefa})`}</span>}
                  </button>
                );
              })}
            </div>
          </div>

          <fieldset className="grid gap-3 sm:grid-cols-3">
            <legend className={rotulo}>Filtros iniciais</legend>
            <div>
              <label htmlFor="visao-func" className={rotulo}>Funcionalidade</label>
              <select id="visao-func" value={funcionalidade} onChange={(e) => setFuncionalidade(e.target.value)} className={campo}>
                <option value="">Todas</option>
                {funcionalidades.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="visao-resp" className={rotulo}>Responsável</label>
              <select id="visao-resp" value={responsavel} onChange={(e) => setResponsavel(e.target.value)} className={campo}>
                <option value="">Todos</option>
                <option value={SEM_VALOR}>Sem responsável</option>
                {ativas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="visao-prio" className={rotulo}>Prioridade</label>
              <select id="visao-prio" value={prioridade} onChange={(e) => setPrioridade(e.target.value)} className={campo}>
                <option value="">Todas</option>
                <option value="P1">P1</option>
                <option value="P2">P2</option>
                <option value="P3">P3</option>
                <option value={SEM_VALOR}>Sem prioridade</option>
              </select>
            </div>
          </fieldset>

          <div>
            <label className={`flex items-center gap-2 text-sm ${voce ? '' : 'opacity-60'}`}>
              <input type="checkbox" checked={compartilhada} disabled={!voce} onChange={(e) => setCompartilhar(e.target.checked)} className="accent-volt-green" />
              Compartilhar com a equipe
            </label>
            {!voce && <p className="mt-1 text-[11px] text-on-surface-variant">Escolha quem é você no cabeçalho para criar uma visão só sua.</p>}
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
            <button type="submit" disabled={nomeLimpo === '' || salvando} className="px-4 py-2.5 rounded-xl text-xs font-black bg-volt-green text-black disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed">
              Criar visão
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
