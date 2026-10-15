import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { FileUp, X } from 'lucide-react';
import { PainelTela } from '../../shared/PainelTela.tsx';
import { ErroApi, importarCenariosCsv, type RespostaImportacao } from './clienteApi.ts';

interface Props {
  /** Chamado depois de gravar, para a lista recarregar. */
  onImportado: () => void;
  onFechar: () => void;
}

/** O servidor recusa arquivo maior que isto; avisar antes poupa mandar tudo à toa. */
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_PROBLEMAS_NA_TELA = 50;

function lerTexto(arquivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(String(leitor.result ?? ''));
    leitor.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
    leitor.readAsText(arquivo, 'utf-8');
  });
}

/**
 * Importar cenários de um CSV em 3 passos: escolher o arquivo, conferir a prévia (nada é gravado) e confirmar.
 * Cada linha é conferida pelas mesmas regras do cadastro; linhas com erro ficam de fora e aparecem listadas.
 */
export default function ImportarCsvModal({ onImportado, onFechar }: Props) {
  const [csv, setCsv] = useState<string | null>(null);
  const [nomeArquivo, setNomeArquivo] = useState('');
  const [previa, setPrevia] = useState<RespostaImportacao | null>(null);
  const [modo, setModo] = useState<'ignorar' | 'atualizar'>('ignorar');
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [resultado, setResultado] = useState<RespostaImportacao | null>(null);
  const fechar = useRef(onFechar);
  fechar.current = onFechar;

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') fechar.current();
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, []);

  const mensagem = (e: unknown) => (e instanceof ErroApi ? e.message : e instanceof Error ? e.message : 'Erro inesperado.');

  const escolher = async (e: ChangeEvent<HTMLInputElement>) => {
    const arquivo = e.target.files?.[0];
    setPrevia(null);
    setResultado(null);
    setErro(null);
    setCsv(null);
    if (!arquivo) return;
    setNomeArquivo(arquivo.name);
    if (arquivo.size > MAX_BYTES) {
      setErro(`O arquivo passa de ${MAX_BYTES / 1024 / 1024} MB, o máximo por importação.`);
      return;
    }
    setOcupado(true);
    try {
      const texto = await lerTexto(arquivo);
      setCsv(texto);
      setPrevia(await importarCenariosCsv(texto, 'previa'));
    } catch (erroLeitura) {
      setErro(mensagem(erroLeitura));
    } finally {
      setOcupado(false);
    }
  };

  const novos = previa?.resumo.novos ?? 0;
  const existentes = previa?.resumo.existentes ?? 0;
  const quantidade = novos + (modo === 'atualizar' ? existentes : 0);
  const estoura = previa ? previa.armazenamento.cenarios + novos > previa.armazenamento.maxCenarios : false;

  const importar = async () => {
    if (csv === null) return;
    setOcupado(true);
    setErro(null);
    try {
      setResultado(await importarCenariosCsv(csv, modo));
      onImportado();
    } catch (erroGravacao) {
      setErro(mensagem(erroGravacao));
    } finally {
      setOcupado(false);
    }
  };

  const problemas = (resultado ?? previa)?.problemas ?? [];

  return (
    <PainelTela titulo="Importar cenários (CSV)" largura="form" onFechar={onFechar}>
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-black uppercase text-sm">
            <FileUp size={18} className="text-volt-green" aria-hidden /> Importar cenários (CSV)
          </div>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="p-1 opacity-60 hover:opacity-100 cursor-pointer">
            <X size={20} />
          </button>
        </div>

        {!resultado && (
          <>
            <div>
              <label htmlFor="imp-arquivo" className="block mb-1 text-[11px] font-bold text-on-surface-variant">Arquivo CSV</label>
              <input
                id="imp-arquivo"
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => void escolher(e)}
                className="block w-full text-sm file:mr-3 file:rounded-lg file:border file:border-white/10 file:bg-white/5 file:px-3 file:py-2 file:text-xs file:font-bold file:text-on-surface"
              />
              <p className="mt-2 text-[11px] text-on-surface-variant">
                Colunas: ID, Nome, Funcionalidade (obrigatórias); Feature, Projeto, Massa, CPF, Passos, Resultado esperado (opcionais). Separador ; ou , e acentos em UTF-8.
                O melhor modelo é o arquivo que o botão Exportar CSV gera. Máximo: 10 MB e 5.000 linhas.
              </p>
            </div>

            {ocupado && !previa && <p role="status" className="text-sm text-on-surface-variant">Conferindo {nomeArquivo}…</p>}

            {previa && (
              <div className="space-y-3">
                <p className="text-xs font-bold text-on-surface-variant">{`Prévia de ${nomeArquivo}: nada foi gravado ainda.`}</p>
                <ul data-testid="resumo-importacao" className="grid grid-cols-2 gap-2 sm:grid-cols-4 text-center">
                  {[
                    ['Linhas', previa.resumo.total],
                    ['Novos', previa.resumo.novos],
                    ['Já existem', previa.resumo.existentes + previa.resumo.iguais],
                    ['Com erro', previa.resumo.comErro],
                  ].map(([titulo, valor]) => (
                    <li key={titulo} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                      <div className="text-lg font-black">{valor}</div>
                      <div className="text-[11px] text-on-surface-variant">{titulo}</div>
                    </li>
                  ))}
                </ul>

                {previa.colunasIgnoradas.length > 0 && (
                  <p className="text-[11px] text-on-surface-variant">{`Colunas que a importação não conhece e vai ignorar: ${previa.colunasIgnoradas.join(', ')}.`}</p>
                )}

                {existentes + previa.resumo.iguais > 0 && (
                  <fieldset className="space-y-1.5 rounded-xl border border-white/10 p-3">
                    <legend className="px-1 text-[11px] font-bold text-on-surface-variant">{`O que fazer com os que já existem (mesmo ID)?`}</legend>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="radio" name="modo-imp" checked={modo === 'ignorar'} onChange={() => setModo('ignorar')} className="accent-volt-green" />
                      {`Ignorar os que já existem (${existentes + previa.resumo.iguais})`}
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="radio" name="modo-imp" checked={modo === 'atualizar'} onChange={() => setModo('atualizar')} className="accent-volt-green" />
                      {`Atualizar com os dados do arquivo (${existentes} mudam${previa.resumo.iguais > 0 ? `, ${previa.resumo.iguais} já estão iguais` : ''})`}
                    </label>
                  </fieldset>
                )}

                {estoura && (
                  <p role="alert" className="rounded-xl border border-neon-error/40 bg-neon-error/10 px-3 py-2 text-xs text-neon-error">
                    {`Com os ${novos} novos o cadastro passaria do limite de ${previa.armazenamento.maxCenarios} cenários (hoje: ${previa.armazenamento.cenarios}). Exclua cenários que não usa mais ou reduza o arquivo.`}
                  </p>
                )}
              </div>
            )}
          </>
        )}

        {resultado && (
          <div role="status" className="rounded-xl border border-volt-green/30 bg-volt-green/10 px-4 py-3 text-sm">
            <p className="font-black text-volt-green">Importação concluída.</p>
            <p className="mt-1">{`${resultado.criados?.length ?? 0} criados, ${resultado.atualizados?.length ?? 0} atualizados, ${resultado.ignorados?.length ?? 0} ignorados e ${resultado.resumo.comErro} linhas com erro (não importadas).`}</p>
          </div>
        )}

        {problemas.length > 0 && (
          <div>
            <h3 className="mb-1 text-xs font-black uppercase tracking-wide text-neon-error">{`Linhas com erro (${problemas.length}) — não serão importadas`}</h3>
            <ul data-testid="problemas-importacao" className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-neon-error/30 bg-neon-error/5 p-3 text-xs [color-scheme:dark]">
              {problemas.slice(0, MAX_PROBLEMAS_NA_TELA).map((p) => (
                <li key={p.linha}>
                  <span className="font-black">{`Linha ${p.linha}${p.idCenario ? ` (${p.idCenario})` : ''}:`}</span> {p.mensagens.join(' ')}
                </li>
              ))}
              {problemas.length > MAX_PROBLEMAS_NA_TELA && <li className="text-on-surface-variant">{`… e mais ${problemas.length - MAX_PROBLEMAS_NA_TELA} linhas com erro.`}</li>}
            </ul>
          </div>
        )}

        {erro && (
          <div role="alert" className="rounded-xl border border-neon-error/40 bg-neon-error/10 px-3 py-2 text-xs text-neon-error">
            {erro}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onFechar} className="px-4 py-2.5 rounded-xl text-xs font-bold bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer">
            {resultado ? 'Concluir' : 'Cancelar'}
          </button>
          {!resultado && (
            <button
              type="button"
              onClick={() => void importar()}
              disabled={!previa || quantidade === 0 || estoura || ocupado}
              className="px-4 py-2.5 rounded-xl text-xs font-black bg-volt-green text-black disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            >
              {`Importar ${quantidade} ${quantidade === 1 ? 'cenário' : 'cenários'}`}
            </button>
          )}
        </div>
      </div>
    </PainelTela>
  );
}
