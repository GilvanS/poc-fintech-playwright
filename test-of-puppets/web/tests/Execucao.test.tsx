import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Run } from '../src/execucao/clienteExecucoes';
import PlanoDetalhe from '../src/pages/planos/PlanoDetalhe';
import { criarApiFalsa, item, plano } from './apiFalsa';

const ct31 = () => item('CT03.1', { nome: 'Pagar valor total', idMassa: '0100', status: 'concluido', resultado: 'falhou' });
const ct32 = () => item('CT03.2', { nome: 'Pagar valor mínimo', idMassa: '0483' });
const run = (extra: Partial<Run>): Run => ({
  runId: 'ex_1',
  planoId: 'pl_a',
  idCenario: 'CT03.2',
  estado: 'na_fila',
  enfileiradoEm: '2026-10-04T10:00:00.000Z',
  anexos: [],
  ...extra,
});

async function abrir(opcoes: Parameters<typeof criarApiFalsa>[0] = {}) {
  const api = criarApiFalsa({ planos: [plano('pl_a', '28/09/26', [ct31(), ct32()])], ...opcoes });
  vi.stubGlobal('fetch', api.falso);
  render(<PlanoDetalhe id="pl_a" onFechar={vi.fn()} onMudou={vi.fn()} />);
  await screen.findByRole('heading', { name: 'Plano: 28/09/26' });
  return api;
}

const posts = (api: Awaited<ReturnType<typeof abrir>>) => api.escritas().map((c) => `${c.metodo} ${c.caminho}`);

beforeEach(() => vi.unstubAllGlobals());
afterEach(() => vi.unstubAllGlobals());

describe('Execução — Play e Stop', () => {
  it('▶ manda executar o teste do plano; vira "Rodando" com ■ Parar; ■ interrompe', async () => {
    const api = await abrir();
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Executar CT03.2' }));

    expect(api.escritas().at(-1)).toMatchObject({ metodo: 'POST', caminho: '/api/execucoes', corpo: { planoId: 'pl_a', idCenario: 'CT03.2' } });
    expect(await screen.findByTestId('exec-CT03.2')).toHaveTextContent('Rodando');
    expect(screen.queryByRole('button', { name: 'Executar CT03.2' })).toBeNull();

    await u.click(screen.getByRole('button', { name: 'Parar CT03.2' }));
    expect(posts(api).at(-1)).toBe('POST /api/execucoes/ex_falso1/parar');
    expect(await screen.findByRole('button', { name: 'Executar CT03.2' })).toBeInTheDocument();
  });

  it('execução que espera a vez mostra "Na fila"', async () => {
    await abrir({ execucoes: [run({ estado: 'na_fila' })] });
    expect(await screen.findByTestId('exec-CT03.2')).toHaveTextContent('Na fila');
    expect(screen.getByRole('button', { name: 'Parar CT03.2' })).toBeInTheDocument();
  });
});

describe('Execução — painel', () => {
  it('Verificar ambiente lista o que está ok e o que está com problema', async () => {
    await abrir({
      ambiente: [
        { chave: 'raiz', titulo: 'Projeto de testes encontrado', ok: true, detalhe: 'A:/projeto' },
        { chave: 'app', titulo: 'FintechBankApp respondendo (127.0.0.1:3000)', ok: false, detalhe: 'fetch failed' },
      ],
    });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Verificar ambiente' }));
    const lista = await screen.findByRole('list', { name: 'Ambiente' });
    expect(within(lista).getByLabelText('ok')).toBeInTheDocument();
    expect(within(lista).getByLabelText('problema')).toBeInTheDocument();
    expect(within(lista).getByText(/FintechBankApp respondendo/)).toHaveTextContent('fetch failed');
  });

  it('Reexecutar falhos mostra quantos são e pede ao servidor', async () => {
    const api = await abrir();
    const botao = screen.getByRole('button', { name: 'Reexecutar falhos (1)' });
    await userEvent.setup().click(botao);
    expect(api.escritas().at(-1)).toMatchObject({ metodo: 'POST', caminho: '/api/execucoes/falhos', corpo: { planoId: 'pl_a' } });
  });

  it('sem teste falho o botão de reexecutar fica desligado', async () => {
    const api = criarApiFalsa({ planos: [plano('pl_a', '28/09/26', [ct32()])] });
    vi.stubGlobal('fetch', api.falso);
    render(<PlanoDetalhe id="pl_a" onFechar={vi.fn()} onMudou={vi.fn()} />);
    expect(await screen.findByRole('button', { name: 'Reexecutar falhos (0)' })).toBeDisabled();
  });

  it('execução que falhou oferece evidência e pacote de falha; o log aparece', async () => {
    await abrir({
      execucoes: [run({ estado: 'falhou', duracaoMs: 42_000, evidencia: 'evidences/CT03.2.docx', anexos: ['output/allure-results/a.png', 'output/allure-results/b.zip'] })],
    });
    const linhaRun = await screen.findByTestId('run-ex_1');
    expect(linhaRun).toHaveTextContent('Falhou · 42 s');
    expect(within(linhaRun).getByRole('link', { name: 'Evidência de CT03.2' })).toHaveAttribute(
      'href',
      '/api/execucoes/ex_1/arquivo?caminho=evidences%2FCT03.2.docx',
    );
    expect(within(linhaRun).getAllByRole('link', { name: /^anexo / })).toHaveLength(2);
    expect(await screen.findByRole('log', { name: 'Log da execução ex_1' })).toHaveTextContent('linha de log');
  });
});
