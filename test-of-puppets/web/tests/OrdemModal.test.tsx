import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OrdemModal from '../src/pages/planos/OrdemModal';
import type { ItemPlano } from '../src/pages/planos/clientePlanos';
import { item } from './apiFalsa';

const ct31 = item('CT03.1', { nome: 'Pagar valor total', idMassa: '0100' });
const ct32 = item('CT03.2', { nome: 'Pagar valor mínimo', idMassa: '0483', massaCompartilhadaCom: ['CT03.7'] });
const ct41 = item('CT04.1', { nome: 'Bloquear cartão', funcionalidade: 'Cartões' });
const ct37 = item('CT03.7', { nome: 'Reenvio pgto mínimo', idMassa: '0483', dependeDe: ['CT03.2'], massaCompartilhadaCom: ['CT03.2'] });

function montar(itens: ItemPlano[] = [ct31, ct32, ct41, ct37], extra: { onSalvar?: (ids: string[]) => Promise<void> } = {}) {
  const props = { onSalvar: vi.fn(async () => {}), onFechar: vi.fn(), ...extra };
  render(<OrdemModal planoNome="28/09/26" itens={itens} {...props} />);
  return props;
}

const ordemAtual = () => screen.getAllByTestId(/^linha-/).map((l) => l.getAttribute('data-testid')!.replace('linha-', ''));
const linha = (id: string) => screen.getByTestId(`linha-${id}`);
const salvar = () => screen.getByRole('button', { name: 'Salvar a ordem' });

describe('OrdemModal — desenho 2', () => {
  it('mostra o plano, os testes numerados na ordem de hoje, a massa e a regra com cadeado', () => {
    montar();
    const modal = screen.getByRole('dialog', { name: 'Ordem de execução' });
    expect(within(modal).getByText(/Plano 28\/09\/26/)).toBeInTheDocument();
    expect(ordemAtual()).toEqual(['CT03.1', 'CT03.2', 'CT04.1', 'CT03.7']);

    expect(within(linha('CT03.1')).getByText('1')).toBeInTheDocument();
    expect(within(linha('CT03.7')).getByText('4')).toBeInTheDocument();
    expect(within(linha('CT03.2')).getByText('Pagar valor mínimo')).toBeInTheDocument();
    expect(within(linha('CT03.2')).getByText('0483')).toBeInTheDocument();
    expect(within(linha('CT03.2')).getByText('libera o CT03.7')).toBeInTheDocument();
    expect(within(linha('CT03.7')).getByText('depois do CT03.2')).toBeInTheDocument();
    expect(within(linha('CT04.1')).queryByText(/libera|depois do/)).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('▲ e ▼ trocam a posição e renumeram; Salvar manda os IDs na nova ordem', async () => {
    const props = montar();
    expect(salvar()).toBeDisabled(); // nada mudou ainda

    await userEvent.click(screen.getByRole('button', { name: 'Subir CT04.1' }));
    expect(ordemAtual()).toEqual(['CT03.1', 'CT04.1', 'CT03.2', 'CT03.7']);
    await userEvent.click(screen.getByRole('button', { name: 'Descer CT03.1' }));
    expect(ordemAtual()).toEqual(['CT04.1', 'CT03.1', 'CT03.2', 'CT03.7']);
    expect(within(linha('CT04.1')).getByText('1')).toBeInTheDocument();

    await userEvent.click(salvar());
    expect(props.onSalvar).toHaveBeenCalledWith(['CT04.1', 'CT03.1', 'CT03.2', 'CT03.7']);
  });

  it('o primeiro não sobe e o último não desce', () => {
    montar();
    expect(screen.getByRole('button', { name: 'Subir CT03.1' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Descer CT03.7' })).toBeDisabled();
  });

  it('cadeado: o dependente não sobe além da dependência e a dependência não desce além do dependente', async () => {
    montar([ct31, ct32, ct37, ct41]); // CT03.7 logo abaixo do CT03.2
    expect(screen.getByRole('button', { name: 'Subir CT03.7' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Descer CT03.2' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Descer CT03.7' })).toBeEnabled();
    await userEvent.click(screen.getByRole('button', { name: 'Descer CT03.7' }));
    expect(ordemAtual()).toEqual(['CT03.1', 'CT03.2', 'CT04.1', 'CT03.7']);
  });

  it('arrastar pela alça ≡ move o teste; arrastar contra o cadeado não faz nada', () => {
    montar();
    fireEvent.dragStart(within(linha('CT04.1')).getByLabelText('Arrastar CT04.1'));
    fireEvent.dragOver(linha('CT03.1'));
    fireEvent.drop(linha('CT03.1'));
    expect(ordemAtual()).toEqual(['CT04.1', 'CT03.1', 'CT03.2', 'CT03.7']);

    fireEvent.dragStart(within(linha('CT03.7')).getByLabelText('Arrastar CT03.7'));
    fireEvent.dragOver(linha('CT04.1'));
    fireEvent.drop(linha('CT04.1'));
    expect(ordemAtual()).toEqual(['CT04.1', 'CT03.1', 'CT03.2', 'CT03.7']); // CT03.7 ia passar do CT03.2
  });

  it('ordem que já chega errada: avisa, bloqueia o Salvar e "Corrigir sozinho" arruma', async () => {
    const props = montar([ct37, ct41, ct32]);
    expect(screen.getByRole('alert')).toHaveTextContent('CT03.2 precisa ficar antes de CT03.7');
    expect(salvar()).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: 'Corrigir sozinho' }));
    expect(ordemAtual()).toEqual(['CT03.2', 'CT03.7', 'CT04.1']);
    expect(screen.queryByRole('alert')).toBeNull();
    await userEvent.click(salvar());
    expect(props.onSalvar).toHaveBeenCalledWith(['CT03.2', 'CT03.7', 'CT04.1']);
  });

  it('"Ordenar por" prioridade ou data reorganiza (respeitando a massa); "Manual" volta à ordem salva', async () => {
    montar([
      item('CT03.1', { prioridade: 'P3', dataPlanejada: '2026-10-09' }),
      item('CT03.2', { prioridade: 'P3', dataPlanejada: '2026-10-08', idMassa: '0483' }),
      item('CT04.1', { prioridade: 'P1' }),
      item('CT03.7', { prioridade: 'P1', idMassa: '0483', dependeDe: ['CT03.2'], dataPlanejada: '2026-10-01' }),
    ]);
    const seletor = screen.getByLabelText('Ordenar por');
    await userEvent.selectOptions(seletor, 'prioridade');
    expect(ordemAtual()).toEqual(['CT04.1', 'CT03.2', 'CT03.7', 'CT03.1']); // P1 sobe, mas o CT03.2 vem antes do CT03.7
    await userEvent.selectOptions(seletor, 'data');
    expect(ordemAtual()).toEqual(['CT03.2', 'CT03.7', 'CT03.1', 'CT04.1']);
    await userEvent.selectOptions(seletor, 'manual');
    expect(ordemAtual()).toEqual(['CT03.1', 'CT03.2', 'CT04.1', 'CT03.7']);
    expect(salvar()).toBeDisabled();
  });

  it('erro ao salvar (ex.: 409 do servidor) aparece no modal e ele continua aberto', async () => {
    const { ErroApi } = await import('../src/pages/cenarios/clienteApi');
    const props = montar(undefined, {
      onSalvar: vi.fn(async () => {
        throw new ErroApi(409, 'ordem_invalida', ['Os testes do plano mudaram. Recarregue o plano e ordene de novo.']);
      }),
    });
    await userEvent.click(screen.getByRole('button', { name: 'Subir CT04.1' }));
    await userEvent.click(salvar());
    expect(await screen.findByRole('alert')).toHaveTextContent('Os testes do plano mudaram');
    expect(screen.getByRole('dialog', { name: 'Ordem de execução' })).toBeInTheDocument();
    expect(props.onFechar).not.toHaveBeenCalled();
  });

  it('Cancelar, ✕ e Esc fecham sem salvar', async () => {
    const props = montar();
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    await userEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    await userEvent.keyboard('{Escape}');
    expect(props.onFechar).toHaveBeenCalledTimes(3);
    expect(props.onSalvar).not.toHaveBeenCalled();
  });
});
