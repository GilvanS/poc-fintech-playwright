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

  const painelDe = (aside: HTMLElement, grupo: string) => within(aside).getByRole('group', { name: `Sub-opções de ${grupo}` });

  it('recolhido (trilho): um ícone por grupo; o grupo da tela ativa vem aberto, com as sub-opções descendo na própria coluna', () => {
    const { aside } = montar({ recolhido: true, ativo: 'kanban' });
    expect(aside).toHaveAttribute('data-recolhido', 'true');
    expect(within(aside).getByRole('button', { name: 'Grupo Planos & Testes' })).toHaveAttribute('aria-expanded', 'true');
    expect(painelDe(aside, 'Planos & Testes')).not.toHaveClass('hidden');
    for (const grupo of ['Planejamento', 'Qualidade', 'Minhas visões', 'Massa & Sistema']) {
      expect(within(aside).getByRole('button', { name: `Grupo ${grupo}` })).toHaveAttribute('aria-expanded', 'false');
      expect(painelDe(aside, grupo)).toHaveClass('hidden');
    }
    // A sub-opção da tela ativa é o círculo verde; as outras ficam sem fundo.
    expect(within(aside).getByRole('button', { name: 'Kanban' })).toHaveClass('bg-volt-green', 'rounded-full');
    expect(within(aside).getByRole('button', { name: 'Lista' })).not.toHaveClass('bg-volt-green');
    expect(aside.querySelector('.fixed')).toBeNull(); // nada abre por cima da tela
  });

  it('recolhido: o ícone do grupo abre e fecha as sub-opções na coluna; escolher uma avisa a chave e o grupo continua aberto', async () => {
    const { aside, props } = montar({ recolhido: true });
    const qualidade = within(aside).getByRole('button', { name: 'Grupo Qualidade' });
    await userEvent.click(qualidade);
    expect(qualidade).toHaveAttribute('aria-expanded', 'true');
    expect(painelDe(aside, 'Qualidade')).not.toHaveClass('hidden');
    expect(painelDe(aside, 'Planos & Testes')).not.toHaveClass('hidden'); // abrir um grupo não fecha os outros

    await userEvent.click(within(painelDe(aside, 'Qualidade')).getByRole('button', { name: 'Release' }));
    expect(props.onSelecionar).toHaveBeenCalledWith('release');
    expect(painelDe(aside, 'Qualidade')).not.toHaveClass('hidden');

    await userEvent.click(qualidade);
    expect(painelDe(aside, 'Qualidade')).toHaveClass('hidden');
  });

  it('recolhido: o nome aparece numa dica ao passar o mouse (grupo e sub-opção); o selo dos INC fica no grupo fechado e no ícone quando aberto', async () => {
    const { aside } = montar({ recolhido: true, selos: { incidentes: '3' } });
    expect(screen.queryByRole('tooltip')).toBeNull();
    const grupo = within(aside).getByRole('button', { name: 'Grupo Qualidade' });
    expect(within(grupo).getByText('3')).toBeInTheDocument(); // fechado: o selo vai no ícone do grupo
    await userEvent.hover(grupo);
    expect(screen.getByRole('tooltip')).toHaveTextContent('Qualidade');
    await userEvent.unhover(grupo);
    expect(screen.queryByRole('tooltip')).toBeNull();

    await userEvent.click(grupo); // aberto: o selo passa para o ícone de Incidentes
    expect(within(grupo).queryByText('3')).toBeNull();
    const incidentes = within(painelDe(aside, 'Qualidade')).getByRole('button', { name: 'Incidentes' });
    expect(within(incidentes).getByText('3')).toBeInTheDocument();
    await userEvent.hover(incidentes);
    expect(screen.getByRole('tooltip')).toHaveTextContent('Incidentes');
  });

  it('menu aberto: o grupo da tela ativa vem aberto, a seta abre e fecha os outros e a sub-opção ativa leva o sublinhado', async () => {
    const { aside } = montar({ ativo: 'release' });
    const qualidade = within(aside).getByRole('button', { name: 'Grupo Qualidade' });
    const planejamento = within(aside).getByRole('button', { name: 'Grupo Planejamento' });
    expect(qualidade).toHaveAttribute('aria-expanded', 'true');
    expect(planejamento).toHaveAttribute('aria-expanded', 'false');
    expect(within(aside).getByRole('button', { name: 'Release' })).toHaveClass('border-volt-green');

    await userEvent.click(planejamento);
    expect(planejamento).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(qualidade);
    expect(qualidade).toHaveAttribute('aria-expanded', 'false');
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
