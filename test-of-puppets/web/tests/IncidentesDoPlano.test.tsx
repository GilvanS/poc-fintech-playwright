import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Incidente } from '../src/incidentes/clienteIncidentes';
import { IncidentesProvider } from '../src/incidentes/ContextoIncidentes';
import PlanoDetalhe from '../src/pages/planos/PlanoDetalhe';
import { CRIADO, criarApiFalsa, item, pessoa, plano } from './apiFalsa';
import { renderComPessoas } from './ajudantes';

const equipe = [pessoa('ana'), pessoa('bia')];

function inc(numero: string, extra: Partial<Incidente> = {}): Incidente {
  return {
    numero,
    titulo: `Titulo de ${numero}`,
    descricao: '',
    status: 'novo',
    severidade: 'media',
    responsavel: null,
    testesAfetados: [],
    comentarios: [],
    historico: [],
    abertoEm: CRIADO,
    resolvidoEm: null,
    atualizadoEm: CRIADO,
    versao: 1,
    ...extra,
  };
}

const incidentesBase = () => [
  inc('INC0715802225', { titulo: 'Saldo de Faturamento difere do extrato', severidade: 'alta', status: 'em_analise', responsavel: 'ana', testesAfetados: ['CT03.1', 'CT03.2'] }),
  inc('INC0715790010', { titulo: 'Botão sem foco', severidade: 'baixa', status: 'resolvido', resolvidoEm: CRIADO, testesAfetados: ['CT03.2'] }),
  inc('INC0999', { titulo: 'De outro plano', testesAfetados: ['CT99.9'] }),
];

const planoA = () =>
  plano('pl_a', '28/09/26', [item('CT03.1', { nome: 'Pagar valor total' }), item('CT03.2', { nome: 'Pagar valor mínimo' }), item('CT05.2', { nome: 'Cadastro duplicado' })]);

async function abrir(opcoes: { incidentes?: Incidente[]; modo?: 'modal' | 'pagina' } = {}) {
  const api = criarApiFalsa({ planos: [planoA()], pessoas: equipe, incidentes: opcoes.incidentes ?? incidentesBase() });
  vi.stubGlobal('fetch', api.falso);
  const props = { onFechar: vi.fn(), onMudou: vi.fn() };
  renderComPessoas(
    <IncidentesProvider>
      <PlanoDetalhe id="pl_a" modo={opcoes.modo} {...props} />
    </IncidentesProvider>,
    equipe,
    'ana',
  );
  await screen.findByRole('heading', { name: /Plano: 28\/09\/26/ });
  return { api, ...props };
}

const abrirAba = async () => userEvent.click(await screen.findByRole('tab', { name: /^Incidentes \(\d+\)$/ }));

beforeEach(() => vi.unstubAllGlobals());
afterEach(() => vi.unstubAllGlobals());

describe('Incidentes — etiquetas e contagem', () => {
  it('a aba conta só os INC que afetam testes deste plano', async () => {
    await abrir();
    expect(await screen.findByRole('tab', { name: 'Incidentes (2)' })).toBeInTheDocument();
  });

  it('a lista mostra a etiqueta dos INC não resolvidos em cada teste afetado, e nenhuma dos resolvidos', async () => {
    await abrir();
    await waitFor(() => expect(within(screen.getByTestId('teste-CT03.1')).getByTestId('etiqueta-INC0715802225')).toBeInTheDocument());
    expect(within(screen.getByTestId('teste-CT03.2')).getByTestId('etiqueta-INC0715802225')).toBeInTheDocument();
    expect(screen.queryByTestId('etiqueta-INC0715790010')).toBeNull();
    expect(within(screen.getByTestId('teste-CT05.2')).queryByText(/INC/)).toBeNull();
  });

  it('o card do kanban também leva a etiqueta', async () => {
    await abrir();
    await userEvent.click(screen.getByRole('tab', { name: 'Visão card' }));
    expect(await within(screen.getByTestId('card-CT03.1')).findByTestId('etiqueta-INC0715802225')).toBeInTheDocument();
  });
});

describe('Incidentes — aba do plano', () => {
  it('lista os INC do plano com severidade, status, registro, responsável e testes; Alta primeiro', async () => {
    await abrir();
    await abrirAba();
    const linhas = screen.getAllByTestId(/^inc-/);
    expect(linhas.map((l) => l.getAttribute('data-testid'))).toEqual(['inc-INC0715802225', 'inc-INC0715790010']);
    const primeira = linhas[0];
    expect(primeira).toHaveTextContent('Saldo de Faturamento difere do extrato');
    expect(primeira).toHaveTextContent('Alta');
    expect(primeira).toHaveTextContent('Em análise');
    expect(primeira).toHaveTextContent('24/09/2026');
    expect(primeira).toHaveTextContent('Ana');
    expect(within(primeira).getByRole('button', { name: 'Abrir CT03.1' })).toBeInTheDocument();
    expect(screen.queryByTestId('inc-INC0999')).toBeNull();
  });

  it('teste do INC que não está no plano aparece como chip sem ação', async () => {
    await abrir({ incidentes: [inc('INC1', { testesAfetados: ['CT03.1', 'CT77.7'] })] });
    await abrirAba();
    expect(screen.getByText('CT77.7')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Abrir CT77.7' })).toBeNull();
  });

  it('sem INC no plano, avisa e mantém os dois botões', async () => {
    await abrir({ incidentes: [] });
    await abrirAba();
    expect(screen.getByText('Nenhum incidente afeta os testes deste plano')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Registrar INC' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Vincular INC existente' })).toBeInTheDocument();
  });

  it('clicar no chip do teste abre o detalhe do teste', async () => {
    await abrir();
    await abrirAba();
    await userEvent.click(within(screen.getByTestId('inc-INC0715802225')).getByRole('button', { name: 'Abrir CT03.2' }));
    expect(await screen.findByRole('dialog', { name: 'Detalhe do teste' })).toBeInTheDocument();
  });

  it('na versão página não há abas: um botão alterna entre os testes e os incidentes', async () => {
    await abrir({ modo: 'pagina' });
    expect(screen.queryByRole('tablist')).toBeNull();
    const botao = await screen.findByRole('button', { name: 'Incidentes (2)' });
    expect(botao).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(botao);
    expect(botao).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('inc-INC0715802225')).toBeInTheDocument();
    expect(screen.queryByLabelText('Status de CT03.1')).toBeNull();
    await userEvent.click(botao);
    expect(await screen.findByLabelText('Status de CT03.1')).toBeInTheDocument();
  });
});

describe('Incidentes — registrar (M6)', () => {
  it('só habilita "Registrar" com número e título; grava com o autor e já aparece na aba e nas etiquetas', async () => {
    const { api } = await abrir();
    await abrirAba();
    await userEvent.click(screen.getByRole('button', { name: 'Registrar INC' }));
    const modal = screen.getByRole('dialog', { name: 'Registrar INC' });
    expect(within(modal).getByRole('button', { name: 'Registrar' })).toBeDisabled();

    await userEvent.type(within(modal).getByLabelText('Nº do INC'), 'inc0715999999');
    await userEvent.type(within(modal).getByLabelText('Título'), 'Cadastro duplicado aceita CPF repetido');
    await userEvent.selectOptions(within(modal).getByLabelText('Severidade'), 'alta');
    await userEvent.selectOptions(within(modal).getByLabelText('Responsável'), 'bia');
    await userEvent.selectOptions(within(modal).getByLabelText('Adicionar teste'), 'CT05.2');
    await userEvent.click(within(modal).getByRole('button', { name: 'Registrar' }));

    await waitFor(() =>
      expect(api.escritas()).toContainEqual({
        metodo: 'POST',
        caminho: '/api/incidentes',
        corpo: { numero: 'inc0715999999', titulo: 'Cadastro duplicado aceita CPF repetido', descricao: '', severidade: 'alta', responsavel: 'bia', testesAfetados: ['CT05.2'], autor: 'ana' },
      }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Registrar INC' })).toBeNull());
    expect(await screen.findByTestId('inc-INC0715999999')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Incidentes (3)' })).toBeInTheDocument();
  });

  it('número repetido: o servidor recusa e o modal continua aberto com a mensagem', async () => {
    await abrir();
    await abrirAba();
    await userEvent.click(screen.getByRole('button', { name: 'Registrar INC' }));
    const modal = screen.getByRole('dialog', { name: 'Registrar INC' });
    await userEvent.type(within(modal).getByLabelText('Nº do INC'), 'INC0715802225');
    await userEvent.type(within(modal).getByLabelText('Título'), 'Repetido');
    await userEvent.click(within(modal).getByRole('button', { name: 'Registrar' }));
    expect(await within(modal).findByRole('alert')).toHaveTextContent('Já existe o INC INC0715802225.');
  });

  it('chips com ✕ tiram o teste escolhido e o devolvem ao seletor', async () => {
    await abrir();
    await abrirAba();
    await userEvent.click(screen.getByRole('button', { name: 'Registrar INC' }));
    const modal = screen.getByRole('dialog', { name: 'Registrar INC' });
    await userEvent.selectOptions(within(modal).getByLabelText('Adicionar teste'), 'CT03.1');
    expect(within(modal).getByRole('button', { name: 'Tirar CT03.1' })).toBeInTheDocument();
    expect(within(within(modal).getByLabelText('Adicionar teste')).queryByRole('option', { name: /CT03\.1/ })).toBeNull();
    await userEvent.click(within(modal).getByRole('button', { name: 'Tirar CT03.1' }));
    expect(within(within(modal).getByLabelText('Adicionar teste')).getByRole('option', { name: /CT03\.1/ })).toBeInTheDocument();
  });

  it('Esc fecha só o modal; o plano continua aberto', async () => {
    const { onFechar } = await abrir();
    await abrirAba();
    await userEvent.click(screen.getByRole('button', { name: 'Registrar INC' }));
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Registrar INC' })).toBeNull();
    expect(onFechar).not.toHaveBeenCalled();
    await userEvent.keyboard('{Escape}');
    expect(onFechar).toHaveBeenCalledTimes(1);
  });
});

describe('Incidentes — vincular existente (M7)', () => {
  it('busca pelo número ou título, escolhe o INC e liga aos testes', async () => {
    const { api } = await abrir({ incidentes: [...incidentesBase(), inc('INC0715802766', { titulo: 'Api de pagamentos não sensibiliza' })] });
    await abrirAba();
    await userEvent.click(screen.getByRole('button', { name: 'Vincular INC existente' }));
    const modal = screen.getByRole('dialog', { name: 'Vincular INC existente' });
    expect(within(modal).getByRole('button', { name: 'Vincular' })).toBeDisabled();

    await userEvent.type(within(modal).getByLabelText('Buscar'), 'pagamentos');
    const opcoes = within(within(modal).getByRole('radiogroup', { name: 'Incidentes' })).getAllByRole('radio');
    expect(opcoes).toHaveLength(1);
    await userEvent.click(opcoes[0]);
    expect(within(modal).getByRole('button', { name: 'Vincular' })).toBeDisabled(); // falta escolher o teste
    await userEvent.selectOptions(within(modal).getByLabelText('Adicionar teste'), 'CT05.2');
    await userEvent.click(within(modal).getByRole('button', { name: 'Vincular' }));

    await waitFor(() => expect(api.escritas()).toContainEqual({ metodo: 'POST', caminho: '/api/incidentes/INC0715802766/vincular', corpo: { idCenarios: ['CT05.2'], autor: 'ana' } }));
    expect(await screen.findByTestId('inc-INC0715802766')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Visão lista' }));
    expect(await within(screen.getByTestId('teste-CT05.2')).findByTestId('etiqueta-INC0715802766')).toBeInTheDocument();
  });

  it('busca sem resultado e cadastro vazio têm mensagem própria', async () => {
    await abrir({ incidentes: [] });
    await abrirAba();
    await userEvent.click(screen.getByRole('button', { name: 'Vincular INC existente' }));
    expect(screen.getByText(/Nenhum INC registrado ainda/)).toBeInTheDocument();
  });

  it('busca que não casa com nenhum INC avisa', async () => {
    await abrir();
    await abrirAba();
    await userEvent.click(screen.getByRole('button', { name: 'Vincular INC existente' }));
    await userEvent.type(screen.getByLabelText('Buscar'), 'zzzz');
    expect(screen.getByText('Nenhum INC encontrado para esta busca.')).toBeInTheDocument();
  });
});

describe('Incidentes — desvincular', () => {
  it('pede confirmação com os testes do plano; "Manter" não faz nada', async () => {
    const { api } = await abrir();
    await abrirAba();
    await userEvent.click(screen.getByRole('button', { name: 'Desvincular INC0715802225' }));
    const aviso = screen.getByRole('alertdialog', { name: 'Confirmar desvínculo' });
    expect(aviso).toHaveTextContent('Desvincular INC0715802225 dos testes deste plano (CT03.1, CT03.2)?');
    await userEvent.click(within(aviso).getByRole('button', { name: 'Manter' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(api.escritas()).toEqual([]);
  });

  it('confirmando, desliga o INC de cada teste do plano e ele sai da aba', async () => {
    const { api } = await abrir();
    await abrirAba();
    await userEvent.click(screen.getByRole('button', { name: 'Desvincular INC0715802225' }));
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Desvincular' }));
    await waitFor(() => expect(api.escritas()).toHaveLength(2));
    expect(api.escritas().map((e) => [e.metodo, e.caminho])).toEqual([
      ['DELETE', '/api/incidentes/INC0715802225/vinculo/CT03.1?autor=ana'],
      ['DELETE', '/api/incidentes/INC0715802225/vinculo/CT03.2?autor=ana'],
    ]);
    await waitFor(() => expect(screen.queryByTestId('inc-INC0715802225')).toBeNull());
    expect(screen.getByRole('tab', { name: 'Incidentes (1)' })).toBeInTheDocument();
  });

  it('Esc fecha só a confirmação', async () => {
    const { onFechar, api } = await abrir();
    await abrirAba();
    await userEvent.click(screen.getByRole('button', { name: 'Desvincular INC0715802225' }));
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(onFechar).not.toHaveBeenCalled();
    expect(api.escritas()).toEqual([]);
  });
});
