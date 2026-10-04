import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// O mosaico usa canvas; no jsdom basta saber que ele foi montado.
vi.mock('../src/shared/GridRevealBackdrop', () => ({ default: () => <div data-testid="fundo-animado" /> }));
vi.mock('../src/shared/MatrixDotLoader', () => ({ default: () => null }));

import App from '../src/App';
import { criarApiFalsa, pessoa } from './apiFalsa';

async function entrar(opcoes: Parameters<typeof criarApiFalsa>[0] = {}) {
  const api = criarApiFalsa(opcoes);
  vi.stubGlobal('fetch', api.falso);
  const view = render(<App />);
  await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
  return { api, ...view };
}

const seletor = () => screen.getByLabelText('Você') as HTMLSelectElement;
const opcoes = () => within(seletor()).getAllByRole('option').map((o) => o.textContent);

beforeEach(() => vi.unstubAllGlobals());
afterEach(() => vi.unstubAllGlobals());

describe('Seletor "Você" no cabeçalho', () => {
  it('lista só as pessoas ativas da Equipe, sem os nomes de exemplo antigos', async () => {
    await entrar({ pessoas: [pessoa('ana'), pessoa('bia', { ativa: false }), pessoa('carlos')] });
    await vi.waitFor(() => expect(opcoes()).toEqual(['Quem é você?', 'Ana', 'Carlos']));
    expect(screen.queryByText(/Online:/)).toBeNull();
  });

  it('escolher grava no navegador e continua escolhido ao recarregar', async () => {
    const { unmount } = await entrar({ pessoas: [pessoa('ana'), pessoa('carlos')] });
    await vi.waitFor(() => expect(opcoes()).toContain('Carlos'));
    await userEvent.selectOptions(seletor(), 'carlos');
    expect(window.localStorage.getItem('puppets:voce')).toBe('carlos');

    unmount();
    render(<App />);
    await vi.waitFor(() => expect(seletor()).toHaveValue('carlos'));
  });

  it('id guardado de pessoa que foi desativada ou não existe mais volta para "Quem é você?"', async () => {
    window.localStorage.setItem('puppets:voce', 'bia');
    await entrar({ pessoas: [pessoa('ana'), pessoa('bia', { ativa: false })] });
    await vi.waitFor(() => expect(opcoes()).toContain('Ana'));
    expect(seletor()).toHaveValue('');
  });

  it('sem ninguém na Equipe, oferece "Cadastrar equipe" que leva à tela Equipe', async () => {
    await entrar();
    await userEvent.click(await screen.findByRole('button', { name: 'Cadastrar equipe' }));
    expect(screen.getByRole('heading', { level: 2, name: 'Equipe' })).toBeInTheDocument();
  });
});
