import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// O mosaico usa canvas; no jsdom basta saber que ele foi montado.
vi.mock('../src/shared/GridRevealBackdrop', () => ({ default: () => <div data-testid="fundo-animado" /> }));
vi.mock('../src/shared/MatrixDotLoader', () => ({ default: () => null }));

import App from '../src/App';
import type { Incidente } from '../src/incidentes/clienteIncidentes';
import { IncidentesProvider } from '../src/incidentes/ContextoIncidentes';
import Incidentes from '../src/pages/incidentes/Incidentes';
import { cenario, criarApiFalsa, pessoa } from './apiFalsa';
import { renderComPessoas } from './ajudantes';

const HOJE = '2026-10-02';
const equipe = [pessoa('ana'), pessoa('bia')];

function inc(numero: string, extra: Partial<Incidente> = {}): Incidente {
  return {
    numero,
    titulo: `Titulo de ${numero}`,
    descricao: '',
    status: 'novo',
    severidade: 'media',
    responsavel: null,
    testesAfetados: [],
    comentarios: [],
    historico: [],
    abertoEm: '2026-10-01T14:10:00.000Z',
    resolvidoEm: null,
    atualizadoEm: '2026-10-01T14:10:00.000Z',
    versao: 1,
    ...extra,
  };
}

const base = () => [
  inc('INC0715802225', {
    titulo: 'Saldo de Faturamento difere do extrato',
    severidade: 'alta',
    status: 'em_analise',
    responsavel: 'ana',
    abertoEm: '2026-09-29T15:40:00.000Z',
    testesAfetados: ['CT03.1', 'CT03.2'],
    descricao: 'Não bate com o extrato.',
    comentarios: [{ id: 'cm_1', autor: 'bia', texto: 'Reproduzi com a massa 0484.', em: '2026-10-01T12:00:00.000Z' }],
    historico: [
      { em: '2026-09-29T15:40:00.000Z', autor: 'ana', tipo: 'registro' },
      { em: '2026-10-02T12:14:00.000Z', autor: 'ana', tipo: 'status', de: 'novo', para: 'em_analise' },
    ],
  }),
  inc('INC0715799001', { titulo: 'Cadastro duplicado aceita CPF repetido', responsavel: 'bia', testesAfetados: ['CT05.2'] }),
  inc('INC0715790010', { titulo: 'Botão sem foco no cadastro PF', severidade: 'baixa', status: 'resolvido', responsavel: 'bia', abertoEm: '2026-09-28T10:00:00.000Z', resolvidoEm: '2026-09-30T16:30:00.000Z', testesAfetados: ['CT05.1'] }),
];

async function abrir(opcoes: { incidentes?: Incidente[]; voce?: string } = {}) {
  const api = criarApiFalsa({ incidentes: opcoes.incidentes ?? base(), pessoas: equipe, cenarios: [cenario('CT03.1'), cenario('CT03.2'), cenario('CT05.1'), cenario('CT05.2')] });
  vi.stubGlobal('fetch', api.falso);
  renderComPessoas(
    <IncidentesProvider>
      <Incidentes hoje={HOJE} />
    </IncidentesProvider>,
    equipe,
    opcoes.voce === undefined ? 'ana' : opcoes.voce || undefined,
  );
  if ((opcoes.incidentes ?? base()).length > 0) await screen.findByTestId('card-inc-INC0715802225');
  return api;
}

const coluna = (status: string) => screen.getByTestId(`coluna-inc-${status}`);

beforeEach(() => vi.unstubAllGlobals());
afterEach(() => vi.unstubAllGlobals());

describe('Tela Incidentes — quadro, tabela e resumo', () => {
  it('sem nenhum INC, diz isso e ensina o que fazer', async () => {
    await abrir({ incidentes: [] });
    expect(await screen.findByText('Nenhum incidente')).toBeInTheDocument();
    expect(screen.getByTestId('resumo-inc')).toHaveTextContent('Resumo: abertos 0');
  });

  it('uma coluna por status, com os cards (número, gravidade, título, afeta, responsável e há quanto tempo)', async () => {
    await abrir();
    expect(within(coluna('novo')).getByRole('heading')).toHaveTextContent('Novo (1)');
    expect(within(coluna('em_analise')).getByRole('heading')).toHaveTextContent('Em análise (1)');
    expect(within(coluna('resolvido')).getByRole('heading')).toHaveTextContent('Resolvido (1)');
    const card = screen.getByTestId('card-inc-INC0715802225');
    expect(card).toHaveTextContent('Alta');
    expect(card).toHaveTextContent('Saldo de Faturamento difere do extrato');
    expect(card).toHaveTextContent('Afeta: CT03.1 CT03.2');
    expect(card).toHaveTextContent('Resp.: Ana · há 3 dias');
    expect(screen.getByTestId('card-inc-INC0715790010')).toHaveTextContent('resolvido 30/09');
  });

  it('a tabela lista os INC com Alta primeiro', async () => {
    await abrir();
    const linhas = screen.getAllByTestId(/^linha-inc-/).map((l) => l.getAttribute('data-testid'));
    expect(linhas).toEqual(['linha-inc-INC0715802225', 'linha-inc-INC0715799001', 'linha-inc-INC0715790010']);
    expect(screen.getByTestId('linha-inc-INC0715799001')).toHaveTextContent('há 1 dia');
  });

  it('o resumo é o do desenho', async () => {
    await abrir();
    expect(screen.getByTestId('resumo-inc')).toHaveTextContent('Resumo: abertos 2 · Alta 1 · Média 1 · tempo médio de resolução 2 dias · testes travados 3');
  });
});

describe('Tela Incidentes — filtros', () => {
  it('"Mostrar resolvidos" desligado tira a coluna e o INC resolvido; o resumo continua o mesmo', async () => {
    await abrir();
    await userEvent.click(screen.getByLabelText('Mostrar resolvidos'));
    expect(screen.queryByTestId('coluna-inc-resolvido')).toBeNull();
    expect(screen.queryByTestId('linha-inc-INC0715790010')).toBeNull();
    expect(screen.getByTestId('resumo-inc')).toHaveTextContent('tempo médio de resolução 2 dias');
  });

  it('filtra por severidade, responsável e busca', async () => {
    await abrir();
    await userEvent.selectOptions(screen.getByLabelText('Severidade'), 'alta');
    expect(screen.getAllByTestId(/^linha-inc-/)).toHaveLength(1);
    await userEvent.selectOptions(screen.getByLabelText('Severidade'), '');
    await userEvent.selectOptions(screen.getByLabelText('Resp.'), 'bia');
    expect(screen.getAllByTestId(/^linha-inc-/)).toHaveLength(2);
    await userEvent.selectOptions(screen.getByLabelText('Resp.'), '');
    await userEvent.type(screen.getByLabelText('Buscar'), 'ct05.2');
    expect(screen.getAllByTestId(/^linha-inc-/).map((l) => l.getAttribute('data-testid'))).toEqual(['linha-inc-INC0715799001']);
    await userEvent.clear(screen.getByLabelText('Buscar'));
    await userEvent.type(screen.getByLabelText('Buscar'), 'zzzz');
    expect(screen.getByText('Nenhum incidente com estes filtros')).toBeInTheDocument();
  });

  it('"Só meus" mostra os INC de quem é "Você"', async () => {
    await abrir();
    await userEvent.click(screen.getByLabelText('Só meus'));
    expect(screen.getAllByTestId(/^linha-inc-/).map((l) => l.getAttribute('data-testid'))).toEqual(['linha-inc-INC0715802225']);
  });

  it('sem "Você", "Só meus" não pode ser marcado', async () => {
    await abrir({ voce: '' });
    expect(screen.getByLabelText('Só meus')).toBeDisabled();
  });
});

describe('Tela Incidentes — mudar o status', () => {
  it('o seletor do card grava o novo status com o autor e o card muda de coluna', async () => {
    const api = await abrir();
    await userEvent.selectOptions(screen.getByLabelText('Status de INC0715799001'), 'em_analise');
    await waitFor(() => expect(api.escritas()).toContainEqual({ metodo: 'PUT', caminho: '/api/incidentes/INC0715799001', corpo: { versao: 1, status: 'em_analise', autor: 'ana' } }));
    await waitFor(() => expect(within(coluna('em_analise')).getByTestId('card-inc-INC0715799001')).toBeInTheDocument());
  });

  it('arrastar o card para outra coluna faz o mesmo; soltar na mesma coluna não grava', async () => {
    const api = await abrir();
    fireEvent.dragStart(screen.getByTestId('card-inc-INC0715799001'));
    fireEvent.drop(coluna('novo'));
    expect(api.escritas()).toEqual([]);
    fireEvent.dragStart(screen.getByTestId('card-inc-INC0715799001'));
    fireEvent.drop(coluna('resolvido'));
    await waitFor(() => expect(api.escritas()).toHaveLength(1));
    expect(api.escritas()[0].corpo).toEqual({ versao: 1, status: 'resolvido', autor: 'ana' });
    await waitFor(() => expect(within(coluna('resolvido')).getByTestId('card-inc-INC0715799001')).toBeInTheDocument());
  });

  it('se o servidor recusar (outra pessoa mexeu antes), mostra o motivo', async () => {
    const api = criarApiFalsa({ incidentes: base(), pessoas: equipe });
    vi.stubGlobal('fetch', async (entrada: RequestInfo | URL, init?: RequestInit) =>
      init?.method === 'PUT'
        ? new Response(JSON.stringify({ erro: 'versao_antiga', mensagem: 'INC0715799001 foi alterado por outra pessoa. Recarregue antes de salvar.' }), { status: 409, headers: { 'content-type': 'application/json' } })
        : api.falso(entrada, init),
    );
    renderComPessoas(<IncidentesProvider><Incidentes hoje={HOJE} /></IncidentesProvider>, equipe, 'ana');
    await userEvent.selectOptions(await screen.findByLabelText('Status de INC0715799001'), 'resolvido');
    expect(await screen.findByRole('alert')).toHaveTextContent('foi alterado por outra pessoa');
  });
});

describe('Tela Incidentes — painel lateral', () => {
  const abrirPainel = async (numero = 'INC0715802225') => {
    await userEvent.click(await screen.findByRole('button', { name: `Abrir ${numero}` }));
    return screen.getByRole('dialog', { name: `Detalhe do ${numero}` });
  };

  it('mostra os campos, os testes afetados, o histórico (mais novo primeiro) e os comentários', async () => {
    await abrir();
    const painel = await abrirPainel();
    expect(within(painel).getByLabelText('Título')).toHaveValue('Saldo de Faturamento difere do extrato');
    expect(within(painel).getByLabelText('Severidade')).toHaveValue('alta');
    expect(within(painel).getByLabelText('Status')).toHaveValue('em_analise');
    expect(within(painel).getByLabelText('Responsável')).toHaveValue('ana');
    expect(within(painel).getByLabelText('Descrição')).toHaveValue('Não bate com o extrato.');
    expect(within(painel).getByRole('button', { name: 'Tirar CT03.1' })).toBeInTheDocument();
    const historico = within(within(painel).getByRole('region', { name: 'Histórico' })).getAllByRole('listitem');
    // data/hora, autor e texto são trechos separados da mesma linha (a hora depende do fuso de quem olha)
    expect(historico[0]).toHaveTextContent(/Anamudou status: Novo → Em análise$/);
    expect(historico[1]).toHaveTextContent(/Anaregistrou o INC$/);
    expect(within(painel).getByRole('region', { name: 'Comentários' })).toHaveTextContent('Bia');
    expect(within(painel).getByText('Reproduzi com a massa 0484.')).toBeInTheDocument();
  });

  it('"Salvar" só liga depois de mudar algo e grava tudo com a versão e o autor', async () => {
    const api = await abrir();
    const painel = await abrirPainel();
    expect(within(painel).getByRole('button', { name: 'Salvar' })).toBeDisabled();
    await userEvent.selectOptions(within(painel).getByLabelText('Status'), 'resolvido');
    await userEvent.selectOptions(within(painel).getByLabelText('Responsável'), 'bia');
    await userEvent.click(within(painel).getByRole('button', { name: 'Tirar CT03.2' }));
    await userEvent.click(within(painel).getByRole('button', { name: 'Salvar' }));
    await waitFor(() =>
      expect(api.escritas()).toContainEqual({
        metodo: 'PUT',
        caminho: '/api/incidentes/INC0715802225',
        corpo: {
          versao: 1,
          titulo: 'Saldo de Faturamento difere do extrato',
          descricao: 'Não bate com o extrato.',
          status: 'resolvido',
          severidade: 'alta',
          responsavel: 'bia',
          testesAfetados: ['CT03.1'],
          autor: 'ana',
        },
      }),
    );
    expect(await within(painel).findByText('Alterações salvas.')).toBeInTheDocument();
    await waitFor(() => expect(within(coluna('resolvido')).getByTestId('card-inc-INC0715802225')).toBeInTheDocument());
  });

  it('comentar grava com o autor, aparece na lista e limpa o campo; salvar depois continua valendo (sem falso conflito)', async () => {
    const api = await abrir();
    const painel = await abrirPainel();
    expect(within(painel).getByRole('button', { name: 'Enviar' })).toBeDisabled();
    await userEvent.type(within(painel).getByLabelText('Escrever comentário'), 'Vou olhar amanhã.');
    await userEvent.click(within(painel).getByRole('button', { name: 'Enviar' }));
    await waitFor(() => expect(api.escritas()).toContainEqual({ metodo: 'POST', caminho: '/api/incidentes/INC0715802225/comentarios', corpo: { texto: 'Vou olhar amanhã.', autor: 'ana' } }));
    expect(await within(painel).findByText('Vou olhar amanhã.')).toBeInTheDocument();
    expect(within(painel).getByLabelText('Escrever comentário')).toHaveValue('');

    await userEvent.selectOptions(within(painel).getByLabelText('Severidade'), 'baixa');
    await userEvent.click(within(painel).getByRole('button', { name: 'Salvar' }));
    expect(await within(painel).findByText('Alterações salvas.')).toBeInTheDocument();
    expect(within(painel).queryByRole('alert')).toBeNull();
  });

  it('excluir pede confirmação; "Manter" e Esc não apagam; confirmar apaga e fecha o painel', async () => {
    const api = await abrir();
    const painel = await abrirPainel('INC0715799001');
    await userEvent.click(within(painel).getByRole('button', { name: 'Excluir INC' }));
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Manter' }));
    await userEvent.click(within(painel).getByRole('button', { name: 'Excluir INC' }));
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Detalhe do INC0715799001' })).toBeInTheDocument();
    expect(api.escritas()).toEqual([]);

    await userEvent.click(within(painel).getByRole('button', { name: 'Excluir INC' }));
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Excluir' }));
    await waitFor(() => expect(api.escritas()).toContainEqual({ metodo: 'DELETE', caminho: '/api/incidentes/INC0715799001', corpo: undefined }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.queryByTestId('card-inc-INC0715799001')).toBeNull();
  });

  it('Esc e ✕ fecham o painel; a linha da tabela abre o mesmo painel', async () => {
    await abrir();
    await abrirPainel();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Abrir INC0715799001 na tabela' }));
    expect(screen.getByRole('dialog', { name: 'Detalhe do INC0715799001' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('Tela Incidentes — registrar e vincular a partir daqui', () => {
  it('"Registrar INC" oferece todos os testes do cadastro e o novo INC aparece no quadro', async () => {
    const api = await abrir();
    await userEvent.click(screen.getByRole('button', { name: 'Registrar INC' }));
    const modal = screen.getByRole('dialog', { name: 'Registrar INC' });
    await waitFor(() => expect(within(within(modal).getByLabelText('Adicionar teste')).getAllByRole('option')).toHaveLength(5)); // "+ adicionar" + 4 cenários
    await userEvent.type(within(modal).getByLabelText('Nº do INC'), 'INC0715900001');
    await userEvent.type(within(modal).getByLabelText('Título'), 'Novo problema');
    await userEvent.click(within(modal).getByRole('button', { name: 'Registrar' }));
    await waitFor(() => expect(api.escritas().some((e) => e.metodo === 'POST' && e.caminho === '/api/incidentes')).toBe(true));
    expect(await screen.findByTestId('card-inc-INC0715900001')).toBeInTheDocument();
    expect(within(coluna('novo')).getByRole('heading')).toHaveTextContent('Novo (2)');
  });

  it('"Vincular INC existente" liga o INC a mais um teste e o card mostra', async () => {
    await abrir();
    await userEvent.click(screen.getByRole('button', { name: 'Vincular INC existente' }));
    const modal = screen.getByRole('dialog', { name: 'Vincular INC existente' });
    await userEvent.type(within(modal).getByLabelText('Buscar'), '799001');
    await userEvent.click(within(modal).getAllByRole('radio')[0]);
    await waitFor(() => expect(within(within(modal).getByLabelText('Adicionar teste')).getAllByRole('option').length).toBeGreaterThan(1));
    await userEvent.selectOptions(within(modal).getByLabelText('Adicionar teste'), 'CT03.1');
    await userEvent.click(within(modal).getByRole('button', { name: 'Vincular' }));
    await waitFor(() => expect(screen.getByTestId('card-inc-INC0715799001')).toHaveTextContent('Afeta: CT05.2 CT03.1'));
  });
});

describe('Incidentes no app', () => {
  it('o menu mostra o número de INC abertos e o item abre a tela', async () => {
    const api = criarApiFalsa({ incidentes: base(), pessoas: equipe });
    vi.stubGlobal('fetch', api.falso);
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    const menu = screen.getByRole('complementary', { name: 'Navegação' });
    const botao = within(menu).getByRole('button', { name: 'Incidentes' });
    await waitFor(() => expect(within(botao).getByText('2')).toBeInTheDocument());
    await userEvent.click(botao);
    expect(screen.getByRole('heading', { level: 2, name: 'Incidentes' })).toBeInTheDocument();
    expect(await screen.findByTestId('card-inc-INC0715802225')).toBeInTheDocument();
  });

  it('sem INC aberto, o menu não mostra selo nenhum', async () => {
    const api = criarApiFalsa({ incidentes: [], pessoas: equipe });
    vi.stubGlobal('fetch', api.falso);
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    const menu = screen.getByRole('complementary', { name: 'Navegação' });
    expect(within(within(menu).getByRole('button', { name: 'Incidentes' })).queryByText(/^\d+$/)).toBeNull();
  });
});
