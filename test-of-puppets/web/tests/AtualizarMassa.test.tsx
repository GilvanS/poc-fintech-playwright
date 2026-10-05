import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PropostaMassa } from '../src/massa/clienteMassa';
import PlanoDetalhe from '../src/pages/planos/PlanoDetalhe';
import { criarApiFalsa, item, plano } from './apiFalsa';
import { json } from './apiFalsaBase';

const CPF = '11111111111';

const proposta = (extra: Partial<PropostaMassa> = {}): PropostaMassa => ({
  propostaId: 'pm_1',
  cpf: CPF,
  fonte: { origem: 'http://127.0.0.1:3001/api/admin/scripts/export-massas-csv', lidoEm: '2026-10-04T13:42:00.000Z' },
  linhas: [
    { coluna: 'saldo_conta', antes: '25000,00', depois: '24615,07', regra: 'atualiza' },
    { coluna: 'status_fatura_fechada', antes: 'VIGENTE', depois: 'PAGO_PARCIAL', regra: 'atualiza' },
    { coluna: 'fatura_aberta', antes: '260,58', depois: '260,58', regra: 'igual' },
    { coluna: 'fatura_fechada', antes: '153,42', depois: '153,42', regra: 'imutavel', motivo: 'imutável — não grava' },
  ],
  temMudanca: true,
  backup: 'dados/backups/MassaDados.2026-10-04.xlsx',
  planilha: 'A:/projeto/data/MassaDados.xlsx',
  ...extra,
});

/** O servidor falso do plano + as duas rotas de massa, anotando o que foi chamado. */
function abrirComMassa(opcoes: { proposta?: PropostaMassa; confirmar?: () => Response } = {}) {
  const concluido = item('CT03.1', { nome: 'Pagar valor total', idMassa: '0100', cpf: CPF, status: 'concluido', resultado: 'passou' });
  const agendado = item('CT03.2', { nome: 'Pagar valor mínimo', idMassa: '0483', cpf: '22222222222' });
  const api = criarApiFalsa({ planos: [plano('pl_a', '28/09/26', [concluido, agendado])] });
  const massa: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (entrada: RequestInfo | URL, init?: RequestInit) => {
      const caminho = new URL(String(entrada), 'http://local').pathname;
      if (caminho === '/api/massa/proposta') {
        massa.push('proposta');
        return json(200, { proposta: opcoes.proposta ?? proposta() });
      }
      if (caminho === '/api/massa/confirmar') {
        massa.push(`confirmar ${JSON.parse(String(init?.body)).propostaId}`);
        return opcoes.confirmar
          ? opcoes.confirmar()
          : json(200, { resultado: { cpf: CPF, backup: 'dados/backups/MassaDados.2026-10-04.xlsx', gravadas: [{ coluna: 'saldo_conta', valor: '24615,07' }, { coluna: 'status_fatura_fechada', valor: 'PAGO_PARCIAL' }] } });
      }
      return api.falso(entrada, init);
    }),
  );
  return massa;
}

async function abrirDetalhe(idCenario: string) {
  render(<PlanoDetalhe id="pl_a" onFechar={vi.fn()} onMudou={vi.fn()} />);
  await screen.findByRole('heading', { name: 'Plano: 28/09/26' });
  const u = userEvent.setup();
  await u.click(screen.getByRole('button', { name: `Ver detalhes de ${idCenario}` }));
  await u.click(await screen.findByRole('tab', { name: 'Cenário e Datas' })); // a massa (CPF) fica nesta aba
}

beforeEach(() => vi.unstubAllGlobals());
afterEach(() => vi.unstubAllGlobals());

describe('Atualizar massa (M8)', () => {
  it('o botão só aparece para teste concluído com CPF', async () => {
    abrirComMassa();
    await abrirDetalhe('CT03.2');
    expect(screen.queryByRole('button', { name: 'Atualizar massa' })).toBeNull();
  });

  it('mostra o diff (antes/depois/regra), a fonte, o backup e o aviso — sem gravar nada ainda', async () => {
    const massa = abrirComMassa();
    await abrirDetalhe('CT03.1');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Atualizar massa' }));

    const modal = await screen.findByRole('dialog', { name: 'Atualizar massa' });
    const saldo = await within(modal).findByTestId('massa-saldo_conta');
    expect(saldo).toHaveTextContent('25000,00');
    expect(saldo).toHaveTextContent('24615,07');
    expect(saldo).toHaveTextContent('atualiza');
    expect(within(modal).getByTestId('massa-status_fatura_fechada')).toHaveTextContent('PAGO_PARCIAL');
    expect(within(modal).getByTestId('massa-fatura_aberta')).toHaveTextContent('sem mudança');
    expect(within(modal).getByTestId('massa-fatura_fechada')).toHaveTextContent('imutável — não grava');
    expect(modal).toHaveTextContent('Backup antes de gravar: dados/backups/MassaDados.2026-10-04.xlsx');
    expect(modal).toHaveTextContent('Isto altera A:/projeto/data/MassaDados.xlsx.');
    expect(massa).toEqual(['proposta']);
  });

  it('Cancelar fecha sem gravar', async () => {
    const massa = abrirComMassa();
    await abrirDetalhe('CT03.1');
    const u = userEvent.setup();
    await u.click(screen.getByRole('button', { name: 'Atualizar massa' }));
    const modal = await screen.findByRole('dialog', { name: 'Atualizar massa' });
    await within(modal).findByTestId('massa-saldo_conta');
    await u.click(within(modal).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog', { name: 'Atualizar massa' })).toBeNull();
    expect(massa).toEqual(['proposta']);
  });

  it('Confirmar e gravar manda só a proposta que a pessoa viu e mostra o backup', async () => {
    const massa = abrirComMassa();
    await abrirDetalhe('CT03.1');
    const u = userEvent.setup();
    await u.click(screen.getByRole('button', { name: 'Atualizar massa' }));
    const modal = await screen.findByRole('dialog', { name: 'Atualizar massa' });
    await within(modal).findByTestId('massa-saldo_conta');
    await u.click(within(modal).getByRole('button', { name: 'Confirmar e gravar' }));

    expect(await within(modal).findByRole('status')).toHaveTextContent('Massa atualizada (2 colunas). Backup em dados/backups/MassaDados.2026-10-04.xlsx');
    expect(massa).toEqual(['proposta', 'confirmar pm_1']);
    expect(within(modal).queryByRole('button', { name: 'Confirmar e gravar' })).toBeNull();
  });

  it('Excel aberto: mostra o bloqueio e desliga o Confirmar', async () => {
    abrirComMassa({ proposta: proposta({ bloqueio: 'O Excel está com a planilha aberta (existe ~$MassaDados.xlsx). Feche o Excel antes de gravar.' }) });
    await abrirDetalhe('CT03.1');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Atualizar massa' }));
    const modal = await screen.findByRole('dialog', { name: 'Atualizar massa' });
    expect(await within(modal).findByText(/Excel está com a planilha aberta/)).toBeInTheDocument();
    expect(within(modal).getByRole('button', { name: 'Confirmar e gravar' })).toBeDisabled();
  });

  it('sem diferença: avisa que não há o que gravar e o Confirmar fica desligado', async () => {
    abrirComMassa({ proposta: proposta({ temMudanca: false }) });
    await abrirDetalhe('CT03.1');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Atualizar massa' }));
    const modal = await screen.findByRole('dialog', { name: 'Atualizar massa' });
    expect(await within(modal).findByText(/não há o que gravar/)).toBeInTheDocument();
    expect(within(modal).getByRole('button', { name: 'Confirmar e gravar' })).toBeDisabled();
  });

  it('planilha mudou: mostra o erro do servidor e "Ver o diff de novo" refaz a proposta', async () => {
    const massa = abrirComMassa({ confirmar: () => json(409, { erro: 'planilha_mudou', mensagem: 'A planilha mudou depois que o diff foi montado.' }) });
    await abrirDetalhe('CT03.1');
    const u = userEvent.setup();
    await u.click(screen.getByRole('button', { name: 'Atualizar massa' }));
    const modal = await screen.findByRole('dialog', { name: 'Atualizar massa' });
    await within(modal).findByTestId('massa-saldo_conta');
    await u.click(within(modal).getByRole('button', { name: 'Confirmar e gravar' }));
    expect(await within(modal).findByRole('alert')).toHaveTextContent('A planilha mudou depois que o diff foi montado.');
    await u.click(within(modal).getByRole('button', { name: 'Ver o diff de novo' }));
    await within(modal).findByTestId('massa-saldo_conta');
    expect(massa).toEqual(['proposta', 'confirmar pm_1', 'proposta']);
  });
});
