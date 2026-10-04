import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// O mosaico usa canvas; no jsdom basta saber que ele foi montado.
vi.mock('../src/shared/GridRevealBackdrop', () => ({
  default: (props: { opacity?: number }) => <div data-testid="fundo-animado" data-opacity={props.opacity} />,
}));
vi.mock('../src/shared/MatrixDotLoader', () => ({ default: () => null }));

import App from '../src/App';

const menu = () => screen.getByRole('complementary', { name: 'Navegação' });

/** Fluxo real: abre o app, passa pela tela de entrada e cai no shell. */
async function entrar() {
  const view = render(<App />);
  await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
  return view;
}

describe('App — tela de entrada', () => {
  it('abre na entrada: sem senha, só o botão Entrar, e o fundo animado já aparece', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1, name: 'Test of Puppets' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument();
    expect(screen.queryByLabelText(/senha/i)).toBeNull();
    expect(document.querySelector('input[type="password"]')).toBeNull();
    expect(screen.getByTestId('fundo-animado')).toBeInTheDocument();
    expect(screen.queryByRole('complementary', { name: 'Navegação' })).toBeNull();
  });

  it('Entrar abre o shell, e recarregar na mesma sessão não pede para entrar de novo', async () => {
    const { unmount } = await entrar();
    expect(menu()).toBeInTheDocument();

    unmount();
    render(<App />);
    expect(screen.queryByRole('button', { name: 'Entrar' })).toBeNull();
    expect(menu()).toBeInTheDocument();
  });

  it('em uma sessão nova (aba nova), volta a mostrar a entrada', async () => {
    const { unmount } = await entrar();
    unmount();
    window.sessionStorage.clear();
    render(<App />);
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument();
  });
});

describe('App — shell visual', () => {
  it('depois de entrar abre em "Planos", com o menu à esquerda e o fundo animado montado', async () => {
    await entrar();
    expect(screen.getByTestId('shell')).toHaveAttribute('data-lado', 'esquerda');
    expect(screen.getByRole('heading', { level: 2, name: 'Planos' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Test of Puppets' })).toBeInTheDocument();
    expect(screen.getByTestId('fundo-animado')).toBeInTheDocument();
    // menu à esquerda = vem antes do conteúdo no DOM
    expect(menu().compareDocumentPosition(screen.getByRole('main')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('clicar num item troca a seção e marca o item como ativo', async () => {
    await entrar();
    await userEvent.click(within(menu()).getByRole('button', { name: 'Kanban' }));
    expect(screen.getByRole('heading', { level: 2, name: 'Kanban' })).toBeInTheDocument();
    expect(within(menu()).getByRole('button', { name: 'Kanban' })).toHaveAttribute('aria-current', 'page');
  });

  it('o botão Voltar leva de volta a "Planos"', async () => {
    await entrar();
    await userEvent.click(within(menu()).getByRole('button', { name: 'Roadmap' }));
    await userEvent.click(screen.getByRole('button', { name: 'Voltar' }));
    expect(screen.getByRole('heading', { level: 2, name: 'Planos' })).toBeInTheDocument();
  });

  it('"Cenários e massa" abre a tela de cadastro de cenários (T1), não o placeholder', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ cenarios: [], funcionalidades: [] }), { status: 200, headers: { 'content-type': 'application/json' } })),
    );
    try {
      await entrar();
      await userEvent.click(within(menu()).getByRole('button', { name: 'Cenários e massa' }));
      expect(screen.getByRole('heading', { level: 2, name: 'Cenários e massa' })).toBeInTheDocument();
      expect(await screen.findByText('Nenhum cenário cadastrado ainda')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Novo cenário' })).toBeInTheDocument();
      expect(screen.queryByText('Em construção')).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('trocar o menu de lado move o menu para a direita e lembra a escolha', async () => {
    const { unmount } = await entrar();
    await userEvent.click(within(menu()).getByRole('button', { name: 'Mover menu para a direita' }));
    expect(screen.getByTestId('shell')).toHaveAttribute('data-lado', 'direita');
    expect(menu().compareDocumentPosition(screen.getByRole('main')) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
    expect(JSON.parse(window.localStorage.getItem('puppets:shell')!)).toMatchObject({ lado: 'direita' });

    unmount();
    render(<App />);
    expect(screen.getByTestId('shell')).toHaveAttribute('data-lado', 'direita');
  });

  it('recolher o menu mostra só os ícones e lembra a escolha', async () => {
    const { unmount } = await entrar();
    await userEvent.click(within(menu()).getByRole('button', { name: 'Recolher menu' }));
    expect(menu()).toHaveAttribute('data-recolhido', 'true');
    expect(within(menu()).queryByText('Kanban')).toBeNull();

    unmount();
    render(<App />);
    expect(menu()).toHaveAttribute('data-recolhido', 'true');
  });

  it('no celular, os itens aparecem numa fileira de botões', async () => {
    await entrar();
    const fileira = screen.getByRole('navigation', { name: 'Seções' });
    await userEvent.click(within(fileira).getByRole('button', { name: 'Incidentes' }));
    expect(screen.getByRole('heading', { level: 2, name: 'Incidentes' })).toBeInTheDocument();
  });

  it('não há nenhum botão de execução: por enquanto a ferramenta só planeja e visualiza', async () => {
    await entrar();
    expect(screen.queryByRole('button', { name: /\bplay\b|executar|rodar|ao vivo/i })).toBeNull();
  });

  it('a janela "Fundo" abre, grava os ajustes e fecha com Esc', async () => {
    await entrar();
    await userEvent.click(screen.getByRole('button', { name: 'Configurar fundo' }));
    const janela = screen.getByRole('dialog', { name: 'Fundo do painel' });

    fireEvent.change(within(janela).getByLabelText('Opacidade do fundo'), { target: { value: '30' } });
    fireEvent.change(within(janela).getByLabelText('Tamanho dos quadrados do dither'), { target: { value: '12' } });
    expect(screen.getByTestId('fundo-animado')).toHaveAttribute('data-opacity', '0.3');
    expect(JSON.parse(window.localStorage.getItem('puppets:fundo')!)).toMatchObject({ opacity: 0.3, ditherCellSize: 12 });

    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('"Sem imagem" fica desabilitado enquanto não há imagem', async () => {
    await entrar();
    await userEvent.click(screen.getByRole('button', { name: 'Configurar fundo' }));
    expect(screen.getByRole('button', { name: /Sem imagem/ })).toBeDisabled();
  });
});
