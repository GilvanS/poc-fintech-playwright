import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// O mosaico usa canvas; no jsdom basta saber que ele foi montado.
vi.mock('../src/shared/GridRevealBackdrop', () => ({ default: () => <div data-testid="fundo-animado" /> }));
vi.mock('../src/shared/MatrixDotLoader', () => ({ default: () => null }));

import App from '../src/App';
import type { Lembrete } from '../src/lembretes/clienteLembretes';
import { INTERVALO_LEMBRETES_MS, LembretesProvider } from '../src/lembretes/ContextoLembretes';
import Sino from '../src/shell/Sino';
import { criarApiFalsa, item, pessoa, plano } from './apiFalsa';
import { renderComPessoas } from './ajudantes';

const equipe = [pessoa('ana'), pessoa('bia')];

const lembrete = (chave: string, extra: Partial<Lembrete> = {}): Lembrete => ({
  chave,
  tipo: 'inc_aberto',
  titulo: `Titulo ${chave}`,
  detalhe: `Detalhe ${chave}`,
  lida: false,
  ...extra,
});

const quatro = (): Lembrete[] => [
  lembrete('teste-hoje:pl_1:CT03.2:2026-10-04', { tipo: 'teste_hoje', titulo: 'Teste de hoje · Plano 28/09/26', detalhe: 'CT03.2 — Pagar valor mínimo', planoId: 'pl_1', idCenario: 'CT03.2' }),
  lembrete('plano-vencido:pl_1:2026-10-01', { tipo: 'plano_vencido', titulo: 'Plano 28/09/26 passou da previsão', detalhe: 'Previsão era 01/10/2026 · 3 testes pendentes', planoId: 'pl_1' }),
  lembrete('inc-aberto:INC1', { tipo: 'inc_aberto', titulo: 'INC aberto · INC1 (3 testes)', detalhe: 'Saldo difere', numero: 'INC1' }),
  lembrete('acao-retro:pl_1:ac_1', { tipo: 'acao_retro', titulo: 'Ação da retro · Plano 28/09/26', detalhe: 'Ordenar CT03.2 · até 20/10/2026', planoId: 'pl_1' }),
];

async function abrir(opcoes: { lembretes?: Lembrete[]; recusar?: boolean; voce?: string } = {}) {
  const api = criarApiFalsa({ pessoas: equipe, lembretes: opcoes.lembretes ?? quatro(), lembretesRecusados: opcoes.recusar });
  vi.stubGlobal('fetch', api.falso);
  const onAbrir = vi.fn();
  renderComPessoas(
    <LembretesProvider>
      <Sino onAbrir={onAbrir} />
    </LembretesProvider>,
    equipe,
    opcoes.voce === undefined ? 'ana' : opcoes.voce || undefined,
  );
  return { api, onAbrir };
}

const sino = (n: number) => screen.getByRole('button', { name: `Lembretes (${n})` });

beforeEach(() => vi.unstubAllGlobals());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('Sino', () => {
  it('mostra o contador de não lidos', async () => {
    await abrir();
    expect(await screen.findByRole('button', { name: 'Lembretes (4)' })).toBeInTheDocument();
    expect(screen.getByTestId('sino-contador')).toHaveTextContent('4');
  });

  it('sem lembretes: zero, sem bolinha e "Nenhum lembrete."', async () => {
    const { api } = await abrir({ lembretes: [] });
    await vi.waitFor(() => expect(api.chamadas.length).toBeGreaterThan(0));
    expect(sino(0)).toBeInTheDocument();
    expect(screen.queryByTestId('sino-contador')).toBeNull();
    await userEvent.click(sino(0));
    expect(within(screen.getByRole('dialog', { name: 'Lembretes' })).getByText('Nenhum lembrete.')).toBeInTheDocument();
  });

  it('abre a lista com título e detalhe de cada lembrete', async () => {
    await abrir();
    await userEvent.click(await screen.findByRole('button', { name: 'Lembretes (4)' }));
    const painel = screen.getByRole('dialog', { name: 'Lembretes' });
    expect(within(painel).getByRole('heading', { name: 'Lembretes (4)' })).toBeInTheDocument();
    expect(within(painel).getAllByRole('listitem')).toHaveLength(4);
    expect(within(painel).getByText('Teste de hoje · Plano 28/09/26')).toBeInTheDocument();
    expect(within(painel).getByText('CT03.2 — Pagar valor mínimo')).toBeInTheDocument();
    expect(within(painel).getByText('INC aberto · INC1 (3 testes)')).toBeInTheDocument();
  });

  it('"Abrir" entrega o lembrete a quem navega e fecha a lista', async () => {
    const { onAbrir } = await abrir();
    await userEvent.click(await screen.findByRole('button', { name: 'Lembretes (4)' }));
    await userEvent.click(screen.getByRole('button', { name: 'Abrir: INC aberto · INC1 (3 testes)' }));
    expect(onAbrir).toHaveBeenCalledWith(expect.objectContaining({ chave: 'inc-aberto:INC1', tipo: 'inc_aberto', numero: 'INC1' }));
    expect(screen.queryByRole('dialog', { name: 'Lembretes' })).toBeNull();
  });

  it('"Marcar como lida" tira do contador, grava para o Você e passa o item para "Lidos"', async () => {
    const { api } = await abrir();
    await userEvent.click(await screen.findByRole('button', { name: 'Lembretes (4)' }));
    await userEvent.click(screen.getByRole('button', { name: 'Marcar como lida: INC aberto · INC1 (3 testes)' }));
    expect(await screen.findByRole('button', { name: 'Lembretes (3)' })).toBeInTheDocument();
    expect(api.escritas()).toEqual([{ metodo: 'POST', caminho: '/api/lembretes/lidas', corpo: { voce: 'ana', chaves: ['inc-aberto:INC1'], lida: true } }]);

    const painel = screen.getByRole('dialog', { name: 'Lembretes' });
    expect(within(painel).getByText('Lidos (1)')).toBeInTheDocument();
    const itens = within(painel).getAllByRole('listitem').filter((l) => l.dataset.testid);
    expect(itens[itens.length - 1]).toHaveTextContent('INC aberto · INC1');
    expect(within(painel).getByRole('button', { name: 'Marcar como não lida: INC aberto · INC1 (3 testes)' })).toBeInTheDocument();
  });

  it('desfazer volta o lembrete para os não lidos', async () => {
    const lida = lembrete('inc-aberto:INC9', { titulo: 'INC aberto · INC9 (1 teste)', lida: true });
    const { api } = await abrir({ lembretes: [lida] });
    await userEvent.click(await screen.findByRole('button', { name: 'Lembretes (0)' }));
    await userEvent.click(screen.getByRole('button', { name: 'Marcar como não lida: INC aberto · INC9 (1 teste)' }));
    expect(await screen.findByRole('button', { name: 'Lembretes (1)' })).toBeInTheDocument();
    expect(api.escritas()[0].corpo).toEqual({ voce: 'ana', chaves: ['inc-aberto:INC9'], lida: false });
  });

  it('"Marcar todas como lidas" zera o contador', async () => {
    const { api } = await abrir();
    await userEvent.click(await screen.findByRole('button', { name: 'Lembretes (4)' }));
    await userEvent.click(screen.getByRole('button', { name: 'Marcar todas como lidas' }));
    expect(await screen.findByRole('button', { name: 'Lembretes (0)' })).toBeInTheDocument();
    expect(screen.queryByTestId('sino-contador')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Marcar todas como lidas' })).toBeNull();
    expect((api.escritas()[0].corpo?.chaves as string[]).length).toBe(4);
  });

  it('sem "Você" a marca vai sem pessoa', async () => {
    const { api } = await abrir({ voce: '' });
    await userEvent.click(await screen.findByRole('button', { name: 'Lembretes (4)' }));
    await userEvent.click(screen.getByRole('button', { name: 'Marcar todas como lidas' }));
    await vi.waitFor(() => expect(api.escritas()).toHaveLength(1));
    expect(api.escritas()[0].corpo).toMatchObject({ voce: null });
    expect(api.chamadas[0].caminho).toBe('/api/lembretes');
  });

  it('com "Você" a lista é pedida para a pessoa', async () => {
    const { api } = await abrir();
    await screen.findByRole('button', { name: 'Lembretes (4)' });
    expect(api.chamadas[0].caminho).toBe('/api/lembretes?voce=ana');
  });

  it('erro ao marcar mostra aviso e não mexe no contador', async () => {
    await abrir({ recusar: true });
    await userEvent.click(await screen.findByRole('button', { name: 'Lembretes (4)' }));
    await userEvent.click(screen.getByRole('button', { name: 'Marcar todas como lidas' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível atualizar os lembretes.');
    expect(sino(4)).toBeInTheDocument();
  });

  it('Esc e clique fora fecham a lista', async () => {
    await abrir();
    await userEvent.click(await screen.findByRole('button', { name: 'Lembretes (4)' }));
    expect(screen.getByRole('dialog', { name: 'Lembretes' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Lembretes' })).toBeNull();
    await userEvent.click(sino(4));
    await userEvent.click(document.body);
    expect(screen.queryByRole('dialog', { name: 'Lembretes' })).toBeNull();
  });

  it('abrir a lista confere o servidor de novo', async () => {
    const { api } = await abrir();
    await screen.findByRole('button', { name: 'Lembretes (4)' });
    const antes = api.chamadas.length;
    await userEvent.click(sino(4));
    await vi.waitFor(() => expect(api.chamadas.length).toBe(antes + 1));
  });

  it('de minuto em minuto confere o servidor sozinho (o dia vira, alguém abre um INC…)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { api } = await abrir();
    await screen.findByRole('button', { name: 'Lembretes (4)' });
    const antes = api.chamadas.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(INTERVALO_LEMBRETES_MS + 100);
    });
    expect(api.chamadas.length).toBe(antes + 1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(INTERVALO_LEMBRETES_MS);
    });
    expect(api.chamadas.length).toBe(antes + 2);
  });

  it('servidor fora do ar: sino zerado, sem quebrar', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('fora')));
    renderComPessoas(
      <LembretesProvider>
        <Sino onAbrir={vi.fn()} />
      </LembretesProvider>,
      equipe,
      'ana',
    );
    expect(await screen.findByRole('button', { name: 'Lembretes (0)' })).toBeInTheDocument();
  });
});

describe('Sino dentro do app', () => {
  const concluido = () => plano('pl_1', '28/09/26', [item('CT03.2', { status: 'concluido', resultado: 'passou' })], { previsao: '2026-10-01' });

  const abrirApp = async () => {
    const api = criarApiFalsa({ planos: [concluido()], pessoas: equipe, incidentes: [], lembretes: quatro() });
    vi.stubGlobal('fetch', api.falso);
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    return api;
  };

  const abrirLembrete = async (titulo: string) => {
    await userEvent.click(await screen.findByRole('button', { name: 'Lembretes (4)' }));
    await userEvent.click(screen.getByRole('button', { name: `Abrir: ${titulo}` }));
  };

  it('INC aberto leva para a tela de Incidentes', async () => {
    await abrirApp();
    await abrirLembrete('INC aberto · INC1 (3 testes)');
    expect(await screen.findByRole('heading', { level: 2, name: 'Incidentes' })).toBeInTheDocument();
  });

  it('plano vencido leva para o Release do plano', async () => {
    await abrirApp();
    await abrirLembrete('Plano 28/09/26 passou da previsão');
    expect(await screen.findByRole('heading', { level: 3, name: 'Release do plano 28/09/26' })).toBeInTheDocument();
  });

  it('ação da retro leva para a Retro do plano', async () => {
    await abrirApp();
    await abrirLembrete('Ação da retro · Plano 28/09/26');
    expect(await screen.findByRole('heading', { level: 3, name: 'Retrospectiva — Plano 28/09/26' })).toBeInTheDocument();
  });

  it('teste de hoje leva para a Lista do plano', async () => {
    await abrirApp();
    await abrirLembrete('Teste de hoje · Plano 28/09/26');
    expect(await screen.findByRole('heading', { level: 2, name: 'Lista' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { level: 3, name: 'Plano: 28/09/26' })).toBeInTheDocument();
  });
});
