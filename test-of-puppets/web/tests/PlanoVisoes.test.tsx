import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PlanoDetalhe from '../src/pages/planos/PlanoDetalhe';
import { criarApiFalsa, item, plano } from './apiFalsa';

const HOJE = '2026-10-05';

const planoBase = () =>
  plano('pl_a', '28/09/26', [
    item('CT03.1', { nome: 'Pagar valor total', idMassa: '0100', status: 'concluido', resultado: 'passou', dataPlanejada: '2026-10-02' }),
    item('CT03.2', { nome: 'Pagar valor mínimo', idMassa: '0483', massaCompartilhadaCom: ['CT03.7'], dataPlanejada: '2026-10-05' }),
    item('CT04.1', { nome: 'Bloquear cartão', funcionalidade: 'Cartões', status: 'em_andamento', dataPlanejada: '2026-10-05' }),
    item('CT03.7', { nome: 'Reenvio pgto mínimo', idMassa: '0483', dependeDe: ['CT03.2'], massaCompartilhadaCom: ['CT03.2'], dataPlanejada: '2026-10-09' }),
  ]);

async function abrir(api = criarApiFalsa({ planos: [planoBase()] })) {
  vi.stubGlobal('fetch', api.falso);
  const props = { onFechar: vi.fn(), onMudou: vi.fn() };
  render(<PlanoDetalhe id="pl_a" hoje={HOJE} {...props} />);
  await screen.findByRole('heading', { name: 'Plano: 28/09/26' });
  return { api, ...props };
}

const idsNaLista = () => screen.getAllByTestId(/^teste-/).map((l) => l.getAttribute('data-testid')!.replace('teste-', ''));
const coluna = (status: string) => screen.getByTestId(`coluna-${status}`);
const idsNaColuna = (status: string) => within(coluna(status)).queryAllByTestId(/^card-/).map((c) => c.getAttribute('data-testid')!.replace('card-', ''));
const cartao = (id: string) => screen.getByTestId(`card-${id}`);

async function irParaCards() {
  await userEvent.click(screen.getByRole('tab', { name: 'Visão card' }));
}

beforeEach(() => vi.unstubAllGlobals());
afterEach(() => vi.unstubAllGlobals());

describe('abas Visão lista / Visão card', () => {
  it('abre na lista; "Visão card" troca para as quatro colunas e volta', async () => {
    await abrir();
    expect(screen.getByRole('tab', { name: 'Visão lista' })).toHaveAttribute('aria-selected', 'true');
    expect(idsNaLista()).toHaveLength(4);

    await irParaCards();
    expect(screen.getByRole('tab', { name: 'Visão card' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryAllByTestId(/^teste-/)).toHaveLength(0);
    for (const s of ['agendado', 'em_andamento', 'refinamento', 'concluido']) expect(coluna(s)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: 'Visão lista' }));
    expect(idsNaLista()).toHaveLength(4);
  });
});

describe('Visão card (kanban)', () => {
  it('distribui os testes nas colunas pelo status, com a contagem no título', async () => {
    await abrir();
    await irParaCards();
    expect(within(coluna('agendado')).getByText('Agendado (2)')).toBeInTheDocument();
    expect(within(coluna('em_andamento')).getByText('Em andamento (1)')).toBeInTheDocument();
    expect(within(coluna('refinamento')).getByText('Refinamento (0)')).toBeInTheDocument();
    expect(within(coluna('concluido')).getByText('Concluído (1)')).toBeInTheDocument();
    expect(idsNaColuna('agendado')).toEqual(['CT03.2', 'CT03.7']);
    expect(idsNaColuna('em_andamento')).toEqual(['CT04.1']);
    expect(idsNaColuna('concluido')).toEqual(['CT03.1']);
    expect(within(coluna('refinamento')).getByText('Nenhum teste')).toBeInTheDocument();
  });

  it('o card mostra ID, cenário, funcionalidade e massa, data planejada, aguardando e resultado', async () => {
    await abrir();
    await irParaCards();
    const ct32 = cartao('CT03.2');
    expect(within(ct32).getByText('CT03.2')).toBeInTheDocument();
    expect(within(ct32).getByText('Pagar valor mínimo')).toBeInTheDocument();
    expect(within(ct32).getByText('Faturas · massa 0483')).toBeInTheDocument();
    expect(within(ct32).getByText('Planejada 05/10/2026')).toBeInTheDocument();
    expect(within(cartao('CT03.7')).getByText('Aguardando CT03.2 passar')).toBeInTheDocument();
    expect(within(cartao('CT03.1')).getByLabelText('Resultado de CT03.1')).toHaveValue('passou');
    expect(within(cartao('CT04.1')).queryByLabelText('Resultado de CT04.1')).toBeNull();
  });

  it('"Mover para" (alternativa ao arrastar) muda o status e o card vai para a coluna certa', async () => {
    const { api, onMudou } = await abrir();
    await irParaCards();
    await userEvent.selectOptions(within(cartao('CT03.2')).getByLabelText('Mover CT03.2 para'), 'refinamento');
    await vi.waitFor(() => expect(idsNaColuna('refinamento')).toEqual(['CT03.2']));
    expect(api.escritas()).toEqual([{ metodo: 'PATCH', caminho: '/api/planos/pl_a/testes/CT03.2', corpo: { status: 'refinamento', versao: 1 } }]);
    expect(onMudou).toHaveBeenCalled();
  });

  it('arrastar o card para outra coluna muda o status; soltar na mesma coluna não faz nada', async () => {
    const { api } = await abrir();
    await irParaCards();
    fireEvent.dragStart(cartao('CT04.1'));
    fireEvent.dragOver(coluna('em_andamento'));
    fireEvent.drop(coluna('em_andamento'));
    expect(api.escritas()).toEqual([]);

    fireEvent.dragStart(cartao('CT03.2'));
    fireEvent.dragOver(coluna('em_andamento'));
    fireEvent.drop(coluna('em_andamento'));
    await vi.waitFor(() => expect(idsNaColuna('em_andamento')).toEqual(['CT03.2', 'CT04.1']));
    expect(api.escritas()[0]).toEqual({ metodo: 'PATCH', caminho: '/api/planos/pl_a/testes/CT03.2', corpo: { status: 'em_andamento', versao: 1 } });
  });

  it('arrastar quem depende da massa para "Em andamento" é recusado: mensagem e o card fica onde estava', async () => {
    await abrir();
    await irParaCards();
    fireEvent.dragStart(cartao('CT03.7'));
    fireEvent.dragOver(coluna('em_andamento'));
    fireEvent.drop(coluna('em_andamento'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Aguardando CT03.2 passar');
    expect(idsNaColuna('agendado')).toContain('CT03.7');
    expect(idsNaColuna('em_andamento')).not.toContain('CT03.7');
  });

  it('marcar o resultado de um card concluído grava o resultado', async () => {
    const { api } = await abrir();
    await irParaCards();
    await userEvent.selectOptions(within(cartao('CT03.1')).getByLabelText('Resultado de CT03.1'), 'falhou');
    await vi.waitFor(() => expect(api.escritas()).toHaveLength(1));
    expect(api.escritas()[0].corpo).toEqual({ resultado: 'falhou', versao: 1 });
  });
});

describe('filtros', () => {
  it('sem filtro mostra "Testes (4)"; filtrar mostra "Testes (n de 4)" e "Limpar" volta tudo', async () => {
    await abrir();
    expect(screen.getByText('Testes (4)')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('ID/cenário'), 'cartão');
    expect(screen.getByText('Testes (1 de 4)')).toBeInTheDocument();
    expect(idsNaLista()).toEqual(['CT04.1']);

    await userEvent.click(screen.getByRole('button', { name: 'Limpar' }));
    expect(screen.getByText('Testes (4)')).toBeInTheDocument();
    expect(idsNaLista()).toHaveLength(4);
    expect(screen.getByLabelText('ID/cenário')).toHaveValue('');
  });

  it('funcionalidade (opções vêm dos testes do plano) e status', async () => {
    await abrir();
    const func = screen.getByLabelText('Funcionalidade');
    expect(within(func).getAllByRole('option').map((o) => o.textContent)).toEqual(['Todas', 'Cartões', 'Faturas']);
    await userEvent.selectOptions(func, 'Faturas');
    expect(idsNaLista()).toEqual(['CT03.1', 'CT03.2', 'CT03.7']);
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'agendado');
    expect(idsNaLista()).toEqual(['CT03.2', 'CT03.7']);
    expect(screen.getByText('Testes (2 de 4)')).toBeInTheDocument();
  });

  it('"Apenas hoje" e "Datas passadas" usam a data planejada em relação a hoje', async () => {
    await abrir();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Apenas hoje' }));
    expect(idsNaLista()).toEqual(['CT03.2', 'CT04.1']);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Datas passadas' }));
    expect(idsNaLista()).toEqual(['CT03.1', 'CT03.2', 'CT04.1']);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Apenas hoje' }));
    expect(idsNaLista()).toEqual(['CT03.1']);
  });

  it('data específica', async () => {
    await abrir();
    fireEvent.change(screen.getByLabelText('Data'), { target: { value: '2026-10-09' } });
    expect(idsNaLista()).toEqual(['CT03.7']);
  });

  it('os filtros valem também na Visão card, e nada encontrado explica o vazio', async () => {
    await abrir();
    await irParaCards();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Apenas hoje' }));
    expect(idsNaColuna('agendado')).toEqual(['CT03.2']);
    expect(idsNaColuna('em_andamento')).toEqual(['CT04.1']);
    expect(idsNaColuna('concluido')).toEqual([]);
    expect(within(coluna('agendado')).getByText('Agendado (1)')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('ID/cenário'), 'zzz');
    expect(screen.getByText('Nenhum teste encontrado com estes filtros')).toBeInTheDocument();
  });

  it('na lista, filtro sem resultado também explica o vazio', async () => {
    await abrir();
    await userEvent.type(screen.getByLabelText('ID/cenário'), 'zzz');
    expect(screen.getByText('Nenhum teste encontrado com estes filtros')).toBeInTheDocument();
  });

  it('o modal de ordem continua mostrando o plano inteiro, mesmo com filtro ligado', async () => {
    await abrir();
    await userEvent.type(screen.getByLabelText('ID/cenário'), 'cartão');
    await userEvent.click(screen.getByRole('button', { name: 'Ordem de execução do plano' }));
    expect(within(screen.getByRole('dialog', { name: 'Ordem de execução' })).getAllByTestId(/^linha-/)).toHaveLength(4);
  });
});
