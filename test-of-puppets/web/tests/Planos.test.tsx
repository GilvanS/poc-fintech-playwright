import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Planos from '../src/pages/planos/Planos';
import { cenario, criarApiFalsa, item, plano } from './apiFalsa';

const cenarios = [
  cenario('CT01.1', { nome: 'Login' }),
  cenario('CT03.2', { nome: 'Pagar valor mínimo', idMassa: '0483', massaCompartilhadaCom: ['CT03.7'] }),
  cenario('CT03.7', { nome: 'Reenvio pgto mínimo', idMassa: '0483', dependeDe: ['CT03.2'], massaCompartilhadaCom: ['CT03.2'] }),
];

const planoA = () =>
  plano(
    'pl_a',
    '28/09/26',
    [item('CT01.1', { status: 'concluido', resultado: 'passou' }), item('CT03.2'), item('CT03.7'), item('CT04.1'), item('CT05.1')],
    { previsao: '2026-10-13' },
  );
const planoVazio = () => plano('pl_v', '05/10/26');
const planoPronto = () => plano('pl_p', '14/09/26', [item('CT01.1', { status: 'concluido', resultado: 'passou' })]);

function usar(api: ReturnType<typeof criarApiFalsa>) {
  vi.stubGlobal('fetch', api.falso);
}

async function abrir(api: ReturnType<typeof criarApiFalsa>) {
  usar(api);
  render(<Planos />);
  await screen.findByRole('heading', { level: 2, name: 'Planos' });
}

beforeEach(() => vi.unstubAllGlobals());
afterEach(() => vi.unstubAllGlobals());

describe('Planos — lista de cards', () => {
  it('sem planos mostra o estado vazio e o botão + Novo Plano', async () => {
    await abrir(criarApiFalsa());
    expect(await screen.findByText('Nenhum plano ainda')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Novo Plano' })).toBeInTheDocument();
  });

  it('tudo vazio: oferece carregar os dados de exemplo (fictícios) e, ao clicar, os planos aparecem', async () => {
    const api = criarApiFalsa({ semente: [planoA(), planoVazio(), planoPronto()] });
    await abrir(api);
    expect(await screen.findByText('Nenhum plano ainda')).toBeInTheDocument();
    expect(screen.getByText(/8 cenários, 3 pessoas e 3 planos fictícios/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Carregar dados de exemplo' }));
    expect(await screen.findByText('28/09/26')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Carregar dados de exemplo' })).toBeNull();
    expect(api.escritas()).toEqual([{ metodo: 'POST', caminho: '/api/semente', corpo: undefined }]);
    expect(screen.getByRole('tab', { name: 'Em execução (2)' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Executados (1)' })).toBeInTheDocument();
  });

  it('se já houver dados no servidor, a recusa aparece e nada muda', async () => {
    await abrir(criarApiFalsa({ sementeRecusada: true }));
    await userEvent.click(await screen.findByRole('button', { name: 'Carregar dados de exemplo' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Os dados de exemplo só entram com tudo vazio.');
    expect(screen.getByText('Nenhum plano ainda')).toBeInTheDocument();
  });

  it('com planos cadastrados o convite para carregar exemplos não aparece', async () => {
    await abrir(criarApiFalsa({ planos: [planoA()] }));
    await screen.findByText('28/09/26');
    expect(screen.queryByRole('button', { name: 'Carregar dados de exemplo' })).toBeNull();
  });

  it('cada card mostra nome, criado em, previsão, progresso e contagem de testes', async () => {
    await abrir(criarApiFalsa({ planos: [planoA(), planoVazio()] }));
    const a = await screen.findByRole('button', { name: /28\/09\/26/ });
    expect(within(a).getByText('28/09/26')).toBeInTheDocument();
    expect(within(a).getByText('Criado em: 24/09/2026')).toBeInTheDocument();
    expect(within(a).getByText('Previsão de término: 13/10/2026')).toBeInTheDocument();
    expect(within(a).getByText('20% executado')).toBeInTheDocument();
    expect(within(a).getByText('5 teste(s) · 4 pendente(s)')).toBeInTheDocument();
    expect(within(a).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '20');

    const vazio = screen.getByRole('button', { name: /05\/10\/26/ });
    expect(within(vazio).getByText('Previsão de término: -')).toBeInTheDocument();
    expect(within(vazio).getByText('0 teste(s) · vazio')).toBeInTheDocument();
    expect(within(vazio).getByText('0% executado')).toBeInTheDocument();
  });

  it('abas "Em execução" e "Executados" com contagem; cada uma mostra só os seus planos', async () => {
    await abrir(criarApiFalsa({ planos: [planoA(), planoVazio(), planoPronto()] }));
    await screen.findByText('28/09/26');
    const abas = screen.getByRole('tablist');
    expect(within(abas).getByRole('tab', { name: 'Em execução (2)' })).toHaveAttribute('aria-selected', 'true');
    expect(within(abas).getByRole('tab', { name: 'Executados (1)' })).toBeInTheDocument();
    expect(screen.queryByText('14/09/26')).toBeNull();

    await userEvent.click(within(abas).getByRole('tab', { name: 'Executados (1)' }));
    expect(screen.getByText('14/09/26')).toBeInTheDocument();
    expect(screen.queryByText('28/09/26')).toBeNull();
  });

  it('aba sem planos explica o vazio', async () => {
    await abrir(criarApiFalsa({ planos: [planoA()] }));
    await screen.findByText('28/09/26');
    await userEvent.click(screen.getByRole('tab', { name: 'Executados (0)' }));
    expect(screen.getByText('Nenhum plano executado ainda')).toBeInTheDocument();
  });

  it('busca pelo nome e ordem crescente/decrescente', async () => {
    await abrir(criarApiFalsa({ planos: [planoA(), planoVazio()] }));
    await screen.findByText('28/09/26');
    const ordemAtual = () => screen.getAllByTestId('plano-nome').map((n) => n.textContent);
    expect(ordemAtual()).toEqual(['28/09/26', '05/10/26']);

    await userEvent.click(screen.getByRole('button', { name: /Crescente/ }));
    expect(ordemAtual()).toEqual(['05/10/26', '28/09/26']);
    expect(screen.getByRole('button', { name: /Decrescente/ })).toBeInTheDocument();

    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar plano' }), '05/10');
    expect(ordemAtual()).toEqual(['05/10/26']);
    await userEvent.clear(screen.getByRole('searchbox', { name: 'Buscar plano' }));
    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar plano' }), 'zzz');
    expect(screen.getByText('Nenhum plano encontrado para esta busca')).toBeInTheDocument();
  });

  it('servidor fora do ar: avisa e "Tentar de novo" busca outra vez', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    render(<Planos />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar os planos');
    usar(criarApiFalsa({ planos: [planoA()] }));
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('28/09/26')).toBeInTheDocument();
  });

  it('clicar no card abre o detalhe do plano; fechar volta para a lista', async () => {
    await abrir(criarApiFalsa({ planos: [planoA()], cenarios }));
    await userEvent.click(await screen.findByRole('button', { name: /28\/09\/26/ }));
    const detalhe = await screen.findByRole('dialog', { name: 'Detalhe do plano' });
    expect(within(detalhe).getByRole('heading', { name: 'Plano: 28/09/26' })).toBeInTheDocument();
    await userEvent.click(within(detalhe).getByRole('button', { name: 'Fechar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('Planos — modal Novo Plano (M1)', () => {
  async function abrirModal(api = criarApiFalsa({ cenarios })) {
    await abrir(api);
    await userEvent.click(await screen.findByRole('button', { name: 'Novo Plano' }));
    return { api, modal: await screen.findByRole('dialog', { name: 'Novo Plano' }) };
  }

  it('cria plano vazio com nome e previsão; fecha o modal e o card aparece', async () => {
    const { api, modal } = await abrirModal();
    await userEvent.type(within(modal).getByLabelText('Nome do plano'), '12/10/26');
    fireEvent.change(within(modal).getByLabelText('Previsão de término'), { target: { value: '2026-10-20' } });
    await userEvent.click(within(modal).getByRole('button', { name: 'Criar plano' }));

    expect(await screen.findByText('12/10/26')).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Novo Plano' })).toBeNull();
    expect(api.escritas()).toEqual([{ metodo: 'POST', caminho: '/api/planos', corpo: { nome: '12/10/26', previsao: '2026-10-20' } }]);
  });

  it('"Todos os cenários cadastrados (3)" cria o plano com todos', async () => {
    const { api, modal } = await abrirModal();
    expect(within(modal).getByRole('radio', { name: 'Vazio' })).toBeChecked();
    await userEvent.type(within(modal).getByLabelText('Nome do plano'), 'Completo');
    await userEvent.click(await within(modal).findByRole('radio', { name: 'Todos os cenários cadastrados (3)' }));
    await userEvent.click(within(modal).getByRole('button', { name: 'Criar plano' }));
    await screen.findByText('Completo');
    expect(api.escritas()[0].corpo).toEqual({ nome: 'Completo', idCenarios: ['CT01.1', 'CT03.2', 'CT03.7'] });
  });

  it('"Escolher agora…" lista os cenários com caixas de marcar; cria só com os marcados', async () => {
    const { api, modal } = await abrirModal();
    await userEvent.type(within(modal).getByLabelText('Nome do plano'), 'Parcial');
    await userEvent.click(await within(modal).findByRole('radio', { name: 'Escolher agora…' }));
    await userEvent.click(within(modal).getByRole('checkbox', { name: /CT03\.7/ }));
    await userEvent.click(within(modal).getByRole('checkbox', { name: /CT01\.1/ }));
    expect(within(modal).getByText('2 selecionado(s)')).toBeInTheDocument();
    await userEvent.click(within(modal).getByRole('button', { name: 'Criar plano' }));
    await screen.findByText('Parcial');
    expect(api.escritas()[0].corpo).toEqual({ nome: 'Parcial', idCenarios: ['CT01.1', 'CT03.7'] });
  });

  it('nome repetido só avisa (não impede de criar)', async () => {
    const { api, modal } = await abrirModal(criarApiFalsa({ planos: [planoA()], cenarios }));
    expect(within(modal).queryByText('Já existe plano com este nome.')).toBeNull();
    await userEvent.type(within(modal).getByLabelText('Nome do plano'), '28/09/26');
    expect(within(modal).getByText('Já existe plano com este nome.')).toBeInTheDocument();
    await userEvent.click(within(modal).getByRole('button', { name: 'Criar plano' }));
    await vi.waitFor(() => expect(api.escritas()).toHaveLength(1));
  });

  it('sem nome o botão fica desabilitado; erro do servidor aparece no modal e ele continua aberto', async () => {
    const { modal } = await abrirModal();
    expect(within(modal).getByRole('button', { name: 'Criar plano' })).toBeDisabled();

    vi.stubGlobal('fetch', vi.fn(async (_entrada: RequestInfo | URL, init?: RequestInit) => {
      if ((init?.method ?? 'GET') === 'POST') {
        return new Response(JSON.stringify({ erro: 'validacao', mensagens: ['Previsão deve ser uma data válida (aaaa-mm-dd).'] }), { status: 400, headers: { 'content-type': 'application/json' } });
      }
      return new Response(JSON.stringify({ planos: [], cenarios: [], funcionalidades: [] }), { status: 200, headers: { 'content-type': 'application/json' } });
    }));
    await userEvent.type(within(modal).getByLabelText('Nome do plano'), 'X');
    await userEvent.click(within(modal).getByRole('button', { name: 'Criar plano' }));
    expect(await within(modal).findByRole('alert')).toHaveTextContent('Previsão deve ser uma data válida');
    expect(screen.getByRole('dialog', { name: 'Novo Plano' })).toBeInTheDocument();
  });

  it('Cancelar e Esc fecham sem criar', async () => {
    const { api, modal } = await abrirModal();
    await userEvent.click(within(modal).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Novo Plano' }));
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(api.escritas()).toEqual([]);
  });
});
