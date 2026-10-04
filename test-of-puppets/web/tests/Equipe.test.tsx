import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Equipe from '../src/pages/equipe/Equipe';
import { PessoasProvider } from '../src/pessoas/ContextoPessoas';
import { criarApiFalsa, pessoa } from './apiFalsa';

async function abrir(opcoes: Parameters<typeof criarApiFalsa>[0] = {}) {
  const api = criarApiFalsa(opcoes);
  vi.stubGlobal('fetch', api.falso);
  render(
    <PessoasProvider>
      <Equipe />
    </PessoasProvider>,
  );
  await screen.findByRole('heading', { level: 2, name: 'Equipe' });
  return api;
}

const linha = (nome: string) => screen.getByTestId(`pessoa-${nome}`);

beforeEach(() => vi.unstubAllGlobals());
afterEach(() => vi.unstubAllGlobals());

describe('Equipe — lista', () => {
  it('sem ninguém cadastrado mostra o estado vazio e o botão Nova pessoa', async () => {
    await abrir();
    expect(await screen.findByText('Nenhuma pessoa cadastrada ainda')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nova pessoa' })).toBeInTheDocument();
  });

  it('lista nome, capacidade (min e horas) e situação; avisa que não há senha', async () => {
    await abrir({
      pessoas: [pessoa('ana', { capacidadeMinSemana: 120 }), pessoa('bia', { capacidadeMinSemana: 90, ativa: false }), pessoa('carlos')],
    });
    expect(await screen.findByTestId('pessoa-Ana')).toBeInTheDocument();
    expect(within(linha('Ana')).getByText('120 min/semana (2 h)')).toBeInTheDocument();
    expect(within(linha('Bia')).getByText('90 min/semana (1,5 h)')).toBeInTheDocument();
    expect(within(linha('Carlos')).getByText('-')).toBeInTheDocument(); // capacidade não informada
    expect(within(linha('Ana')).getByText('Ativa')).toBeInTheDocument();
    expect(within(linha('Bia')).getByText('Inativa')).toBeInTheDocument();
    expect(screen.getByText(/sem senha/i)).toBeInTheDocument();
  });
});

describe('Equipe — cadastro e edição', () => {
  it('cria a pessoa: manda nome, capacidade, cor e ativa; fecha o modal e ela aparece na lista', async () => {
    const api = await abrir();
    await userEvent.click(await screen.findByRole('button', { name: 'Nova pessoa' }));
    const modal = screen.getByRole('dialog', { name: 'Nova pessoa' });
    await userEvent.type(within(modal).getByLabelText('Nome'), 'Ana');
    await userEvent.type(within(modal).getByLabelText('Capacidade (min por semana)'), '120');
    await userEvent.selectOptions(within(modal).getByLabelText('Cor'), 'verde');
    expect(within(modal).getByRole('checkbox', { name: 'Ativa' })).toBeChecked();
    await userEvent.click(within(modal).getByRole('button', { name: 'Salvar pessoa' }));

    expect(await screen.findByTestId('pessoa-Ana')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(api.escritas()).toEqual([
      { metodo: 'POST', caminho: '/api/pessoas', corpo: { nome: 'Ana', capacidadeMinSemana: 120, cor: 'verde', ativa: true } },
    ]);
  });

  it('capacidade vazia não é enviada (o servidor assume 0)', async () => {
    const api = await abrir();
    await userEvent.click(await screen.findByRole('button', { name: 'Nova pessoa' }));
    const modal = screen.getByRole('dialog', { name: 'Nova pessoa' });
    await userEvent.type(within(modal).getByLabelText('Nome'), 'Bia');
    await userEvent.click(within(modal).getByRole('button', { name: 'Salvar pessoa' }));
    await screen.findByTestId('pessoa-Bia');
    expect(api.escritas()[0].corpo).toEqual({ nome: 'Bia', cor: 'azul', ativa: true });
  });

  it('edita: abre com os valores, manda PUT com a versão e a lista mostra o novo nome', async () => {
    const api = await abrir({ pessoas: [pessoa('ana', { capacidadeMinSemana: 120, cor: 'roxo' })] });
    await userEvent.click(await screen.findByRole('button', { name: 'Editar Ana' }));
    const modal = screen.getByRole('dialog', { name: 'Editar Ana' });
    expect(within(modal).getByLabelText('Nome')).toHaveValue('Ana');
    expect(within(modal).getByLabelText('Capacidade (min por semana)')).toHaveValue(120);
    expect(within(modal).getByLabelText('Cor')).toHaveValue('roxo');
    const nome = within(modal).getByLabelText('Nome');
    await userEvent.clear(nome);
    await userEvent.type(nome, 'Ana Souza');
    await userEvent.click(within(modal).getByRole('checkbox', { name: 'Ativa' }));
    await userEvent.click(within(modal).getByRole('button', { name: 'Salvar pessoa' }));

    expect(await screen.findByTestId('pessoa-Ana Souza')).toBeInTheDocument();
    expect(within(linha('Ana Souza')).getByText('Inativa')).toBeInTheDocument();
    expect(api.escritas()[0]).toEqual({
      metodo: 'PUT',
      caminho: '/api/pessoas/ana',
      corpo: { nome: 'Ana Souza', capacidadeMinSemana: 120, cor: 'roxo', ativa: false, versao: 1 },
    });
  });

  it('nome repetido: a mensagem do servidor aparece no modal, que continua aberto', async () => {
    await abrir({ pessoas: [pessoa('ana')] });
    await userEvent.click(await screen.findByRole('button', { name: 'Nova pessoa' }));
    const modal = screen.getByRole('dialog', { name: 'Nova pessoa' });
    await userEvent.type(within(modal).getByLabelText('Nome'), 'ana');
    await userEvent.click(within(modal).getByRole('button', { name: 'Salvar pessoa' }));
    expect(await within(modal).findByRole('alert')).toHaveTextContent('Já existe uma pessoa chamada ana.');
    expect(screen.getByRole('dialog', { name: 'Nova pessoa' })).toBeInTheDocument();
  });

  it('Cancelar e Esc fecham sem enviar', async () => {
    const api = await abrir();
    await userEvent.click(await screen.findByRole('button', { name: 'Nova pessoa' }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Nova pessoa' }));
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(api.escritas()).toEqual([]);
  });
});

describe('Equipe — excluir e "Sou eu"', () => {
  it('excluir pede confirmação; confirmar remove a pessoa', async () => {
    const api = await abrir({ pessoas: [pessoa('ana'), pessoa('bia')] });
    await userEvent.click(await screen.findByRole('button', { name: 'Excluir Ana' }));
    const aviso = screen.getByRole('alertdialog', { name: 'Confirmar exclusão' });
    expect(aviso).toHaveTextContent('Excluir Ana da equipe?');
    await userEvent.click(within(aviso).getByRole('button', { name: 'Excluir' }));
    await vi.waitFor(() => expect(screen.queryByTestId('pessoa-Ana')).toBeNull());
    expect(screen.getByTestId('pessoa-Bia')).toBeInTheDocument();
    expect(api.escritas()).toEqual([{ metodo: 'DELETE', caminho: '/api/pessoas/ana', corpo: undefined }]);
  });

  it('"Manter" desiste; pessoa responsável por testes é recusada com a explicação', async () => {
    await abrir({ pessoas: [pessoa('ana')], pessoasEmUso: ['ana'] });
    await userEvent.click(await screen.findByRole('button', { name: 'Excluir Ana' }));
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Manter' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Excluir Ana' }));
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Excluir' }));
    expect(await within(screen.getByRole('alertdialog')).findByRole('alert')).toHaveTextContent('apenas desative a pessoa');
    expect(screen.getByTestId('pessoa-Ana')).toBeInTheDocument();
  });

  it('"Sou eu" escolhe quem é "Você" neste navegador e marca a linha', async () => {
    await abrir({ pessoas: [pessoa('ana'), pessoa('bia')] });
    await userEvent.click(await screen.findByRole('button', { name: 'Usar Bia como Você' }));
    expect(window.localStorage.getItem('puppets:voce')).toBe('bia');
    expect(within(linha('Bia')).getByText('Você')).toBeInTheDocument();
    expect(within(linha('Ana')).queryByText('Você')).toBeNull();
  });

  it('pessoa inativa não pode ser "Você"', async () => {
    await abrir({ pessoas: [pessoa('ana', { ativa: false })] });
    expect(await screen.findByRole('button', { name: 'Usar Ana como Você' })).toBeDisabled();
  });
});
