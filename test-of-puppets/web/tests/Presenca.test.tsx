import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// O mosaico usa canvas; no jsdom basta saber que ele foi montado.
vi.mock('../src/shared/GridRevealBackdrop', () => ({ default: () => <div data-testid="fundo-animado" /> }));
vi.mock('../src/shared/MatrixDotLoader', () => ({ default: () => null }));

import App from '../src/App';
import { INTERVALO_PRESENCA_MS, PresencaProvider } from '../src/presenca/ContextoPresenca';
import Online from '../src/shell/Online';
import { criarApiFalsa, pessoa } from './apiFalsa';
import { renderComPessoas } from './ajudantes';

const equipe = [pessoa('ana'), pessoa('bia'), pessoa('carlos')];

function montar(opcoes: { presenca?: string[]; voce?: string } = {}) {
  const api = criarApiFalsa({ pessoas: equipe, presenca: opcoes.presenca });
  vi.stubGlobal('fetch', api.falso);
  renderComPessoas(
    <PresencaProvider>
      <Online />
    </PresencaProvider>,
    equipe,
    opcoes.voce === undefined ? 'ana' : opcoes.voce || undefined,
  );
  return api;
}

const sinais = (api: ReturnType<typeof criarApiFalsa>) => api.chamadas.filter((c) => c.caminho === '/api/presenca');

function escondida(valor: boolean) {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (valor ? 'hidden' : 'visible') });
}

beforeEach(() => vi.unstubAllGlobals());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(document, 'visibilityState');
});

describe('Presença — "Online: …"', () => {
  it('com "Você" dá sinal logo ao abrir e mostra quem está online, inclusive você', async () => {
    const api = montar({ presenca: ['bia'] });
    expect(await screen.findByTestId('online')).toHaveTextContent('Online: Bia, Ana');
    expect(sinais(api)[0]).toMatchObject({ metodo: 'POST', corpo: { pessoa: 'ana' } });
  });

  it('sem "Você" só olha (GET, sem dar sinal) e mostra os outros', async () => {
    const api = montar({ presenca: ['bia', 'carlos'], voce: '' });
    expect(await screen.findByTestId('online')).toHaveTextContent('Online: Bia, Carlos');
    expect(sinais(api).every((c) => c.metodo === 'GET')).toBe(true);
  });

  it('ninguém online: não mostra nada', async () => {
    const api = montar({ voce: '' });
    await vi.waitFor(() => expect(sinais(api).length).toBeGreaterThan(0));
    expect(screen.queryByTestId('online')).toBeNull();
  });

  it('id de pessoa que não está mais na Equipe não aparece', async () => {
    montar({ presenca: ['fantasma', 'bia'], voce: '' });
    expect(await screen.findByTestId('online')).toHaveTextContent(/^Online: Bia$/);
  });

  it('de 5 em 5 segundos dá sinal de novo', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const api = montar();
    await screen.findByTestId('online');
    const antes = sinais(api).length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(INTERVALO_PRESENCA_MS + 100);
    });
    expect(sinais(api).length).toBe(antes + 1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(INTERVALO_PRESENCA_MS);
    });
    expect(sinais(api).length).toBe(antes + 2);
    expect(sinais(api).every((c) => c.metodo === 'POST')).toBe(true);
  });

  it('aba escondida não dá sinal (só olha) e ao voltar dá sinal na hora', async () => {
    escondida(true);
    const api = montar({ presenca: ['bia'] });
    expect(await screen.findByTestId('online')).toHaveTextContent('Online: Bia');
    expect(sinais(api).every((c) => c.metodo === 'GET')).toBe(true);

    escondida(false);
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await vi.waitFor(() => expect(sinais(api).some((c) => c.metodo === 'POST' && c.corpo?.pessoa === 'ana')).toBe(true));
  });

  it('servidor fora do ar: some sem quebrar', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('fora')));
    renderComPessoas(
      <PresencaProvider>
        <Online />
      </PresencaProvider>,
      equipe,
      'ana',
    );
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByTestId('online')).toBeNull();
  });
});

describe('Presença dentro do app', () => {
  it('o cabeçalho mostra quem está online depois de entrar', async () => {
    const api = criarApiFalsa({ pessoas: equipe, presenca: ['carlos'] });
    vi.stubGlobal('fetch', api.falso);
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByTestId('online')).toHaveTextContent('Online: Carlos');
  });
});
