import { usePessoas } from '../../pessoas/ContextoPessoas.tsx';
import { ROTULO_STATUS, STATUS } from './clientePlanos.ts';
import { SEM_FILTROS, SEM_VALOR, temFiltro, type Filtros } from './filtros.ts';

interface Props {
  filtros: Filtros;
  onChange: (filtros: Filtros) => void;
  /** Funcionalidades que existem nos testes do plano. */
  funcionalidades: string[];
  /** Ids de quem é responsável por algum teste do plano. */
  responsaveis: string[];
}

const campo =
  'w-full rounded-lg border border-white/10 bg-volt-page px-2.5 py-2 text-xs text-on-surface outline-none focus:border-volt-green/50';
const rotulo = 'block mb-1 text-[11px] font-bold text-on-surface-variant';

/** Barra de filtros do plano: ID/cenário, funcionalidade, status, data, "Apenas hoje", "Datas passadas" e "Limpar". */
export default function FiltrosTestes({ filtros, onChange, funcionalidades, responsaveis }: Props) {
  const { nome, voce } = usePessoas();
  const mudar = (parcial: Partial<Filtros>) => onChange({ ...filtros, ...parcial });
  const porNome = [...responsaveis].sort((a, b) => nome(a).localeCompare(nome(b), 'pt-BR'));

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        <div>
          <label htmlFor="flt-texto" className={rotulo}>ID/cenário</label>
          <input id="flt-texto" value={filtros.texto} onChange={(e) => mudar({ texto: e.target.value })} autoComplete="off" className={campo} />
        </div>
        <div>
          <label htmlFor="flt-func" className={rotulo}>Funcionalidade</label>
          <select id="flt-func" value={filtros.funcionalidade} onChange={(e) => mudar({ funcionalidade: e.target.value })} className={campo}>
            <option value="">Todas</option>
            {funcionalidades.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="flt-status" className={rotulo}>Status</label>
          <select id="flt-status" value={filtros.status} onChange={(e) => mudar({ status: e.target.value as Filtros['status'] })} className={campo}>
            <option value="">Todos</option>
            {STATUS.map((s) => (
              <option key={s} value={s}>
                {ROTULO_STATUS[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="flt-data" className={rotulo}>Data</label>
          <input id="flt-data" type="date" value={filtros.data} onChange={(e) => mudar({ data: e.target.value })} className={campo} />
        </div>
        <div>
          <label htmlFor="flt-resp" className={rotulo}>Responsável</label>
          <select id="flt-resp" value={filtros.responsavel} onChange={(e) => mudar({ responsavel: e.target.value })} className={campo}>
            <option value="">Todos</option>
            <option value={SEM_VALOR}>Sem responsável</option>
            {porNome.map((id) => (
              <option key={id} value={id}>
                {nome(id)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="flt-result" className={rotulo}>Resultado</label>
          <select id="flt-result" value={filtros.resultado} onChange={(e) => mudar({ resultado: e.target.value as Filtros['resultado'] })} className={campo}>
            <option value="">Todos</option>
            <option value="passou">Passou</option>
            <option value="falhou">Falhou</option>
            <option value={SEM_VALOR}>Sem resultado</option>
          </select>
        </div>
        <div>
          <label htmlFor="flt-prio" className={rotulo}>Prioridade</label>
          <select id="flt-prio" value={filtros.prioridade} onChange={(e) => mudar({ prioridade: e.target.value as Filtros['prioridade'] })} className={campo}>
            <option value="">Todas</option>
            <option value="P1">P1</option>
            <option value="P2">P2</option>
            <option value="P3">P3</option>
            <option value={SEM_VALOR}>Sem prioridade</option>
          </select>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4 text-xs">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={filtros.apenasHoje} onChange={(e) => mudar({ apenasHoje: e.target.checked })} className="accent-volt-green" />
          Apenas hoje
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={filtros.datasPassadas} onChange={(e) => mudar({ datasPassadas: e.target.checked })} className="accent-volt-green" />
          Datas passadas
        </label>
        <label className={`flex items-center gap-2 ${voce ? '' : 'opacity-50'}`}>
          <input type="checkbox" checked={filtros.somenteMeus} disabled={!voce} onChange={(e) => mudar({ somenteMeus: e.target.checked })} className="accent-volt-green" />
          {voce ? `Só meus (${voce.nome})` : 'Só meus'}
        </label>
        <button
          type="button"
          onClick={() => onChange(SEM_FILTROS)}
          disabled={!temFiltro(filtros)}
          className="px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 font-bold hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          Limpar
        </button>
      </div>
    </div>
  );
}
