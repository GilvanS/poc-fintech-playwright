import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { decorridoMs, formatarDecorrido, minutosMedidos } from '../src/cronometro/tempo';
import PlanoDetalhe from '../src/pages/planos/PlanoDetalhe';
import { criarApiFalsa, item, plano } from './apiFalsa';

// O cronômetro não executa nada: ▶ marca o início, ⏸ pausa, ■ pede o resultado e o tempo.

const ct31 = () => item('CT03.1', { nome: 'Pagar valor total', idMassa: '0100' });
const ct32 = () => item('CT03.2', { nome: 'Pagar valor mínimo', idMassa: '0483' });
const ct37 = () => item('CT03.7', { nome: 'Reenvio', idMassa: '0483', dependeDe: ['CT03.2'], massaCompartilhadaCom: ['CT03.2'] });

async function abrir(itens = [ct31(), ct32(), ct37()]) {
  const api = criarApiFalsa({ planos: [plano('pl_a', '28/09/26', itens)] });
  vi.stubGlobal('fetch', api.falso);
  render(<PlanoDetalhe id="pl_a" onFechar={vi.fn()} onMudou={vi.fn()} />);
  await screen.findByRole('heading', { name: 'Plano: 28/09/26' });
  return api;
}

const ultimaEscrita = (api: Awaited<ReturnType<typeof abrir>>) => api.escritas().at(-1);

beforeEach(() => vi.unstubAllGlobals());
afterEach(() => vi.unstubAllGlobals());

describe('tempo (funções puras)', () => {
  it('soma o que ficou das pausas com o trecho que está rodando e formata mm:ss / h:mm:ss', () => {
    const rodando = item('CT03.1', { status: 'em_andamento', iniciadoEm: '2026-10-05T10:00:00.000Z', acumuladoMs: 30_000 });
    expect(decorridoMs(rodando, Date.parse('2026-10-05T10:01:00.000Z'))).toBe(90_000);
    const pausado = item('CT03.1', { status: 'em_andamento', acumuladoMs: 125_000 });
    expect(decorridoMs(pausado, Date.parse('2026-10-05T18:00:00.000Z'))).toBe(125_000); // pausado não anda
    expect(formatarDecorrido(75_000)).toBe('01:15');
    expect(formatarDecorrido(3_725_000)).toBe('1:02:05');
    expect(minutosMedidos(10_000)).toBe(1);
    expect(minutosMedidos(150_000)).toBe(3);
  });
});

describe('Cronômetro na lista', () => {
  it('▶ inicia o teste: manda a ação, vira Em andamento e mostra o relógio com ⏸ e ■', async () => {
    const api = await abrir();
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Iniciar CT03.1' }));

    expect(ultimaEscrita(api)).toMatchObject({ metodo: 'POST', caminho: '/api/planos/pl_a/testes/CT03.1/cronometro', corpo: { acao: 'iniciar' } });
    expect(await screen.findByTestId('cron-CT03.1')).toHaveTextContent(/^\d{2}:\d{2}$/);
    expect(screen.getByLabelText('Status de CT03.1')).toHaveValue('em_andamento');
    expect(screen.getByRole('button', { name: 'Pausar CT03.1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Finalizar CT03.1' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Iniciar CT03.1' })).toBeNull();
  });

  it('⏸ pausa (mostra "Pausado" e oferece Retomar) e Retomar volta a contar', async () => {
    const api = await abrir();
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Iniciar CT03.1' }));
    await u.click(await screen.findByRole('button', { name: 'Pausar CT03.1' }));
    expect(ultimaEscrita(api)).toMatchObject({ corpo: { acao: 'pausar' } });
    expect(await screen.findByTestId('cron-CT03.1')).toHaveTextContent(/^Pausado \d{2}:\d{2}$/);

    await u.click(screen.getByRole('button', { name: 'Retomar CT03.1' }));
    expect(ultimaEscrita(api)).toMatchObject({ corpo: { acao: 'retomar' } });
    expect(await screen.findByRole('button', { name: 'Pausar CT03.1' })).toBeInTheDocument();
  });

  it('■ pede o resultado: sem escolher, recusa; com resultado, tempo e observação, conclui o teste', async () => {
    const api = await abrir();
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Iniciar CT03.1' }));
    await u.click(await screen.findByRole('button', { name: 'Finalizar CT03.1' }));

    const modal = await screen.findByRole('dialog', { name: 'Registrar resultado' });
    expect(within(modal).getByLabelText('Tempo gasto (minutos)')).toHaveValue(1); // mínimo de 1 min medido
    await u.click(within(modal).getByRole('button', { name: 'Registrar' }));
    expect(within(modal).getByRole('alert')).toHaveTextContent('Escolha o resultado');
    expect(api.escritas().filter((c) => c.caminho.endsWith('/cronometro'))).toHaveLength(1); // só o iniciar

    await u.click(within(modal).getByRole('radio', { name: 'Falhou' }));
    await u.clear(within(modal).getByLabelText('Tempo gasto (minutos)'));
    await u.type(within(modal).getByLabelText('Tempo gasto (minutos)'), '14');
    await u.type(within(modal).getByLabelText('Observações'), 'erro no extrato');
    await u.click(within(modal).getByRole('button', { name: 'Registrar' }));

    expect(await screen.findByLabelText('Resultado de CT03.1')).toHaveValue('falhou'); // só depois de a resposta chegar a chamada está registrada
    expect(ultimaEscrita(api)).toMatchObject({ corpo: { acao: 'finalizar', resultado: 'falhou', tempoRealMin: 14, observacoes: 'erro no extrato' } });
    expect(screen.queryByRole('dialog', { name: 'Registrar resultado' })).toBeNull();
    expect(screen.getByLabelText('Status de CT03.1')).toHaveValue('concluido');
    expect(screen.getByRole('button', { name: 'Iniciar CT03.1' })).toBeInTheDocument(); // dá para refazer
  });

  it('Cancelar no registro não manda nada e o teste segue contando', async () => {
    const api = await abrir();
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Iniciar CT03.1' }));
    await u.click(await screen.findByRole('button', { name: 'Finalizar CT03.1' }));
    await u.click(within(await screen.findByRole('dialog', { name: 'Registrar resultado' })).getByRole('button', { name: 'Cancelar' }));
    expect(api.escritas().filter((c) => c.caminho.endsWith('/cronometro'))).toHaveLength(1);
    expect(screen.getByTestId('cron-CT03.1')).toBeInTheDocument();
  });

  it('teste que espera a massa de outro mostra o erro do servidor e não inicia', async () => {
    await abrir();
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Iniciar CT03.7' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Aguardando CT03.2 passar');
    expect(screen.getByLabelText('Status de CT03.7')).toHaveValue('agendado');
  });
});
