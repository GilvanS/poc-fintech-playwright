import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PlanoDetalhe from '../src/pages/planos/PlanoDetalhe';
import { renderComPessoas } from './ajudantes';
import { criarApiFalsa, item, pessoa, plano } from './apiFalsa';

const HOJE = '2026-10-05';
const equipe = () => [pessoa('ana'), pessoa('bia'), pessoa('carlos'), pessoa('zeca', { ativa: false })];

const planoBase = () =>
  plano('pl_a', '28/09/26', [
    item('CT03.1', { nome: 'Pagar valor total', status: 'concluido', resultado: 'passou', estimativaMin: 20, prioridade: 'P1', responsavel: 'ana' }),
    item('CT03.2', { nome: 'Pagar valor mínimo', idMassa: '0483', estimativaMin: 30, prioridade: 'P2', responsavel: 'bia', massaCompartilhadaCom: ['CT03.7'] }),
    item('CT04.1', { nome: 'Bloquear cartão', funcionalidade: 'Cartões', status: 'concluido', resultado: 'falhou', estimativaMin: 25 }),
    item('CT03.7', { nome: 'Reenvio pgto mínimo', idMassa: '0483', estimativaMin: 15, dependeDe: ['CT03.2'], massaCompartilhadaCom: ['CT03.2'] }),
  ]);

async function abrir(opcoes: { voce?: string; pessoas?: ReturnType<typeof pessoa>[] } = {}) {
  const api = criarApiFalsa({ planos: [planoBase()] });
  vi.stubGlobal('fetch', api.falso);
  const props = { onFechar: vi.fn(), onMudou: vi.fn() };
  renderComPessoas(<PlanoDetalhe id="pl_a" hoje={HOJE} {...props} />, opcoes.pessoas ?? equipe(), opcoes.voce);
  await screen.findByRole('heading', { name: 'Plano: 28/09/26' });
  return { api, ...props };
}

const linha = (id: string) => screen.getByTestId(`teste-${id}`);
const idsNaLista = () => screen.getAllByTestId(/^teste-/).map((l) => l.getAttribute('data-testid')!.replace('teste-', ''));
const marcar = async (...ids: string[]) => {
  for (const id of ids) await userEvent.click(within(linha(id)).getByRole('checkbox', { name: `Selecionar ${id}` }));
};
const barra = () => screen.getByRole('region', { name: 'Ações em lote' });

beforeEach(() => vi.unstubAllGlobals());
afterEach(() => vi.unstubAllGlobals());

describe('lista — Pri, Resp. e Est. na própria linha', () => {
  it('mostra prioridade, responsável (pelo nome) e estimativa de cada teste', async () => {
    await abrir();
    expect(within(linha('CT03.2')).getByLabelText('Prioridade de CT03.2')).toHaveValue('P2');
    expect(within(linha('CT03.2')).getByLabelText('Responsável de CT03.2')).toHaveValue('bia');
    expect(within(linha('CT03.2')).getByRole('option', { name: 'Bia' })).toBeInTheDocument();
    expect(within(linha('CT03.2')).getByLabelText('Estimativa de CT03.2')).toHaveValue(30);
    expect(within(linha('CT04.1')).getByLabelText('Prioridade de CT04.1')).toHaveValue('');
    expect(within(linha('CT04.1')).getByLabelText('Responsável de CT04.1')).toHaveValue('');
  });

  it('o seletor de responsável só oferece pessoas ativas (e a atual, se já estiver atribuída)', async () => {
    await abrir();
    const nomes = within(within(linha('CT04.1')).getByLabelText('Responsável de CT04.1')).getAllByRole('option').map((o) => o.textContent);
    expect(nomes).toEqual(['Sem responsável', 'Ana', 'Bia', 'Carlos']);
  });

  it('trocar a prioridade grava na hora; "-" limpa', async () => {
    const { api } = await abrir();
    await userEvent.selectOptions(within(linha('CT03.2')).getByLabelText('Prioridade de CT03.2'), 'P1');
    await vi.waitFor(() => expect(api.escritas()).toHaveLength(1));
    expect(api.escritas()[0].corpo).toEqual({ prioridade: 'P1', versao: 1 });

    await vi.waitFor(() => expect(within(linha('CT03.2')).getByLabelText('Prioridade de CT03.2')).toHaveValue('P1'));
    await userEvent.selectOptions(within(linha('CT03.2')).getByLabelText('Prioridade de CT03.2'), '');
    await vi.waitFor(() => expect(api.escritas()).toHaveLength(2));
    expect(api.escritas()[1].corpo).toEqual({ prioridade: null, versao: 2 });
  });

  it('trocar o responsável grava na hora', async () => {
    const { api } = await abrir();
    await userEvent.selectOptions(within(linha('CT04.1')).getByLabelText('Responsável de CT04.1'), 'carlos');
    await vi.waitFor(() => expect(api.escritas()).toHaveLength(1));
    expect(api.escritas()[0]).toEqual({ metodo: 'PATCH', caminho: '/api/planos/pl_a/testes/CT04.1', corpo: { responsavel: 'carlos', versao: 1 } });
  });

  it('estimativa: grava ao sair do campo ou com Enter; vazio limpa; sem mudança não grava', async () => {
    const { api } = await abrir();
    const campo = within(linha('CT03.2')).getByLabelText('Estimativa de CT03.2');
    await userEvent.clear(campo);
    await userEvent.type(campo, '45');
    await userEvent.tab();
    await vi.waitFor(() => expect(api.escritas()).toHaveLength(1));
    expect(api.escritas()[0].corpo).toEqual({ estimativaMin: 45, versao: 1 });

    const outro = within(linha('CT03.7')).getByLabelText('Estimativa de CT03.7');
    await userEvent.clear(outro);
    await userEvent.type(outro, '20{Enter}');
    await vi.waitFor(() => expect(api.escritas()).toHaveLength(2));
    expect(api.escritas()[1].corpo).toEqual({ estimativaMin: 20, versao: 1 });

    const limpar = within(linha('CT04.1')).getByLabelText('Estimativa de CT04.1');
    await userEvent.clear(limpar);
    await userEvent.tab();
    await vi.waitFor(() => expect(api.escritas()).toHaveLength(3));
    expect(api.escritas()[2].corpo).toEqual({ estimativaMin: null, versao: 1 });

    const igual = within(linha('CT03.1')).getByLabelText('Estimativa de CT03.1');
    await userEvent.click(igual);
    await userEvent.tab();
    expect(api.escritas()).toHaveLength(3);
  });

  it('rodapé: total estimado, executados e falhas dos testes que estão na tela', async () => {
    await abrir();
    expect(screen.getByTestId('resumo-lista')).toHaveTextContent('Total estimado: 90 min (1,5 h) · Executado: 2 de 4 · Falhas: 1');
    await userEvent.selectOptions(screen.getByLabelText('Responsável'), 'ana');
    expect(screen.getByTestId('resumo-lista')).toHaveTextContent('Total estimado: 20 min (0,3 h) · Executado: 1 de 1 · Falhas: 0');
  });
});

describe('filtros de responsável, prioridade e "Só meus"', () => {
  it('Responsável: quem aparece nos testes, "Sem responsável" e filtra a lista', async () => {
    await abrir();
    const filtro = screen.getByLabelText('Responsável');
    expect(within(filtro).getAllByRole('option').map((o) => o.textContent)).toEqual(['Todos', 'Sem responsável', 'Ana', 'Bia']);
    await userEvent.selectOptions(filtro, 'bia');
    expect(idsNaLista()).toEqual(['CT03.2']);
    await userEvent.selectOptions(filtro, '__sem');
    expect(idsNaLista()).toEqual(['CT04.1', 'CT03.7']);
  });

  it('Prioridade filtra, inclusive "Sem prioridade"', async () => {
    await abrir();
    await userEvent.selectOptions(screen.getByLabelText('Prioridade'), 'P1');
    expect(idsNaLista()).toEqual(['CT03.1']);
    await userEvent.selectOptions(screen.getByLabelText('Prioridade'), '__sem');
    expect(idsNaLista()).toEqual(['CT04.1', 'CT03.7']);
  });

  it('"Só meus (Ana)" usa quem é "Você"', async () => {
    await abrir({ voce: 'ana' });
    await userEvent.click(screen.getByRole('checkbox', { name: 'Só meus (Ana)' }));
    expect(idsNaLista()).toEqual(['CT03.1']);
    expect(screen.getByText('Testes (1 de 4)')).toBeInTheDocument();
  });

  it('sem ninguém em "Você", "Só meus" fica desabilitado', async () => {
    await abrir();
    expect(screen.getByRole('checkbox', { name: 'Só meus' })).toBeDisabled();
  });
});

describe('edição em lote', () => {
  it('marcar linhas mostra a barra com a contagem; ✕ limpa a seleção', async () => {
    await abrir();
    expect(screen.queryByRole('region', { name: 'Ações em lote' })).toBeNull();
    await marcar('CT03.2');
    expect(within(barra()).getByText('1 selecionado')).toBeInTheDocument();
    await marcar('CT03.7');
    expect(within(barra()).getByText('2 selecionados')).toBeInTheDocument();
    await userEvent.click(within(barra()).getByRole('button', { name: 'Limpar seleção' }));
    expect(screen.queryByRole('region', { name: 'Ações em lote' })).toBeNull();
    expect(within(linha('CT03.2')).getByRole('checkbox', { name: 'Selecionar CT03.2' })).not.toBeChecked();
  });

  it('atribuir e prioridade em lote: um único pedido com os testes marcados; depois a seleção some', async () => {
    const { api } = await abrir();
    await marcar('CT03.2', 'CT03.7');
    expect(within(barra()).getByRole('button', { name: 'Aplicar' })).toBeDisabled();
    await userEvent.selectOptions(within(barra()).getByLabelText('Atribuir a'), 'carlos');
    await userEvent.selectOptions(within(barra()).getByLabelText('Definir prioridade'), 'P1');
    await userEvent.click(within(barra()).getByRole('button', { name: 'Aplicar' }));

    await vi.waitFor(() => expect(screen.queryByRole('region', { name: 'Ações em lote' })).toBeNull());
    expect(api.escritas()).toEqual([
      { metodo: 'PATCH', caminho: '/api/planos/pl_a/testes', corpo: { idCenarios: ['CT03.2', 'CT03.7'], responsavel: 'carlos', prioridade: 'P1' } },
    ]);
    expect(within(linha('CT03.7')).getByLabelText('Responsável de CT03.7')).toHaveValue('carlos');
    expect(within(linha('CT03.2')).getByLabelText('Prioridade de CT03.2')).toHaveValue('P1');
  });

  it('só um dos campos: o outro não é enviado; "Remover" limpa', async () => {
    const { api } = await abrir();
    await marcar('CT03.1', 'CT03.2');
    await userEvent.selectOptions(within(barra()).getByLabelText('Atribuir a'), '__sem');
    await userEvent.click(within(barra()).getByRole('button', { name: 'Aplicar' }));
    await vi.waitFor(() => expect(api.escritas()).toHaveLength(1));
    expect(api.escritas()[0].corpo).toEqual({ idCenarios: ['CT03.1', 'CT03.2'], responsavel: null });
    await vi.waitFor(() => expect(within(linha('CT03.1')).getByLabelText('Responsável de CT03.1')).toHaveValue(''));
  });

  it('o checkbox do cabeçalho marca só os testes que estão na tela (respeita o filtro)', async () => {
    await abrir();
    await userEvent.selectOptions(screen.getByLabelText('Funcionalidade'), 'Faturas');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Selecionar todos os testes visíveis' }));
    expect(within(barra()).getByText('3 selecionados')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Selecionar todos os testes visíveis' }));
    expect(screen.queryByRole('region', { name: 'Ações em lote' })).toBeNull();
  });

  it('"Remover do plano" só aparece se todos os marcados ainda não começaram; pede confirmação e tira um a um', async () => {
    const { api } = await abrir();
    await marcar('CT03.1', 'CT03.2');
    expect(within(barra()).queryByRole('button', { name: 'Remover do plano' })).toBeNull(); // CT03.1 já foi concluído
    await userEvent.click(within(linha('CT03.1')).getByRole('checkbox', { name: 'Selecionar CT03.1' }));

    await marcar('CT03.7');
    await userEvent.click(within(barra()).getByRole('button', { name: 'Remover do plano' }));
    const aviso = screen.getByRole('alertdialog', { name: 'Confirmar' });
    expect(aviso).toHaveTextContent('Tirar 2 testes do plano?');
    await userEvent.click(within(aviso).getByRole('button', { name: 'Tirar' }));

    await vi.waitFor(() => expect(idsNaLista()).toEqual(['CT03.1', 'CT04.1']));
    expect(api.escritas().map((e) => [e.metodo, e.caminho])).toEqual([
      ['DELETE', '/api/planos/pl_a/testes/CT03.2'],
      ['DELETE', '/api/planos/pl_a/testes/CT03.7'],
    ]);
    expect(screen.queryByRole('region', { name: 'Ações em lote' })).toBeNull();
  });
});

describe('Visão card mostra prioridade e responsável', () => {
  it('o card traz o chip da prioridade e quem é o responsável (pelo nome)', async () => {
    await abrir();
    await userEvent.click(screen.getByRole('tab', { name: 'Visão card' }));
    const card = screen.getByTestId('card-CT03.2');
    expect(within(card).getByText('P2')).toBeInTheDocument();
    expect(within(card).getByText('Resp. Bia')).toBeInTheDocument();
    expect(within(screen.getByTestId('card-CT04.1')).queryByText(/^Resp\./)).toBeNull();
  });
});
