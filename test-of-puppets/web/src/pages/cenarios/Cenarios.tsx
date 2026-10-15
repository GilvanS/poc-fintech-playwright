import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, FileUp, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import Sobreposicao from '../../shared/Sobreposicao.tsx';
import { itemPorChave } from '../../shell/menu.ts';
import CenarioDetalheModal from './CenarioDetalheModal.tsx';
import CenarioModal from './CenarioModal.tsx';
import ImportarCsvModal from './ImportarCsvModal.tsx';
import { formatarCpf } from './massa.ts';
import {
  atualizarCenario,
  criarCenario,
  ErroApi,
  excluirCenario,
  exportarCenariosCsv,
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

function filtrar(cenarios: CenarioVisao[], busca: string, funcionalidade: string, projeto: string): CenarioVisao[] {
  const termo = busca.trim().toLowerCase();
  return cenarios.filter(
    (c) =>
      (!funcionalidade || c.funcionalidade === funcionalidade) &&
      (!projeto || c.projeto === projeto) &&
      (!termo || [c.idCenario, c.nome, c.funcionalidade, c.feature ?? '', c.projeto ?? '', c.idMassa ?? ''].some((campo) => campo.toLowerCase().includes(termo))),
  );
}

/** Abaixo de 1 MB mostra em KB (20 KB aparecendo como "0 MB" não diz nada). */
const megas = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`;

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
  const [detalhe, setDetalhe] = useState<CenarioVisao | null>(null);
  const [importando, setImportando] = useState(false);
  const [filtroFuncionalidade, setFiltroFuncionalidade] = useState('');
  const [filtroProjeto, setFiltroProjeto] = useState('');
  const [erroExportar, setErroExportar] = useState<string | null>(null);

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
  const visiveis = useMemo(() => filtrar(cenarios, busca, filtroFuncionalidade, filtroProjeto), [cenarios, busca, filtroFuncionalidade, filtroProjeto]);
  const filtrando = busca.trim() !== '' || filtroFuncionalidade !== '' || filtroProjeto !== '';

  const exportar = async () => {
    setErroExportar(null);
    try {
      await exportarCenariosCsv();
    } catch (erro) {
      setErroExportar(erro instanceof ErroApi ? erro.message : 'Não foi possível exportar.');
    }
  };

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

  const contagem = filtrando ? `${visiveis.length} de ${plural(cenarios.length)}` : plural(cenarios.length);
  const armazenamento = dados?.armazenamento;

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
          <button type="button" onClick={() => void exportar()} disabled={dados === null} className={botao}>
            <Download size={16} aria-hidden />
            Exportar CSV
          </button>
          <button type="button" onClick={() => setImportando(true)} disabled={dados === null} className={botao}>
            <FileUp size={16} aria-hidden />
            Importar CSV
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
              placeholder="Buscar por ID, nome, funcionalidade, feature, projeto ou massa…"
              className="flex-1 min-w-[16rem] p-2.5 rounded-xl text-sm bg-volt-page border border-white/20 text-on-surface outline-none focus:border-volt-green/50"
            />
            <select
              value={filtroFuncionalidade}
              onChange={(e) => setFiltroFuncionalidade(e.target.value)}
              aria-label="Filtrar por funcionalidade"
              className="rounded-xl border border-white/20 bg-volt-page p-2.5 text-sm text-on-surface outline-none focus:border-volt-green/50"
            >
              <option value="">Todas as funcionalidades</option>
              {(dados.funcionalidades ?? []).map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
            {(dados.projetos ?? []).length > 0 && (
              <select
                value={filtroProjeto}
                onChange={(e) => setFiltroProjeto(e.target.value)}
                aria-label="Filtrar por projeto"
                className="rounded-xl border border-white/20 bg-volt-page p-2.5 text-sm text-on-surface outline-none focus:border-volt-green/50"
              >
                <option value="">Todos os projetos</option>
                {(dados.projetos ?? []).map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            )}
            <p className="text-xs text-on-surface-variant">{contagem}</p>
          </div>
          <p className="text-[11px] text-on-surface-variant">CPFs fictícios de massa de teste, não são dados reais. Esta ferramenta roda só nesta máquina.</p>
          {armazenamento && (
            <p data-testid="armazenamento" className={`text-[11px] ${armazenamento.perto ? 'font-bold text-neon-error' : 'text-on-surface-variant'}`}>
              {`Armazenamento: ${armazenamento.cenarios.toLocaleString('pt-BR')} de ${armazenamento.maxCenarios.toLocaleString('pt-BR')} cenários · ${megas(armazenamento.bytes)} de ${megas(armazenamento.maxBytes)}${armazenamento.perto ? ' — perto do limite' : ''}. O banco fica só nesta máquina; o CSV de controle (pasta controle/) é o que vai para o git.`}
            </p>
          )}
          {erroExportar && (
            <p role="alert" className="text-xs text-neon-error">
              {erroExportar}
            </p>
          )}

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
                    <th className="py-2 pr-4 font-bold">Feature</th>
                    <th className="py-2 pr-4 font-bold">Projeto</th>
                    <th className="py-2 pr-4 font-bold">Massa</th>
                    <th className="py-2 pr-4 font-bold">CPF</th>
                    <th className="py-2 font-bold">
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visiveis.map((c) => (
                    <tr key={c.idCenario} onClick={() => setDetalhe(c)} className="border-t border-white/10 align-top cursor-pointer hover:bg-white/[0.03]">
                      <td className="py-3 pr-4 font-mono whitespace-nowrap">
                        <button type="button" onClick={() => setDetalhe(c)} aria-label={`Detalhes de ${c.idCenario}`} className="font-mono text-volt-green underline-offset-2 hover:underline cursor-pointer">
                          {c.idCenario}
                        </button>
                      </td>
                      <td className="py-3 pr-4">{c.nome}</td>
                      <td className="py-3 pr-4">{c.funcionalidade}</td>
                      <td className="py-3 pr-4 font-mono text-xs">{c.feature ?? <span className="text-on-surface-variant">-</span>}</td>
                      <td className="py-3 pr-4">{c.projeto ?? <span className="text-on-surface-variant">-</span>}</td>
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
                            onClick={(e) => {
                              e.stopPropagation();
                              setModal({ modo: 'editar', cenario: c });
                            }}
                            aria-label={`Editar ${c.idCenario}`}
                            className="p-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 cursor-pointer"
                          >
                            <Pencil size={14} aria-hidden />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
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
          projetos={dados?.projetos ?? []}
          onSalvar={salvar}
          onFechar={() => setModal(null)}
        />
      )}

      {detalhe && (
        <CenarioDetalheModal
          cenario={detalhe}
          onEditar={() => {
            setModal({ modo: 'editar', cenario: detalhe });
            setDetalhe(null);
          }}
          onExcluir={() => {
            setErroExcluir(null);
            setExcluindo(detalhe);
            setDetalhe(null);
          }}
          onFechar={() => setDetalhe(null)}
        />
      )}

      {importando && <ImportarCsvModal onImportado={() => void carregar()} onFechar={() => setImportando(false)} />}

      {excluindo && (
        <Sobreposicao>
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
        </Sobreposicao>
      )}
    </section>
  );
}
