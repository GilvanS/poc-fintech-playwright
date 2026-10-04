import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import IncluirTestesModal from '../src/pages/planos/IncluirTestesModal';
import { ErroApi } from '../src/pages/cenarios/clienteApi';
import { cenario, criarApiFalsa } from './apiFalsa';

const cenarios = [
  cenario('CT03.1', { nome: 'Pagar valor total', idMassa: '0340' }),
  cenario('CT03.2', { nome: 'Pagar valor mínimo', idMassa: '0483', massaCompartilhadaCom: ['CT03.7'] }),
  cenario('CT03.3', { nome: 'Pagar com valor parcial', idMassa: '0393' }),
  cenario('CT03.7', { nome: 'Reenvio do pagamento mínimo', idMassa: '0483', dependeDe: ['CT03.2'], massaCompartilhadaCom: ['CT03.2'] }),
  cenario('CT04.1', { nome: 'Bloquear cartão', funcionalidade: 'Cartões' }),
];

async function abrir(opcoes: { noPlano?: string[]; onIncluir?: (ids: string[], data?: string) => Promise<void>; catalogo?: typeof cenarios } = {}) {
  vi.stubGlobal('fetch', criarApiFalsa({ cenarios: opcoes.catalogo ?? cenarios }).falso);
  const props = { onIncluir: vi.fn(opcoes.onIncluir ?? (async () => {})), onFechar: vi.fn() };
  render(<IncluirTestesModal planoNome="28/09/26" idsNoPlano={opcoes.noPlano ?? ['CT03.1']} {...props} />);
  const modal = await screen.findByRole('dialog', { name: 'Incluir testes' });
  await within(modal).findByTestId('cenario-CT03.2');
  return { modal, ...props };
}

const linha = (id: string) => screen.getByTestId(`cenario-${id}`);
const idsVisiveis = () => screen.queryAllByTestId(/^cenario-/).map((l) => l.getAttribute('data-testid')!.replace('cenario-', ''));
const botaoIncluir = () => screen.getByRole('button', { name: /^Incluir( \d+ testes?)?$/ });

beforeEach(() => vi.unstubAllGlobals());
afterEach(() => vi.unstubAllGlobals());

describe('IncluirTestesModal (M2)', () => {
  it('lista os cenários cadastrados com ID, nome, massa e a observação; os que já estão no plano ficam travados', async () => {
    const { modal } = await abrir();
    expect(within(modal).getByText('Incluir testes no plano 28/09/26')).toBeInTheDocument();
    expect(idsVisiveis()).toEqual(['CT03.1', 'CT03.2', 'CT03.3', 'CT03.7', 'CT04.1']);
    expect(within(linha('CT03.2')).getByText('Pagar valor mínimo')).toBeInTheDocument();
    expect(within(linha('CT03.2')).getByText('0483')).toBeInTheDocument();
    expect(within(linha('CT03.2')).getByText('= compartilhada com CT03.7')).toBeInTheDocument();
    expect(within(linha('CT03.1')).getByText('já no plano')).toBeInTheDocument();
    expect(within(linha('CT03.1')).getByRole('checkbox')).toBeDisabled();
    expect(within(linha('CT03.3')).getByRole('checkbox')).toBeEnabled();
  });

  it('buscar e filtrar por funcionalidade; "só os livres" esconde os que já estão no plano', async () => {
    await abrir();
    await userEvent.type(screen.getByLabelText('Buscar'), 'mínimo');
    expect(idsVisiveis()).toEqual(['CT03.2', 'CT03.7']);
    await userEvent.clear(screen.getByLabelText('Buscar'));

    await userEvent.selectOptions(screen.getByLabelText('Funcionalidade'), 'Cartões');
    expect(idsVisiveis()).toEqual(['CT04.1']);
    await userEvent.selectOptions(screen.getByLabelText('Funcionalidade'), '');

    await userEvent.click(screen.getByRole('checkbox', { name: 'só os livres' }));
    expect(idsVisiveis()).toEqual(['CT03.2', 'CT03.3', 'CT03.7', 'CT04.1']);

    await userEvent.type(screen.getByLabelText('Buscar'), 'zzz');
    expect(screen.getByText('Nenhum cenário encontrado')).toBeInTheDocument();
  });

  it('marcar mostra "n selecionados"; o botão diz quantos testes vai incluir e começa desabilitado', async () => {
    await abrir();
    expect(botaoIncluir()).toBeDisabled();
    expect(botaoIncluir()).toHaveTextContent('Incluir');

    await userEvent.click(within(linha('CT03.2')).getByRole('checkbox'));
    expect(screen.getByText('1 selecionado')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Incluir 1 teste' })).toBeEnabled();

    await userEvent.click(within(linha('CT03.3')).getByRole('checkbox'));
    expect(screen.getByText('2 selecionados')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Incluir 2 testes' })).toBeEnabled();

    await userEvent.click(within(linha('CT03.3')).getByRole('checkbox'));
    expect(screen.getByText('1 selecionado')).toBeInTheDocument();
  });

  it('incluir manda os IDs na ordem do cadastro e a data planejada escolhida', async () => {
    const { onIncluir } = await abrir();
    await userEvent.click(within(linha('CT04.1')).getByRole('checkbox'));
    await userEvent.click(within(linha('CT03.2')).getByRole('checkbox'));
    fireEvent.change(screen.getByLabelText('Data planejada para os selecionados'), { target: { value: '2026-10-05' } });
    await userEvent.click(screen.getByRole('button', { name: 'Incluir 2 testes' }));
    expect(onIncluir).toHaveBeenCalledWith(['CT03.2', 'CT04.1'], '2026-10-05');
  });

  it('sem data escolhida, manda só os IDs', async () => {
    const { onIncluir } = await abrir();
    await userEvent.click(within(linha('CT03.3')).getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: 'Incluir 1 teste' }));
    expect(onIncluir).toHaveBeenCalledWith(['CT03.3'], undefined);
  });

  it('recusa do servidor (ex.: data antes da dependência) aparece no modal, que continua aberto e com a seleção', async () => {
    const { onFechar } = await abrir({
      onIncluir: async () => {
        throw new ErroApi(409, 'data_antes_da_dependencia', ['CT03.7 não pode ser planejado em 01/10/2026, antes de CT03.2 (05/10/2026).']);
      },
    });
    await userEvent.click(within(linha('CT03.7')).getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: 'Incluir 1 teste' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('CT03.7 não pode ser planejado em 01/10/2026');
    expect(screen.getByRole('dialog', { name: 'Incluir testes' })).toBeInTheDocument();
    expect(screen.getByText('1 selecionado')).toBeInTheDocument();
    expect(onFechar).not.toHaveBeenCalled();
  });

  it('sem nenhum cenário cadastrado explica o vazio', async () => {
    vi.stubGlobal('fetch', criarApiFalsa({ cenarios: [] }).falso);
    render(<IncluirTestesModal planoNome="28/09/26" idsNoPlano={[]} onIncluir={vi.fn()} onFechar={vi.fn()} />);
    expect(await screen.findByText('Nenhum cenário cadastrado ainda')).toBeInTheDocument();
  });

  it('servidor fora do ar ao abrir: mostra o erro', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    render(<IncluirTestesModal planoNome="28/09/26" idsNoPlano={[]} onIncluir={vi.fn()} onFechar={vi.fn()} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível');
  });

  it('Cancelar, ✕ e Esc fecham sem incluir', async () => {
    const { onFechar, onIncluir } = await abrir();
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    await userEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    await userEvent.keyboard('{Escape}');
    expect(onFechar).toHaveBeenCalledTimes(3);
    expect(onIncluir).not.toHaveBeenCalled();
  });
});
