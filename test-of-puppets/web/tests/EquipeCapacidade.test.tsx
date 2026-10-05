import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Planejamento from '../src/pages/planejamento/Planejamento';
import { PessoasProvider } from '../src/pessoas/ContextoPessoas';
import { criarApiFalsa, item, pessoa, plano } from './apiFalsa';

// Modal M12 "Equipe e capacidade", aberto pelo Planejamento.
const HOJE = '2026-10-05';
const equipe = () => [
  pessoa('ana', { capacidadeMinSemana: 120, cor: 'azul' }),
  pessoa('bia', { capacidadeMinSemana: 90, cor: 'verde' }),
  pessoa('carlos', { capacidadeMinSemana: 60, cor: 'roxo' }),
];

async function abrir(opcoes: { emUso?: string[] } = {}) {
  const api = criarApiFalsa({
    planos: [plano('pl_a', '05/10/26', [item('CT03.3', { responsavel: 'bia', dataPlanejada: '2026-10-05', estimativaMin: 25 })])],
    pessoas: equipe(),
    pessoasEmUso: opcoes.emUso,
  });
  vi.stubGlobal('fetch', api.falso);
  const ir = vi.fn();
  render(
    <PessoasProvider>
      <Planejamento hoje={HOJE} onIrParaEquipe={ir} />
    </PessoasProvider>,
  );
  await screen.findByTestId('linha-pessoa-ana');
  await userEvent.click(screen.getByRole('button', { name: 'Equipe e capacidade' }));
  return { api, ir, modal: screen.getByRole('dialog', { name: 'Equipe e capacidade' }) };
}

const salvar = (modal: HTMLElement) => within(modal).getByRole('button', { name: 'Salvar' });

beforeEach(() => vi.unstubAllGlobals());
afterEach(() => vi.unstubAllGlobals());

describe('Equipe e capacidade (M12)', () => {
  it('lista as pessoas com capacidade, cor e "ativa"; Salvar começa desabilitado', async () => {
    const { modal } = await abrir();
    expect(within(modal).getByLabelText('Capacidade de Ana')).toHaveValue('120');
    expect(within(modal).getByLabelText('Capacidade de Bia')).toHaveValue('90');
    expect(within(modal).getByLabelText('Cor de Carlos')).toHaveValue('roxo');
    expect(within(modal).getByRole('checkbox', { name: 'Ana está ativa' })).toBeChecked();
    expect(salvar(modal)).toBeDisabled();
  });

  it('salva só o que mudou (capacidade da Bia e Carlos inativo), fecha e a tela já usa a capacidade nova', async () => {
    const { api, modal } = await abrir();
    await userEvent.clear(within(modal).getByLabelText('Capacidade de Bia'));
    await userEvent.type(within(modal).getByLabelText('Capacidade de Bia'), '100');
    await userEvent.click(within(modal).getByRole('checkbox', { name: 'Carlos está ativa' }));
    expect(salvar(modal)).toBeEnabled();
    await userEvent.click(salvar(modal));

    await vi.waitFor(() => expect(screen.queryByRole('dialog', { name: 'Equipe e capacidade' })).toBeNull());
    expect(api.escritas()).toEqual([
      { metodo: 'PUT', caminho: '/api/pessoas/bia', corpo: { nome: 'Bia', capacidadeMinSemana: 100, cor: 'verde', ativa: true, versao: 1 } },
      { metodo: 'PUT', caminho: '/api/pessoas/carlos', corpo: { nome: 'Carlos', capacidadeMinSemana: 60, cor: 'roxo', ativa: false, versao: 1 } },
    ]);
    // Reabrindo, a capacidade nova já está lá (a Equipe foi relida) e o Carlos continua inativo.
    await userEvent.click(screen.getByRole('button', { name: 'Equipe e capacidade' }));
    const de_novo = screen.getByRole('dialog', { name: 'Equipe e capacidade' });
    expect(within(de_novo).getByLabelText('Capacidade de Bia')).toHaveValue('100');
    expect(within(de_novo).getByRole('checkbox', { name: 'Carlos está ativa' })).not.toBeChecked();
  });

  it('adicionar pessoa: nome, capacidade e cor; cria com POST', async () => {
    const { api, modal } = await abrir();
    await userEvent.click(within(modal).getByRole('button', { name: 'Adicionar pessoa' }));
    expect(salvar(modal)).toBeDisabled(); // linha nova sem nome não conta
    await userEvent.type(within(modal).getByLabelText('Nome da pessoa nova'), 'Dora');
    await userEvent.type(within(modal).getByLabelText('Capacidade de Dora'), '45');
    await userEvent.selectOptions(within(modal).getByLabelText('Cor de Dora'), 'rosa');
    await userEvent.click(salvar(modal));
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(api.escritas()).toEqual([{ metodo: 'POST', caminho: '/api/pessoas', corpo: { nome: 'Dora', cor: 'rosa', ativa: true, capacidadeMinSemana: 45 } }]);
  });

  it('linha nova sem nome é descartada ao tirar; excluir uma pessoa que existe risca a linha e desfaz', async () => {
    const { api, modal } = await abrir();
    await userEvent.click(within(modal).getByRole('button', { name: 'Adicionar pessoa' }));
    await userEvent.click(within(modal).getByRole('button', { name: 'Excluir pessoa nova' }));
    expect(within(modal).queryByLabelText('Nome da pessoa nova')).toBeNull();

    await userEvent.click(within(modal).getByRole('button', { name: 'Excluir Carlos' }));
    expect(within(modal).getByLabelText('Capacidade de Carlos')).toBeDisabled();
    expect(salvar(modal)).toBeEnabled();
    await userEvent.click(within(modal).getByRole('button', { name: 'Desfazer exclusão de Carlos' }));
    expect(salvar(modal)).toBeDisabled();
    expect(api.escritas()).toEqual([]);
  });

  it('excluir pessoa grava o DELETE', async () => {
    const { api, modal } = await abrir();
    await userEvent.click(within(modal).getByRole('button', { name: 'Excluir Carlos' }));
    await userEvent.click(salvar(modal));
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(api.escritas()).toEqual([{ metodo: 'DELETE', caminho: '/api/pessoas/carlos', corpo: undefined }]);
  });

  it('pessoa que ainda é responsável por testes: o servidor recusa, a mensagem aparece e o modal fica aberto com a tabela relida', async () => {
    const { modal } = await abrir({ emUso: ['bia'] });
    await userEvent.clear(within(modal).getByLabelText('Capacidade de Ana'));
    await userEvent.type(within(modal).getByLabelText('Capacidade de Ana'), '130');
    await userEvent.click(within(modal).getByRole('button', { name: 'Excluir Bia' }));
    await userEvent.click(salvar(modal));

    const alerta = await within(modal).findByRole('alert');
    expect(alerta).toHaveTextContent('Bia é responsável por testes');
    expect(alerta).toHaveTextContent('As alterações depois deste ponto não foram salvas.');
    // A Ana (antes da Bia na tabela) foi salva; a tabela foi relida com a versão nova dela e a Bia voltou.
    expect(within(modal).getByLabelText('Capacidade de Ana')).toHaveValue('130');
    expect(within(modal).getByLabelText('Capacidade de Bia')).toBeEnabled();
    expect(screen.getByRole('dialog', { name: 'Equipe e capacidade' })).toBeInTheDocument();
  });

  it('capacidade que não é número e nome repetido são barrados antes de chamar o servidor', async () => {
    const { api, modal } = await abrir();
    await userEvent.clear(within(modal).getByLabelText('Capacidade de Ana'));
    await userEvent.type(within(modal).getByLabelText('Capacidade de Ana'), 'muita');
    await userEvent.click(salvar(modal));
    expect(await within(modal).findByRole('alert')).toHaveTextContent('Capacidade de Ana deve ser um número inteiro de minutos por semana.');

    await userEvent.clear(within(modal).getByLabelText('Capacidade de Ana'));
    await userEvent.type(within(modal).getByLabelText('Capacidade de Ana'), '120');
    await userEvent.click(within(modal).getByRole('button', { name: 'Adicionar pessoa' }));
    await userEvent.type(within(modal).getByLabelText('Nome da pessoa nova'), 'bia');
    await userEvent.click(salvar(modal));
    expect(await within(modal).findByRole('alert')).toHaveTextContent('Já existe uma pessoa com esse nome.');
    expect(api.escritas()).toEqual([]);
  });

  it('Esc e Cancelar fecham sem gravar nada', async () => {
    const { api, modal } = await abrir();
    await userEvent.clear(within(modal).getByLabelText('Capacidade de Ana'));
    await userEvent.type(within(modal).getByLabelText('Capacidade de Ana'), '1');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Equipe e capacidade' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Equipe e capacidade' }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(api.escritas()).toEqual([]);
  });
});
