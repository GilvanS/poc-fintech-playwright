import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Planejamento from '../src/pages/planejamento/Planejamento';
import { criarApiFalsa, item, pessoa, plano } from './apiFalsa';
import { renderComPessoas } from './ajudantes';

// Hoje = segunda-feira 05/10/2026; a semana mostrada é 05/10 – 09/10.
const HOJE = '2026-10-05';
const equipe = [
  pessoa('ana', { capacidadeMinSemana: 120 }),
  pessoa('bia', { capacidadeMinSemana: 90 }),
  pessoa('carlos', { capacidadeMinSemana: 60 }),
];

const planoA = () =>
  plano('pl_a', '05/10/26', [
    item('CT01.1', { status: 'concluido', resultado: 'passou', responsavel: 'ana', dataPlanejada: '2026-10-05', estimativaMin: 10 }),
    item('CT03.3', { responsavel: 'bia', dataPlanejada: '2026-10-05', estimativaMin: 25, prioridade: 'P2' }),
    item('CT03.7', { responsavel: 'bia', dataPlanejada: '2026-10-06', estimativaMin: 30, prioridade: 'P2' }),
    item('CT04.1', { responsavel: 'carlos', dataPlanejada: '2026-10-07', estimativaMin: 20, prioridade: 'P1' }),
    item('CT04.2', { responsavel: 'carlos', dataPlanejada: '2026-10-08', estimativaMin: 25, prioridade: 'P2' }),
    item('CT04.4', { dataPlanejada: '2026-10-09', estimativaMin: 25, prioridade: 'P2' }),
    item('CT04.9', { responsavel: 'bia', dataPlanejada: '2026-10-10' }),
    item('CT06.1', { prioridade: 'P1', estimativaMin: 20, nome: 'Bloquear cartão', funcionalidade: 'Cartão', idMassa: '0530' }),
    item('CT04.3', { prioridade: 'P1', estimativaMin: 20 }),
    item('CT04.5', { prioridade: 'P2', estimativaMin: 25 }),
    item('CT03.4', { prioridade: 'P2', estimativaMin: 30 }),
    item('CT05.3', { prioridade: 'P3', estimativaMin: 15 }),
    item('CT05.4', { prioridade: 'P3', estimativaMin: 15 }),
    item('CT05.5', { prioridade: 'P3', estimativaMin: 15 }),
  ]);

async function abrir(ir = vi.fn()) {
  const api = criarApiFalsa({ planos: [planoA()], pessoas: equipe });
  vi.stubGlobal('fetch', api.falso);
  renderComPessoas(<Planejamento hoje={HOJE} onIrParaEquipe={ir} />, equipe);
  await screen.findByTestId('linha-pessoa-ana');
  return { api, ir };
}

const celula = (pessoaId: string, dia: string) => screen.getByTestId(`celula-${pessoaId}-${dia}`);
const chip = (id: string) => screen.getByRole('button', { name: new RegExp(`^${id.replace('.', '\\.')}: `) });
const arrastar = (origem: HTMLElement, destino: HTMLElement) => {
  fireEvent.dragStart(origem);
  fireEvent.drop(destino);
};

beforeEach(() => vi.unstubAllGlobals());
afterEach(() => vi.unstubAllGlobals());

describe('Planejamento — semana', () => {
  it('mostra a semana de segunda a sexta, uma linha por pessoa e "Sem dono"', async () => {
    await abrir();
    expect(screen.getByRole('heading', { level: 2, name: 'Planejamento' })).toBeInTheDocument();
    expect(screen.getByTestId('semana')).toHaveTextContent('Semana 05/10 – 09/10/2026');
    expect(screen.getByTestId('dia-2026-10-05')).toHaveTextContent('Seg 05/10');
    expect(screen.getByTestId('dia-2026-10-09')).toHaveTextContent('Sex 09/10');
    expect(screen.queryByTestId('dia-2026-10-10')).toBeNull();
    for (const id of ['ana', 'bia', 'carlos', '__sem']) expect(screen.getByTestId(`linha-pessoa-${id}`)).toBeInTheDocument();
  });

  it('os testes aparecem como chips no dia e na pessoa certos, com os minutos', async () => {
    await abrir();
    expect(within(celula('bia', '2026-10-05')).getByRole('button', { name: 'CT03.3: 25 min' })).toHaveTextContent('[P2]');
    expect(within(celula('carlos', '2026-10-07')).getByRole('button', { name: 'CT04.1: 20 min' })).toBeInTheDocument();
    expect(within(celula('__sem', '2026-10-09')).getByRole('button', { name: 'CT04.4: 25 min' })).toBeInTheDocument();
  });

  it('uso/capacidade por pessoa; sem dono mostra só os minutos', async () => {
    await abrir();
    expect(screen.getByTestId('uso-ana')).toHaveTextContent('10/120 min');
    expect(screen.getByTestId('uso-bia')).toHaveTextContent('55/90 min');
    expect(screen.getByTestId('uso-carlos')).toHaveTextContent('45/60 min');
    expect(screen.getByTestId('uso-__sem')).toHaveTextContent('25 min');
  });

  it('barras de capacidade, disponível e total da equipe', async () => {
    await abrir();
    const bia = screen.getByTestId('capacidade-bia');
    expect(within(bia).getByText('55 de 90 min')).toBeInTheDocument();
    expect(within(bia).getByText('disponível: 35 min')).toBeInTheDocument();
    expect(within(bia).getByRole('progressbar', { name: 'Capacidade de Bia' })).toHaveAttribute('aria-valuenow', '61');
    expect(screen.getByTestId('capacidade-equipe')).toHaveTextContent('Equipe 135 de 270 min (50%)');
  });

  it('avisa do teste sem responsável', async () => {
    await abrir();
    expect(screen.getByText(/1 teste\(s\) sem responsável/)).toBeInTheDocument();
  });

  it('teste sem estimativa mostra "?" e conta 0', async () => {
    await abrir();
    await userEvent.click(screen.getByLabelText('Mostrar fins de semana'));
    expect(within(celula('bia', '2026-10-10')).getByRole('button', { name: 'CT04.9: sem estimativa' })).toHaveTextContent('?');
    expect(screen.getByTestId('uso-bia')).toHaveTextContent('55/90 min');
  });

  it('fins de semana: escondidos por padrão com aviso; ligar mostra Sáb/Dom', async () => {
    await abrir();
    expect(screen.getByText(/1 teste\(s\) planejado\(s\) no fim de semana/)).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Mostrar fins de semana'));
    expect(screen.getByTestId('dia-2026-10-10')).toHaveTextContent('Sáb 10/10');
    expect(screen.getByTestId('dia-2026-10-11')).toHaveTextContent('Dom 11/10');
    expect(screen.queryByText(/planejado\(s\) no fim de semana/)).toBeNull();
    expect(screen.getByTestId('semana')).toHaveTextContent('05/10 – 11/10/2026');
  });

  it('◀ ▶ andam de semana em semana e "Esta semana" volta', async () => {
    await abrir();
    await userEvent.click(screen.getByRole('button', { name: 'Próxima semana' }));
    expect(screen.getByTestId('semana')).toHaveTextContent('12/10 – 16/10/2026');
    expect(screen.queryByRole('button', { name: 'CT03.3: 25 min' })).toBeNull();
    expect(screen.getByTestId('uso-bia')).toHaveTextContent('0/90 min');
    await userEvent.click(screen.getByRole('button', { name: 'Semana anterior' }));
    await userEvent.click(screen.getByRole('button', { name: 'Semana anterior' }));
    expect(screen.getByTestId('semana')).toHaveTextContent('28/09 – 02/10/2026');
    await userEvent.click(screen.getByRole('button', { name: 'Esta semana' }));
    expect(screen.getByTestId('semana')).toHaveTextContent('05/10 – 09/10/2026');
  });

  it('filtro de pessoa mostra só a linha dela', async () => {
    await abrir();
    await userEvent.selectOptions(screen.getByLabelText('Pessoas'), 'bia');
    expect(screen.getByTestId('linha-pessoa-bia')).toBeInTheDocument();
    expect(screen.queryByTestId('linha-pessoa-ana')).toBeNull();
    expect(screen.queryByTestId('linha-pessoa-__sem')).toBeNull();
  });

  it('"Equipe e capacidade" leva à tela Equipe', async () => {
    const { ir } = await abrir();
    await userEvent.click(screen.getByRole('button', { name: 'Equipe e capacidade' }));
    expect(ir).toHaveBeenCalled();
  });
});

describe('Planejamento — backlog', () => {
  it('lista os testes sem dia por prioridade, 5 de cada vez, com opção de ver todos', async () => {
    await abrir();
    const nomes = screen.getAllByTestId(/^backlog-/).map((e) => e.getAttribute('data-testid'));
    expect(nomes).toEqual(['backlog-CT04.3', 'backlog-CT06.1', 'backlog-CT03.4', 'backlog-CT04.5', 'backlog-CT05.3']);
    expect(screen.getByTestId('backlog-CT06.1')).toHaveTextContent('Cartão · Bloquear cartão');
    expect(screen.getByTestId('backlog-CT06.1')).toHaveTextContent('20m');
    expect(screen.getByTestId('backlog-CT06.1')).toHaveTextContent('0530');
    await userEvent.click(screen.getByRole('button', { name: /mais 2 · Ver todos/ }));
    expect(screen.getAllByTestId(/^backlog-/)).toHaveLength(7);
    await userEvent.click(screen.getByRole('button', { name: 'Ver menos' }));
    expect(screen.getAllByTestId(/^backlog-/)).toHaveLength(5);
  });
});

describe('Planejamento — arrastar', () => {
  it('backlog para o dia de uma pessoa grava o dia e o responsável', async () => {
    const { api } = await abrir();
    arrastar(screen.getByTestId('backlog-CT06.1'), celula('ana', '2026-10-07'));
    await waitFor(() =>
      expect(api.escritas()).toContainEqual({ metodo: 'PATCH', caminho: '/api/planos/pl_a/testes/CT06.1', corpo: { versao: 1, dataPlanejada: '2026-10-07', responsavel: 'ana' } }),
    );
    await waitFor(() => expect(within(celula('ana', '2026-10-07')).getByRole('button', { name: 'CT06.1: 20 min' })).toBeInTheDocument());
    expect(screen.queryByTestId('backlog-CT06.1')).toBeNull();
  });

  it('chip para outra pessoa reatribui e recalcula as duas linhas', async () => {
    const { api } = await abrir();
    arrastar(chip('CT04.1'), celula('ana', '2026-10-08'));
    await waitFor(() => expect(api.escritas()).toHaveLength(1));
    expect(api.escritas()[0].corpo).toEqual({ versao: 1, dataPlanejada: '2026-10-08', responsavel: 'ana' });
    await waitFor(() => expect(screen.getByTestId('uso-carlos')).toHaveTextContent('25/60 min'));
    expect(screen.getByTestId('uso-ana')).toHaveTextContent('30/120 min');
  });

  it('soltar no mesmo dia e na mesma pessoa não grava nada', async () => {
    const { api } = await abrir();
    arrastar(chip('CT03.3'), celula('bia', '2026-10-05'));
    expect(api.escritas()).toEqual([]);
  });

  it('teste concluído não pode ser arrastado', async () => {
    await abrir();
    expect(chip('CT01.1')).toHaveAttribute('draggable', 'false');
    expect(chip('CT03.3')).toHaveAttribute('draggable', 'true');
  });

  it('soltar na linha "Sem dono" tira o responsável', async () => {
    const { api } = await abrir();
    arrastar(chip('CT03.3'), celula('__sem', '2026-10-06'));
    await waitFor(() => expect(api.escritas()).toHaveLength(1));
    expect(api.escritas()[0].corpo).toEqual({ versao: 1, dataPlanejada: '2026-10-06', responsavel: null });
  });

  it('se o servidor recusar (regra da dependência), mostra o motivo', async () => {
    const api = criarApiFalsa({ planos: [planoA()], pessoas: equipe });
    vi.stubGlobal('fetch', async (entrada: RequestInfo | URL, init?: RequestInit) =>
      init?.method === 'PATCH'
        ? new Response(JSON.stringify({ erro: 'data_antes_da_dependencia', mensagem: 'CT04.1 não pode ser planejado antes de CT03.2.' }), { status: 409, headers: { 'content-type': 'application/json' } })
        : api.falso(entrada, init),
    );
    renderComPessoas(<Planejamento hoje={HOJE} onIrParaEquipe={vi.fn()} />, equipe);
    await screen.findByTestId('linha-pessoa-ana');
    arrastar(chip('CT04.1'), celula('carlos', '2026-10-06'));
    expect(await screen.findByRole('alert')).toHaveTextContent('antes de CT03.2');
  });

  it('clicar no chip abre o detalhe do teste', async () => {
    await abrir();
    await userEvent.click(chip('CT03.3'));
    expect(await screen.findByRole('dialog', { name: 'Detalhe do teste' })).toBeInTheDocument();
  });
});

describe('Planejamento — capacidade excedida', () => {
  async function estourar() {
    const ctx = await abrir();
    arrastar(screen.getByTestId('backlog-CT06.1'), celula('carlos', '2026-10-09'));
    return { ...ctx, aviso: await screen.findByRole('alertdialog', { name: 'Capacidade excedida' }) };
  }

  it('soltar além da capacidade pergunta antes e diz quem tem folga, do mais folgado para o menos', async () => {
    const { api, aviso } = await estourar();
    expect(within(aviso).getByText('Carlos ficaria com 65 min para 60 min de capacidade.')).toBeInTheDocument();
    expect(within(aviso).getByText(/Ana \(110 min\)\s+Bia \(35 min\)/)).toBeInTheDocument();
    expect(api.escritas()).toEqual([]);
  });

  it('"Colocar na Ana" grava com a pessoa que tem folga', async () => {
    const { api, aviso } = await estourar();
    await userEvent.click(within(aviso).getByRole('button', { name: 'Colocar na Ana' }));
    await waitFor(() => expect(api.escritas()).toHaveLength(1));
    expect(api.escritas()[0].corpo).toEqual({ versao: 1, dataPlanejada: '2026-10-09', responsavel: 'ana' });
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('"Manter no Carlos" grava mesmo assim e a linha fica como EXCEDEU', async () => {
    const { api, aviso } = await estourar();
    await userEvent.click(within(aviso).getByRole('button', { name: 'Manter no Carlos' }));
    await waitFor(() => expect(api.escritas()).toHaveLength(1));
    expect(api.escritas()[0].corpo).toEqual({ versao: 1, dataPlanejada: '2026-10-09', responsavel: 'carlos' });
    await waitFor(() => expect(screen.getByTestId('uso-carlos')).toHaveTextContent('EXCEDEU em 5 min'));
    expect(within(screen.getByTestId('capacidade-carlos')).getByText('EXCEDEU em 5 min')).toBeInTheDocument();
  });

  it('Cancelar e Esc fecham sem gravar', async () => {
    const { api, aviso } = await estourar();
    await userEvent.click(within(aviso).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();

    arrastar(screen.getByTestId('backlog-CT06.1'), celula('carlos', '2026-10-09'));
    await screen.findByRole('alertdialog');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(api.escritas()).toEqual([]);
  });

  it('mover dentro da própria semana de quem já estourou não pergunta de novo', async () => {
    const { api } = await abrir();
    arrastar(screen.getByTestId('backlog-CT06.1'), celula('carlos', '2026-10-09'));
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Manter no Carlos' }));
    await waitFor(() => expect(api.escritas()).toHaveLength(1));
    await waitFor(() => expect(within(celula('carlos', '2026-10-09')).getByRole('button', { name: 'CT06.1: 20 min' })).toBeInTheDocument());
    arrastar(chip('CT06.1'), celula('carlos', '2026-10-06'));
    await waitFor(() => expect(api.escritas()).toHaveLength(2));
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('sem ninguém com folga suficiente, o aviso diz isso e só sobram Manter e Cancelar', async () => {
    const pouca = [pessoa('ana', { capacidadeMinSemana: 15 }), pessoa('carlos', { capacidadeMinSemana: 60 })];
    const api = criarApiFalsa({ planos: [planoA()], pessoas: pouca });
    vi.stubGlobal('fetch', api.falso);
    renderComPessoas(<Planejamento hoje={HOJE} onIrParaEquipe={vi.fn()} />, pouca);
    await screen.findByTestId('linha-pessoa-ana');
    arrastar(screen.getByTestId('backlog-CT06.1'), celula('carlos', '2026-10-09'));
    const aviso = await screen.findByRole('alertdialog');
    expect(within(aviso).getByText('Ninguém tem folga suficiente nesta semana.')).toBeInTheDocument();
    expect(within(aviso).queryByRole('button', { name: /Colocar na/ })).toBeNull();
  });

  it('pessoa sem capacidade informada nunca estoura', async () => {
    const semCapacidade = [pessoa('ana'), pessoa('carlos', { capacidadeMinSemana: 60 })];
    const api = criarApiFalsa({ planos: [planoA()], pessoas: semCapacidade });
    vi.stubGlobal('fetch', api.falso);
    renderComPessoas(<Planejamento hoje={HOJE} onIrParaEquipe={vi.fn()} />, semCapacidade);
    await screen.findByTestId('linha-pessoa-ana');
    expect(screen.getByTestId('uso-ana')).toHaveTextContent('10 min');
    arrastar(screen.getByTestId('backlog-CT06.1'), celula('ana', '2026-10-07'));
    await waitFor(() => expect(api.escritas()).toHaveLength(1));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.getByTestId('capacidade-ana')).toHaveTextContent('capacidade não informada');
  });
});
