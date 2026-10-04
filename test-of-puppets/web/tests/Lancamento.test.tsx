import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// O mosaico usa canvas; no jsdom basta saber que ele foi montado.
vi.mock('../src/shared/GridRevealBackdrop', () => ({ default: () => <div data-testid="fundo-animado" /> }));
vi.mock('../src/shared/MatrixDotLoader', () => ({ default: () => null }));

import App from '../src/App';
import Lancamento from '../src/pages/lancamento/Lancamento';
import { SEM_FILTROS } from '../src/pages/planos/filtros';
import { criarApiFalsa, item, pessoa, plano } from './apiFalsa';
import { renderComPessoas } from './ajudantes';

const HOJE = '2026-10-03';
const equipe = [pessoa('ana'), pessoa('bia'), pessoa('carlos')];

const planoMaster = () =>
  plano(
    'pl_master',
    '28/09/26',
    [
      item('CT03.1', { funcionalidade: 'Faturas', status: 'concluido', resultado: 'passou', responsavel: 'ana', prioridade: 'P1', estimativaMin: 20 }),
      item('CT03.2', { funcionalidade: 'Faturas', status: 'em_andamento', responsavel: 'ana', prioridade: 'P1', estimativaMin: 30, idMassa: '0483', massaCompartilhadaCom: ['CT03.7'] }),
      item('CT03.3', { funcionalidade: 'Faturas', responsavel: 'bia', prioridade: 'P2', estimativaMin: 25 }),
      item('CT03.7', { funcionalidade: 'Faturas', responsavel: 'bia', prioridade: 'P2', estimativaMin: 30, idMassa: '0483', dependeDe: ['CT03.2'], massaCompartilhadaCom: ['CT03.2'] }),
      item('CT04.1', { funcionalidade: 'Pix', responsavel: 'carlos', prioridade: 'P1', estimativaMin: 20 }),
      item('CT05.2', { funcionalidade: 'Cadastro', status: 'concluido', resultado: 'falhou', responsavel: 'bia' }),
    ],
    { previsao: '2026-10-13' },
  );

async function abrir(extra: { onAbrirLista?: ReturnType<typeof vi.fn>; planoId?: string | null } = {}) {
  const api = criarApiFalsa({ planos: [planoMaster()], pessoas: equipe });
  vi.stubGlobal('fetch', api.falso);
  const onAbrirLista = extra.onAbrirLista ?? vi.fn();
  const onIrParaPlanos = vi.fn();
  renderComPessoas(<Lancamento planoId={extra.planoId === undefined ? 'pl_master' : extra.planoId} hoje={HOJE} onAbrirLista={onAbrirLista} onIrParaPlanos={onIrParaPlanos} />, equipe);
  return { api, onAbrirLista, onIrParaPlanos };
}

const linha = (id: string) => screen.getByTestId(`linha-${id}`);
/** O texto de cada célula da linha, na ordem das colunas. */
const numeros = (el: HTMLElement) => within(el).getAllByRole('cell').map((c) => c.textContent);

beforeEach(() => vi.unstubAllGlobals());
afterEach(() => vi.unstubAllGlobals());

describe('Lançamento — quadro', () => {
  it('mostra o plano, o marco em dias úteis e o pronto geral', async () => {
    await abrir();
    expect(await screen.findByRole('heading', { level: 3, name: 'Lançamento do plano 28/09/26' })).toBeInTheDocument();
    expect(screen.getByTestId('marco')).toHaveTextContent('Próximo marco: previsão 13/10/2026 (7 dias úteis)');
    expect(screen.getByRole('progressbar', { name: 'Pronto do plano' })).toHaveAttribute('aria-valuenow', '17');
  });

  it('linhas por funcionalidade com responsável principal, contagem por status, pronto e TOTAL', async () => {
    await abrir();
    await screen.findByTestId('linha-Faturas');
    expect(numeros(linha('Faturas'))).toEqual(['Ana / Bia', '2', '1', '0', '1', '0', '25%']);
    expect(numeros(linha('Pix'))).toEqual(['Carlos', '1', '0', '0', '0', '0', '0%']);
    expect(numeros(linha('Cadastro'))).toEqual(['Bia', '0', '0', '0', '0', '1', '0%']);
    expect(numeros(screen.getByTestId('linha-total'))).toEqual(['', '3', '1', '0', '1', '1', '17%']);
  });

  it('a coluna "Concluído sem resultado" só aparece quando existe algum', async () => {
    await abrir();
    await screen.findByTestId('linha-Faturas');
    expect(screen.queryByRole('columnheader', { name: 'Concluído sem resultado' })).toBeNull();
  });

  it('valor "Minutos estimados" e "% do total" trocam os números', async () => {
    await abrir();
    await screen.findByTestId('linha-Faturas');
    await userEvent.selectOptions(screen.getByLabelText('Valor'), 'minutos');
    expect(numeros(linha('Faturas')).slice(1, 6)).toEqual(['55', '30', '0', '20', '0']);
    await userEvent.selectOptions(screen.getByLabelText('Valor'), 'percentual');
    expect(numeros(linha('Faturas')).slice(1, 6)).toEqual(['33%', '17%', '0%', '17%', '0%']);
  });

  it('linhas por responsável tiram a coluna "Resp. principal"', async () => {
    await abrir();
    await screen.findByTestId('linha-Faturas');
    await userEvent.selectOptions(screen.getByLabelText('Linhas'), 'responsavel');
    expect(screen.queryByRole('columnheader', { name: 'Resp. principal' })).toBeNull();
    expect(screen.getByRole('columnheader', { name: 'Responsável' })).toBeInTheDocument();
    expect(numeros(linha('ana'))).toEqual(['0', '1', '0', '1', '0', '50%']);
    expect(numeros(linha('bia'))).toEqual(['2', '0', '0', '0', '1', '0%']);
  });

  it('filtro de responsável recalcula o quadro só com os testes da pessoa', async () => {
    await abrir();
    await screen.findByTestId('linha-Faturas');
    await userEvent.selectOptions(screen.getByLabelText('Resp.'), 'bia');
    expect(screen.queryByTestId('linha-Pix')).toBeNull();
    expect(numeros(linha('Faturas')).slice(1, 3)).toEqual(['2', '0']);
    expect(numeros(screen.getByTestId('linha-total'))[1]).toBe('2');
  });

  it('mostra o "pronto" de cada área e a nota da massa compartilhada', async () => {
    await abrir();
    await screen.findByTestId('linha-Faturas');
    expect(screen.getByRole('progressbar', { name: 'Pronto de Faturas' })).toHaveAttribute('aria-valuenow', '25');
    expect(screen.getByText('1 de 4 passaram')).toBeInTheDocument();
    expect(screen.getByText('= massa 0483 compartilhada (CT03.2 → CT03.7)')).toBeInTheDocument();
  });

  it('sem teste esperando outro, os bloqueios dizem isso; sem previsão, o marco também', async () => {
    const api = criarApiFalsa({ planos: [plano('pl_a', 'A', [item('CT1', { funcionalidade: 'Pix' })])] });
    vi.stubGlobal('fetch', api.falso);
    renderComPessoas(<Lancamento planoId="pl_a" hoje={HOJE} onAbrirLista={vi.fn()} onIrParaPlanos={vi.fn()} />, equipe);
    expect(await screen.findByText('Nenhum teste esperando outro.')).toBeInTheDocument();
    expect(screen.getByTestId('marco')).toHaveTextContent('Sem previsão definida');
  });

  it('previsão que já passou diz há quantos dias úteis venceu', async () => {
    const api = criarApiFalsa({ planos: [plano('pl_a', 'A', [item('CT1')], { previsao: '2026-09-30' })] });
    vi.stubGlobal('fetch', api.falso);
    renderComPessoas(<Lancamento planoId="pl_a" hoje={HOJE} onAbrirLista={vi.fn()} onIrParaPlanos={vi.fn()} />, equipe);
    expect(await screen.findByTestId('marco')).toHaveTextContent('previsão 30/09/2026 (venceu há 3 dias úteis)');
  });

  it('sem plano escolhido, avisa e oferece ir para Planos', async () => {
    const { onIrParaPlanos } = await abrir({ planoId: null });
    await userEvent.click(screen.getByRole('button', { name: 'Ir para Planos' }));
    expect(onIrParaPlanos).toHaveBeenCalled();
  });
});

describe('Lançamento — clicar abre a Lista filtrada', () => {
  it('célula: funcionalidade + status', async () => {
    const { onAbrirLista } = await abrir();
    await userEvent.click(await screen.findByRole('button', { name: 'Faturas × Agendado: 2' }));
    expect(onAbrirLista).toHaveBeenCalledWith({ ...SEM_FILTROS, funcionalidade: 'Faturas', status: 'agendado' });
  });

  it('células Passou e Falhou filtram também pelo resultado', async () => {
    const { onAbrirLista } = await abrir();
    await userEvent.click(await screen.findByRole('button', { name: 'Faturas × Passou: 1' }));
    expect(onAbrirLista).toHaveBeenLastCalledWith({ ...SEM_FILTROS, funcionalidade: 'Faturas', status: 'concluido', resultado: 'passou' });
    await userEvent.click(screen.getByRole('button', { name: 'Cadastro × Falhou: 1' }));
    expect(onAbrirLista).toHaveBeenLastCalledWith({ ...SEM_FILTROS, funcionalidade: 'Cadastro', status: 'concluido', resultado: 'falhou' });
  });

  it('nome da funcionalidade abre a Lista só dela', async () => {
    const { onAbrirLista } = await abrir();
    await userEvent.click(await screen.findByRole('button', { name: 'Abrir a Lista só de Pix' }));
    expect(onAbrirLista).toHaveBeenCalledWith({ ...SEM_FILTROS, funcionalidade: 'Pix' });
  });

  it('com linhas por responsável o filtro é o responsável; o filtro de Resp. da tela é levado junto', async () => {
    const { onAbrirLista } = await abrir();
    await screen.findByTestId('linha-Faturas');
    await userEvent.selectOptions(screen.getByLabelText('Linhas'), 'responsavel');
    await userEvent.click(screen.getByRole('button', { name: 'Ana × Em andamento: 1' }));
    expect(onAbrirLista).toHaveBeenLastCalledWith({ ...SEM_FILTROS, responsavel: 'ana', status: 'em_andamento' });

    await userEvent.selectOptions(screen.getByLabelText('Linhas'), 'funcionalidade');
    await userEvent.selectOptions(screen.getByLabelText('Resp.'), 'bia');
    await userEvent.click(screen.getByRole('button', { name: 'Faturas × Agendado: 2' }));
    expect(onAbrirLista).toHaveBeenLastCalledWith({ ...SEM_FILTROS, responsavel: 'bia', funcionalidade: 'Faturas', status: 'agendado' });
  });

  it('célula com zero não é botão', async () => {
    await abrir();
    await screen.findByTestId('linha-Pix');
    expect(screen.queryByRole('button', { name: /Pix × Passou/ })).toBeNull();
  });
});

describe('Lançamento — dentro do app', () => {
  it('clicar numa célula abre a Lista já filtrada; abrir "Lista" pelo menu volta a mostrar tudo', async () => {
    const api = criarApiFalsa({ planos: [planoMaster()], pessoas: equipe });
    vi.stubGlobal('fetch', api.falso);
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    const menu = screen.getByRole('complementary', { name: 'Navegação' });

    await userEvent.click(within(menu).getByRole('button', { name: 'Lançamento' }));
    expect(screen.getByRole('heading', { level: 2, name: 'Lançamento' })).toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', { name: 'Faturas × Agendado: 2' }));

    expect(await screen.findByRole('heading', { level: 2, name: 'Lista' })).toBeInTheDocument();
    await screen.findByRole('heading', { level: 3, name: 'Plano: 28/09/26' });
    expect(screen.getByLabelText('Funcionalidade')).toHaveValue('Faturas');
    expect(screen.getByLabelText('Status')).toHaveValue('agendado');
    expect(screen.getAllByTestId(/^teste-/).map((l) => l.getAttribute('data-testid'))).toEqual(['teste-CT03.3', 'teste-CT03.7']);

    await userEvent.click(within(menu).getByRole('button', { name: 'Kanban' }));
    await userEvent.click(within(menu).getByRole('button', { name: 'Lista' }));
    await screen.findByRole('heading', { level: 3, name: 'Plano: 28/09/26' });
    expect(screen.getByLabelText('Status')).toHaveValue('');
    expect(screen.getAllByTestId(/^teste-/)).toHaveLength(6);
  });
});
