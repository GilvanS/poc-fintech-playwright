import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// O mosaico usa canvas; no jsdom basta saber que ele foi montado.
vi.mock('../src/shared/GridRevealBackdrop', () => ({ default: () => <div data-testid="fundo-animado" /> }));
vi.mock('../src/shared/MatrixDotLoader', () => ({ default: () => null }));

import App from '../src/App';
import AcoesPendentesAnteriores from '../src/pages/retro/AcoesPendentesAnteriores';
import type { Acao, Retro } from '../src/retros/clienteRetros';
import { criarApiFalsa, item, pessoa, plano } from './apiFalsa';
import { renderComPessoas } from './ajudantes';

const HOJE = '2026-10-08';
const equipe = [pessoa('ana'), pessoa('carlos')];

const acao = (id: string, extra: Partial<Acao> = {}): Acao => ({
  id,
  texto: `Ação ${id}`,
  responsavel: 'ana',
  prazo: '2026-10-20',
  feito: false,
  feitoEm: null,
  feitoPor: null,
  origem: null,
  incId: null,
  criadaEm: '2026-09-26T10:00:00.000Z',
  criadaPor: null,
  ...extra,
});

const retroDe = (planoId: string, acoes: Acao[]): Retro => ({
  planoId,
  status: 'aberta',
  anonimas: false,
  fechadaEm: null,
  fechadaPor: null,
  notas: [],
  acoes,
  atualizadoEm: null,
});

const concluido = () => plano('pl_14', '14/09/26', [item('CT01.1', { status: 'concluido', resultado: 'passou' })]);
const emAndamento = () => plano('pl_28', '28/09/26', [item('CT01.1'), item('CT01.2')]);

beforeEach(() => vi.unstubAllGlobals());
afterEach(() => vi.unstubAllGlobals());

describe('AcoesPendentesAnteriores', () => {
  const montar = (opcoes: { planoId: string; retros?: Retro[]; onAbrirRetro?: (id: string) => void }) => {
    const api = criarApiFalsa({
      planos: [concluido(), emAndamento(), plano('pl_05', '05/10/26', [])],
      pessoas: equipe,
      retros: opcoes.retros ?? [retroDe('pl_14', [acao('a1', { texto: 'Ordenar CT03.2 antes do CT03.7' }), acao('a2', { feito: true }), acao('a3', { texto: 'Revisar estimativas', responsavel: 'carlos', prazo: null })])],
    });
    vi.stubGlobal('fetch', api.falso);
    renderComPessoas(<AcoesPendentesAnteriores planoId={opcoes.planoId} hoje={HOJE} onAbrirRetro={opcoes.onAbrirRetro} />, equipe);
    return api;
  };

  it('lista as ações pendentes das retros dos planos anteriores, com responsável, plano e quanto falta', async () => {
    montar({ planoId: 'pl_28' });
    const aviso = await screen.findByTestId('acoes-pendentes-anteriores');
    expect(within(aviso).getByRole('heading', { name: 'Ações pendentes de retros anteriores (2)' })).toBeInTheDocument();
    const itens = within(aviso).getAllByRole('listitem').map((l) => l.textContent);
    expect(itens[0]).toContain('Ordenar CT03.2 antes do CT03.7');
    expect(itens[0]).toContain('Ana · retro do plano 14/09/26 · até 20/10/2026 (faltam 12 dias)');
    expect(itens[1]).toContain('Revisar estimativas');
    expect(itens[1]).toContain('Carlos · retro do plano 14/09/26 · sem prazo');
    expect(within(aviso).queryByText('Ação a2')).toBeNull(); // a feita não entra
  });

  it('o primeiro plano não tem anteriores: nada aparece', async () => {
    const api = montar({ planoId: 'pl_14' });
    await vi.waitFor(() => expect(api.chamadas.some((c) => c.caminho === '/api/retros')).toBe(true));
    expect(screen.queryByTestId('acoes-pendentes-anteriores')).toBeNull();
  });

  it('sem pendência (retro vazia ou tudo feito) não mostra aviso', async () => {
    const api = montar({ planoId: 'pl_28', retros: [retroDe('pl_14', [acao('a1', { feito: true })])] });
    await vi.waitFor(() => expect(api.chamadas.some((c) => c.caminho === '/api/retros')).toBe(true));
    expect(screen.queryByTestId('acoes-pendentes-anteriores')).toBeNull();
  });

  it('"abrir retro" entrega o plano de origem; sem o callback não há botão', async () => {
    const onAbrirRetro = vi.fn();
    montar({ planoId: 'pl_28', onAbrirRetro });
    await userEvent.click((await screen.findAllByRole('button', { name: 'Abrir a retro do plano 14/09/26' }))[0]);
    expect(onAbrirRetro).toHaveBeenCalledWith('pl_14');
  });

  it('somente informa quando ninguém passa onAbrirRetro', async () => {
    montar({ planoId: 'pl_28' });
    await screen.findByTestId('acoes-pendentes-anteriores');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('servidor fora do ar: some sem quebrar', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('fora')));
    const { container } = renderComPessoas(<AcoesPendentesAnteriores planoId="pl_28" hoje={HOJE} />, equipe);
    await new Promise((r) => setTimeout(r, 30));
    expect(container).toBeEmptyDOMElement();
  });
});

describe('aviso dentro do app', () => {
  it('ao abrir a Lista do plano 28/09/26 aparece o aviso; "abrir retro" leva à retro do plano 14/09/26', async () => {
    const api = criarApiFalsa({
      planos: [concluido(), emAndamento()],
      pessoas: equipe,
      retros: [retroDe('pl_14', [acao('a1', { texto: 'Ordenar CT03.2 antes do CT03.7' })])],
    });
    vi.stubGlobal('fetch', api.falso);
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    const menu = screen.getByRole('complementary', { name: 'Navegação' });
    await userEvent.click(within(menu).getByRole('button', { name: 'Lista' }));

    await screen.findByRole('heading', { level: 3, name: 'Plano: 28/09/26' });
    const aviso = await screen.findByTestId('acoes-pendentes-anteriores');
    expect(aviso).toHaveTextContent('Ordenar CT03.2 antes do CT03.7');

    await userEvent.click(within(aviso).getByRole('button', { name: 'Abrir a retro do plano 14/09/26' }));
    expect(await screen.findByRole('heading', { level: 3, name: 'Retrospectiva — Plano 14/09/26' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Retro' })).toBeInTheDocument();
  });
});
