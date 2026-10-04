import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// O mosaico usa canvas; no jsdom basta saber que ele foi montado.
vi.mock('../src/shared/GridRevealBackdrop', () => ({ default: () => <div data-testid="fundo-animado" /> }));
vi.mock('../src/shared/MatrixDotLoader', () => ({ default: () => null }));

import App from '../src/App';
import { LembretesProvider } from '../src/lembretes/ContextoLembretes';
import Configuracoes from '../src/pages/configuracoes/Configuracoes';
import { criarApiFalsa, pessoa } from './apiFalsa';
import { renderComPessoas } from './ajudantes';

const equipe = [pessoa('ana')];

async function abrir() {
  const api = criarApiFalsa({ pessoas: equipe, wip: { em_andamento: 3, refinamento: 3 } });
  vi.stubGlobal('fetch', api.falso);
  renderComPessoas(
    <LembretesProvider>
      <Configuracoes />
    </LembretesProvider>,
    equipe,
    'ana',
  );
  await screen.findByTestId('wip-resumo');
  return api;
}

const caixa = (nome: string) => screen.getByRole('checkbox', { name: new RegExp(`^${nome}`) });

beforeEach(() => vi.unstubAllGlobals());
afterEach(() => vi.unstubAllGlobals());

describe('Configurações', () => {
  it('mostra os limites de WIP e os quatro tipos de lembrete, todos ligados, com Salvar desabilitado', async () => {
    await abrir();
    expect(screen.getByRole('heading', { level: 2, name: 'Configurações' })).toBeInTheDocument();
    expect(screen.getByTestId('wip-resumo')).toHaveTextContent('Em andamento: 3 · Refinamento: 3 · Agendado e Concluído: sem limite');
    for (const nome of ['Teste de hoje', 'Plano vencido', 'INC aberto', 'Ação da retro']) expect(caixa(nome)).toBeChecked();
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled();
  });

  it('desligar um tipo habilita o Salvar; salvar grava os quatro, avisa e recarrega o sino', async () => {
    const api = await abrir();
    await userEvent.click(caixa('INC aberto'));
    expect(caixa('INC aberto')).not.toBeChecked();
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Configurações salvas.');
    expect(api.escritas()).toEqual([
      {
        metodo: 'PUT',
        caminho: '/api/config',
        corpo: { lembretes: { teste_hoje: true, plano_vencido: true, inc_aberto: false, acao_retro: true } },
      },
    ]);
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled();
    expect(caixa('INC aberto')).not.toBeChecked();
    // O sino foi pedido de novo depois de salvar (além da carga inicial).
    expect(api.chamadas.filter((c) => c.caminho.startsWith('/api/lembretes')).length).toBeGreaterThanOrEqual(2);
  });

  it('mexer de novo some com o aviso de salvo; voltar ao valor salvo desabilita o Salvar', async () => {
    await abrir();
    await userEvent.click(caixa('Plano vencido'));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await screen.findByRole('status');
    await userEvent.click(caixa('Ação da retro'));
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeEnabled();
    await userEvent.click(caixa('Ação da retro'));
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled();
  });

  it('"Editar limites" abre o M13; salvar grava o WIP e atualiza o resumo', async () => {
    const api = await abrir();
    await userEvent.click(screen.getByRole('button', { name: 'Editar limites' }));
    const modal = screen.getByRole('dialog', { name: 'Limites de WIP' });
    await userEvent.clear(within(modal).getByLabelText('Em andamento'));
    await userEvent.type(within(modal).getByLabelText('Em andamento'), '5');
    await userEvent.clear(within(modal).getByLabelText('Refinamento'));
    await userEvent.click(within(modal).getByRole('button', { name: 'Salvar' }));

    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(api.escritas()).toEqual([{ metodo: 'PUT', caminho: '/api/config', corpo: { wip: { em_andamento: 5, refinamento: null } } }]);
    expect(screen.getByTestId('wip-resumo')).toHaveTextContent('Em andamento: 5 · Refinamento: sem limite');
  });

  it('o M13 é o mesmo do Kanban: Esc fecha sem gravar', async () => {
    const api = await abrir();
    await userEvent.click(screen.getByRole('button', { name: 'Editar limites' }));
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(api.escritas()).toEqual([]);
  });

  it('servidor fora do ar: mostra o aviso e não mostra as opções', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('fora')));
    renderComPessoas(
      <LembretesProvider>
        <Configuracoes />
      </LembretesProvider>,
      equipe,
      'ana',
    );
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByTestId('wip-resumo')).toBeNull();
  });

  it('"Atualizar" busca a configuração de novo', async () => {
    const api = await abrir();
    const antes = api.chamadas.filter((c) => c.caminho === '/api/config').length;
    await userEvent.click(screen.getByRole('button', { name: 'Atualizar' }));
    await vi.waitFor(() => expect(api.chamadas.filter((c) => c.caminho === '/api/config').length).toBe(antes + 1));
  });
});

describe('Configurações dentro do app', () => {
  it('o item do menu abre a tela (não é mais a página provisória)', async () => {
    const api = criarApiFalsa({ pessoas: equipe, wip: { em_andamento: 3, refinamento: 3 } });
    vi.stubGlobal('fetch', api.falso);
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    const menu = screen.getByRole('complementary', { name: 'Navegação' });
    await userEvent.click(within(menu).getByRole('button', { name: 'Configurações' }));
    expect(screen.getByRole('heading', { level: 2, name: 'Configurações' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { level: 3, name: 'Lembretes do sino' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Limites de WIP do Kanban' })).toBeInTheDocument();
  });
});
