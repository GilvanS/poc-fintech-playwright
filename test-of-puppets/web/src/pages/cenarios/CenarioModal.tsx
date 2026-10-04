import { useEffect, useRef, useState, type FormEvent } from 'react';
import { FileText, X } from 'lucide-react';
import { ErroApi, type CenarioEntrada, type CenarioVisao } from './clienteApi.ts';
import { formatarCpf, massaCompartilhada } from './massa.ts';

interface Props {
  /** Ausente = cadastro novo; presente = edição (o ID fica travado). */
  cenario?: CenarioVisao;
  cenarios: CenarioVisao[];
  funcionalidades: string[];
  onSalvar: (entrada: CenarioEntrada, versao?: number) => Promise<void>;
  onFechar: () => void;
}

const campo =
  'w-full p-2.5 rounded-xl text-sm bg-volt-page border border-white/20 text-on-surface outline-none focus:border-volt-green/50 disabled:opacity-60';
const rotulo = 'block mb-1 text-[11px] font-bold text-on-surface-variant';

/** Modal M16 — cadastro e edição de cenário. Senha e PIN não existem aqui. */
export default function CenarioModal({ cenario, cenarios, funcionalidades, onSalvar, onFechar }: Props) {
  const edicao = cenario !== undefined;
  const [idCenario, setIdCenario] = useState(cenario?.idCenario ?? '');
  const [nome, setNome] = useState(cenario?.nome ?? '');
  const [funcionalidade, setFuncionalidade] = useState(cenario?.funcionalidade ?? '');
  const [idMassa, setIdMassa] = useState(cenario?.idMassa ?? '');
  const [cpf, setCpf] = useState(formatarCpf(cenario?.cpf ?? ''));
  const [passos, setPassos] = useState(cenario?.passos ?? '');
  const [resultadoEsperado, setResultadoEsperado] = useState(cenario?.resultadoEsperado ?? '');
  const [erros, setErros] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  const primeiroCampo = useRef<HTMLInputElement>(null);
  const campoNome = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (edicao ? campoNome : primeiroCampo).current?.focus();
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFechar();
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [edicao, onFechar]);

  const { usadaPor, dependeDe } = massaCompartilhada(cenarios, idMassa, idCenario.trim());

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    const texto = (valor: string) => valor.trim() || undefined;
    const entrada: CenarioEntrada = {
      idCenario: idCenario.trim(),
      nome: nome.trim(),
      funcionalidade: funcionalidade.trim(),
      idMassa: texto(idMassa),
      cpf: texto(cpf.replace(/\D/g, '')),
      passos: texto(passos),
      resultadoEsperado: texto(resultadoEsperado),
    };
    setErros([]);
    setSalvando(true);
    try {
      await onSalvar(entrada, cenario?.versao);
    } catch (erro) {
      setErros(erro instanceof ErroApi ? erro.mensagens : ['Não foi possível salvar o cenário.']);
      setSalvando(false);
    }
  };

  const titulo = edicao ? `Editar cenário ${cenario.idCenario}` : 'Novo cenário';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <form
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        onSubmit={enviar}
        className="w-full max-w-xl max-h-[92vh] overflow-y-auto p-6 rounded-3xl bg-[#1a1a1a] border border-white/10 text-on-surface"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 font-black uppercase text-sm">
            <FileText size={18} className="text-volt-green" aria-hidden /> {titulo}
          </div>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="p-1 opacity-60 hover:opacity-100 cursor-pointer">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label htmlFor="cen-id" className={rotulo}>ID do cenário</label>
            <input
              id="cen-id"
              ref={primeiroCampo}
              value={idCenario}
              onChange={(e) => setIdCenario(e.target.value)}
              disabled={edicao}
              placeholder="CT03.8  (formato CTnn.n)"
              autoComplete="off"
              className={`${campo} font-mono`}
            />
          </div>
          <div>
            <label htmlFor="cen-nome" className={rotulo}>Nome</label>
            <input id="cen-nome" ref={campoNome} value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="off" className={campo} />
          </div>
          <div>
            <label htmlFor="cen-func" className={rotulo}>Funcionalidade</label>
            <input
              id="cen-func"
              list="cen-funcionalidades"
              value={funcionalidade}
              onChange={(e) => setFuncionalidade(e.target.value)}
              placeholder="escolha uma existente ou digite uma nova"
              autoComplete="off"
              className={campo}
            />
            <datalist id="cen-funcionalidades">
              {funcionalidades.map((f) => (
                <option key={f} value={f} />
              ))}
            </datalist>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="cen-massa" className={rotulo}>Massa (ID)</label>
              <input id="cen-massa" value={idMassa} onChange={(e) => setIdMassa(e.target.value)} autoComplete="off" className={`${campo} font-mono`} />
            </div>
            <div>
              <label htmlFor="cen-cpf" className={rotulo}>CPF (opcional)</label>
              <input
                id="cen-cpf"
                value={cpf}
                onChange={(e) => setCpf(formatarCpf(e.target.value))}
                inputMode="numeric"
                placeholder="000.000.000-00"
                autoComplete="off"
                className={`${campo} font-mono`}
              />
            </div>
            <p className="sm:col-span-2 text-[11px] text-on-surface-variant">CPF fictício de massa de teste (não é dado real). Senha e PIN nunca são guardados.</p>
          </div>

          {usadaPor.length > 0 && (
            <div role="status" className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-on-surface-variant space-y-0.5">
              <p>{`Massa ${idMassa.trim()} já usada por ${usadaPor.join(', ')} (detectado sozinho)`}</p>
              {dependeDe.length > 0 && <p>{`Dependência automática: roda depois de ${dependeDe.join(', ')}`}</p>}
            </div>
          )}

          <div>
            <label htmlFor="cen-passos" className={rotulo}>Passos</label>
            <textarea id="cen-passos" rows={2} value={passos} onChange={(e) => setPassos(e.target.value)} className={campo} />
          </div>
          <div>
            <label htmlFor="cen-esperado" className={rotulo}>Resultado esperado</label>
            <textarea id="cen-esperado" rows={2} value={resultadoEsperado} onChange={(e) => setResultadoEsperado(e.target.value)} className={campo} />
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
            <button type="submit" disabled={salvando} className="px-4 py-2.5 rounded-xl text-xs font-black bg-volt-green text-black disabled:opacity-50 cursor-pointer">
              Salvar cenário
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
