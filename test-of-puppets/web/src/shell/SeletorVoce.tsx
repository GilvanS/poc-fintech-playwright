import { usePessoas } from '../pessoas/ContextoPessoas.tsx';

interface Props {
  /** Leva para a tela Equipe quando ainda não há ninguém cadastrado. */
  onCadastrar: () => void;
}

const classe =
  'rounded-xl border border-white/10 bg-volt-page px-2.5 py-2 text-xs font-bold text-on-surface outline-none focus:border-volt-green/50';

/** "Você: [Ana ▾]" do cabeçalho. Sem senha: só diz quem está usando este navegador. */
export default function SeletorVoce({ onCadastrar }: Props) {
  const { ativas, voce, definirVoce } = usePessoas();

  if (ativas.length === 0) {
    return (
      <button type="button" onClick={onCadastrar} className={`${classe} cursor-pointer hover:bg-white/10`}>
        Cadastrar equipe
      </button>
    );
  }

  return (
    <select aria-label="Você" value={voce?.id ?? ''} onChange={(e) => definirVoce(e.target.value || null)} className={classe}>
      <option value="">Quem é você?</option>
      {ativas.map((p) => (
        <option key={p.id} value={p.id}>
          {p.nome}
        </option>
      ))}
    </select>
  );
}
