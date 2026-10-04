import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Kanban from '../src/pages/planos/Kanban';
import PlanoDetalhe from '../src/pages/planos/PlanoDetalhe';
import { SEM_LIMITES, type Wip } from '../src/config/clienteConfig';
import { criarApiFalsa, item, pessoa, plano } from './apiFalsa';
import { renderComPessoas } from './ajudantes';

const equipe = [pessoa('ana'), pessoa('bia'), pessoa('carlos')];

const ct31 = () => item('CT03.1', { status: 'em_andamento', responsavel: 'ana' });
const ct32 = () => item('CT03.2', { status: 'em_andamento', responsavel: 'ana' });
const ct33 = () => item('CT03.3', { status: 'agendado', responsavel: 'bia' });
const ct41 = () => item('CT04.1', { status: 'agendado' });
const ct37 = () => item('CT03.7', { status: 'agendado', responsavel: 'bia', bloqueadoPor: ['CT03.2'], dependeDe: ['CT03.2'] });

function montar(extra: Partial<Parameters<typeof Kanban>[0]> = {}, itens = [ct31(), ct32(), ct33(), ct41()]) {
  const props = { itens, onAlterar: vi.fn(), onAbrir: vi.fn(), onConfirmando: vi.fn(), ...extra };
  renderComPessoas(<Kanban {...props} />, equipe);
  return props;
}

const arrastar = (id: string, destino: HTMLElement) => {
  fireEvent.dragStart(screen.getByTestId(`card-${id}`));
  fireEvent.drop(destino);
};

describe('Kanban — limite de WIP macio', () => {
  it('sem limites o título mostra só a contagem e nada fica marcado', () => {
    montar();
    expect(within(screen.getByTestId('coluna-em_andamento')).getByRole('heading')).toHaveTextContent('Em andamento (2)');
    expect(screen.queryByText('Limite')).toBeNull();
  });

  it('com limite o título mostra atual/limite do plano inteiro, mesmo com filtro, e marca a coluna cheia', () => {
    montar({ itens: [ct31()], todos: [ct31(), ct32(), ct33(), ct41()], wip: { ...SEM_LIMITES, em_andamento: 2, refinamento: 3 } });
    const cheia = screen.getByTestId('coluna-em_andamento');
    expect(within(cheia).getByRole('heading')).toHaveTextContent('Em andamento (2/2)');
    expect(within(cheia).getByText('Limite')).toBeInTheDocument();
    const livre = screen.getByTestId('coluna-refinamento');
    expect(within(livre).getByRole('heading')).toHaveTextContent('Refinamento (0/3)');
    expect(within(livre).queryByText('Limite')).toBeNull();
  });

  it('mover para a coluna cheia pede confirmação: "Voltar" não muda nada', async () => {
    const { onAlterar } = montar({ wip: { ...SEM_LIMITES, em_andamento: 2 } });
    await userEvent.selectOptions(screen.getByLabelText('Mover CT04.1 para'), 'em_andamento');
    const aviso = screen.getByRole('alertdialog', { name: 'Confirmar movimento' });
    expect(within(aviso).getByText(/A coluna Em andamento já tem 2 de 2 testes/)).toBeInTheDocument();
    await userEvent.click(within(aviso).getByRole('button', { name: 'Voltar' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(onAlterar).not.toHaveBeenCalled();
  });

  it('"Soltar mesmo assim" move de qualquer jeito (o limite é macio)', async () => {
    const { onAlterar, itens } = montar({ wip: { ...SEM_LIMITES, em_andamento: 2 } });
    arrastar('CT04.1', screen.getByTestId('coluna-em_andamento'));
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Soltar mesmo assim' }));
    expect(onAlterar).toHaveBeenCalledWith(itens.find((i) => i.idCenario === 'CT04.1'), { status: 'em_andamento' });
  });

  it('coluna com folga move direto, sem pergunta', async () => {
    const { onAlterar } = montar({ wip: { ...SEM_LIMITES, refinamento: 3 } });
    await userEvent.selectOptions(screen.getByLabelText('Mover CT04.1 para'), 'refinamento');
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(onAlterar).toHaveBeenCalledWith(expect.objectContaining({ idCenario: 'CT04.1' }), { status: 'refinamento' });
  });

  it('soltar na mesma coluna não faz nada', () => {
    const { onAlterar } = montar({ wip: { ...SEM_LIMITES, em_andamento: 2 } });
    arrastar('CT03.1', screen.getByTestId('coluna-em_andamento'));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(onAlterar).not.toHaveBeenCalled();
  });

  it('Esc fecha só a confirmação e o pai é avisado de que ela abriu e fechou', async () => {
    const { onAlterar, onConfirmando } = montar({ wip: { ...SEM_LIMITES, em_andamento: 2 } });
    await userEvent.selectOptions(screen.getByLabelText('Mover CT04.1 para'), 'em_andamento');
    expect(onConfirmando).toHaveBeenLastCalledWith(true);
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(onConfirmando).toHaveBeenLastCalledWith(false);
    expect(onAlterar).not.toHaveBeenCalled();
  });
});

describe('Kanban — bloqueio por dependência', () => {
  it('o card travado mostra o cadeado e o motivo, sem tratar como erro', () => {
    montar({}, [ct32(), ct37()]);
    const card = screen.getByTestId('card-CT03.7');
    expect(within(card).getByText('Aguardando CT03.2 passar')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(within(screen.getByTestId('card-CT03.2')).queryByText(/Aguardando/)).toBeNull();
  });
});

describe('Kanban — raias por responsável', () => {
  const raias = () => montar({ agrupar: 'responsavel' }, [ct31(), ct32(), ct33(), ct41(), ct37()]);

  it('uma raia por pessoa da Equipe e "Sem dono", com a contagem de cada uma', () => {
    raias();
    expect(screen.getByRole('button', { name: 'Raia Ana' })).toHaveTextContent('Ana (2)');
    expect(screen.getByRole('button', { name: 'Raia Bia' })).toHaveTextContent('Bia (2)');
    expect(screen.getByRole('button', { name: 'Raia Carlos' })).toHaveTextContent('Carlos (0)');
    expect(screen.getByRole('button', { name: 'Raia Sem dono' })).toHaveTextContent('Sem dono (1)');
    expect(within(screen.getByTestId('celula-ana-em_andamento')).getByTestId('card-CT03.1')).toBeInTheDocument();
    expect(within(screen.getByTestId('celula-__sem-agendado')).getByTestId('card-CT04.1')).toBeInTheDocument();
  });

  it('o cabeçalho das colunas aparece uma vez só, com os limites', () => {
    montar({ agrupar: 'responsavel', wip: { ...SEM_LIMITES, em_andamento: 3 } });
    expect(screen.getByTestId('cabecalho-em_andamento')).toHaveTextContent('Em andamento (2/3)');
    expect(screen.queryByTestId('coluna-em_andamento')).toBeNull();
  });

  it('soltar em outra raia pergunta "Passar CT03.3 de Bia para Carlos?" e só então reatribui', async () => {
    const { onAlterar } = raias();
    arrastar('CT03.3', screen.getByTestId('celula-carlos-agendado'));
    const aviso = screen.getByRole('alertdialog');
    expect(within(aviso).getByText('Passar CT03.3 de Bia para Carlos?')).toBeInTheDocument();
    expect(onAlterar).not.toHaveBeenCalled();
    await userEvent.click(within(aviso).getByRole('button', { name: 'Passar' }));
    expect(onAlterar).toHaveBeenCalledWith(expect.objectContaining({ idCenario: 'CT03.3' }), { responsavel: 'carlos' });
  });

  it('soltar na raia "Sem dono" tira o responsável', async () => {
    const { onAlterar } = raias();
    arrastar('CT03.3', screen.getByTestId('celula-__sem-agendado'));
    expect(screen.getByText('Passar CT03.3 de Bia para ninguém (sem dono)?')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Passar' }));
    expect(onAlterar).toHaveBeenCalledWith(expect.objectContaining({ idCenario: 'CT03.3' }), { responsavel: null });
  });

  it('soltar na mesma raia, em outra coluna, só muda o status e não pergunta', () => {
    const { onAlterar } = raias();
    arrastar('CT03.3', screen.getByTestId('celula-bia-refinamento'));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(onAlterar).toHaveBeenCalledWith(expect.objectContaining({ idCenario: 'CT03.3' }), { status: 'refinamento' });
  });

  it('mudar de raia e de coluna numa coluna cheia junta os dois avisos e o botão vira "Confirmar"', async () => {
    const { onAlterar } = montar({ agrupar: 'responsavel', wip: { ...SEM_LIMITES, em_andamento: 2 } });
    arrastar('CT03.3', screen.getByTestId('celula-carlos-em_andamento'));
    const aviso = screen.getByRole('alertdialog');
    expect(within(aviso).getByText(/Passar CT03.3 de Bia para Carlos/)).toBeInTheDocument();
    expect(within(aviso).getByText(/A coluna Em andamento já tem 2 de 2/)).toBeInTheDocument();
    await userEvent.click(within(aviso).getByRole('button', { name: 'Confirmar' }));
    expect(onAlterar).toHaveBeenCalledWith(expect.objectContaining({ idCenario: 'CT03.3' }), { status: 'em_andamento', responsavel: 'carlos' });
  });

  it('recolher a raia esconde os cards e mostra só a quantidade', async () => {
    raias();
    const botao = screen.getByRole('button', { name: 'Raia Ana' });
    expect(botao).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(botao);
    expect(botao).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('card-CT03.1')).toBeNull();
    expect(screen.getByTestId('card-CT03.3')).toBeInTheDocument();
    expect(within(screen.getByTestId('celula-ana-em_andamento')).getByText('2 teste(s)')).toBeInTheDocument();
  });
});

describe('PlanoDetalhe — WIP e raias no Kanban', () => {
  const planoBase = () => plano('pl_a', '28/09/26', [ct31(), ct32(), ct33(), ct41()]);

  async function abrir(wip: Partial<Wip>) {
    const api = criarApiFalsa({ planos: [planoBase()], wip, pessoas: equipe });
    vi.stubGlobal('fetch', api.falso);
    const props = { onFechar: vi.fn(), onMudou: vi.fn() };
    renderComPessoas(<PlanoDetalhe id="pl_a" {...props} />, equipe);
    await screen.findByRole('heading', { name: 'Plano: 28/09/26' });
    await userEvent.click(screen.getByRole('tab', { name: 'Visão card' }));
    return { api, ...props };
  }

  beforeEach(() => vi.unstubAllGlobals());
  afterEach(() => vi.unstubAllGlobals());

  it('lê os limites do servidor: resumo na barra, contador na coluna e só na visão card', async () => {
    await abrir({ em_andamento: 2, refinamento: 3 });
    expect(await screen.findByTestId('resumo-wip')).toHaveTextContent('Limite WIP: Em andamento 2 · Refinamento 3');
    await vi.waitFor(() => expect(within(screen.getByTestId('coluna-em_andamento')).getByRole('heading')).toHaveTextContent('Em andamento (2/2)'));
    await userEvent.click(screen.getByRole('tab', { name: 'Visão lista' }));
    expect(screen.queryByTestId('resumo-wip')).toBeNull();
  });

  it('mover para a coluna cheia: o Esc fecha só o aviso, o plano continua aberto e nada é gravado', async () => {
    const { api, onFechar } = await abrir({ em_andamento: 2 });
    await vi.waitFor(() => expect(within(screen.getByTestId('coluna-em_andamento')).getByRole('heading')).toHaveTextContent('(2/2)'));
    await userEvent.selectOptions(screen.getByLabelText('Mover CT04.1 para'), 'em_andamento');
    expect(screen.getByRole('alertdialog', { name: 'Confirmar movimento' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(onFechar).not.toHaveBeenCalled();
    expect(api.escritas()).toEqual([]);
  });

  it('"Soltar mesmo assim" grava o novo status no servidor', async () => {
    const { api } = await abrir({ em_andamento: 2 });
    await vi.waitFor(() => expect(within(screen.getByTestId('coluna-em_andamento')).getByRole('heading')).toHaveTextContent('(2/2)'));
    await userEvent.selectOptions(screen.getByLabelText('Mover CT04.1 para'), 'em_andamento');
    await userEvent.click(screen.getByRole('button', { name: 'Soltar mesmo assim' }));
    await vi.waitFor(() =>
      expect(api.escritas()).toContainEqual({ metodo: 'PATCH', caminho: '/api/planos/pl_a/testes/CT04.1', corpo: { versao: 1, status: 'em_andamento' } }),
    );
  });

  it('M13: "Editar limites" salva os dois limites, vazio = sem limite, e a barra se atualiza', async () => {
    const { api } = await abrir({ em_andamento: 2, refinamento: 3 });
    await screen.findByTestId('resumo-wip');
    await userEvent.click(screen.getByRole('button', { name: 'Editar limites' }));
    const modal = screen.getByRole('dialog', { name: 'Limites de WIP' });
    expect(within(modal).getByLabelText('Em andamento')).toHaveValue(2);
    await userEvent.clear(within(modal).getByLabelText('Em andamento'));
    await userEvent.type(within(modal).getByLabelText('Em andamento'), '5');
    await userEvent.clear(within(modal).getByLabelText('Refinamento'));
    await userEvent.click(within(modal).getByRole('button', { name: 'Salvar' }));

    await vi.waitFor(() => expect(screen.queryByRole('dialog', { name: 'Limites de WIP' })).toBeNull());
    expect(api.escritas()).toContainEqual({ metodo: 'PUT', caminho: '/api/config', corpo: { wip: { em_andamento: 5, refinamento: null } } });
    expect(screen.getByTestId('resumo-wip')).toHaveTextContent('Limite WIP: Em andamento 5');
  });

  it('M13: limite 0 nem sai do formulário (mínimo 1) e o modal continua aberto', async () => {
    const { api } = await abrir({ em_andamento: 2 });
    await screen.findByTestId('resumo-wip');
    await userEvent.click(screen.getByRole('button', { name: 'Editar limites' }));
    const modal = screen.getByRole('dialog', { name: 'Limites de WIP' });
    await userEvent.clear(within(modal).getByLabelText('Em andamento'));
    await userEvent.type(within(modal).getByLabelText('Em andamento'), '0');
    await userEvent.click(within(modal).getByRole('button', { name: 'Salvar' }));
    expect(screen.getByRole('dialog', { name: 'Limites de WIP' })).toBeInTheDocument();
    expect(api.escritas()).toEqual([]);
  });

  it('M13: se o servidor recusar o valor, a mensagem aparece no modal, que continua aberto', async () => {
    const api = criarApiFalsa({ planos: [planoBase()], wip: { em_andamento: 2 }, pessoas: equipe });
    vi.stubGlobal('fetch', api.falso);
    renderComPessoas(<PlanoDetalhe id="pl_a" onFechar={vi.fn()} onMudou={vi.fn()} />, equipe);
    await screen.findByRole('heading', { name: 'Plano: 28/09/26' });
    await userEvent.click(screen.getByRole('tab', { name: 'Visão card' }));
    await screen.findByTestId('resumo-wip');
    await userEvent.click(screen.getByRole('button', { name: 'Editar limites' }));
    const modal = screen.getByRole('dialog', { name: 'Limites de WIP' });
    // 150 passa na validação do formulário? Não: max=99 também é nativo, então forço o envio direto pelo formulário.
    fireEvent.change(within(modal).getByLabelText('Em andamento'), { target: { value: '150' } });
    fireEvent.submit(modal);
    expect(await within(modal).findByRole('alert')).toHaveTextContent('inteiro de 1 a 99');
  });

  it('M13: Esc fecha o modal sem fechar o plano', async () => {
    const { onFechar } = await abrir({ em_andamento: 2 });
    await screen.findByTestId('resumo-wip');
    await userEvent.click(screen.getByRole('button', { name: 'Editar limites' }));
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Limites de WIP' })).toBeNull();
    expect(onFechar).not.toHaveBeenCalled();
  });

  it('"Agrupar: Responsável" troca as colunas por raias', async () => {
    await abrir({ em_andamento: 2 });
    expect(screen.getByTestId('coluna-agendado')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Agrupar'), 'responsavel');
    expect(screen.queryByTestId('coluna-agendado')).toBeNull();
    expect(screen.getByRole('button', { name: 'Raia Ana' })).toBeInTheDocument();
    expect(within(screen.getByTestId('celula-bia-agendado')).getByTestId('card-CT03.3')).toBeInTheDocument();
  });
});
