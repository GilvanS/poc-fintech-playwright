import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ListPlus, X } from 'lucide-react';
import { ErroApi, listarCenarios, type CenarioVisao } from '../cenarios/clienteApi.ts';

interface Props {
  planoNome: string;
  /** Testes que o plano já tem (aparecem travados). */
  idsNoPlano: string[];
  onIncluir: (idCenarios: string[], dataPlanejada?: string) => Promise<void>;
  onFechar: () => void;
}

const campo =
  'w-full rounded-lg border border-white/10 bg-volt-page px-2.5 py-2 text-xs text-on-surface outline-none focus:border-volt-green/50';
const rotulo = 'block mb-1 text-[11px] font-bold text-on-surface-variant';

/** Modal M2 — Incluir testes: escolhe cenários cadastrados para acrescentar ao plano, com uma data planejada opcional. */
export default function IncluirTestesModal({ planoNome, idsNoPlano, onIncluir, onFechar }: Props) {
  const [cenarios, setCenarios] = useState<CenarioVisao[] | null>(null);
  const [busca, setBusca] = useState('');
  const [funcionalidade, setFuncionalidade] = useState('');
  const [soLivres, setSoLivres] = useState(false);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [data, setData] = useState('');
  const [erros, setErros] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  const janela = useRef<HTMLFormElement>(null);

  useEffect(() => {
    janela.current?.focus();
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
      .then((r) => vivo && setCenarios(r.cenarios))
      .catch((e) => vivo && setErros([e instanceof ErroApi ? `Não foi possível carregar os cenários. ${e.message}` : 'Não foi possível carregar os cenários.']));
    return () => {
      vivo = false;
    };
  }, []);

  const noPlano = useMemo(() => new Set(idsNoPlano), [idsNoPlano]);
  const funcionalidades = useMemo(
    () => [...new Set((cenarios ?? []).map((c) => c.funcionalidade))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [cenarios],
  );

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return (cenarios ?? []).filter((c) => {
      if (soLivres && noPlano.has(c.idCenario)) return false;
      if (funcionalidade && c.funcionalidade !== funcionalidade) return false;
      if (termo && !`${c.idCenario} ${c.nome}`.toLowerCase().includes(termo)) return false;
      return true;
    });
  }, [cenarios, busca, funcionalidade, soLivres, noPlano]);

  const alternar = (id: string) =>
    setMarcados((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });

  const total = marcados.size;
  const textoBotao = total === 0 ? 'Incluir' : `Incluir ${total} ${total === 1 ? 'teste' : 'testes'}`;

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    const ids = (cenarios ?? []).filter((c) => marcados.has(c.idCenario)).map((c) => c.idCenario);
    setErros([]);
    setSalvando(true);
    try {
      await onIncluir(ids, data || undefined);
    } catch (erro) {
      setErros(erro instanceof ErroApi ? erro.mensagens : ['Não foi possível incluir os testes.']);
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <form
        ref={janela}
        role="dialog"
        aria-modal="true"
        aria-label="Incluir testes"
        tabIndex={-1}
        onSubmit={enviar}
        className="w-full max-w-3xl max-h-[92vh] flex flex-col rounded-3xl bg-[#1a1a1a] border border-white/10 text-on-surface outline-none"
      >
        <div className="flex items-center justify-between p-5 pb-3">
          <div className="flex items-center gap-2 font-black uppercase text-sm">
            <ListPlus size={18} className="text-volt-green" aria-hidden />
            <span>{`Incluir testes no plano ${planoNome}`}</span>
          </div>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="p-1 opacity-60 hover:opacity-100 cursor-pointer">
            <X size={20} />
          </button>
        </div>

        <div className="px-5 grid gap-3 grid-cols-2 md:grid-cols-[2fr_1fr_auto] items-end">
          <div>
            <label htmlFor="inc-busca" className={rotulo}>Buscar</label>
            <input id="inc-busca" value={busca} onChange={(e) => setBusca(e.target.value)} autoComplete="off" className={campo} />
          </div>
          <div>
            <label htmlFor="inc-func" className={rotulo}>Funcionalidade</label>
            <select id="inc-func" value={funcionalidade} onChange={(e) => setFuncionalidade(e.target.value)} className={campo}>
              <option value="">Todas</option>
              {funcionalidades.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-xs pb-2">
            <input type="checkbox" checked={soLivres} onChange={(e) => setSoLivres(e.target.checked)} className="accent-volt-green" />
            só os livres
          </label>
        </div>

        <div className="px-5 pt-3 overflow-y-auto min-h-24">
          {cenarios !== null && (cenarios.length === 0 ? (
            <p className="py-8 text-center text-sm text-on-surface-variant">Nenhum cenário cadastrado ainda</p>
          ) : visiveis.length === 0 ? (
            <p className="py-8 text-center text-sm text-on-surface-variant">Nenhum cenário encontrado</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-on-surface-variant">
                  <th className="py-2 pr-2 w-8">
                    <span className="sr-only">Incluir</span>
                  </th>
                  <th className="py-2 pr-3 font-bold">ID</th>
                  <th className="py-2 pr-3 font-bold">Cenário</th>
                  <th className="py-2 pr-3 font-bold">Massa</th>
                  <th className="py-2 font-bold">
                    <span className="sr-only">Observação</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visiveis.map((c) => {
                  const jaTem = noPlano.has(c.idCenario);
                  return (
                    <tr key={c.idCenario} data-testid={`cenario-${c.idCenario}`} className={`border-t border-white/10 ${jaTem ? 'opacity-60' : ''}`}>
                      <td className="py-2.5 pr-2">
                        <input
                          type="checkbox"
                          aria-label={`Incluir ${c.idCenario}`}
                          checked={jaTem || marcados.has(c.idCenario)}
                          disabled={jaTem}
                          onChange={() => alternar(c.idCenario)}
                          className="accent-volt-green"
                        />
                      </td>
                      <td className="py-2.5 pr-3 font-mono text-xs text-volt-green whitespace-nowrap">{c.idCenario}</td>
                      <td className="py-2.5 pr-3">{c.nome}</td>
                      <td className="py-2.5 pr-3 font-mono">{c.idMassa ?? '-'}</td>
                      <td className="py-2.5 text-[11px] text-on-surface-variant">
                        {jaTem ? 'já no plano' : c.massaCompartilhadaCom.length > 0 ? `= compartilhada com ${c.massaCompartilhadaCom.join(', ')}` : ''}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ))}
        </div>

        <div className="p-5 pt-3 flex flex-col gap-3">
          {erros.length > 0 && (
            <div role="alert" className="rounded-xl border border-neon-error/40 bg-neon-error/10 px-3 py-2 text-xs text-neon-error">
              <ul className="list-disc pl-4 space-y-0.5">
                {erros.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex items-end gap-3">
              <div>
                <label htmlFor="inc-data" className={rotulo}>Data planejada para os selecionados</label>
                <input id="inc-data" type="date" value={data} onChange={(e) => setData(e.target.value)} className={campo} />
              </div>
              <span className="pb-2 text-xs text-on-surface-variant">{`${total} ${total === 1 ? 'selecionado' : 'selecionados'}`}</span>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={onFechar} className="px-4 py-2.5 rounded-xl text-xs font-bold bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer">
                Cancelar
              </button>
              <button type="submit" disabled={total === 0 || salvando} className="px-4 py-2.5 rounded-xl text-xs font-black bg-volt-green text-black disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed">
                {textoBotao}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
