import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Iteracoes from '../src/pages/iteracoes/Iteracoes';
import { cenario, criarApiFalsa, item, pessoa, plano } from './apiFalsa';
import { renderComPessoas } from './ajudantes';

// Hoje = sexta 02/10/2026: dia 5 de 12 da iteração 28/09 → 13/10.
const HOJE = '2026-10-02';
const equipe = [pessoa('ana', { capacidadeMinSemana: 120 }), pessoa('bia', { capacidadeMinSemana: 90 }), pessoa('carlos', { capacidadeMinSemana: 60 })];
const meta = (criado: string, previsao: string) => ({ criadoEm: `${criado}T12:00:00.000Z`, previsao });

const planoVelho = () =>
  plano(
    'pl_velho',
    '14/09/26',
    [
      item('CT04.3', { status: 'concluido', resultado: 'passou', prioridade: 'P1', estimativaMin: 20, tempoRealMin: 26 }),
      ...[20, 20, 20, 25, 25].map((m, i) => item(`CT9${i}`, { status: 'concluido', resultado: 'passou', estimativaMin: m, tempoRealMin: 26 })),
    ],
    meta('2026-09-14', '2026-09-25'),
  );
const planoAtual = () =>
  plano(
    'pl_atual',
    '28/09/26',
    [
      item('CT1', { status: 'concluido', resultado: 'passou', dataExecucao: '2026-09-29', estimativaMin: 20, tempoRealMin: 25 }),
      item('CT2', { status: 'concluido', resultado: 'passou', dataExecucao: '2026-09-30', estimativaMin: 30, tempoRealMin: 40 }),
      item('CT3', { status: 'concluido', resultado: 'falhou', dataExecucao: '2026-10-02', estimativaMin: 25 }),
      ...['CT4', 'CT5', 'CT6', 'CT7', 'CT8'].map((id) => item(id, { estimativaMin: 20 })),
    ],
    meta('2026-09-28', '2026-10-13'),
  );
const planoProx = () => plano('pl_prox', '05/10/26', [], meta('2026-10-05', '2026-10-20'));
const catalogo = () => [
  cenario('CT06.1', { idMassa: '0530', nome: 'Bloquear cartão', funcionalidade: 'Cartão' }),
  cenario('CT04.3', { nome: 'Cancelar Pix', funcionalidade: 'Pix' }),
  ...[1, 2, 3, 4, 5].map((n) => cenario(`CT07.${n}`)),
];

async function abrir(opcoes: { planos?: ReturnType<typeof planoAtual>[]; ir?: () => void; recusar?: boolean } = {}) {
  const api = criarApiFalsa({ planos: opcoes.planos ?? [planoVelho(), planoAtual(), planoProx()], cenarios: catalogo(), pessoas: equipe, recusarInclusao: opcoes.recusar });
  vi.stubGlobal('fetch', api.falso);
  const onIrParaPlanos = opcoes.ir ?? vi.fn();
  renderComPessoas(<Iteracoes hoje={HOJE} onIrParaPlanos={onIrParaPlanos} />, equipe);
  await screen.findByRole('heading', { name: /^Burndown/ });
  return { api, onIrParaPlanos };
}

const card = (papel: string) => screen.getByTestId(`iteracao-${papel}`);
const arrastar = (origem: HTMLElement, destino: HTMLElement) => {
  fireEvent.dragStart(origem);
  fireEvent.drop(destino);
};

beforeEach(() => vi.unstubAllGlobals());
afterEach(() => vi.unstubAllGlobals());

describe('Iterações — cards', () => {
  it('anterior: concluídos, estimado, real e a variação em %', async () => {
    await abrir();
    const c = card('anterior');
    expect(within(c).getByRole('heading', { name: 'Plano 14/09/26' })).toBeInTheDocument();
    expect(c).toHaveTextContent('14/09 → 25/09');
    expect(c).toHaveTextContent('6 de 6 concluídos');
    expect(c).toHaveTextContent('Estimado 130 min');
    expect(c).toHaveTextContent('Real 156 min (+20%)');
  });

  it('atual: dia do período em dias úteis, concluídos, estimado e real até agora', async () => {
    await abrir();
    const c = card('atual');
    expect(within(c).getByRole('heading', { name: 'Plano 28/09/26' })).toBeInTheDocument();
    expect(c).toHaveTextContent('28/09 → 13/10');
    expect(c).toHaveTextContent('dia 5 de 12');
    expect(c).toHaveTextContent('3 de 8 concluídos');
    expect(c).toHaveTextContent('Estimado 175 min');
    expect(c).toHaveTextContent('Real até agora 65 min');
  });

  it('próxima: sem testes e com a capacidade da equipe no período', async () => {
    await abrir();
    const c = card('proxima');
    expect(c).toHaveTextContent('05/10 → 20/10');
    expect(c).toHaveTextContent('0 testes');
    expect(c).toHaveTextContent('Capacidade 648 min');
  });

  it('sem próxima iteração, o card avisa e oferece criar', async () => {
    const ir = vi.fn();
    await abrir({ planos: [planoAtual()], ir });
    const aviso = screen.getByRole('region', { name: 'Iteração próxima' });
    expect(aviso).toHaveTextContent('Nenhuma iteração planejada.');
    await userEvent.click(within(aviso).getByRole('button', { name: '+ Criar a próxima iteração' }));
    expect(ir).toHaveBeenCalled();
  });

  it('"Abrir plano" abre o detalhe; "Nova iteração" leva a Planos', async () => {
    const { onIrParaPlanos } = await abrir();
    await userEvent.click(within(card('atual')).getByRole('button', { name: 'Abrir plano' }));
    expect(await screen.findByRole('dialog', { name: 'Detalhe do plano' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('button', { name: 'Nova iteração' }));
    expect(onIrParaPlanos).toHaveBeenCalled();
  });

  it('sem nenhum plano, diz que cada plano é uma iteração', async () => {
    const ir = vi.fn();
    const api = criarApiFalsa({ planos: [] });
    vi.stubGlobal('fetch', api.falso);
    renderComPessoas(<Iteracoes hoje={HOJE} onIrParaPlanos={ir} />, equipe);
    await userEvent.click(await screen.findByRole('button', { name: 'Ir para Planos' }));
    expect(screen.getByText(/cada plano é uma iteração/)).toBeInTheDocument();
    expect(ir).toHaveBeenCalled();
  });
});

describe('Iterações — burndown e velocidade', () => {
  it('mostra o burndown da iteração atual, a projeção no ritmo e a velocidade média', async () => {
    await abrir();
    expect(await screen.findByRole('heading', { name: 'Burndown — testes restantes (plano 28/09/26)' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Burndown do plano 28/09/26: 8 testes no início, 5 restantes hoje' })).toBeInTheDocument();
    expect(screen.getByTestId('burndown-real').getAttribute('points')?.split(' ')).toHaveLength(5);
    expect(screen.getByTestId('burndown-ideal').getAttribute('points')?.split(' ')).toHaveLength(12);
    expect(screen.getByTestId('projecao')).toHaveTextContent('Projeção no ritmo atual (0,6 teste/dia): termina ~15/10 (2 dias úteis após o alvo)');
    expect(screen.getByTestId('velocidade')).toHaveTextContent('Velocidade média: 6 testes/iteração');
  });

  it('trocar a iteração do gráfico: encerrada não projeta; vazia explica que não há burndown', async () => {
    await abrir();
    await userEvent.selectOptions(screen.getByLabelText('Iteração'), 'pl_velho');
    expect(screen.getByRole('heading', { name: 'Burndown — testes restantes (plano 14/09/26)' })).toBeInTheDocument();
    expect(screen.queryByTestId('projecao')).toBeNull();
    await userEvent.selectOptions(screen.getByLabelText('Iteração'), 'pl_prox');
    expect(screen.getByText(/Burndown indisponível: a iteração 05\/10\/26 ainda não tem testes/)).toBeInTheDocument();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('sem nenhuma iteração encerrada, a velocidade diz isso', async () => {
    await abrir({ planos: [planoAtual(), planoProx()] });
    expect(screen.getByTestId('velocidade')).toHaveTextContent('Velocidade média: sem iterações encerradas');
  });

  it('avisa quando há concluído sem data de execução', async () => {
    const semData = plano('pl_atual', '28/09/26', [item('A', { status: 'concluido', resultado: 'passou' }), item('B')], meta('2026-09-28', '2026-10-13'));
    await abrir({ planos: [semData] });
    expect(await screen.findByText('1 teste(s) concluído(s) sem data de execução contam só a partir de hoje.')).toBeInTheDocument();
  });
});

describe('Iterações — backlog', () => {
  it('lista o catálogo fora de plano aberto, por prioridade, 5 de cada vez', async () => {
    await abrir();
    expect(await screen.findByRole('heading', { name: 'Backlog priorizado (7)' })).toBeInTheDocument();
    expect(screen.getAllByTestId(/^backlog-/).map((e) => e.getAttribute('data-testid'))).toEqual(['backlog-CT04.3', 'backlog-CT06.1', 'backlog-CT07.1', 'backlog-CT07.2', 'backlog-CT07.3']);
    expect(screen.getByTestId('backlog-CT04.3')).toHaveTextContent('P1');
    expect(screen.getByTestId('backlog-CT04.3')).toHaveTextContent('20m');
    expect(screen.getByTestId('backlog-CT06.1')).toHaveTextContent('Cartão · Bloquear cartão');
    expect(screen.getByTestId('backlog-CT06.1')).toHaveTextContent('0530');
    await userEvent.click(screen.getByRole('button', { name: /mais 2 · Ver todos/ }));
    expect(screen.getAllByTestId(/^backlog-/)).toHaveLength(7);
  });

  it('"Mover" leva para a próxima iteração por padrão e o item sai do backlog', async () => {
    const { api } = await abrir();
    await userEvent.click(await screen.findByRole('button', { name: 'Mover CT04.3' }));
    await waitFor(() => expect(api.escritas()).toContainEqual({ metodo: 'POST', caminho: '/api/planos/pl_prox/testes', corpo: { idCenarios: ['CT04.3'] } }));
    await waitFor(() => expect(screen.queryByTestId('backlog-CT04.3')).toBeNull());
    expect(screen.getByRole('heading', { name: 'Backlog priorizado (6)' })).toBeInTheDocument();
    expect(card('proxima')).toHaveTextContent('0 de 1 concluídos');
  });

  it('arrastar o item para o card da próxima iteração inclui no plano; no anterior não faz nada', async () => {
    const { api } = await abrir();
    arrastar(await screen.findByTestId('backlog-CT06.1'), card('anterior'));
    expect(api.escritas()).toEqual([]);
    arrastar(screen.getByTestId('backlog-CT06.1'), card('proxima'));
    await waitFor(() => expect(api.escritas()).toContainEqual({ metodo: 'POST', caminho: '/api/planos/pl_prox/testes', corpo: { idCenarios: ['CT06.1'] } }));
  });

  it('para a iteração em andamento, avisa que aumenta o escopo; só inclui depois de confirmar', async () => {
    const { api } = await abrir();
    arrastar(await screen.findByTestId('backlog-CT04.3'), card('atual'));
    const aviso = screen.getByRole('alertdialog', { name: 'Aumentar o escopo' });
    expect(aviso).toHaveTextContent('Adicionar à iteração em andamento aumenta o escopo (+20 min).');
    expect(api.escritas()).toEqual([]);
    await userEvent.click(within(aviso).getByRole('button', { name: 'Adicionar mesmo assim' }));
    await waitFor(() => expect(api.escritas()).toContainEqual({ metodo: 'POST', caminho: '/api/planos/pl_atual/testes', corpo: { idCenarios: ['CT04.3'] } }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('Cancelar e Esc fecham o aviso sem incluir; escolher "Atual" em "Mover para" também pede confirmação', async () => {
    const { api } = await abrir();
    await userEvent.selectOptions(await screen.findByLabelText('Mover para'), 'pl_atual');
    await userEvent.click(screen.getByRole('button', { name: 'Mover CT06.1' }));
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Mover CT06.1' }));
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(api.escritas()).toEqual([]);
  });

  it('se o servidor recusar a inclusão, mostra o motivo', async () => {
    await abrir({ recusar: true });
    await userEvent.click(await screen.findByRole('button', { name: 'Mover CT04.3' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('não pode ser planejado');
  });

  it('sem iteração aberta, "Mover" fica desabilitado', async () => {
    await abrir({ planos: [planoVelho()] });
    expect(await screen.findByRole('button', { name: 'Mover CT06.1' })).toBeDisabled();
  });
});
