import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// O mosaico usa canvas; no jsdom basta saber que ele foi montado.
vi.mock('../src/shared/GridRevealBackdrop', () => ({ default: () => <div data-testid="fundo-animado" /> }));
vi.mock('../src/shared/MatrixDotLoader', () => ({ default: () => null }));

import App from '../src/App';
import type { Visao } from '../src/visoes/clienteVisoes';
import { cenario, criarApiFalsa, CRIADO, item, pessoa, plano } from './apiFalsa';

const planoMaster = plano('pl_master', '28/09/26', [
  item('CT03.1', { funcionalidade: 'Faturas', prioridade: 'P1', responsavel: 'ana' }),
  item('CT03.2', { funcionalidade: 'Faturas', prioridade: 'P2', responsavel: 'ana' }),
  item('CT04.1', { funcionalidade: 'Pix', prioridade: 'P1', responsavel: 'bia' }),
]);
const planoVelho = plano('pl_velho', '14/09/26', [item('CT03.1', { status: 'concluido', resultado: 'passou' })]);
const planoVazio = plano('pl_vazio', '05/10/26', []);

function visao(id: string, nome: string, extra: Partial<Visao> = {}): Visao {
  return {
    id,
    nome,
    tipo: 'kanban',
    dono: 'ana',
    compartilhada: false,
    filtros: { funcionalidade: '', responsavel: '', prioridade: '' },
    versao: 1,
    criadoEm: CRIADO,
    ...extra,
  };
}

async function entrar(opcoes: Parameters<typeof criarApiFalsa>[0] = {}) {
  const api = criarApiFalsa({ planos: [planoMaster, planoVelho, planoVazio], cenarios: [cenario('CT03.1'), cenario('CT04.1', { funcionalidade: 'Pix' })], ...opcoes });
  vi.stubGlobal('fetch', api.falso);
  const view = render(<App />);
  await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
  return { api, ...view };
}

const menu = () => screen.getByRole('complementary', { name: 'Navegação' });
const seletorPlano = () => screen.getByRole('combobox', { name: 'Plano' }) as HTMLSelectElement;
const textoOpcoes = (s: HTMLSelectElement) => within(s).getAllByRole('option').map((o) => o.textContent);
const idsNaTela = () => screen.queryAllByTestId(/^teste-/).map((e) => e.getAttribute('data-testid')!.replace('teste-', ''));

beforeEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});
afterEach(() => vi.unstubAllGlobals());

describe('Seletor "Plano" do cabeçalho', () => {
  it('lista os planos reais do servidor, marca o concluído e não traz mais os nomes de exemplo', async () => {
    await entrar();
    await vi.waitFor(() => expect(textoOpcoes(seletorPlano())).toEqual(['Plano 28/09/26', 'Plano 14/09/26 · concluído', 'Plano 05/10/26']));
    expect(screen.queryByText(/MASTER/)).toBeNull();
  });

  it('sem planos, fica desabilitado em "Nenhum plano"', async () => {
    await entrar({ planos: [] });
    await vi.waitFor(() => expect(textoOpcoes(seletorPlano())).toEqual(['Nenhum plano']));
    expect(seletorPlano()).toBeDisabled();
  });

  it('abre no primeiro plano ainda em execução; escolher outro grava o id e vale depois de recarregar', async () => {
    const { unmount } = await entrar();
    await vi.waitFor(() => expect(seletorPlano()).toHaveValue('pl_master'));
    await userEvent.selectOptions(seletorPlano(), 'pl_velho');
    expect(window.localStorage.getItem('puppets:plano')).toBe('pl_velho');

    unmount();
    render(<App />);
    await vi.waitFor(() => expect(seletorPlano()).toHaveValue('pl_velho'));
  });

  it('um id guardado de plano que não existe mais cai no primeiro em execução', async () => {
    window.localStorage.setItem('puppets:plano', 'pl_excluido');
    await entrar();
    await vi.waitFor(() => expect(seletorPlano()).toHaveValue('pl_master'));
  });
});

describe('Lista e Kanban do menu', () => {
  it('"Lista" abre o plano escolhido como página: sem abas e sem modal, com os testes em linhas', async () => {
    await entrar();
    await vi.waitFor(() => expect(seletorPlano()).toHaveValue('pl_master'));
    await userEvent.click(within(menu()).getByRole('button', { name: 'Lista' }));

    expect(screen.getByRole('heading', { level: 2, name: 'Lista' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { level: 3, name: 'Plano: 28/09/26' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Plano' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Fechar' })).toBeNull();
    expect(await screen.findByLabelText('Status de CT03.1')).toBeInTheDocument();
  });

  it('"Kanban" abre o mesmo plano em colunas', async () => {
    await entrar();
    await vi.waitFor(() => expect(seletorPlano()).toHaveValue('pl_master'));
    await userEvent.click(within(menu()).getByRole('button', { name: 'Kanban' }));
    expect(await screen.findByTestId('coluna-agendado')).toBeInTheDocument();
    expect(within(screen.getByTestId('coluna-agendado')).getByTestId('card-CT04.1')).toBeInTheDocument();
    expect(screen.queryByLabelText('Status de CT03.1')).toBeNull();
  });

  it('trocar o plano no cabeçalho troca o plano mostrado', async () => {
    await entrar();
    await vi.waitFor(() => expect(seletorPlano()).toHaveValue('pl_master'));
    await userEvent.click(within(menu()).getByRole('button', { name: 'Lista' }));
    expect(await screen.findByRole('heading', { level: 3, name: 'Plano: 28/09/26' })).toBeInTheDocument();

    await userEvent.selectOptions(seletorPlano(), 'pl_velho');
    expect(await screen.findByRole('heading', { level: 3, name: 'Plano: 14/09/26' })).toBeInTheDocument();
  });

  it('sem nenhum plano, avisa e oferece ir para Planos', async () => {
    await entrar({ planos: [] });
    await userEvent.click(within(menu()).getByRole('button', { name: 'Lista' }));
    expect(screen.getByText(/Nenhum plano para mostrar/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Ir para Planos' }));
    expect(screen.getByRole('heading', { level: 2, name: 'Planos' })).toBeInTheDocument();
  });

  it('o Esc não fecha nada na página (só os modais de cima respondem a ele)', async () => {
    await entrar();
    await userEvent.click(within(menu()).getByRole('button', { name: 'Lista' }));
    expect(await screen.findByRole('heading', { level: 3, name: 'Plano: 28/09/26' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('heading', { level: 3, name: 'Plano: 28/09/26' })).toBeInTheDocument();
  });
});

describe('Visões salvas', () => {
  // Compartilhada para aparecer mesmo antes de alguém escolher "Você"; a pessoal de outra pessoa tem teste próprio.
  const faturasP1 = visao('so-faturas-p1', 'Só Faturas P1', { compartilhada: true, filtros: { funcionalidade: 'Faturas', responsavel: '', prioridade: 'P1' } });

  it('aparecem em "Minhas visões" quando o servidor devolve; os nomes de exemplo antigos não existem mais', async () => {
    await entrar({ visoes: [faturasP1] });
    expect(await within(menu()).findByRole('button', { name: 'Só Faturas P1' })).toBeInTheDocument();
  });

  it('sem visões salvas, o menu não inventa nenhuma', async () => {
    await entrar();
    await vi.waitFor(() => expect(seletorPlano()).toHaveValue('pl_master'));
    expect(within(menu()).queryByRole('button', { name: 'Só Faturas P1' })).toBeNull();
  });

  it('abrir uma visão mostra o plano já filtrado e o tipo dela (kanban)', async () => {
    await entrar({ visoes: [faturasP1] });
    await userEvent.click(await within(menu()).findByRole('button', { name: 'Só Faturas P1' }));

    expect(screen.getByRole('heading', { level: 2, name: 'Só Faturas P1' })).toBeInTheDocument();
    expect(await screen.findByTestId('card-CT03.1')).toBeInTheDocument();
    expect(screen.queryByTestId('card-CT03.2')).toBeNull(); // Faturas, mas P2
    expect(screen.queryByTestId('card-CT04.1')).toBeNull(); // P1, mas Pix
    expect(screen.getByLabelText('Funcionalidade')).toHaveValue('Faturas');
    expect(screen.getByLabelText('Prioridade')).toHaveValue('P1');
    expect(within(menu()).getByRole('button', { name: 'Só Faturas P1' })).toHaveAttribute('aria-current', 'page');
  });

  it('o filtro da visão pode ser mudado na tela sem alterar a visão salva', async () => {
    const { api } = await entrar({ visoes: [faturasP1] });
    await userEvent.click(await within(menu()).findByRole('button', { name: 'Só Faturas P1' }));
    await screen.findByTestId('card-CT03.1');
    await userEvent.selectOptions(screen.getByLabelText('Prioridade'), '');
    expect(await screen.findByTestId('card-CT03.2')).toBeInTheDocument();
    expect(api.escritas()).toEqual([]);
  });

  it('"Excluir visão" apaga no servidor, tira do menu e volta para Planos', async () => {
    const { api } = await entrar({ visoes: [faturasP1], pessoas: [pessoa('ana')] });
    await vi.waitFor(() => expect(screen.getByLabelText('Você')).toBeInTheDocument());
    await userEvent.selectOptions(screen.getByLabelText('Você'), 'ana');
    await userEvent.click(await within(menu()).findByRole('button', { name: 'Só Faturas P1' }));
    await userEvent.click(screen.getByRole('button', { name: 'Excluir visão' }));

    await vi.waitFor(() => expect(within(menu()).queryByRole('button', { name: 'Só Faturas P1' })).toBeNull());
    expect(api.escritas()).toContainEqual({ metodo: 'DELETE', caminho: '/api/visoes/so-faturas-p1?voce=ana', corpo: undefined });
    expect(screen.getByRole('heading', { level: 2, name: 'Planos' })).toBeInTheDocument();
  });

  it('visão pessoal de outra pessoa não aparece no menu', async () => {
    await entrar({ visoes: [faturasP1, visao('da-bia', 'Da Bia', { dono: 'bia' })], pessoas: [pessoa('ana'), pessoa('bia')] });
    await vi.waitFor(() => expect(screen.getByLabelText('Você')).toBeInTheDocument());
    await userEvent.selectOptions(screen.getByLabelText('Você'), 'ana');
    await within(menu()).findByRole('button', { name: 'Só Faturas P1' });
    expect(within(menu()).queryByRole('button', { name: 'Da Bia' })).toBeNull();
  });
});

describe('Nova visão (M11)', () => {
  const abrir = async () => {
    await userEvent.click(within(menu()).getByRole('button', { name: 'Nova visão' }));
    return screen.getByRole('dialog', { name: 'Nova visão' });
  };

  it('"Nova visão" abre o modal em vez de trocar de tela; Esc e Cancelar fecham', async () => {
    await entrar();
    const modal = await abrir();
    expect(screen.getByRole('heading', { level: 2, name: 'Planos' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(modal).not.toBeInTheDocument();

    const outra = await abrir();
    await userEvent.click(within(outra).getByRole('button', { name: 'Cancelar' }));
    expect(outra).not.toBeInTheDocument();
  });

  it('mostra os 9 modelos; só Lista e Kanban estão disponíveis, o resto avisa "Em breve"', async () => {
    await entrar();
    const modal = await abrir();
    const modelos = within(within(modal).getByRole('radiogroup', { name: 'Escolha um modelo' })).getAllByRole('radio');
    expect(modelos).toHaveLength(9);
    expect(modelos.filter((m) => !(m as HTMLButtonElement).disabled).map((m) => m.textContent)).toEqual([
      'Listatabela com todos os testes',
      'Kanbancolunas por status',
    ]);
    expect(within(modal).getByRole('radio', { name: /Roadmap/ })).toBeDisabled();
    expect(within(modal).getByText('Em breve (T13.6)')).toBeInTheDocument();
    expect(within(modal).getByRole('radio', { name: /Kanban/ })).toHaveAttribute('aria-checked', 'true');
  });

  it('só habilita "Criar visão" com nome', async () => {
    await entrar();
    const modal = await abrir();
    expect(within(modal).getByRole('button', { name: 'Criar visão' })).toBeDisabled();
    await userEvent.type(within(modal).getByLabelText('Nome'), '   ');
    expect(within(modal).getByRole('button', { name: 'Criar visão' })).toBeDisabled();
    await userEvent.type(within(modal).getByLabelText('Nome'), 'Pix');
    expect(within(modal).getByRole('button', { name: 'Criar visão' })).toBeEnabled();
  });

  it('sem "Você", a visão nasce compartilhada e a caixa fica travada com a explicação', async () => {
    await entrar();
    const modal = await abrir();
    const caixa = within(modal).getByRole('checkbox', { name: 'Compartilhar com a equipe' });
    expect(caixa).toBeChecked();
    expect(caixa).toBeDisabled();
    expect(within(modal).getByText(/Escolha quem é você no cabeçalho/)).toBeInTheDocument();
  });

  it('cria a visão com filtros iniciais, grava como pessoal de "Você", entra no menu e abre a visão', async () => {
    const { api } = await entrar({ pessoas: [pessoa('ana'), pessoa('bia')] });
    await vi.waitFor(() => expect(screen.getByLabelText('Você')).toBeInTheDocument());
    await userEvent.selectOptions(screen.getByLabelText('Você'), 'ana');

    const modal = await abrir();
    await userEvent.type(within(modal).getByLabelText('Nome'), 'Pix da Bia');
    await userEvent.click(within(modal).getByRole('radio', { name: /Lista/ }));
    await vi.waitFor(() => expect(within(modal).getByRole('option', { name: 'Pix' })).toBeInTheDocument());
    await userEvent.selectOptions(within(modal).getByLabelText('Funcionalidade'), 'Pix');
    await userEvent.selectOptions(within(modal).getByLabelText('Responsável'), 'bia');
    await userEvent.selectOptions(within(modal).getByLabelText('Prioridade'), 'P1');
    expect(within(modal).getByRole('checkbox', { name: 'Compartilhar com a equipe' })).not.toBeChecked();
    await userEvent.click(within(modal).getByRole('button', { name: 'Criar visão' }));

    expect(api.escritas()).toContainEqual({
      metodo: 'POST',
      caminho: '/api/visoes',
      corpo: { nome: 'Pix da Bia', tipo: 'lista', dono: 'ana', compartilhada: false, filtros: { funcionalidade: 'Pix', responsavel: 'bia', prioridade: 'P1' } },
    });
    expect(await screen.findByRole('heading', { level: 2, name: 'Pix da Bia' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Nova visão' })).toBeNull();
    expect(within(menu()).getByRole('button', { name: 'Pix da Bia' })).toHaveAttribute('aria-current', 'page');
    // Lista + CT04.1 (Pix, P1, Bia) é o único teste que passa nos filtros
    await vi.waitFor(() => expect(idsNaTela()).toEqual(['CT04.1']));
  });

  it('nome repetido: o servidor recusa e o modal continua aberto com a mensagem', async () => {
    await entrar({ visoes: [visao('pix', 'Pix', { compartilhada: true, dono: null })] });
    const modal = await abrir();
    await userEvent.type(within(modal).getByLabelText('Nome'), 'pix');
    await userEvent.click(within(modal).getByRole('button', { name: 'Criar visão' }));
    expect(await within(modal).findByRole('alert')).toHaveTextContent('Já existe uma visão chamada pix.');
    expect(screen.getByRole('dialog', { name: 'Nova visão' })).toBeInTheDocument();
  });
});
