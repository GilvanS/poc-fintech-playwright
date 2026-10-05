import { useCallback, useState } from 'react';
import { DatabaseZap } from 'lucide-react';
import AtualizarMassaModal from './AtualizarMassaModal.tsx';

/** Botão "Atualizar massa" do detalhe do teste concluído: abre o diff (M8); nada é gravado sem confirmar lá. */
export default function AtualizarMassa({ cpf, idCenario }: { cpf: string; idCenario: string }) {
  const [aberto, setAberto] = useState(false);
  const fechar = useCallback(() => setAberto(false), []);
  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="mt-2 flex items-center gap-2 px-3 py-1.5 rounded-xl border border-volt-green/40 bg-volt-green/10 text-xs font-bold text-volt-green hover:bg-volt-green/20 cursor-pointer"
      >
        <DatabaseZap size={14} aria-hidden />
        Atualizar massa
      </button>
      {aberto && <AtualizarMassaModal cpf={cpf} idCenario={idCenario} onFechar={fechar} />}
    </>
  );
}
