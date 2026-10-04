import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import TesteModal from '../src/pages/planos/TesteModal';
import { ErroApi } from '../src/pages/cenarios/clienteApi';
import type { CamposItem, ItemPlano } from '../src/pages/planos/clientePlanos';
import { renderComPessoas } from './ajudantes';
import { criarApiFalsa, item, pessoa, plano } from './apiFalsa';

const ct31 = () => item('CT03.1', { nome: 'Pagar valor total', idMassa: '0100', status: 'concluido', resultado: 'passou', dataPlanejada: '2026-10-02', dataExecucao: '2026-10-03' });
const ct32 = () =>
  item('CT03.2', {
    nome: 'Pagar valor mínimo',
    idMassa: '0483',
    cpf: '12345678909',
    passos: 'tests/features/faturas.feature#CT03.2',
    resultadoEsperado: 'Pagamento mínimo registrado',
    massaCompartilhadaCom: ['CT03.7'],
    responsavel: 'ana',
    prioridade: 'P2',
    estimativaMin: 30,
    observacoes: 'rodar de manhã',
  });
const ct41 = () => item('CT04.1', { nome: 'Bloquear cartão', funcionalidade: 'Cartões' });
const ct37 = () => item('CT03.7', { nome: 'Reenvio pgto mínimo', idMassa: '0483', cpf: '12345678909', dependeDe: ['CT03.2'], massaCompartilhadaCom: ['CT03.2'], bloqueadoPor: ['CT03.2'] });
const itens = (): ItemPlano[] => [ct31(), ct32(), ct41(), ct37()].map((i, p) => ({ ...i, posicao: p + 1 }));

interface Opcoes {
  inicio?: string;
  onSalvar?: (i: ItemPlano, campos: CamposItem) => Promise<void>;
  planosDoFalso?: ReturnType<typeof plano>[];
}

function Harness({
  inicio = 'CT03.2',
  lista = itens(),
  onSalvar,
  onTirar,
  onFechar,
}: {
  inicio?: string;
  lista?: ItemPlano[];
  onSalvar: Opcoes['onSalvar'];
  onTirar: (id: string) => void;
  onFechar: () => void;
}) {
  const [id, setId] = useState(inicio);
  return <TesteModal planoNome="28/09/26" itens={lista} idAtual={id} onTrocar={setId} onSalvar={onSalvar!} onTirar={onTirar} onFechar={onFechar} />;
}

function abrir(opcoes: Opcoes = {}) {
  const api = criarApiFalsa({
    planos: opcoes.planosDoFalso ?? [plano('pl_a', '28/09/26', itens()), plano('pl_b', '05/10/26', [ct32(), ct41()])],
  });
  vi.stubGlobal('fetch', api.falso);
  const props = { onSalvar: vi.fn(opcoes.onSalvar ?? (async () => {})), onTirar: vi.fn(), onFechar: vi.fn() };
  render(<Harness inicio={opcoes.inicio} {...props} />);
  return { api, ...props, modal: screen.getByRole('dialog', { name: 'Detalhe do teste' }) };
}

const salvar = () => screen.getByRole('button', { name: 'Salvar alterações' });

beforeEach(() => vi.unstubAllGlobals());
afterEach(() => vi.unstubAllGlobals());

describe('TesteModal — cabeçalho e navegação', () => {
  it('mostra ID, nome, status, plano e "n de m no plano"', () => {
    const { modal } = abrir();
    expect(within(modal).getByRole('heading', { name: 'CT03.2 · Pagar valor mínimo' })).toBeInTheDocument();
    expect(within(modal).getByTestId('status-atual')).toHaveTextContent('Agendado');
    expect(within(modal).getByText('Plano 28/09/26')).toBeInTheDocument();
    expect(within(modal).getByText('2 de 4 no plano')).toBeInTheDocument();
  });

  it('Anterior/Próximo percorrem os testes na ordem do plano; nas pontas ficam desabilitados', async () => {
    const { modal } = abrir();
    await userEvent.click(within(modal).getByRole('button', { name: 'Próximo' }));
    expect(within(modal).getByRole('heading', { name: 'CT04.1 · Bloquear cartão' })).toBeInTheDocument();
    expect(within(modal).getByText('3 de 4 no plano')).toBeInTheDocument();
    await userEvent.click(within(modal).getByRole('button', { name: 'Próximo' }));
    expect(within(modal).getByText('4 de 4 no plano')).toBeInTheDocument();
    expect(within(modal).getByRole('button', { name: 'Próximo' })).toBeDisabled();
    await userEvent.click(within(modal).getByRole('button', { name: 'Anterior' }));
    await userEvent.click(within(modal).getByRole('button', { name: 'Anterior' }));
    await userEvent.click(within(modal).getByRole('button', { name: 'Anterior' }));
    expect(within(modal).getByText('1 de 4 no plano')).toBeInTheDocument();
    expect(within(modal).getByRole('button', { name: 'Anterior' })).toBeDisabled();
  });

  it('teste que depende da massa de outro mostra "Aguardando CT03.2 passar"', () => {
    const { modal } = abrir({ inicio: 'CT03.7' });
    expect(within(modal).getByText('Aguardando CT03.2 passar')).toBeInTheDocument();
  });

  it('✕ e Esc fecham; "Tirar do plano" avisa quem abriu o modal', async () => {
    const { modal, onFechar, onTirar } = abrir();
    await userEvent.click(within(modal).getByRole('button', { name: 'Tirar do plano' }));
    expect(onTirar).toHaveBeenCalledWith('CT03.2');
    await userEvent.click(within(modal).getByRole('button', { name: 'Fechar' }));
    await userEvent.keyboard('{Escape}');
    expect(onFechar).toHaveBeenCalledTimes(2);
  });
});

describe('TesteModal — aba Geral', () => {
  it('mostra os campos de planejamento do teste', () => {
    const { modal } = abrir();
    expect(within(modal).getByRole('tab', { name: 'Geral' })).toHaveAttribute('aria-selected', 'true');
    expect(within(modal).getByLabelText('Status')).toHaveValue('agendado');
    expect(within(modal).getByLabelText('Prioridade')).toHaveValue('P2');
    expect(within(modal).getByLabelText('Responsável')).toHaveValue('ana');
    expect(within(modal).getByLabelText('Estimativa (min)')).toHaveValue(30);
    expect(within(modal).getByLabelText('Tempo real (min)')).toHaveValue(null);
    expect(within(modal).queryByLabelText('Resultado')).toBeNull();
  });

  it('salvar manda só o que mudou, numa única alteração', async () => {
    const { modal, onSalvar } = abrir();
    expect(salvar()).toBeDisabled();
    await userEvent.selectOptions(within(modal).getByLabelText('Status'), 'refinamento');
    await userEvent.selectOptions(within(modal).getByLabelText('Prioridade'), 'P1');
    const resp = within(modal).getByLabelText('Responsável');
    await userEvent.clear(resp);
    await userEvent.type(resp, 'bia');
    const est = within(modal).getByLabelText('Estimativa (min)');
    await userEvent.clear(est);
    await userEvent.type(est, '45');
    await userEvent.type(within(modal).getByLabelText('Tempo real (min)'), '40');
    await userEvent.click(salvar());
    expect(onSalvar).toHaveBeenCalledTimes(1);
    expect(onSalvar.mock.calls[0][0].idCenario).toBe('CT03.2');
    expect(onSalvar.mock.calls[0][1]).toEqual({ status: 'refinamento', prioridade: 'P1', responsavel: 'bia', estimativaMin: 45, tempoRealMin: 40 });
  });

  it('esvaziar um campo manda null (limpa no servidor)', async () => {
    const { modal, onSalvar } = abrir();
    await userEvent.clear(within(modal).getByLabelText('Responsável'));
    await userEvent.clear(within(modal).getByLabelText('Estimativa (min)'));
    await userEvent.selectOptions(within(modal).getByLabelText('Prioridade'), '');
    await userEvent.click(salvar());
    expect(onSalvar.mock.calls[0][1]).toEqual({ responsavel: null, estimativaMin: null, prioridade: null });
  });

  it('o resultado só aparece com o status "Concluído"', async () => {
    const { modal, onSalvar } = abrir();
    await userEvent.selectOptions(within(modal).getByLabelText('Status'), 'concluido');
    const resultado = within(modal).getByLabelText('Resultado');
    expect(resultado).toHaveValue('');
    await userEvent.selectOptions(resultado, 'falhou');
    await userEvent.click(salvar());
    expect(onSalvar.mock.calls[0][1]).toEqual({ status: 'concluido', resultado: 'falhou' });
  });

  it('teste já concluído mostra o resultado que ele tem', () => {
    const { modal } = abrir({ inicio: 'CT03.1' });
    expect(within(modal).getByLabelText('Resultado')).toHaveValue('passou');
  });
});

describe('TesteModal — responsável com a Equipe cadastrada', () => {
  function abrirComEquipe(lista: ItemPlano[], equipe = [pessoa('ana'), pessoa('bia'), pessoa('zeca', { ativa: false })]) {
    vi.stubGlobal('fetch', criarApiFalsa({ planos: [plano('pl_a', '28/09/26', lista)] }).falso);
    const props = { onSalvar: vi.fn(async (_item: ItemPlano, _campos: CamposItem) => {}), onTirar: vi.fn(), onFechar: vi.fn() };
    renderComPessoas(<Harness lista={lista} {...props} />, equipe);
    return { ...props, modal: screen.getByRole('dialog', { name: 'Detalhe do teste' }) };
  }

  it('vira um seletor com as pessoas ativas e manda o id da escolhida', async () => {
    const { modal, onSalvar } = abrirComEquipe(itens());
    const seletor = within(modal).getByLabelText('Responsável');
    expect(seletor).toHaveValue('ana');
    expect(within(seletor).getAllByRole('option').map((o) => o.textContent)).toEqual(['Sem responsável', 'Ana', 'Bia']);
    await userEvent.selectOptions(seletor, 'bia');
    await userEvent.click(salvar());
    expect(onSalvar.mock.calls[0][1]).toEqual({ responsavel: 'bia' });
  });

  it('"Sem responsável" limpa o campo', async () => {
    const { modal, onSalvar } = abrirComEquipe(itens());
    await userEvent.selectOptions(within(modal).getByLabelText('Responsável'), '');
    await userEvent.click(salvar());
    expect(onSalvar.mock.calls[0][1]).toEqual({ responsavel: null });
  });

  it('responsável que foi desativado continua aparecendo (com o nome) até alguém trocar', () => {
    const lista = itens().map((i) => (i.idCenario === 'CT03.2' ? { ...i, responsavel: 'zeca' } : i));
    const { modal } = abrirComEquipe(lista);
    const seletor = within(modal).getByLabelText('Responsável');
    expect(seletor).toHaveValue('zeca');
    expect(within(seletor).getByRole('option', { name: 'Zeca' })).toBeInTheDocument();
  });
});

describe('TesteModal — aba Cenário e Datas', () => {
  async function irParaCenario(inicio?: string) {
    const r = abrir({ inicio });
    await userEvent.click(within(r.modal).getByRole('tab', { name: 'Cenário e Datas' }));
    return r;
  }

  it('mostra o cenário, a massa e o CPF SEM máscara, com o aviso de que é dado fictício de teste', async () => {
    const { modal } = await irParaCenario();
    expect(within(modal).getByText('Pagar valor mínimo')).toBeInTheDocument();
    expect(within(modal).getByText('0483')).toBeInTheDocument();
    expect(within(modal).getByText('123.456.789-09')).toBeInTheDocument();
    expect(within(modal).queryByText(/\*\*\*/)).toBeNull();
    expect(within(modal).getByText('CPF fictício de massa de teste (não é dado real)')).toBeInTheDocument();
    expect(within(modal).getByText('= massa compartilhada com CT03.7')).toBeInTheDocument();
    expect(within(modal).getByText('tests/features/faturas.feature#CT03.2')).toBeInTheDocument();
    expect(within(modal).getByText('Pagamento mínimo registrado')).toBeInTheDocument();
    expect(within(modal).getByText('Nenhuma')).toBeInTheDocument(); // dependência
  });

  it('a dependência automática diz depois de quem o teste roda', async () => {
    const { modal } = await irParaCenario('CT03.7');
    expect(within(modal).getByText('Depois de CT03.2 (mesma massa)')).toBeInTheDocument();
  });

  it('sem massa nem CPF mostra traço, sem inventar nada', async () => {
    const { modal } = await irParaCenario('CT04.1');
    expect(within(modal).queryByText('CPF fictício de massa de teste (não é dado real)')).toBeNull();
    expect(within(modal).getAllByText('-').length).toBeGreaterThan(0);
  });

  it('datas e observações são editáveis e salvam só o que mudou', async () => {
    const { modal, onSalvar } = await irParaCenario();
    expect(within(modal).getByLabelText('Observações')).toHaveValue('rodar de manhã');
    fireEvent.change(within(modal).getByLabelText('Data planejada'), { target: { value: '2026-10-05' } });
    fireEvent.change(within(modal).getByLabelText('Data de execução'), { target: { value: '2026-10-06' } });
    const obs = within(modal).getByLabelText('Observações');
    await userEvent.clear(obs);
    await userEvent.type(obs, 'rodar à tarde');
    await userEvent.click(salvar());
    expect(onSalvar.mock.calls[0][1]).toEqual({ dataPlanejada: '2026-10-05', dataExecucao: '2026-10-06', observacoes: 'rodar à tarde' });
  });

  it('limpar a data manda null', async () => {
    const { modal, onSalvar } = await irParaCenario('CT03.1');
    fireEvent.change(within(modal).getByLabelText('Data planejada'), { target: { value: '' } });
    await userEvent.click(salvar());
    expect(onSalvar.mock.calls[0][1]).toEqual({ dataPlanejada: null });
  });
});

describe('TesteModal — alterações pendentes', () => {
  it('com alteração pendente a navegação trava até salvar ou descartar; "Descartar" volta aos valores salvos', async () => {
    const { modal } = abrir();
    await userEvent.type(within(modal).getByLabelText('Tempo real (min)'), '10');
    expect(within(modal).getByRole('button', { name: 'Próximo' })).toBeDisabled();
    expect(within(modal).getByRole('button', { name: 'Anterior' })).toBeDisabled();
    expect(within(modal).getByText('Salve ou descarte as alterações para trocar de teste')).toBeInTheDocument();

    await userEvent.click(within(modal).getByRole('button', { name: 'Descartar' }));
    expect(within(modal).getByLabelText('Tempo real (min)')).toHaveValue(null);
    expect(within(modal).getByRole('button', { name: 'Próximo' })).toBeEnabled();
    expect(salvar()).toBeDisabled();
  });

  it('salvou: aparece "Alterações salvas." e o botão volta a desabilitar', async () => {
    const { modal } = abrir();
    await userEvent.type(within(modal).getByLabelText('Tempo real (min)'), '10');
    await userEvent.click(salvar());
    expect(await within(modal).findByText('Alterações salvas.')).toBeInTheDocument();
    expect(salvar()).toBeDisabled();
  });

  it('recusa do servidor aparece no modal e a alteração continua pendente', async () => {
    const { modal } = abrir({
      onSalvar: async () => {
        throw new ErroApi(409, 'dependencia_pendente', ['Aguardando CT03.2 passar: CT03.7 usa a mesma massa e só pode andar depois.']);
      },
    });
    await userEvent.selectOptions(within(modal).getByLabelText('Status'), 'em_andamento');
    await userEvent.click(salvar());
    expect(await within(modal).findByRole('alert')).toHaveTextContent('Aguardando CT03.2 passar');
    expect(salvar()).toBeEnabled();
    expect(within(modal).getByLabelText('Status')).toHaveValue('em_andamento');
  });
});

describe('TesteModal — aba Histórico', () => {
  it('mostra o teste em cada plano onde aparece, com contagem na aba', async () => {
    const { modal } = abrir();
    const aba = await within(modal).findByRole('tab', { name: 'Histórico (2)' });
    await userEvent.click(aba);
    const linhas = within(modal).getAllByTestId(/^historico-/);
    expect(linhas.map((l) => l.getAttribute('data-testid'))).toEqual(['historico-pl_a', 'historico-pl_b']);
    expect(within(linhas[0]).getByText('28/09/26')).toBeInTheDocument();
    expect(within(linhas[1]).getByText('05/10/26')).toBeInTheDocument();
    expect(within(linhas[0]).getByText('Agendado')).toBeInTheDocument();
  });

  it('teste que só está num plano mostra uma linha', async () => {
    const { modal } = abrir({ inicio: 'CT03.7' });
    await userEvent.click(await within(modal).findByRole('tab', { name: 'Histórico (1)' }));
    expect(within(modal).getAllByTestId(/^historico-/)).toHaveLength(1);
  });
});
