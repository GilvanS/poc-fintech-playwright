import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { itemPorChave } from '../../shell/menu.ts';
import CenarioModal from './CenarioModal.tsx';
import { formatarCpf } from './massa.ts';
import {
  atualizarCenario,
  criarCenario,
  ErroApi,
  excluirCenario,
  listarCenarios,
  type CenarioEntrada,
  type CenarioVisao,
  type ListaCenarios,
} from './clienteApi.ts';

type Modal = { modo: 'novo' } | { modo: 'editar'; cenario: CenarioVisao };

const botao =
  'flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/5 text-sm font-bold text-on-surface-variant hover:bg-white/10 disabled:opacity-60 cursor-pointer';

function plural(n: number): string {
  return `${n} ${n === 1 ? 'cenário' : 'cenários'}`;
}

function filtrar(cenarios: CenarioVisao[], busca: string): CenarioVisao[] {
  const termo = busca.trim().toLowerCase();
  if (!termo) return cenarios;
  return cenarios.filter((c) =>
    [c.idCenario, c.nome, c.funcionalidade, c.idMassa ?? ''].some((campo) => campo.toLowerCase().includes(termo)),
  );
}

/** Tela "Cenários e massa" (T1): lista, busca e cadastro/edição/exclusão de cenários pelo modal M16. */
export default function Cenarios() {
  const { rotulo, icone: Icone } = itemPorChave('cenarios');
  const [dados, setDados] = useState<ListaCenarios | null>(null);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [atualizando, setAtualizando] = useState(false);
  const [busca, setBusca] = useState('');
  const [modal, setModal] = useState<Modal | null>(null);
  const [excluindo, setExcluindo] = useState<CenarioVisao | null>(null);
  const [erroExcluir, setErroExcluir] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setAtualizando(true);
    try {
      setDados(await listarCenarios());
      setErroCarga(null);
    } catch (erro) {
      setErroCarga(erro instanceof ErroApi ? erro.message : 'Erro inesperado.');
    } finally {
      setAtualizando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const cenarios = useMemo(() => dados?.cenarios ?? [], [dados]);
  const visiveis = useMemo(() => filtrar(cenarios, busca), [cenarios, busca]);

  const salvar = async (entrada: CenarioEntrada, versao?: number) => {
    if (modal?.modo === 'editar') await atualizarCenario(modal.cenario.idCenario, entrada, versao ?? modal.cenario.versao);
    else await criarCenario(entrada);
    setModal(null);
    await carregar();
  };

  const confirmarExclusao = async () => {
    if (!excluindo) return;
    try {
      await excluirCenario(excluindo.idCenario);
      setExcluindo(null);
      setErroExcluir(null);
      await carregar();
    } catch (erro) {
      setErroExcluir(erro instanceof ErroApi ? erro.message : 'Não foi possível excluir.');
    }
  };

  const contagem = busca.trim() ? `${visiveis.length} de ${plural(cenarios.length)}` : plural(cenarios.length);

  return (
    <section aria-label={rotulo} className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="flex items-center gap-3 text-xl font-black uppercase tracking-tight text-on-surface">
          <Icone size={22} className="text-volt-green" aria-hidden />
          {rotulo}
        </h2>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => void carregar()} disabled={atualizando} className={botao}>
            <RefreshCw size={16} className={atualizando ? 'animate-spin' : ''} aria-hidden />
            Atualizar
          </button>
          <button
            type="button"
            onClick={() => setModal({ modo: 'novo' })}
            disabled={dados === null}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-volt-green text-black text-sm font-black disabled:opacity-50 cursor-pointer"
          >
            <Plus size={16} aria-hidden />
            Novo cenário
          </button>
        </div>
      </div>

      {erroCarga && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-neon-error/40 bg-neon-error/10 p-4 text-sm text-neon-error">
          <span>Não foi possível carregar os cenários. {erroCarga}</span>
          <button type="button" onClick={() => void carregar()} className={botao}>
            Tentar de novo
          </button>
        </div>
      )}

      {dados && (
        <div className="rounded-3xl border border-white/10 bg-volt-surface/80 backdrop-blur-sm p-4 sm:p-6 flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              aria-label="Buscar cenário"
              placeholder="Buscar por ID, nome, funcionalidade ou massa…"
              className="flex-1 min-w-[16rem] p-2.5 rounded-xl text-sm bg-volt-page border border-white/20 text-on-surface outline-none focus:border-volt-green/50"
            />
            <p className="text-xs text-on-surface-variant">{contagem}</p>
          </div>
          <p className="text-[11px] text-on-surface-variant">CPFs fictícios de massa de teste, não são dados reais. Esta ferramenta roda só nesta máquina.</p>

          {cenarios.length === 0 ? (
            <p className="py-8 text-center text-sm text-on-surface-variant">Nenhum cenário cadastrado ainda</p>
          ) : visiveis.length === 0 ? (
            <p className="py-8 text-center text-sm text-on-surface-variant">Nenhum cenário encontrado para esta busca</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wide text-on-surface-variant">
                    <th className="py-2 pr-4 font-bold">ID</th>
                    <th className="py-2 pr-4 font-bold">Nome</th>
                    <th className="py-2 pr-4 font-bold">Funcionalidade</th>
                    <th className="py-2 pr-4 font-bold">Massa</th>
                    <th className="py-2 pr-4 font-bold">CPF</th>
                    <th className="py-2 font-bold">
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visiveis.map((c) => (
                    <tr key={c.idCenario} className="border-t border-white/10 align-top">
                      <td className="py-3 pr-4 font-mono text-volt-green whitespace-nowrap">{c.idCenario}</td>
                      <td className="py-3 pr-4">{c.nome}</td>
                      <td className="py-3 pr-4">{c.funcionalidade}</td>
                      <td className="py-3 pr-4">
                        <div className="flex flex-col gap-1 items-start">
                          {c.idMassa ? <span className="font-mono">{c.idMassa}</span> : <span className="text-on-surface-variant">-</span>}
                          {c.massaCompartilhadaCom.length > 0 && (
                            <span className="text-[11px] text-on-surface-variant">{`= compartilhada com ${c.massaCompartilhadaCom.join(', ')}`}</span>
                          )}
                          {c.dependeDe.length > 0 && (
                            <span className="text-[11px] text-on-surface-variant">{`Depende de ${c.dependeDe.join(', ')}`}</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 pr-4 font-mono whitespace-nowrap">{c.cpf ? formatarCpf(c.cpf) : <span className="text-on-surface-variant">-</span>}</td>
                      <td className="py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setModal({ modo: 'editar', cenario: c })}
                            aria-label={`Editar ${c.idCenario}`}
                            className="p-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 cursor-pointer"
                          >
                            <Pencil size={14} aria-hidden />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setErroExcluir(null);
                              setExcluindo(c);
                            }}
                            aria-label={`Excluir ${c.idCenario}`}
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
      )}

      {modal && (
        <CenarioModal
          cenario={modal.modo === 'editar' ? modal.cenario : undefined}
          cenarios={cenarios}
          funcionalidades={dados?.funcionalidades ?? []}
          onSalvar={salvar}
          onFechar={() => setModal(null)}
        />
      )}

      {excluindo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-label="Confirmar exclusão"
            className="w-full max-w-sm p-6 rounded-3xl bg-[#1a1a1a] border border-white/10 text-on-surface"
          >
            <p className="text-sm font-bold">{`Excluir o cenário ${excluindo.idCenario}?`}</p>
            <p className="mt-1 text-xs text-on-surface-variant">{excluindo.nome}</p>
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
