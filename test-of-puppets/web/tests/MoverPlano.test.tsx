import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PlanoDetalhe from '../src/pages/planos/PlanoDetalhe';
import { renderComPessoas } from './ajudantes';
import { criarApiFalsa, item, pessoa, plano } from './apiFalsa';

const equipe = () => [pessoa('ana'), pessoa('bia')];

const origem = () =>
  plano('pl_a', '28/09/26', [
    item('CT03.1', { nome: 'Pagar valor total', status: 'concluido', resultado: 'passou' }),
    item('CT03.2', { nome: 'Pagar valor mínimo', status: 'em_andamento' }),
    item('CT03.3', { nome: 'Pagar valor parcial' }),
    item('CT04.1', { nome: 'Bloquear cartão', funcionalidade: 'Cartões' }),
  ]);
const emExecucao = () => plano('pl_b', '05/10/26', [item('CT05.1', { nome: 'Cadastro PF' })]);
const concluido = () => plano('pl_c', '14/09/26', [item('CT06.1', { status: 'concluido', resultado: 'passou' })]);

async function abrir() {
  const api = criarApiFalsa({ planos: [origem(), emExecucao(), concluido()] });
  vi.stubGlobal('fetch', api.falso);
  const props = { onFechar: vi.fn(), onMudou: vi.fn() };
  renderComPessoas(<PlanoDetalhe id="pl_a" {...props} />, equipe());
  await screen.findByRole('heading', { name: 'Plano: 28/09/26' });
  return { api, ...props };
}

const linha = (id: string) => screen.getByTestId(`teste-${id}`);
const ids = () => screen.queryAllByTestId(/^teste-/).map((l) => l.getAttribute('data-testid')!.replace('teste-', ''));
const marcar = async (...lista: string[]) => {
  for (const id of lista) await userEvent.click(within(linha(id)).getByRole('checkbox', { name: `Selecionar ${id}` }));
};
const barra = () => screen.getByRole('region', { name: 'Ações em lote' });

beforeEach(() => vi.unstubAllGlobals());
afterEach(() => vi.unstubAllGlobals());

describe('Mover para plano (lote)', () => {
  it('oferece só os outros planos em execução (não o próprio nem o concluído)', async () => {
    await abrir();
    await marcar('CT03.3');
    const destino = within(barra()).getByLabelText('Mover para plano');
    expect(within(destino).getAllByRole('option').map((o) => o.textContent)).toEqual(['Escolha…', '05/10/26']);
  });

  it('move os marcados: um único pedido, a seleção some e os testes saem da lista', async () => {
    const { api, onMudou } = await abrir();
    await marcar('CT03.3', 'CT04.1');
    expect(within(barra()).getByRole('button', { name: 'Mover' })).toBeDisabled();
    await userEvent.selectOptions(within(barra()).getByLabelText('Mover para plano'), 'pl_b');
    await userEvent.click(within(barra()).getByRole('button', { name: 'Mover' }));

    await vi.waitFor(() => expect(ids()).toEqual(['CT03.1', 'CT03.2']));
    expect(api.escritas()).toEqual([{ metodo: 'POST', caminho: '/api/planos/pl_a/mover', corpo: { idCenarios: ['CT03.3', 'CT04.1'], paraPlano: 'pl_b' } }]);
    expect(screen.queryByRole('region', { name: 'Ações em lote' })).toBeNull();
    expect(onMudou).toHaveBeenCalled();
    // Os testes agora estão no outro plano.
    const resposta = await api.falso('/api/planos/pl_b');
    const noDestino = (await resposta.json()) as { itens: { idCenario: string }[] };
    expect(noDestino.itens.map((i) => i.idCenario)).toEqual(['CT05.1', 'CT03.3', 'CT04.1']);
  });

  it('com um teste que já começou na seleção não aparece "Mover" nem "Remover do plano"', async () => {
    await abrir();
    await marcar('CT03.3', 'CT03.2'); // CT03.2 está em andamento
    expect(within(barra()).queryByLabelText('Mover para plano')).toBeNull();
    expect(within(barra()).queryByRole('button', { name: 'Remover do plano' })).toBeNull();
  });

  it('sem outro plano em execução o seletor avisa e fica desabilitado', async () => {
    const api = criarApiFalsa({ planos: [origem(), concluido()] });
    vi.stubGlobal('fetch', api.falso);
    renderComPessoas(<PlanoDetalhe id="pl_a" onFechar={vi.fn()} onMudou={vi.fn()} />, equipe());
    await screen.findByRole('heading', { name: 'Plano: 28/09/26' });
    await marcar('CT03.3');
    const seletor = within(barra()).getByLabelText('Mover para plano');
    expect(seletor).toBeDisabled();
    expect(within(seletor).getByRole('option', { name: 'Nenhum outro plano em execução' })).toBeInTheDocument();
  });

  it('o servidor recusando mostra o aviso e relê o plano', async () => {
    const api = criarApiFalsa({ planos: [origem(), plano('pl_b', '05/10/26', [item('CT03.3')])] });
    vi.stubGlobal('fetch', api.falso);
    renderComPessoas(<PlanoDetalhe id="pl_a" onFechar={vi.fn()} onMudou={vi.fn()} />, equipe());
    await screen.findByRole('heading', { name: 'Plano: 28/09/26' });
    await marcar('CT03.3');
    await userEvent.selectOptions(within(barra()).getByLabelText('Mover para plano'), 'pl_b');
    await userEvent.click(within(barra()).getByRole('button', { name: 'Mover' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Já está no plano 05/10/26: CT03.3.');
    expect(ids()).toContain('CT03.3');
  });
});
