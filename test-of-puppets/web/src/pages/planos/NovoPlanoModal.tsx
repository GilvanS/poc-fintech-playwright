import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ClipboardList, X } from 'lucide-react';
import { ErroApi, listarCenarios, type CenarioVisao } from '../cenarios/clienteApi.ts';
import type { NovoPlano, PlanoResumido } from './clientePlanos.ts';

interface Props {
  /** Planos que já existem (só para avisar de nome repetido). */
  planos: PlanoResumido[];
  onCriar: (entrada: NovoPlano) => Promise<void>;
  onFechar: () => void;
}

type Modo = 'vazio' | 'todos' | 'escolher';

const campo =
  'w-full p-2.5 rounded-xl text-sm bg-volt-page border border-white/20 text-on-surface outline-none focus:border-volt-green/50';
const rotulo = 'block mb-1 text-[11px] font-bold text-on-surface-variant';

/** Modal M1 — Novo Plano. Nome repetido só avisa; os testes podem vir vazios, todos ou escolhidos agora. */
export default function NovoPlanoModal({ planos, onCriar, onFechar }: Props) {
  const [nome, setNome] = useState('');
  const [previsao, setPrevisao] = useState('');
  const [modo, setModo] = useState<Modo>('vazio');
  const [cenarios, setCenarios] = useState<CenarioVisao[] | null>(null);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [erros, setErros] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  const primeiroCampo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    primeiroCampo.current?.focus();
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
      .catch((e) => vivo && setErros([e instanceof ErroApi ? e.message : 'Não foi possível carregar os cenários.']));
    return () => {
      vivo = false;
    };
  }, []);

  const nomeLimpo = nome.trim();
  const repetido = nomeLimpo !== '' && planos.some((p) => p.nome.trim().toLowerCase() === nomeLimpo.toLowerCase());

  const alternar = (id: string) =>
    setMarcados((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    const entrada: NovoPlano = { nome: nomeLimpo };
    if (previsao) entrada.previsao = previsao;
    if (modo === 'todos') entrada.idCenarios = (cenarios ?? []).map((c) => c.idCenario);
    if (modo === 'escolher') entrada.idCenarios = (cenarios ?? []).filter((c) => marcados.has(c.idCenario)).map((c) => c.idCenario);
    setErros([]);
    setSalvando(true);
    try {
      await onCriar(entrada);
    } catch (erro) {
      setErros(erro instanceof ErroApi ? erro.mensagens : ['Não foi possível criar o plano.']);
      setSalvando(false);
    }
  };

  const total = cenarios?.length ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <form
        role="dialog"
        aria-modal="true"
        aria-label="Novo Plano"
        onSubmit={enviar}
        className="w-full max-w-lg max-h-[92vh] overflow-y-auto p-6 rounded-3xl bg-[#1a1a1a] border border-white/10 text-on-surface"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 font-black uppercase text-sm">
            <ClipboardList size={18} className="text-volt-green" aria-hidden /> Novo Plano
          </div>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="p-1 opacity-60 hover:opacity-100 cursor-pointer">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label htmlFor="plano-nome" className={rotulo}>Nome do plano</label>
            <input id="plano-nome" ref={primeiroCampo} value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="off" className={campo} />
          </div>
          <div>
            <label htmlFor="plano-previsao" className={rotulo}>Previsão de término</label>
            <input id="plano-previsao" type="date" value={previsao} onChange={(e) => setPrevisao(e.target.value)} className={campo} />
          </div>

          <fieldset className="space-y-1.5">
            <legend className={rotulo}>Criar com os testes</legend>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="modo" checked={modo === 'vazio'} onChange={() => setModo('vazio')} className="accent-volt-green" />
              Vazio
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="modo" checked={modo === 'todos'} onChange={() => setModo('todos')} disabled={cenarios === null} className="accent-volt-green" />
              {`Todos os cenários cadastrados (${total})`}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="modo" checked={modo === 'escolher'} onChange={() => setModo('escolher')} disabled={cenarios === null} className="accent-volt-green" />
              Escolher agora…
            </label>
          </fieldset>

          {modo === 'escolher' && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-1 max-h-48 overflow-y-auto">
              {total === 0 ? (
                <p className="text-xs text-on-surface-variant">Nenhum cenário cadastrado ainda</p>
              ) : (
                (cenarios ?? []).map((c) => (
                  <label key={c.idCenario} className="flex items-center gap-2 text-xs">
                    <input type="checkbox" checked={marcados.has(c.idCenario)} onChange={() => alternar(c.idCenario)} className="accent-volt-green" />
                    <span className="font-mono text-volt-green">{c.idCenario}</span>
                    <span>{`· ${c.nome}`}</span>
                  </label>
                ))
              )}
              <p className="pt-1 text-[11px] text-on-surface-variant">{`${marcados.size} selecionado(s)`}</p>
            </div>
          )}

          {repetido && (
            <p role="status" className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-on-surface-variant">
              Já existe plano com este nome.
            </p>
          )}

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
              Criar plano
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
