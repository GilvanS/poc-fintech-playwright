import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Cenarios from '../src/pages/cenarios/Cenarios';
import type { Armazenamento, CenarioVisao, RespostaImportacao } from '../src/pages/cenarios/clienteApi';

const AGORA = '2026-10-03T10:00:00.000Z';

function cenario(idCenario: string, extra: Partial<CenarioVisao> = {}): CenarioVisao {
  return { idCenario, nome: `Nome de ${idCenario}`, funcionalidade: 'Faturas', versao: 1, criadoEm: AGORA, atualizadoEm: AGORA, dependeDe: [], massaCompartilhadaCom: [], ...extra };
}

const CATALOGO = [
  cenario('CT03.2', { feature: 'faturas.feature', projeto: 'FintechBankApp', passos: 'Abrir a fatura\nPagar o mínimo', resultadoEsperado: 'Pagamento mínimo registrado', idMassa: '0483', cpf: '52998224725' }),
  cenario('CT03.3', { feature: 'faturas.feature', projeto: 'FintechBankApp' }),
  cenario('CT04.1', { nome: 'Agendar Pix', funcionalidade: 'Pix', feature: 'pix.feature', projeto: 'Outro' }),
];

const armaz = (extra: Partial<Armazenamento> = {}): Armazenamento => ({ cenarios: 3, maxCenarios: 5000, bytes: 49152, maxBytes: 25 * 1024 * 1024, perto: false, ...extra });

interface Opcoes {
  armazenamento?: Armazenamento;
  planosDoCenario?: unknown[];
  previa?: Partial<RespostaImportacao>;
}

function servidorFalso({ armazenamento = armaz(), planosDoCenario = [], previa = {} }: Opcoes = {}) {
  const chamadas: { metodo: string; caminho: string; corpo?: Record<string, unknown> }[] = [];
  const json = (status: number, corpo: unknown) => new Response(JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json' } });
  const resposta = (modo: string): RespostaImportacao => ({
    resumo: { total: 3, novos: 1, existentes: 1, iguais: 0, comErro: 1 },
    problemas: [{ linha: 4, idCenario: 'XX', mensagens: ['ID do cenário deve seguir o formato CTnn.n (ex.: CT03.2).'] }],
    colunasIgnoradas: ['Extra'],
    armazenamento: armazenamento,
    ...(modo === 'previa' ? {} : { criados: ['CT05.1'], atualizados: modo === 'atualizar' ? ['CT03.2'] : [], ignorados: modo === 'ignorar' ? ['CT03.2'] : [] }),
    ...previa,
  });
  const falso = vi.fn(async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const caminho = String(entrada);
    const metodo = init?.method ?? 'GET';
    const corpo = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined;
    chamadas.push({ metodo, caminho, corpo });
    if (caminho === '/api/cenarios/exportar.csv') return new Response('﻿ID;Nome\r\nCT03.2;Nome\r\n', { status: 200, headers: { 'content-type': 'text/csv' } });
    if (caminho === '/api/cenarios/importar') return json(200, resposta(String(corpo?.modo)));
    if (/\/api\/cenarios\/[^/]+\/planos$/.test(caminho)) return json(200, { planos: planosDoCenario });
    return json(200, {
      cenarios: CATALOGO,
      funcionalidades: ['Faturas', 'Pix'],
      projetos: ['FintechBankApp', 'Outro'],
      armazenamento,
    });
  });
  return { falso, chamadas };
}

async function abrir(opcoes?: Opcoes) {
  const api = servidorFalso(opcoes);
  vi.stubGlobal('fetch', api.falso);
  render(<Cenarios />);
  await screen.findByRole('button', { name: 'Detalhes de CT03.2' });
  return api;
}

beforeEach(() => vi.unstubAllGlobals());
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Cenários — detalhe', () => {
  it('clicar no ID abre o popup com todos os dados, os planos onde o cenário está e as alças para esticar os textos', async () => {
    await abrir({
      planosDoCenario: [{ planoId: 'pl1', planoNome: '28/09/26', criadoEm: AGORA, status: 'agendado', dataPlanejada: '2026-10-08' }],
    });
    await userEvent.click(screen.getByRole('button', { name: 'Detalhes de CT03.2' }));
    const popup = await screen.findByRole('dialog', { name: 'Detalhe do cenário' });
    expect(within(popup).getByText('faturas.feature')).toBeInTheDocument();
    expect(within(popup).getAllByText('FintechBankApp').length).toBeGreaterThan(0);
    expect(within(popup).getByText('529.982.247-25')).toBeInTheDocument();
    expect((within(popup).getByLabelText('Passos') as HTMLTextAreaElement).value).toBe('Abrir a fatura\nPagar o mínimo');
    expect(within(popup).getByLabelText('Passos')).toHaveClass('resize-y');
    expect(within(popup).getByLabelText('Resultado esperado')).toHaveAttribute('readonly');
    expect(await within(popup).findByTestId('plano-do-cenario-pl1')).toHaveTextContent('Plano 28/09/26');
    expect(within(popup).getByText('Planos (1)')).toBeInTheDocument();
  });

  it('sem planos avisa; Esc fecha; Editar abre o formulário já com Feature e Projeto preenchidos', async () => {
    await abrir();
    await userEvent.click(screen.getByRole('button', { name: 'Detalhes de CT03.2' }));
    const popup = await screen.findByRole('dialog', { name: 'Detalhe do cenário' });
    expect(await within(popup).findByText('Este cenário ainda não está em nenhum plano.')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Detalhe do cenário' })).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Detalhes de CT03.2' }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: 'Detalhe do cenário' })).getByRole('button', { name: 'Editar' }));
    const form = await screen.findByRole('dialog', { name: 'Editar cenário CT03.2' });
    expect(within(form).getByLabelText('Feature (opcional)')).toHaveValue('faturas.feature');
    expect(within(form).getByLabelText('Projeto (opcional)')).toHaveValue('FintechBankApp');
  });

  it('Excluir no detalhe abre a confirmação de exclusão', async () => {
    await abrir();
    await userEvent.click(screen.getByRole('button', { name: 'Detalhes de CT04.1' }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: 'Detalhe do cenário' })).getByRole('button', { name: 'Excluir' }));
    expect(await screen.findByText('Excluir o cenário CT04.1?')).toBeInTheDocument();
  });
});

describe('Cenários — filtros e armazenamento', () => {
  it('filtra por funcionalidade e por projeto, e a contagem acompanha', async () => {
    await abrir();
    expect(screen.getByText('3 cenários')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Filtrar por funcionalidade'), 'Pix');
    expect(screen.getByText('1 de 3 cenários')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Detalhes de CT03.2' })).toBeNull();

    await userEvent.selectOptions(screen.getByLabelText('Filtrar por funcionalidade'), '');
    await userEvent.selectOptions(screen.getByLabelText('Filtrar por projeto'), 'FintechBankApp');
    expect(screen.getByText('2 de 3 cenários')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Detalhes de CT04.1' })).toBeNull();
  });

  it('a busca também acha pela feature e pelo projeto; a tabela mostra as colunas Feature e Projeto', async () => {
    await abrir();
    expect(screen.getByRole('columnheader', { name: 'Feature' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Projeto' })).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Buscar cenário'), 'pix.feature');
    expect(screen.getByText('1 de 3 cenários')).toBeInTheDocument();
  });

  it('mostra quanto do limite está usado e destaca quando chega perto', async () => {
    await abrir();
    expect(screen.getByTestId('armazenamento')).toHaveTextContent('Armazenamento: 3 de 5.000 cenários');
    expect(screen.getByTestId('armazenamento')).not.toHaveTextContent('perto do limite');
  });

  it('perto do limite: o aviso aparece', async () => {
    await abrir({ armazenamento: armaz({ cenarios: 4100, perto: true }) });
    expect(screen.getByTestId('armazenamento')).toHaveTextContent('4.100 de 5.000 cenários');
    expect(screen.getByTestId('armazenamento')).toHaveTextContent('perto do limite');
  });
});

describe('Cenários — exportar CSV', () => {
  it('"Exportar CSV" baixa o arquivo cenarios.csv vindo do servidor', async () => {
    const api = await abrir();
    const criar = vi.fn(() => 'blob:falso');
    const revogar = vi.fn();
    Object.assign(URL, { createObjectURL: criar, revokeObjectURL: revogar });
    const baixados: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      baixados.push(this.download);
    });
    await userEvent.click(screen.getByRole('button', { name: 'Exportar CSV' }));
    await waitFor(() => expect(baixados).toEqual(['cenarios.csv']));
    expect(api.chamadas.some((c) => c.caminho === '/api/cenarios/exportar.csv')).toBe(true);
    expect(criar).toHaveBeenCalledTimes(1);
    expect(revogar).toHaveBeenCalledWith('blob:falso');
  });
});

describe('Cenários — importar CSV', () => {
  const arquivo = () => new File(['ID;Nome;Funcionalidade\r\nCT05.1;Novo;Cartões\r\n'], 'cenarios.csv', { type: 'text/csv' });
  const abrirImportacao = async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Importar CSV' }));
    return screen.findByRole('dialog', { name: 'Importar cenários (CSV)' });
  };

  it('escolher o arquivo mostra a prévia sem gravar nada, com as linhas de erro e a escolha para os que já existem', async () => {
    const api = await abrir();
    const painel = await abrirImportacao();
    await userEvent.upload(within(painel).getByLabelText('Arquivo CSV'), arquivo());

    const resumo = await within(painel).findByTestId('resumo-importacao');
    expect(resumo).toHaveTextContent('3Linhas');
    expect(resumo).toHaveTextContent('1Novos');
    expect(resumo).toHaveTextContent('1Já existem');
    expect(resumo).toHaveTextContent('1Com erro');
    expect(within(painel).getByTestId('problemas-importacao')).toHaveTextContent('Linha 4 (XX): ID do cenário deve seguir o formato CTnn.n');
    expect(within(painel).getByText(/Colunas que a importação não conhece.*Extra/)).toBeInTheDocument();
    expect(within(painel).getByRole('radio', { name: /Ignorar os que já existem/ })).toBeChecked();
    expect(within(painel).getByRole('button', { name: 'Importar 1 cenário' })).toBeEnabled();
    expect(api.chamadas.filter((c) => c.caminho === '/api/cenarios/importar').map((c) => c.corpo?.modo)).toEqual(['previa']);
  });

  it('confirmar manda o modo escolhido, mostra o resultado e recarrega a lista', async () => {
    const api = await abrir();
    const painel = await abrirImportacao();
    await userEvent.upload(within(painel).getByLabelText('Arquivo CSV'), arquivo());
    await within(painel).findByTestId('resumo-importacao');
    await userEvent.click(within(painel).getByRole('radio', { name: /Atualizar com os dados do arquivo/ }));
    expect(within(painel).getByRole('button', { name: 'Importar 2 cenários' })).toBeEnabled();
    const listagensAntes = api.chamadas.filter((c) => c.metodo === 'GET' && c.caminho === '/api/cenarios').length;
    await userEvent.click(within(painel).getByRole('button', { name: 'Importar 2 cenários' }));

    expect(await within(painel).findByText('Importação concluída.')).toBeInTheDocument();
    expect(within(painel).getByText(/1 criados, 1 atualizados, 0 ignorados e 1 linhas com erro/)).toBeInTheDocument();
    expect(api.chamadas.filter((c) => c.caminho === '/api/cenarios/importar').map((c) => c.corpo?.modo)).toEqual(['previa', 'atualizar']);
    await waitFor(() => expect(api.chamadas.filter((c) => c.metodo === 'GET' && c.caminho === '/api/cenarios').length).toBeGreaterThan(listagensAntes));
  });

  it('se os novos passariam do limite, avisa e não deixa importar', async () => {
    await abrir({
      previa: { resumo: { total: 10, novos: 10, existentes: 0, iguais: 0, comErro: 0 }, problemas: [], armazenamento: armaz({ cenarios: 4995, perto: true }) },
    });
    const painel = await abrirImportacao();
    await userEvent.upload(within(painel).getByLabelText('Arquivo CSV'), arquivo());
    expect(await within(painel).findByRole('alert')).toHaveTextContent('passaria do limite de 5000 cenários');
    expect(within(painel).getByRole('button', { name: 'Importar 10 cenários' })).toBeDisabled();
  });

  it('arquivo acima de 5 MB é recusado na hora, sem chamar o servidor', async () => {
    const api = await abrir();
    const painel = await abrirImportacao();
    const grande = new File(['x'], 'grande.csv', { type: 'text/csv' });
    Object.defineProperty(grande, 'size', { value: 6 * 1024 * 1024 });
    await userEvent.upload(within(painel).getByLabelText('Arquivo CSV'), grande);
    expect(await within(painel).findByRole('alert')).toHaveTextContent('passa de 5 MB');
    expect(api.chamadas.some((c) => c.caminho === '/api/cenarios/importar')).toBe(false);
  });
});
