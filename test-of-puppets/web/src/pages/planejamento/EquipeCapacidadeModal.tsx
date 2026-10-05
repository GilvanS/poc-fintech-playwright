import { useEffect, useRef, useState } from 'react';
import { Plus, Trash2, Users, X } from 'lucide-react';
import { atualizarPessoa, criarPessoa, CORES, excluirPessoa, listarPessoas, type Cor, type Pessoa } from '../../pessoas/clientePessoas.ts';
import { ErroApi } from '../cenarios/clienteApi.ts';

interface Props {
  /** Todas as pessoas da Equipe (ativas e inativas). */
  pessoas: Pessoa[];
  /** Roda depois de salvar: relê a Equipe para o resto da tela enxergar a capacidade nova. */
  onSalvo: () => Promise<void>;
  /** Leva à tela Equipe (nome, exclusão com todos os detalhes). */
  onAbrirEquipe: () => void;
  onFechar: () => void;
}

interface Linha {
  chave: string;
  /** Pessoa que já existe; ausente = linha nova. */
  original?: Pessoa;
  nome: string;
  /** Minutos por semana, em texto (vazio = sem capacidade definida). */
  capacidade: string;
  cor: Cor;
  ativa: boolean;
  remover: boolean;
}

const campo = 'rounded-lg border border-white/10 bg-volt-page px-2.5 py-2 text-sm text-on-surface outline-none focus:border-volt-green/50';
const deExistente = (p: Pessoa): Linha => ({
  chave: p.id,
  original: p,
  nome: p.nome,
  capacidade: p.capacidadeMinSemana > 0 ? String(p.capacidadeMinSemana) : '',
  cor: p.cor,
  ativa: p.ativa,
  remover: false,
});
const capacidadeOk = (texto: string) => texto.trim() === '' || /^\d{1,5}$/.test(texto.trim());
const numero = (texto: string) => (texto.trim() === '' ? 0 : Number(texto));

/** Houve mudança nesta linha? (linha nova só conta se tem nome; linha existente, se mudou capacidade, cor ou "ativa"; ou se vai ser excluída.) */
function mudou(l: Linha): boolean {
  if (!l.original) return !l.remover && l.nome.trim() !== '';
  return l.remover || numero(l.capacidade) !== l.original.capacidadeMinSemana || l.cor !== l.original.cor || l.ativa !== l.original.ativa;
}

/**
 * Modal M12 — Equipe e capacidade: minutos por semana, cor e "ativa" de cada pessoa, mais adicionar e excluir, sem sair do
 * Planejamento. Pessoa inativa some das listas de atribuição, mas o histórico fica. Salva só o que mudou, na ordem da tabela.
 */
export default function EquipeCapacidadeModal({ pessoas, onSalvo, onAbrirEquipe, onFechar }: Props) {
  const [linhas, setLinhas] = useState<Linha[]>(() => pessoas.map(deExistente));
  const [novas, setNovas] = useState(0);
  const [erros, setErros] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  const fechar = useRef(onFechar);
  fechar.current = onFechar;

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') fechar.current();
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, []);

  const mexer = (chave: string, parcial: Partial<Linha>) => setLinhas((ls) => ls.map((l) => (l.chave === chave ? { ...l, ...parcial } : l)));
  const adicionar = () => {
    setLinhas((ls) => [...ls, { chave: `nova-${novas}`, nome: '', capacidade: '', cor: 'azul', ativa: true, remover: false }]);
    setNovas((n) => n + 1);
  };
  const tirar = (l: Linha) => {
    // Linha nova some na hora; pessoa que existe fica riscada e só é excluída ao salvar.
    if (!l.original) setLinhas((ls) => ls.filter((x) => x.chave !== l.chave));
    else mexer(l.chave, { remover: !l.remover });
  };

  const alteradas = linhas.filter(mudou);

  const salvar = async () => {
    const problemas: string[] = [];
    for (const l of linhas) {
      if (l.remover || !mudou(l)) continue;
      if (!capacidadeOk(l.capacidade)) problemas.push(`Capacidade de ${l.nome.trim() || 'pessoa nova'} deve ser um número inteiro de minutos por semana.`);
    }
    const nomes = linhas.filter((l) => !l.original && !l.remover).map((l) => l.nome.trim().toLowerCase());
    if (nomes.some((n, i) => n !== '' && (nomes.indexOf(n) !== i || pessoas.some((p) => p.nome.toLowerCase() === n)))) problemas.push('Já existe uma pessoa com esse nome.');
    if (problemas.length > 0) {
      setErros(problemas);
      return;
    }

    setErros([]);
    setSalvando(true);
    try {
      for (const l of linhas) {
        if (l.original && l.remover) await excluirPessoa(l.original.id);
        else if (!l.original && !l.remover && l.nome.trim() !== '') {
          await criarPessoa({ nome: l.nome.trim(), cor: l.cor, ativa: l.ativa, ...(l.capacidade.trim() !== '' ? { capacidadeMinSemana: numero(l.capacidade) } : {}) });
        } else if (l.original && mudou(l)) {
          await atualizarPessoa(l.original.id, { nome: l.original.nome, capacidadeMinSemana: numero(l.capacidade), cor: l.cor, ativa: l.ativa }, l.original.versao);
        }
      }
      await onSalvo();
      onFechar();
    } catch (e) {
      // O que já foi salvo antes do erro vale: relê a Equipe e mostra a tabela como o servidor tem agora (versões novas).
      try {
        setLinhas((await listarPessoas()).map(deExistente));
        await onSalvo();
      } catch {
        // sem servidor não há como reler; a mensagem de erro abaixo já explica
      }
      setErros([...(e instanceof ErroApi ? e.mensagens : ['Não foi possível salvar.']), 'As alterações depois deste ponto não foram salvas.']);
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-label="Equipe e capacidade" className="w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 rounded-3xl bg-[#1a1a1a] border border-white/10 text-on-surface">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 font-black uppercase text-sm">
            <Users size={18} className="text-volt-green" aria-hidden /> Equipe e capacidade
          </div>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="p-1 opacity-60 hover:opacity-100 cursor-pointer">
            <X size={20} />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-on-surface-variant">
                <th className="py-2 pr-3">Pessoa</th>
                <th className="py-2 pr-3">Capacidade (min/semana)</th>
                <th className="py-2 pr-3">Cor</th>
                <th className="py-2 pr-3">Ativa</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => {
                const rotulo = l.nome.trim() || 'pessoa nova';
                return (
                  <tr key={l.chave} data-testid={`pessoa-${l.chave}`} className={`border-t border-white/5 ${l.remover ? 'opacity-50' : ''}`}>
                    <td className="py-2 pr-3">
                      {l.original ? (
                        <span className={`font-bold ${l.remover ? 'line-through' : ''}`}>{l.nome}</span>
                      ) : (
                        <input aria-label="Nome da pessoa nova" autoFocus value={l.nome} maxLength={40} onChange={(e) => mexer(l.chave, { nome: e.target.value })} className={`${campo} w-36`} placeholder="Nome" />
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      <input
                        aria-label={`Capacidade de ${rotulo}`}
                        inputMode="numeric"
                        disabled={l.remover}
                        value={l.capacidade}
                        onChange={(e) => mexer(l.chave, { capacidade: e.target.value })}
                        className={`${campo} w-28`}
                        placeholder="sem"
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <select aria-label={`Cor de ${rotulo}`} disabled={l.remover} value={l.cor} onChange={(e) => mexer(l.chave, { cor: e.target.value as Cor })} className={campo}>
                        {CORES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 pr-3">
                      <input type="checkbox" aria-label={`${rotulo} está ativa`} disabled={l.remover} checked={l.ativa} onChange={(e) => mexer(l.chave, { ativa: e.target.checked })} className="cursor-pointer" />
                    </td>
                    <td className="py-2 text-right">
                      <button type="button" aria-label={l.remover ? `Desfazer exclusão de ${rotulo}` : `Excluir ${rotulo}`} onClick={() => tirar(l)} className="p-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-neon-error/20 hover:text-neon-error cursor-pointer">
                        <Trash2 size={14} aria-hidden />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <button type="button" onClick={adicionar} className="mt-2 flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold hover:bg-white/10 cursor-pointer">
          <Plus size={14} aria-hidden />
          Adicionar pessoa
        </button>
        <p className="mt-3 text-[11px] text-on-surface-variant">
          Pessoa inativa some das listas de atribuição, mas o histórico fica. Quem ainda é responsável por testes não pode ser excluída: desative-a.{' '}
          <button type="button" onClick={onAbrirEquipe} className="font-bold text-volt-green hover:underline cursor-pointer">
            Abrir a tela Equipe
          </button>
        </p>

        {erros.length > 0 && (
          <div role="alert" className="mt-3 rounded-xl border border-neon-error/40 bg-neon-error/10 px-3 py-2 text-xs text-neon-error">
            <ul className="list-disc pl-4 space-y-0.5">
              {erros.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onFechar} className="px-4 py-2.5 rounded-xl text-xs font-bold bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer">
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void salvar()}
            disabled={salvando || alteradas.length === 0}
            className="px-4 py-2.5 rounded-xl text-xs font-black bg-volt-green text-black disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
