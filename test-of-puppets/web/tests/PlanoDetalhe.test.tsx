import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PlanoDetalhe from '../src/pages/planos/PlanoDetalhe';
import { cenario, criarApiFalsa, item, plano } from './apiFalsa';

const ct32 = () => item('CT03.2', { nome: 'Pagar valor mínimo', idMassa: '0483', massaCompartilhadaCom: ['CT03.7'] });
const ct37 = () => item('CT03.7', { nome: 'Reenvio pgto mínimo', idMassa: '0483', dependeDe: ['CT03.2'], massaCompartilhadaCom: ['CT03.2'] });
const ct31 = () => item('CT03.1', { nome: 'Pagar valor total', idMassa: '0100', status: 'concluido', resultado: 'passou' });
const ct41 = () => item('CT04.1', { nome: 'Bloquear cartão', funcionalidade: 'Cartões', dataPlanejada: '2026-10-05' });

const planoBase = () => plano('pl_a', '28/09/26', [ct31(), ct32(), ct41(), ct37()], { previsao: '2026-10-13' });

async function abrir(api = criarApiFalsa({ planos: [planoBase()] })) {
  vi.stubGlobal('fetch', api.falso);
  const props = { onFechar: vi.fn(), onMudou: vi.fn() };
  render(<PlanoDetalhe id="pl_a" {...props} />);
  await screen.findByRole('heading', { name: 'Plano: 28/09/26' });
  return { api, ...props };
}

const linha = (id: string) => screen.getByTestId(`teste-${id}`);
const idsNaOrdem = () => screen.getAllByTestId(/^teste-/).map((l) => l.getAttribute('data-testid')!.replace('teste-', ''));

beforeEach(() => vi.unstubAllGlobals());
afterEach(() => vi.unstubAllGlobals());

describe('PlanoDetalhe — cabeçalho e visão lista', () => {
  it('mostra nome, criado em, previsão, progresso e a contagem de testes', async () => {
    await abrir();
    const modal = screen.getByRole('dialog', { name: 'Detalhe do plano' });
    expect(within(modal).getByText('Criado em 24/09/2026 · Previsão 13/10/2026')).toBeInTheDocument();
    expect(within(modal).getByText('25% executado')).toBeInTheDocument();
    expect(within(modal).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '25');
    expect(within(modal).getByText('Testes (4)')).toBeInTheDocument();
  });

  it('lista os testes na ordem de execução, com número, funcionalidade, cenário e status', async () => {
    await abrir();
    expect(idsNaOrdem()).toEqual(['CT03.1', 'CT03.2', 'CT04.1', 'CT03.7']);
    const l = linha('CT03.2');
    expect(within(l).getByText('2')).toBeInTheDocument();
    expect(within(l).getByText('Faturas')).toBeInTheDocument();
    expect(within(l).getByText('Pagar valor mínimo')).toBeInTheDocument();
    expect(within(l).getByLabelText('Status de CT03.2')).toHaveValue('agendado');
    expect(within(linha('CT03.1')).getByLabelText('Status de CT03.1')).toHaveValue('concluido');
  });

  it('teste que reaproveita a massa mostra "Aguardando CT03.2 passar", sem tratar como erro', async () => {
    await abrir();
    expect(within(linha('CT03.7')).getByText('Aguardando CT03.2 passar')).toBeInTheDocument();
    expect(within(linha('CT03.7')).getByText('= massa 0483 compartilhada com CT03.2')).toBeInTheDocument();
    expect(within(linha('CT03.2')).queryByText(/Aguardando/)).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('plano que não existe mostra o erro do servidor', async () => {
    vi.stubGlobal('fetch', criarApiFalsa().falso);
    render(<PlanoDetalhe id="pl_x" onFechar={vi.fn()} onMudou={vi.fn()} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Plano pl_x não encontrado.');
  });

  it('✕ e Esc fecham', async () => {
    const { onFechar } = await abrir();
    await userEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    await userEvent.keyboard('{Escape}');
    expect(onFechar).toHaveBeenCalledTimes(2);
  });
});

describe('PlanoDetalhe — status, resultado e data', () => {
  it('trocar o status manda PATCH com a versão do teste e avisa a lista de planos', async () => {
    const { api, onMudou } = await abrir();
    await userEvent.selectOptions(screen.getByLabelText('Status de CT03.2'), 'refinamento');
    await vi.waitFor(() => expect(api.escritas()).toHaveLength(1));
    expect(api.escritas()[0]).toEqual({ metodo: 'PATCH', caminho: '/api/planos/pl_a/testes/CT03.2', corpo: { status: 'refinamento', versao: 1 } });
    await vi.waitFor(() => expect(screen.getByLabelText('Status de CT03.2')).toHaveValue('refinamento'));
    expect(onMudou).toHaveBeenCalled();
  });

  it('dependência que não passou: o servidor recusa, a mensagem aparece e o status volta', async () => {
    await abrir();
    await userEvent.selectOptions(screen.getByLabelText('Status de CT03.7'), 'em_andamento');
    expect(await screen.findByRole('alert')).toHaveTextContent('Aguardando CT03.2 passar');
    expect(screen.getByLabelText('Status de CT03.7')).toHaveValue('agendado');
  });

  it('concluir mostra o resultado; marcar "passou" no CT03.2 libera o CT03.7', async () => {
    const { api } = await abrir();
    expect(within(linha('CT03.2')).queryByLabelText('Resultado de CT03.2')).toBeNull();
    await userEvent.selectOptions(screen.getByLabelText('Status de CT03.2'), 'concluido');
    const resultado = await within(linha('CT03.2')).findByLabelText('Resultado de CT03.2');
    expect(resultado).toHaveValue('');

    await userEvent.selectOptions(resultado, 'passou');
    await vi.waitFor(() => expect(within(linha('CT03.7')).queryByText('Aguardando CT03.2 passar')).toBeNull());
    expect(api.escritas()[1].corpo).toEqual({ resultado: 'passou', versao: 2 });
    expect(within(linha('CT03.2')).getByLabelText('Resultado de CT03.2')).toHaveValue('passou');

    await userEvent.selectOptions(screen.getByLabelText('Status de CT03.7'), 'em_andamento');
    await vi.waitFor(() => expect(screen.getByLabelText('Status de CT03.7')).toHaveValue('em_andamento'));
  });

  it('data planejada: escolher grava; limpar manda null', async () => {
    const { api } = await abrir();
    const data = screen.getByLabelText('Data planejada de CT03.2');
    fireEvent.change(data, { target: { value: '2026-10-05' } });
    await vi.waitFor(() => expect(api.escritas()).toHaveLength(1));
    expect(api.escritas()[0].corpo).toEqual({ dataPlanejada: '2026-10-05', versao: 1 });

    await vi.waitFor(() => expect(screen.getByLabelText('Data planejada de CT03.2')).toHaveValue('2026-10-05'));
    fireEvent.change(screen.getByLabelText('Data planejada de CT03.2'), { target: { value: '' } });
    await vi.waitFor(() => expect(api.escritas()).toHaveLength(2));
    expect(api.escritas()[1].corpo).toEqual({ dataPlanejada: null, versao: 2 });
  });
});

describe('PlanoDetalhe — remover teste e excluir plano', () => {
  it('tirar do plano pede confirmação; "Manter" desiste, "Tirar" remove', async () => {
    const { api } = await abrir();
    await userEvent.click(screen.getByRole('button', { name: 'Tirar CT04.1 do plano' }));
    const aviso = screen.getByRole('alertdialog', { name: 'Confirmar' });
    expect(aviso).toHaveTextContent('Tirar o teste CT04.1 do plano?');
    await userEvent.click(within(aviso).getByRole('button', { name: 'Manter' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(api.escritas()).toEqual([]);

    await userEvent.click(screen.getByRole('button', { name: 'Tirar CT04.1 do plano' }));
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Tirar' }));
    await vi.waitFor(() => expect(idsNaOrdem()).toEqual(['CT03.1', 'CT03.2', 'CT03.7']));
    expect(api.escritas()).toEqual([{ metodo: 'DELETE', caminho: '/api/planos/pl_a/testes/CT04.1', corpo: undefined }]);
  });

  it('excluir o plano pede confirmação, apaga e fecha o detalhe', async () => {
    const { api, onFechar, onMudou } = await abrir();
    await userEvent.click(screen.getByRole('button', { name: 'Excluir plano' }));
    const aviso = screen.getByRole('alertdialog', { name: 'Confirmar' });
    expect(aviso).toHaveTextContent('Excluir o plano 28/09/26 e seus 4 testes?');
    await userEvent.click(within(aviso).getByRole('button', { name: 'Excluir' }));
    await vi.waitFor(() => expect(onFechar).toHaveBeenCalled());
    expect(onMudou).toHaveBeenCalled();
    expect(api.escritas()).toEqual([{ metodo: 'DELETE', caminho: '/api/planos/pl_a', corpo: undefined }]);
  });
});

describe('PlanoDetalhe — detalhe do teste (T6)', () => {
  const catalogoComMassa = () => [
    item('CT03.1', { nome: 'Pagar valor total', idMassa: '0100', status: 'concluido', resultado: 'passou' }),
    item('CT03.2', { nome: 'Pagar valor mínimo', idMassa: '0483', cpf: '12345678909', passos: 'a.feature#CT03.2', massaCompartilhadaCom: ['CT03.7'] }),
    item('CT03.7', { nome: 'Reenvio pgto mínimo', idMassa: '0483', cpf: '12345678909', dependeDe: ['CT03.2'], massaCompartilhadaCom: ['CT03.2'] }),
  ];
  const abrirComMassa = () => abrir(criarApiFalsa({ planos: [plano('pl_a', '28/09/26', catalogoComMassa(), { previsao: '2026-10-13' })] }));
  const modalTeste = () => screen.getByRole('dialog', { name: 'Detalhe do teste' });

  it('o olho da linha abre o detalhe do teste com "n de m no plano"', async () => {
    await abrirComMassa();
    await userEvent.click(within(linha('CT03.2')).getByRole('button', { name: 'Ver detalhes de CT03.2' }));
    expect(within(modalTeste()).getByRole('heading', { name: 'CT03.2 · Pagar valor mínimo' })).toBeInTheDocument();
    expect(within(modalTeste()).getByText('2 de 3 no plano')).toBeInTheDocument();
  });

  it('na Visão card, clicar no ID do card abre o mesmo detalhe', async () => {
    await abrirComMassa();
    await userEvent.click(screen.getByRole('tab', { name: 'Visão card' }));
    await userEvent.click(screen.getByRole('button', { name: 'Abrir CT03.7' }));
    expect(within(modalTeste()).getByRole('heading', { name: 'CT03.7 · Reenvio pgto mínimo' })).toBeInTheDocument();
  });

  it('o CPF da massa aparece inteiro (fictício), com o aviso, na aba Cenário e Datas', async () => {
    await abrirComMassa();
    await userEvent.click(within(linha('CT03.2')).getByRole('button', { name: 'Ver detalhes de CT03.2' }));
    await userEvent.click(within(modalTeste()).getByRole('tab', { name: 'Cenário e Datas' }));
    expect(within(modalTeste()).getByText('123.456.789-09')).toBeInTheDocument();
    expect(within(modalTeste()).getByText('CPF fictício de massa de teste (não é dado real)')).toBeInTheDocument();
  });

  it('salvar no detalhe manda PATCH com a versão, atualiza a lista e avisa a lista de planos', async () => {
    const { api, onMudou } = await abrirComMassa();
    await userEvent.click(within(linha('CT03.2')).getByRole('button', { name: 'Ver detalhes de CT03.2' }));
    await userEvent.type(within(modalTeste()).getByLabelText('Responsável'), 'ana');
    await userEvent.click(within(modalTeste()).getByRole('button', { name: 'Salvar alterações' }));
    expect(await within(modalTeste()).findByText('Alterações salvas.')).toBeInTheDocument();
    expect(api.escritas()).toEqual([{ metodo: 'PATCH', caminho: '/api/planos/pl_a/testes/CT03.2', corpo: { responsavel: 'ana', versao: 1 } }]);
    expect(onMudou).toHaveBeenCalled();
  });

  it('recusa da regra da massa aparece no detalhe do teste', async () => {
    await abrirComMassa();
    await userEvent.click(within(linha('CT03.7')).getByRole('button', { name: 'Ver detalhes de CT03.7' }));
    await userEvent.selectOptions(within(modalTeste()).getByLabelText('Status'), 'em_andamento');
    await userEvent.click(within(modalTeste()).getByRole('button', { name: 'Salvar alterações' }));
    expect(await within(modalTeste()).findByRole('alert')).toHaveTextContent('Aguardando CT03.2 passar');
  });

  it('Próximo percorre a ordem do plano inteira, mesmo com filtro ligado na lista', async () => {
    await abrirComMassa();
    await userEvent.type(screen.getByLabelText('ID/cenário'), 'CT03.2');
    await userEvent.click(within(linha('CT03.2')).getByRole('button', { name: 'Ver detalhes de CT03.2' }));
    await userEvent.click(within(modalTeste()).getByRole('button', { name: 'Próximo' }));
    expect(within(modalTeste()).getByRole('heading', { name: 'CT03.7 · Reenvio pgto mínimo' })).toBeInTheDocument();
  });

  it('"Tirar do plano" pede confirmação e, ao tirar, fecha o detalhe do teste', async () => {
    const { api } = await abrirComMassa();
    await userEvent.click(within(linha('CT03.2')).getByRole('button', { name: 'Ver detalhes de CT03.2' }));
    await userEvent.click(within(modalTeste()).getByRole('button', { name: 'Tirar do plano' }));
    await userEvent.click(within(screen.getByRole('alertdialog', { name: 'Confirmar' })).getByRole('button', { name: 'Tirar' }));
    await vi.waitFor(() => expect(screen.queryByRole('dialog', { name: 'Detalhe do teste' })).toBeNull());
    expect(api.escritas()).toEqual([{ metodo: 'DELETE', caminho: '/api/planos/pl_a/testes/CT03.2', corpo: undefined }]);
    expect(idsNaOrdem()).toEqual(['CT03.1', 'CT03.7']);
  });

  it('Esc com o detalhe do teste aberto fecha só ele, não o detalhe do plano', async () => {
    const { onFechar } = await abrirComMassa();
    await userEvent.click(within(linha('CT03.1')).getByRole('button', { name: 'Ver detalhes de CT03.1' }));
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Detalhe do teste' })).toBeNull();
    expect(onFechar).not.toHaveBeenCalled();
  });
});

describe('PlanoDetalhe — Incluir testes (M2)', () => {
  const catalogo = [
    cenario('CT03.1', { nome: 'Pagar valor total' }),
    cenario('CT03.2', { nome: 'Pagar valor mínimo', idMassa: '0483' }),
    cenario('CT04.1', { nome: 'Bloquear cartão', funcionalidade: 'Cartões' }),
    cenario('CT03.7', { nome: 'Reenvio pgto mínimo', idMassa: '0483', dependeDe: ['CT03.2'] }),
    cenario('CT05.1', { nome: 'Cadastrar chave Pix', funcionalidade: 'Pix' }),
    cenario('CT05.2', { nome: 'Pagar com Pix', funcionalidade: 'Pix' }),
  ];

  it('o botão "+ Incluir testes" abre o modal; o que já está no plano aparece travado', async () => {
    await abrir(criarApiFalsa({ planos: [planoBase()], cenarios: catalogo }));
    await userEvent.click(screen.getByRole('button', { name: 'Incluir testes' }));
    const modal = await screen.findByRole('dialog', { name: 'Incluir testes' });
    await within(modal).findByTestId('cenario-CT05.1');
    expect(within(within(modal).getByTestId('cenario-CT04.1')).getByRole('checkbox')).toBeDisabled();
    expect(within(within(modal).getByTestId('cenario-CT05.1')).getByRole('checkbox')).toBeEnabled();
  });

  it('incluir manda os IDs e a data, fecha o modal e a lista já mostra os novos testes', async () => {
    const { api, onMudou } = await abrir(criarApiFalsa({ planos: [planoBase()], cenarios: catalogo }));
    await userEvent.click(screen.getByRole('button', { name: 'Incluir testes' }));
    const modal = await screen.findByRole('dialog', { name: 'Incluir testes' });
    await userEvent.click(within(await within(modal).findByTestId('cenario-CT05.2')).getByRole('checkbox'));
    await userEvent.click(within(within(modal).getByTestId('cenario-CT05.1')).getByRole('checkbox'));
    fireEvent.change(within(modal).getByLabelText('Data planejada para os selecionados'), { target: { value: '2026-10-08' } });
    await userEvent.click(within(modal).getByRole('button', { name: 'Incluir 2 testes' }));

    await vi.waitFor(() => expect(screen.queryByRole('dialog', { name: 'Incluir testes' })).toBeNull());
    expect(api.escritas()).toEqual([
      { metodo: 'POST', caminho: '/api/planos/pl_a/testes', corpo: { idCenarios: ['CT05.1', 'CT05.2'], dataPlanejada: '2026-10-08' } },
    ]);
    expect(idsNaOrdem()).toEqual(['CT03.1', 'CT03.2', 'CT04.1', 'CT03.7', 'CT05.1', 'CT05.2']);
    expect(screen.getByText('Testes (6)')).toBeInTheDocument();
    expect(within(linha('CT05.1')).getByText('5')).toBeInTheDocument();
    expect(within(linha('CT05.1')).getByLabelText('Data planejada de CT05.1')).toHaveValue('2026-10-08');
    expect(onMudou).toHaveBeenCalled();
  });

  it('recusa do servidor aparece no modal e o plano não muda', async () => {
    await abrir(criarApiFalsa({ planos: [planoBase()], cenarios: catalogo, recusarInclusao: true }));
    await userEvent.click(screen.getByRole('button', { name: 'Incluir testes' }));
    const modal = await screen.findByRole('dialog', { name: 'Incluir testes' });
    await userEvent.click(within(await within(modal).findByTestId('cenario-CT05.1')).getByRole('checkbox'));
    await userEvent.click(within(modal).getByRole('button', { name: 'Incluir 1 teste' }));
    expect(await within(modal).findByRole('alert')).toHaveTextContent('não pode ser planejado em 01/10/2026');
    expect(idsNaOrdem()).toHaveLength(4);
  });

  it('Esc com o modal de incluir aberto fecha só ele, não o detalhe', async () => {
    const { onFechar } = await abrir(criarApiFalsa({ planos: [planoBase()], cenarios: catalogo }));
    await userEvent.click(screen.getByRole('button', { name: 'Incluir testes' }));
    await screen.findByRole('dialog', { name: 'Incluir testes' });
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Incluir testes' })).toBeNull();
    expect(onFechar).not.toHaveBeenCalled();
  });

  it('plano vazio também aceita incluir testes', async () => {
    vi.stubGlobal('fetch', criarApiFalsa({ planos: [plano('pl_a', '28/09/26')], cenarios: catalogo }).falso);
    render(<PlanoDetalhe id="pl_a" onFechar={vi.fn()} onMudou={vi.fn()} />);
    await screen.findByRole('heading', { name: 'Plano: 28/09/26' });
    expect(screen.getByText('Este plano ainda não tem testes')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Incluir testes' }));
    const modal = await screen.findByRole('dialog', { name: 'Incluir testes' });
    await userEvent.click(within(await within(modal).findByTestId('cenario-CT05.1')).getByRole('checkbox'));
    await userEvent.click(within(modal).getByRole('button', { name: 'Incluir 1 teste' }));
    await vi.waitFor(() => expect(idsNaOrdem()).toEqual(['CT05.1']));
  });
});

describe('PlanoDetalhe — ordem de execução (⇅)', () => {
  it('cada teste tem o botão ⇅ no canto direito; ele abre o modal com a ordem de hoje', async () => {
    await abrir();
    await userEvent.click(within(linha('CT04.1')).getByRole('button', { name: 'Ordem de execução de CT04.1' }));
    const ordem = screen.getByRole('dialog', { name: 'Ordem de execução' });
    expect(within(ordem).getByText(/Plano 28\/09\/26/)).toBeInTheDocument();
    expect(within(ordem).getAllByTestId(/^linha-/).map((l) => l.getAttribute('data-testid'))).toEqual([
      'linha-CT03.1',
      'linha-CT03.2',
      'linha-CT04.1',
      'linha-CT03.7',
    ]);
  });

  it('salvar a nova ordem manda PUT /ordem, fecha só o modal de ordem e a lista já vem renumerada', async () => {
    const { api, onFechar, onMudou } = await abrir();
    await userEvent.click(screen.getByRole('button', { name: 'Ordem de execução do plano' }));
    await userEvent.click(screen.getByRole('button', { name: 'Subir CT04.1' }));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar a ordem' }));

    await vi.waitFor(() => expect(screen.queryByRole('dialog', { name: 'Ordem de execução' })).toBeNull());
    expect(api.escritas()).toEqual([{ metodo: 'PUT', caminho: '/api/planos/pl_a/ordem', corpo: { ordem: ['CT03.1', 'CT04.1', 'CT03.2', 'CT03.7'] } }]);
    expect(screen.getByRole('dialog', { name: 'Detalhe do plano' })).toBeInTheDocument();
    expect(onFechar).not.toHaveBeenCalled();
    expect(idsNaOrdem()).toEqual(['CT03.1', 'CT04.1', 'CT03.2', 'CT03.7']);
    expect(within(linha('CT04.1')).getByText('2')).toBeInTheDocument();
    expect(onMudou).toHaveBeenCalled();
  });

  it('Esc com o modal de ordem aberto fecha só a ordem, não o detalhe', async () => {
    const { onFechar } = await abrir();
    await userEvent.click(screen.getByRole('button', { name: 'Ordem de execução do plano' }));
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Ordem de execução' })).toBeNull();
    expect(onFechar).not.toHaveBeenCalled();
  });

  it('servidor recusa a ordem (409): a mensagem aparece no modal de ordem', async () => {
    await abrir(criarApiFalsa({ planos: [planoBase()], recusarOrdem: true }));
    await userEvent.click(screen.getByRole('button', { name: 'Ordem de execução do plano' }));
    await userEvent.click(screen.getByRole('button', { name: 'Subir CT04.1' }));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar a ordem' }));
    expect(await within(screen.getByRole('dialog', { name: 'Ordem de execução' })).findByRole('alert')).toHaveTextContent(
      'CT03.2 precisa ficar antes de CT03.7',
    );
  });

  it('plano com menos de 2 testes: ordenar não faz sentido e os botões ficam desabilitados', async () => {
    vi.stubGlobal('fetch', criarApiFalsa({ planos: [plano('pl_a', '28/09/26', [ct41()])] }).falso);
    render(<PlanoDetalhe id="pl_a" onFechar={vi.fn()} onMudou={vi.fn()} />);
    await screen.findByRole('heading', { name: 'Plano: 28/09/26' });
    expect(screen.getByRole('button', { name: 'Ordem de execução do plano' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Ordem de execução de CT04.1' })).toBeDisabled();
  });
});
