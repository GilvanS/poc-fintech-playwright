import { useState } from 'react';
import { Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { ErroApi } from '../cenarios/clienteApi.ts';
import { itemPorChave } from '../../shell/menu.ts';
import { atualizarPessoa, CLASSE_COR, criarPessoa, excluirPessoa, type CamposPessoa, type Pessoa } from '../../pessoas/clientePessoas.ts';
import { usePessoas } from '../../pessoas/ContextoPessoas.tsx';
import PessoaModal from './PessoaModal.tsx';

type Modal = { modo: 'nova' } | { modo: 'editar'; pessoa: Pessoa };

const botao =
  'flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/5 text-sm font-bold text-on-surface-variant hover:bg-white/10 disabled:opacity-60 cursor-pointer';

/** 90 -> "90 min/semana (1,5 h)"; 0 = não informado. */
export function formatarCapacidade(min: number): string {
  if (min <= 0) return '-';
  const horas = String(Math.round(min / 6) / 10).replace('.', ',');
  return `${min} min/semana (${horas} h)`;
}

/** Tela "Equipe" (T13.1): quem usa a ferramenta, a capacidade semanal e quem é "Você" neste navegador. */
export default function Equipe() {
  const { rotulo, icone: Icone } = itemPorChave('equipe');
  const { pessoas, voce, definirVoce, recarregar } = usePessoas();
  const [modal, setModal] = useState<Modal | null>(null);
  const [excluindo, setExcluindo] = useState<Pessoa | null>(null);
  const [erroExcluir, setErroExcluir] = useState<string | null>(null);
  const [atualizando, setAtualizando] = useState(false);

  const atualizar = async () => {
    setAtualizando(true);
    await recarregar();
    setAtualizando(false);
  };

  const salvar = async (campos: CamposPessoa, versao?: number) => {
    if (modal?.modo === 'editar') await atualizarPessoa(modal.pessoa.id, campos, versao ?? modal.pessoa.versao);
    else await criarPessoa(campos);
    setModal(null);
    await recarregar();
  };

  const confirmarExclusao = async () => {
    if (!excluindo) return;
    try {
      await excluirPessoa(excluindo.id);
      setExcluindo(null);
      setErroExcluir(null);
      await recarregar();
    } catch (e) {
      setErroExcluir(e instanceof ErroApi ? e.message : 'Não foi possível excluir.');
    }
  };

  return (
    <section aria-label={rotulo} className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="flex items-center gap-3 text-xl font-black uppercase tracking-tight text-on-surface">
          <Icone size={22} className="text-volt-green" aria-hidden />
          {rotulo}
        </h2>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => void atualizar()} disabled={atualizando} className={botao}>
            <RefreshCw size={16} className={atualizando ? 'animate-spin' : ''} aria-hidden />
            Atualizar
          </button>
          <button type="button" onClick={() => setModal({ modo: 'nova' })} className="flex items-center gap-2 px-4 py-2 rounded-full bg-volt-green text-black text-sm font-black cursor-pointer">
            <Plus size={16} aria-hidden />
            Nova pessoa
          </button>
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-volt-surface/80 backdrop-blur-sm p-4 sm:p-6 flex flex-col gap-4">
        <p className="text-[11px] text-on-surface-variant">
          Sem senha: cada pessoa escolhe quem é em “Você”, no cabeçalho. Os dados ficam só nesta máquina.
        </p>

        {pessoas.length === 0 ? (
          <p className="py-8 text-center text-sm text-on-surface-variant">Nenhuma pessoa cadastrada ainda</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-on-surface-variant">
                  <th className="py-2 pr-4 font-bold">Nome</th>
                  <th className="py-2 pr-4 font-bold">Capacidade</th>
                  <th className="py-2 pr-4 font-bold">Situação</th>
                  <th className="py-2 font-bold">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {pessoas.map((p) => (
                  <tr key={p.id} data-testid={`pessoa-${p.nome}`} className="border-t border-white/10 align-middle">
                    <td className="py-3 pr-4">
                      <span className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${CLASSE_COR[p.cor]}`} aria-hidden />
                        <span className="font-bold">{p.nome}</span>
                        {voce?.id === p.id && <span className="rounded-full border border-volt-green/30 px-2 py-0.5 text-[10px] font-black text-volt-green">Você</span>}
                      </span>
                    </td>
                    <td className="py-3 pr-4">{formatarCapacidade(p.capacidadeMinSemana)}</td>
                    <td className="py-3 pr-4">{p.ativa ? 'Ativa' : 'Inativa'}</td>
                    <td className="py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => definirVoce(p.id)}
                          disabled={!p.ativa || voce?.id === p.id}
                          aria-label={`Usar ${p.nome} como Você`}
                          className="px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 text-xs font-bold hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        >
                          Sou eu
                        </button>
                        <button type="button" onClick={() => setModal({ modo: 'editar', pessoa: p })} aria-label={`Editar ${p.nome}`} className="p-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 cursor-pointer">
                          <Pencil size={14} aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setErroExcluir(null);
                            setExcluindo(p);
                          }}
                          aria-label={`Excluir ${p.nome}`}
                          className="p-2 rounded-xl border border-white/10 bg-white/5 hover:bg-neon-error/20 cursor-pointer"
                        >
                          <Trash2 size={14} aria-hidden />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && <PessoaModal pessoa={modal.modo === 'editar' ? modal.pessoa : undefined} onSalvar={salvar} onFechar={() => setModal(null)} />}

      {excluindo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div role="alertdialog" aria-modal="true" aria-label="Confirmar exclusão" className="w-full max-w-sm p-6 rounded-3xl bg-[#1a1a1a] border border-white/10 text-on-surface">
            <p className="text-sm font-bold">{`Excluir ${excluindo.nome} da equipe?`}</p>
            {erroExcluir && <p role="alert" className="mt-3 text-xs text-neon-error">{erroExcluir}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setExcluindo(null)} className="px-4 py-2.5 rounded-xl text-xs font-bold bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer">
                Manter
              </button>
              <button type="button" onClick={() => void confirmarExclusao()} className="px-4 py-2.5 rounded-xl text-xs font-black bg-neon-error text-black cursor-pointer">
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
