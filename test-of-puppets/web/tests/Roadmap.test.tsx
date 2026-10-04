import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Roadmap from '../src/pages/roadmap/Roadmap';
import { criarApiFalsa, item, pessoa, plano } from './apiFalsa';
import { renderComPessoas } from './ajudantes';

// Hoje = sábado 03/10/2026; a janela mensal vai de 21/09 a 18/10.
const HOJE = '2026-10-03';
const equipe = [pessoa('ana'), pessoa('bia')];

const planoMaster = () =>
  plano(
    'pl_master',
    '28/09/26',
    [
      item('CT03.1', { nome: 'Pagar valor total', status: 'concluido', resultado: 'passou', dataPlanejada: '2026-09-28', dataExecucao: '2026-09-29', prioridade: 'P1', responsavel: 'ana' }),
      item('CT03.2', { nome: 'Pagar valor mínimo', status: 'em_andamento', dataPlanejada: '2026-10-02', responsavel: 'ana' }),
      item('CT03.3', { nome: 'Pagar valor parcial', dataPlanejada: '2026-10-06', responsavel: 'bia', estimativaMin: 30 }),
      item('CT04.4', { nome: 'Sem data ainda', responsavel: 'bia' }),
    ],
    { previsao: '2026-10-13' },
  );
const planoVazio = () => plano('pl_vazio', '05/10/26', []);

async function abrir(opcoes: { planos?: ReturnType<typeof planoMaster>[]; ir?: () => void } = {}) {
  const api = criarApiFalsa({ planos: opcoes.planos ?? [planoMaster(), planoVazio()], pessoas: equipe });
  vi.stubGlobal('fetch', api.falso);
  const onIrParaPlanos = opcoes.ir ?? vi.fn();
  renderComPessoas(<Roadmap hoje={HOJE} onIrParaPlanos={onIrParaPlanos} />, equipe);
  await screen.findByTestId('linha-plano-pl_master');
  return { api, onIrParaPlanos };
}

const linha = (id: string) => screen.getByTestId(id);
const dia = (linhaId: string, iso: string) => linha(linhaId).querySelector(`[data-dia="${iso}"]`) as HTMLElement;
const barra = (nome: RegExp | string) => screen.getByRole('button', { name: nome });
const arrastar = (origem: HTMLElement, destino: HTMLElement) => {
  fireEvent.dragStart(origem);
  fireEvent.drop(destino);
};

beforeEach(() => vi.unstubAllGlobals());
afterEach(() => vi.unstubAllGlobals());

describe('Roadmap — grade', () => {
  it('mostra o período, os planos e as barras de cada teste com o estado certo', async () => {
    await abrir();
    expect(screen.getByRole('heading', { level: 2, name: 'Roadmap' })).toBeInTheDocument();
    expect(screen.getByTestId('periodo')).toHaveTextContent('set–out/2026');
    expect(linha('linha-plano-pl_master')).toHaveTextContent('Plano 28/09/26');
    expect(linha('linha-plano-pl_vazio')).toHaveTextContent('Plano 05/10/26');
    expect(barra('CT03.1: passou em 29/09/2026')).toHaveTextContent('ok');
    expect(barra('CT03.2: atrasado em 02/10/2026')).toBeInTheDocument();
    expect(barra('CT03.3: planejado em 06/10/2026')).toBeInTheDocument();
    expect(screen.getByTestId('linha-teste-pl_master-CT03.1')).toHaveTextContent('CT03.1P1Ana');
    expect(screen.getByText('(sem testes)')).toBeInTheDocument();
  });

  it('plano tem barra da criação até a previsão e o ◆ da previsão', async () => {
    await abrir();
    expect(barra('Abrir plano 28/09/26')).toBeInTheDocument();
    expect(barra('Previsão do plano 28/09/26: 13/10/2026')).toBeInTheDocument();
  });

  it('marca o dia de hoje e os fins de semana nas colunas', async () => {
    await abrir();
    expect(dia('linha-plano-pl_master', HOJE).className).toContain('border-volt-green');
    expect(dia('linha-plano-pl_master', '2026-10-04').className).toContain('bg-white/[0.04]');
    expect(dia('linha-plano-pl_master', '2026-10-05').className).not.toContain('bg-white/[0.04]');
  });

  it('teste sem data não tem barra: vai para a faixa "Sem data" e abre o detalhe', async () => {
    await abrir();
    const faixa = screen.getByTestId('sem-data-pl_master');
    expect(faixa).toHaveTextContent('Sem data (1)');
    expect(screen.queryByTestId('linha-teste-pl_master-CT04.4')).toBeNull();
    await userEvent.click(within(faixa).getByRole('button', { name: 'Definir data de CT04.4' }));
    expect(await screen.findByRole('dialog', { name: 'Detalhe do teste' })).toBeInTheDocument();
  });

  it('recolher o plano esconde os testes e expandir traz de volta', async () => {
    await abrir();
    await userEvent.click(screen.getByRole('button', { name: 'Recolher plano 28/09/26' }));
    expect(screen.queryByTestId('linha-teste-pl_master-CT03.1')).toBeNull();
    expect(screen.queryByTestId('sem-data-pl_master')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Expandir plano 28/09/26' }));
    expect(screen.getByTestId('linha-teste-pl_master-CT03.1')).toBeInTheDocument();
  });

  it('filtro de responsável mostra só os testes da pessoa', async () => {
    await abrir();
    await userEvent.selectOptions(screen.getByLabelText('Resp.'), 'bia');
    expect(screen.queryByTestId('linha-teste-pl_master-CT03.1')).toBeNull();
    expect(screen.getByTestId('linha-teste-pl_master-CT03.3')).toBeInTheDocument();
  });

  it('sem planos, avisa e oferece ir para Planos', async () => {
    const ir = vi.fn();
    const api = criarApiFalsa({ planos: [] });
    vi.stubGlobal('fetch', api.falso);
    renderComPessoas(<Roadmap hoje={HOJE} onIrParaPlanos={ir} />, equipe);
    await userEvent.click(await screen.findByRole('button', { name: 'Ir para Planos' }));
    expect(screen.getByText('Nenhum plano ainda.')).toBeInTheDocument();
    expect(ir).toHaveBeenCalled();
  });
});

describe('Roadmap — zoom e navegação', () => {
  it('Trimestral mostra semanas, a carga prevista por semana e não deixa arrastar', async () => {
    await abrir();
    await userEvent.click(screen.getByRole('button', { name: 'Trimestral' }));
    expect(screen.getByTestId('periodo')).toHaveTextContent('set–dez/2026');
    expect(screen.getByTestId('coluna-2026-09-28')).toHaveTextContent('S40');
    expect(within(screen.getByTestId('linha-carga')).getByText('30')).toBeInTheDocument();
    expect(barra('CT03.3: planejado em 06/10/2026')).toHaveAttribute('draggable', 'false');
    expect(screen.getByText(/use o zoom Mensal/)).toBeInTheDocument();
  });

  it('◀ ▶ andam no tempo e "Hoje" volta', async () => {
    await abrir();
    await userEvent.click(screen.getByRole('button', { name: 'Trimestral' }));
    await userEvent.click(screen.getByRole('button', { name: 'Próximo período' }));
    expect(screen.getByTestId('periodo')).toHaveTextContent('out–jan/2027');
    await userEvent.click(screen.getByRole('button', { name: 'Hoje' }));
    expect(screen.getByTestId('periodo')).toHaveTextContent('set–dez/2026');
    await userEvent.click(screen.getByRole('button', { name: 'Período anterior' }));
    expect(screen.getByTestId('periodo')).toHaveTextContent('ago–nov/2026');
  });

  it('barra que sai da janela some', async () => {
    await abrir();
    expect(screen.queryByRole('button', { name: /CT03.1: passou/ })).not.toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Próximo período' }));
    await userEvent.click(screen.getByRole('button', { name: 'Próximo período' }));
    expect(screen.queryByRole('button', { name: /CT03.1: passou/ })).toBeNull();
  });
});

describe('Roadmap — arrastar datas', () => {
  it('arrastar a barra do teste para outro dia grava a data planejada', async () => {
    const { api } = await abrir();
    arrastar(barra('CT03.3: planejado em 06/10/2026'), dia('linha-teste-pl_master-CT03.3', '2026-10-08'));
    await waitFor(() =>
      expect(api.escritas()).toContainEqual({ metodo: 'PATCH', caminho: '/api/planos/pl_master/testes/CT03.3', corpo: { versao: 1, dataPlanejada: '2026-10-08' } }),
    );
    await waitFor(() => expect(barra('CT03.3: planejado em 08/10/2026')).toBeInTheDocument());
  });

  it('fim de semana é recusado enquanto "Fins de semana" está desmarcado; marcando, grava', async () => {
    const { api } = await abrir();
    arrastar(barra('CT03.3: planejado em 06/10/2026'), dia('linha-teste-pl_master-CT03.3', '2026-10-10'));
    expect(screen.getByRole('alert')).toHaveTextContent('Fins de semana estão desligados');
    expect(api.escritas()).toEqual([]);

    await userEvent.click(screen.getByLabelText('Fins de semana'));
    arrastar(barra('CT03.3: planejado em 06/10/2026'), dia('linha-teste-pl_master-CT03.3', '2026-10-10'));
    await waitFor(() => expect(api.escritas()).toHaveLength(1));
    expect(api.escritas()[0].corpo).toEqual({ versao: 1, dataPlanejada: '2026-10-10' });
  });

  it('soltar no mesmo dia, ou na linha de outro plano, não grava nada', async () => {
    const { api } = await abrir();
    arrastar(barra('CT03.3: planejado em 06/10/2026'), dia('linha-teste-pl_master-CT03.3', '2026-10-06'));
    arrastar(barra('CT03.3: planejado em 06/10/2026'), dia('linha-plano-pl_vazio', '2026-10-08'));
    expect(api.escritas()).toEqual([]);
  });

  it('teste concluído não pode ser arrastado', async () => {
    await abrir();
    expect(barra('CT03.1: passou em 29/09/2026')).toHaveAttribute('draggable', 'false');
    expect(barra('CT03.2: atrasado em 02/10/2026')).toHaveAttribute('draggable', 'true');
  });

  it('arrastar o ◆ do plano muda a previsão', async () => {
    const { api } = await abrir();
    arrastar(barra('Previsão do plano 28/09/26: 13/10/2026'), dia('linha-plano-pl_master', '2026-10-15'));
    await waitFor(() => expect(api.escritas()).toContainEqual({ metodo: 'PATCH', caminho: '/api/planos/pl_master', corpo: { versao: 1, previsao: '2026-10-15' } }));
    await waitFor(() => expect(barra('Previsão do plano 28/09/26: 15/10/2026')).toBeInTheDocument());
  });

  it('se o servidor recusar a data (regra da dependência), mostra o motivo e relê o plano', async () => {
    const api = criarApiFalsa({ planos: [planoMaster()], pessoas: equipe });
    vi.stubGlobal('fetch', async (entrada: RequestInfo | URL, init?: RequestInit) =>
      init?.method === 'PATCH' && String(entrada).includes('/testes/')
        ? new Response(JSON.stringify({ erro: 'data_antes_da_dependencia', mensagem: 'CT03.3 não pode ser planejado em 07/10/2026, antes de CT03.2.' }), { status: 409, headers: { 'content-type': 'application/json' } })
        : api.falso(entrada, init),
    );
    renderComPessoas(<Roadmap hoje={HOJE} onIrParaPlanos={vi.fn()} />, equipe);
    await screen.findByTestId('linha-plano-pl_master');
    arrastar(barra('CT03.3: planejado em 06/10/2026'), dia('linha-teste-pl_master-CT03.3', '2026-10-07'));
    expect(await screen.findByRole('alert')).toHaveTextContent('antes de CT03.2');
    expect(barra('CT03.3: planejado em 06/10/2026')).toBeInTheDocument();
  });
});

describe('Roadmap — abrir', () => {
  it('clicar na barra do teste abre o detalhe do teste; clicar na do plano abre o plano', async () => {
    await abrir();
    await userEvent.click(barra('CT03.3: planejado em 06/10/2026'));
    const teste = await screen.findByRole('dialog', { name: 'Detalhe do teste' });
    expect(teste).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    await userEvent.click(barra('Abrir plano 28/09/26'));
    expect(await screen.findByRole('dialog', { name: 'Detalhe do plano' })).toBeInTheDocument();
  });
});
