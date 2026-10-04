import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Sidebar from '../src/shell/Sidebar';
import { GRUPOS } from '../src/shell/menu';

function montar(extra: Partial<Parameters<typeof Sidebar>[0]> = {}) {
  const props = {
    lado: 'esquerda' as const,
    recolhido: false,
    ativo: 'planos' as const,
    onSelecionar: vi.fn(),
    onAlternarLado: vi.fn(),
    onAlternarRecolhido: vi.fn(),
    ...extra,
  };
  render(<Sidebar {...props} />);
  return { props, aside: screen.getByRole('complementary', { name: 'Navegação' }) };
}

describe('Sidebar (menu lateral)', () => {
  it('mostra os 5 grupos do menu com seus itens', () => {
    const { aside } = montar();
    for (const titulo of ['Planos & Testes', 'Qualidade', 'Minhas visões', 'Massa & Sistema']) {
      expect(within(aside).getByText(titulo)).toBeInTheDocument();
    }
    expect(GRUPOS).toHaveLength(5);
    for (const item of [
      'Planos', 'Lista', 'Kanban', 'Roadmap', 'Iterações', 'Planejamento', 'Incidentes', 'Release',
      'Lançamento', 'Retro', 'Nova visão', 'Cenários e massa', 'Equipe', 'Configurações',
    ]) {
      expect(within(aside).getByRole('button', { name: item })).toBeInTheDocument();
    }
  });

  it('sem visões salvas, "Minhas visões" tem só "Nova visão" (não há mais visão de exemplo)', () => {
    const { aside } = montar();
    expect(within(aside).queryByRole('button', { name: 'Só Faturas P1' })).toBeNull();
  });

  it('mostra as visões salvas antes de "Nova visão" e avisa a chave de cada uma', async () => {
    const { aside, props } = montar({
      visoes: [
        { id: 'so-faturas-p1', nome: 'Só Faturas P1', compartilhada: false },
        { id: 'da-equipe', nome: 'Da equipe', compartilhada: true },
      ],
      ativo: 'visao:da-equipe',
    });
    const nomes = within(aside).getAllByRole('button').map((b) => b.getAttribute('aria-label'));
    expect(nomes.indexOf('Só Faturas P1')).toBeGreaterThan(-1);
    expect(nomes.indexOf('Da equipe')).toBe(nomes.indexOf('Só Faturas P1') + 1);
    expect(nomes.indexOf('Nova visão')).toBe(nomes.indexOf('Da equipe') + 1);
    expect(within(aside).getByRole('button', { name: 'Da equipe' })).toHaveAttribute('aria-current', 'page');

    await userEvent.click(within(aside).getByRole('button', { name: 'Só Faturas P1' }));
    expect(props.onSelecionar).toHaveBeenCalledWith('visao:so-faturas-p1');
    await userEvent.click(within(aside).getByRole('button', { name: 'Nova visão' }));
    expect(props.onSelecionar).toHaveBeenCalledWith('nova-visao');
  });

  it('marca só o item ativo com aria-current="page"', () => {
    const { aside } = montar({ ativo: 'kanban' });
    expect(within(aside).getByRole('button', { name: 'Kanban' })).toHaveAttribute('aria-current', 'page');
    expect(within(aside).getByRole('button', { name: 'Lista' })).not.toHaveAttribute('aria-current');
  });

  it('avisa a chave do item clicado', async () => {
    const { aside, props } = montar();
    await userEvent.click(within(aside).getByRole('button', { name: 'Release' }));
    expect(props.onSelecionar).toHaveBeenCalledWith('release');
  });

  it('mostra o selo dos incidentes abertos que vier na prop (sem a prop, não há selo); massa repetida é proposital e não ganha selo de alerta', () => {
    const { aside } = montar({ selos: { incidentes: '2' } });
    expect(within(within(aside).getByRole('button', { name: 'Incidentes' })).getByText('2')).toBeInTheDocument();
    expect(within(within(aside).getByRole('button', { name: 'Cenários e massa' })).queryByText('!')).toBeNull();
  });

  it('recolhido: some o texto, mas o nome continua acessível e o título do grupo vira "·"', () => {
    const { aside } = montar({ recolhido: true });
    expect(aside).toHaveAttribute('data-recolhido', 'true');
    expect(within(aside).queryByText('Kanban')).toBeNull();
    expect(within(aside).getByRole('button', { name: 'Kanban' })).toHaveAttribute('title', 'Kanban');
    expect(within(aside).queryByText('Qualidade')).toBeNull();
    expect(within(aside).getAllByText('·')).toHaveLength(5);
  });

  it('o botão de recolher muda de nome conforme o estado e avisa o clique', async () => {
    const aberto = montar();
    await userEvent.click(within(aberto.aside).getByRole('button', { name: 'Recolher menu' }));
    expect(aberto.props.onAlternarRecolhido).toHaveBeenCalledTimes(1);
  });

  it('recolhido, o botão vira "Expandir menu"', () => {
    const { aside } = montar({ recolhido: true });
    expect(within(aside).getByRole('button', { name: 'Expandir menu' })).toBeInTheDocument();
  });

  it('o botão de lado diz para onde o menu vai e avisa o clique', async () => {
    const esquerda = montar({ lado: 'esquerda' });
    expect(esquerda.aside).toHaveAttribute('data-lado', 'esquerda');
    await userEvent.click(within(esquerda.aside).getByRole('button', { name: 'Mover menu para a direita' }));
    expect(esquerda.props.onAlternarLado).toHaveBeenCalledTimes(1);
  });

  it('no lado direito, o botão oferece mover para a esquerda', () => {
    const { aside } = montar({ lado: 'direita' });
    expect(aside).toHaveAttribute('data-lado', 'direita');
    expect(within(aside).getByRole('button', { name: 'Mover menu para a esquerda' })).toBeInTheDocument();
  });
});
