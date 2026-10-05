import { usePessoas } from '../pessoas/ContextoPessoas.tsx';
import { usePresenca } from '../presenca/ContextoPresenca.tsx';

/** "Online: Ana, Bia" no cabeçalho: quem está com a ferramenta aberta agora. Some quando não há ninguém para mostrar. */
export default function Online() {
  const online = usePresenca();
  const { pessoas, nome } = usePessoas();
  // Só quem ainda está na Equipe (id apagado não vira nome de verdade).
  const nomes = online.filter((id) => pessoas.some((p) => p.id === id)).map((id) => nome(id));
  if (nomes.length === 0) return null;
  return (
    <span data-testid="online" className="hidden md:flex items-center gap-2 text-xs text-on-surface-variant">
      <span className="h-2 w-2 rounded-full bg-volt-green" aria-hidden />
      {`Online: ${nomes.join(', ')}`}
    </span>
  );
}
