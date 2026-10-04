import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// O mosaico usa canvas; no jsdom basta saber que ele foi montado.
vi.mock('../src/shared/GridRevealBackdrop', () => ({ default: () => <div data-testid="fundo-animado" /> }));
vi.mock('../src/shared/MatrixDotLoader', () => ({ default: () => null }));

import App from '../src/App';
import { IncidentesProvider } from '../src/incidentes/ContextoIncidentes';
import Retro from '../src/pages/retro/Retro';
import type { Acao, Nota, Retro as DadosRetro } from '../src/retros/clienteRetros';
import { criarApiFalsa, item, pessoa, plano } from './apiFalsa';
import { renderComPessoas } from './ajudantes';

const HOJE = '2026-10-08';
const equipe = [pessoa('ana'), pessoa('bia'), pessoa('carlos')];

const planoConcluido = () =>
  plano(
    'pl_ret',
    '14/09/26',
    [
      item('CT03.2', { status: 'concluido', resultado: 'passou', estimativaMin: 30, tempoRealMin: 40, idMassa: '0483', dataExecucao: '2026-09-20' }),
      item('CT03.7', { status: 'concluido', resultado: 'passou', estimativaMin: 30, tempoRealMin: 40, idMassa: '0483', dependeDe: ['CT03.2'], dataExecucao: '2026-09-23' }),
      item('CT02.3', { status: 'concluido', resultado: 'falhou', estimativaMin: 70, tempoRealMin: 76, dataExecucao: '2026-09-22' }),
    ],
    { previsao: '2026-09-24' },
  );

const planoAndando = () =>
  plano('pl_and', '28/09/26', [item('CT01.1', { status: 'concluido', resultado: 'passou' }), item('CT01.2')], { previsao: '2026-10-13' });

const nota = (id: string, extra: Partial<Nota> = {}): Nota => ({ id, coluna: 'bem', texto: `Texto ${id}`, autor: 'bia', em: '2026-09-26T10:00:00.000Z', votos: [], ...extra });
const acao = (id: string, extra: Partial<Acao> = {}): Acao => ({
  id,
  texto: `Ação ${id}`,
  responsavel: 'ana',
  prazo: '2026-10-20',
  feito: false,
  feitoEm: null,
  feitoPor: null,
  origem: null,
  incId: null,
  criadaEm: '2026-09-26T10:00:00.000Z',
  criadaPor: 'ana',
  ...extra,
});
const retroDe = (extra: Partial<DadosRetro> = {}): DadosRetro => ({
  planoId: 'pl_ret',
  status: 'aberta',
  anonimas: false,
  fechadaEm: null,
  fechadaPor: null,
  notas: [],
  acoes: [],
  atualizadoEm: null,
  ...extra,
});

async function abrir(opcoes: { planos?: ReturnType<typeof plano>[]; planoId?: string | null; retro?: DadosRetro; voce?: string } = {}) {
  const api = criarApiFalsa({
    planos: opcoes.planos ?? [planoConcluido(), planoAndando()],
    pessoas: equipe,
    retros: opcoes.retro ? [opcoes.retro] : [],
    incidentes: [],
  });
  vi.stubGlobal('fetch', api.falso);
  const onIrParaPlanos = vi.fn();
  renderComPessoas(
    <IncidentesProvider>
      <Retro planoId={opcoes.planoId === undefined ? 'pl_ret' : opcoes.planoId} hoje={HOJE} onIrParaPlanos={onIrParaPlanos} />
    </IncidentesProvider>,
    equipe,
    opcoes.voce === undefined ? 'ana' : opcoes.voce || undefined,
  );
  if (opcoes.planoId !== null) await screen.findByTestId(/^retro-(status|indisponivel)$/);
  return { api, onIrParaPlanos };
}

const coluna = (c: 'bem' | 'melhorar' | 'acoes') => screen.getByTestId(`coluna-retro-${c}`);

beforeEach(() => vi.unstubAllGlobals());
afterEach(() => vi.unstubAllGlobals());

describe('Retro — plano concluído', () => {
  it('mostra o título, o status ABERTA, as três colunas vazias e as sugestões tiradas dos dados', async () => {
    await abrir();
    expect(await screen.findByRole('heading', { level: 3, name: 'Retrospectiva — Plano 14/09/26' })).toBeInTheDocument();
    expect(screen.getByTestId('retro-status')).toHaveTextContent('Status: ABERTA');
    expect(screen.getByRole('heading', { level: 3, name: 'Foi bem (0)' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Pode melhorar (0)' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Ações (0)' })).toBeInTheDocument();
    const sugestoes = within(screen.getByTestId('sugestoes')).getAllByRole('listitem').map((l) => l.textContent);
    expect(sugestoes).toEqual([
      '• 1 teste concluiu com falha (CT02.3)+ nota "Pode melhorar"',
      '• Estimado 130 min, real 156 min (+20%)+ nota "Pode melhorar"',
      '• Massa 0483 reutilizada por 2 testes (CT03.2 → CT03.7)+ nota "Pode melhorar"',
      '• Concluído dentro da previsão de 24/09/2026+ nota "Foi bem"',
    ]);
  });

  it('sugestão vira nota na coluna indicada, com o autor, e some da lista', async () => {
    const { api } = await abrir();
    await userEvent.click(await screen.findByRole('button', { name: 'Virar nota "Pode melhorar": 1 teste concluiu com falha (CT02.3)' }));
    await within(coluna('melhorar')).findByText('1 teste concluiu com falha (CT02.3)');
    expect(screen.getByRole('heading', { level: 3, name: 'Pode melhorar (1)' })).toBeInTheDocument();
    expect(api.escritas()).toEqual([
      { metodo: 'POST', caminho: '/api/retros/pl_ret/notas', corpo: { coluna: 'melhorar', texto: '1 teste concluiu com falha (CT02.3)', autor: 'ana' } },
    ]);
    expect(screen.queryByRole('button', { name: /Virar nota .*1 teste concluiu/ })).toBeNull();
  });

  it('nota nova pelo formulário inline: exige texto, salva e cancela', async () => {
    const { api } = await abrir();
    await userEvent.click(await screen.findByRole('button', { name: 'Nova nota (Foi bem)' }));
    await userEvent.click(within(coluna('bem')).getByRole('button', { name: 'Salvar' }));
    expect(within(coluna('bem')).getByRole('alert')).toHaveTextContent('Escreva a nota.');
    await userEvent.type(screen.getByLabelText('Escreva a nota (Foi bem)'), '  Kanban com WIP evitou 2 execuções ao mesmo tempo.  ');
    await userEvent.click(within(coluna('bem')).getByRole('button', { name: 'Salvar' }));
    await within(coluna('bem')).findByText('Kanban com WIP evitou 2 execuções ao mesmo tempo.');
    expect(screen.getByRole('heading', { level: 3, name: 'Foi bem (1)' })).toBeInTheDocument();
    expect(api.escritas()[0].corpo).toEqual({ coluna: 'bem', texto: 'Kanban com WIP evitou 2 execuções ao mesmo tempo.', autor: 'ana' });

    await userEvent.click(screen.getByRole('button', { name: 'Nova nota (Foi bem)' }));
    await userEvent.type(screen.getByLabelText('Escreva a nota (Foi bem)'), 'rascunho');
    await userEvent.click(within(coluna('bem')).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByLabelText('Escreva a nota (Foi bem)')).toBeNull();
    expect(api.escritas()).toHaveLength(1);
  });

  it('votar: +1 por pessoa; o segundo clique tira o voto; mais votada sobe', async () => {
    const retro = retroDe({ notas: [nota('a', { texto: 'Primeira' }), nota('b', { texto: 'Segunda', votos: ['carlos'] })] });
    const { api } = await abrir({ retro });
    await screen.findByText('Segunda');
    const textos = () => within(coluna('bem')).getAllByRole('listitem').map((l) => l.querySelector('p')?.textContent);
    expect(textos()).toEqual(['Segunda', 'Primeira']);

    await userEvent.click(screen.getByRole('button', { name: 'Votar em: Primeira' }));
    const voto = await screen.findByRole('button', { name: 'Tirar o voto de: Primeira' });
    expect(voto).toHaveTextContent('+1');
    expect(voto).toHaveAttribute('aria-pressed', 'true');
    expect(textos()).toEqual(['Primeira', 'Segunda']); // empate em 1 voto: volta a ordem original
    expect(api.escritas()[0]).toMatchObject({ caminho: '/api/retros/pl_ret/notas/a/votos', corpo: { pessoa: 'ana' } });

    await userEvent.click(voto);
    expect(await screen.findByRole('button', { name: 'Votar em: Primeira' })).toHaveTextContent('+0');
  });

  it('mostra quem votou e quem escreveu; com "Notas anônimas" some o nome e só a própria nota diz "(sua nota)"', async () => {
    const retro = retroDe({ notas: [nota('a', { texto: 'Texto um', autor: 'bia', votos: ['carlos'] }), nota('b', { texto: 'Texto dois', autor: 'ana' })] });
    await abrir({ retro });
    const daBia = await screen.findByTestId('nota-a');
    expect(daBia).toHaveTextContent('(Carlos)');
    expect(daBia).toHaveTextContent('Bia');

    await userEvent.click(screen.getByRole('checkbox', { name: 'Notas anônimas' }));
    await vi.waitFor(() => expect(screen.getByTestId('nota-b')).toHaveTextContent('(sua nota)'));
    expect(screen.getByTestId('nota-a')).not.toHaveTextContent('Bia');
    expect(screen.getByTestId('nota-a')).not.toHaveTextContent('Carlos');
    expect(screen.getByTestId('nota-a')).toHaveTextContent('+1');
    expect(screen.getByTestId('nota-b')).not.toHaveTextContent('Ana');
  });

  it('excluir nota tira da coluna', async () => {
    await abrir({ retro: retroDe({ notas: [nota('a', { texto: 'Sai daqui' })] }) });
    await userEvent.click(await screen.findByRole('button', { name: 'Excluir a nota: Sai daqui' }));
    await vi.waitFor(() => expect(screen.queryByText('Sai daqui')).toBeNull());
    expect(screen.getByRole('heading', { level: 3, name: 'Foi bem (0)' })).toBeInTheDocument();
  });

  it('sem "Você": avisa e desabilita escrever, votar e usar sugestões', async () => {
    await abrir({ voce: '', retro: retroDe({ notas: [nota('a')] }) });
    expect(await screen.findByText(/Escolha “Você” no cabeçalho/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nova nota (Foi bem)' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Votar em: Texto a' })).toBeDisabled();
    expect(screen.getAllByRole('button', { name: /^Virar nota/ })[0]).toBeDisabled();
  });
});

describe('Retro — ações (M14)', () => {
  it('"Virar ação" abre o modal com a origem; salva com responsável (Você), prazo e mostra quanto falta', async () => {
    const { api } = await abrir({ retro: retroDe({ notas: [nota('a', { coluna: 'melhorar', texto: 'Reuso de massa sem ordem' })] }) });
    await userEvent.click(await screen.findByRole('button', { name: 'Virar ação: Reuso de massa sem ordem' }));
    const modal = screen.getByRole('dialog', { name: 'Nova ação' });
    expect(within(modal).getByText('nota "Reuso de massa sem ordem"')).toBeInTheDocument();
    expect(within(modal).getByLabelText('Responsável')).toHaveValue('ana');

    await userEvent.click(within(modal).getByRole('button', { name: 'Salvar ação' }));
    expect(within(modal).getByRole('alert')).toHaveTextContent('Ação é obrigatória.');

    await userEvent.type(within(modal).getByLabelText('Ação'), 'Ordenar CT03.2 antes do CT03.7');
    await userEvent.type(within(modal).getByLabelText('Prazo'), '2026-10-20');
    await userEvent.click(within(modal).getByRole('button', { name: 'Salvar ação' }));

    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(api.escritas()[0]).toMatchObject({
      metodo: 'POST',
      caminho: '/api/retros/pl_ret/acoes',
      corpo: { texto: 'Ordenar CT03.2 antes do CT03.7', responsavel: 'ana', prazo: '2026-10-20', origem: 'Reuso de massa sem ordem', incId: null, autor: 'ana' },
    });
    expect(within(coluna('acoes')).getByText('Resp.: Ana · até 20/10/2026 (faltam 12 dias) · (sem INC)')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Ações (1)' })).toBeInTheDocument();
  });

  it('"Criar também um INC": exige o número, abre o INC e liga na ação', async () => {
    const { api } = await abrir();
    await userEvent.click(await screen.findByRole('button', { name: 'Nova ação' }));
    const modal = screen.getByRole('dialog', { name: 'Nova ação' });
    await userEvent.type(within(modal).getByLabelText('Ação'), 'Corrigir saldo do faturamento');
    await userEvent.click(within(modal).getByRole('checkbox', { name: 'Criar também um INC' }));
    await userEvent.click(within(modal).getByRole('button', { name: 'Salvar ação' }));
    expect(within(modal).getByRole('alert')).toHaveTextContent('Informe o número do INC.');

    await userEvent.type(within(modal).getByLabelText('Número do INC'), 'inc0000009');
    await userEvent.selectOptions(within(modal).getByLabelText('Severidade do INC'), 'alta');
    await userEvent.click(within(modal).getByRole('button', { name: 'Salvar ação' }));

    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const [inc, acaoCriada] = api.escritas();
    expect(inc).toMatchObject({ caminho: '/api/incidentes', corpo: { numero: 'inc0000009', titulo: 'Corrigir saldo do faturamento', severidade: 'alta', responsavel: 'ana', autor: 'ana' } });
    expect(acaoCriada).toMatchObject({ caminho: '/api/retros/pl_ret/acoes', corpo: { incId: 'INC0000009' } });
    expect(within(coluna('acoes')).getByText(/· INC0000009$/)).toBeInTheDocument();
  });

  it('INC repetido: mostra o erro no modal e não cria a ação', async () => {
    const api = criarApiFalsa({
      planos: [planoConcluido()],
      pessoas: equipe,
      incidentes: [
        { numero: 'INC0000009', titulo: 'Já existe', descricao: '', status: 'novo', severidade: 'media', responsavel: null, testesAfetados: [], comentarios: [], historico: [], abertoEm: '2026-10-01T10:00:00.000Z', resolvidoEm: null, atualizadoEm: '2026-10-01T10:00:00.000Z', versao: 1 },
      ],
    });
    vi.stubGlobal('fetch', api.falso);
    renderComPessoas(
      <IncidentesProvider>
        <Retro planoId="pl_ret" hoje={HOJE} onIrParaPlanos={vi.fn()} />
      </IncidentesProvider>,
      equipe,
      'ana',
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Nova ação' }));
    const modal = screen.getByRole('dialog', { name: 'Nova ação' });
    await userEvent.type(within(modal).getByLabelText('Ação'), 'Outra');
    await userEvent.click(within(modal).getByRole('checkbox', { name: 'Criar também um INC' }));
    await userEvent.type(within(modal).getByLabelText('Número do INC'), 'INC0000009');
    await userEvent.click(within(modal).getByRole('button', { name: 'Salvar ação' }));
    expect(await within(modal).findByRole('alert')).toHaveTextContent('Já existe o INC INC0000009.');
    expect(api.escritas().some((c) => c.caminho.includes('/acoes'))).toBe(false);
  });

  it('marcar como feita grava quem e quando; desmarcar volta; clicar no texto edita; excluir tira', async () => {
    const { api } = await abrir({ retro: retroDe({ acoes: [acao('1', { texto: 'Revisar estimativas' })] }) });
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Marcar como feita: Revisar estimativas' }));
    expect(await screen.findByText(/^feita em \d{2}\/\d{2}\/\d{4} por Ana$/)).toBeInTheDocument();
    expect(api.escritas()[0]).toMatchObject({ metodo: 'PATCH', caminho: '/api/retros/pl_ret/acoes/1', corpo: { feito: true, autor: 'ana' } });
    await userEvent.click(screen.getByRole('checkbox', { name: 'Marcar como feita: Revisar estimativas' }));
    await vi.waitFor(() => expect(screen.queryByText(/^feita em/)).toBeNull());

    await userEvent.click(screen.getByRole('button', { name: 'Editar ação: Revisar estimativas' }));
    const modal = screen.getByRole('dialog', { name: 'Editar ação' });
    await userEvent.clear(within(modal).getByLabelText('Ação'));
    await userEvent.type(within(modal).getByLabelText('Ação'), 'Revisar estimativas do time');
    await userEvent.selectOptions(within(modal).getByLabelText('Responsável'), 'carlos');
    await userEvent.click(within(modal).getByRole('button', { name: 'Salvar ação' }));
    await within(coluna('acoes')).findByText('Revisar estimativas do time');
    expect(within(coluna('acoes')).getByText(/Resp\.: Carlos/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Editar ação: Revisar estimativas do time' }));
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Editar ação' })).getByRole('button', { name: 'Excluir ação' }));
    await vi.waitFor(() => expect(screen.getByRole('heading', { level: 3, name: 'Ações (0)' })).toBeInTheDocument());
  });
});

describe('Retro — fechar e reabrir', () => {
  const comAcoes = () =>
    retroDe({
      notas: [nota('a', { texto: 'Uma nota' })],
      acoes: [acao('1', { texto: 'Pendente' }), acao('2', { texto: 'Feita', feito: true, feitoEm: '2026-09-28T10:00:00.000Z', feitoPor: 'carlos', responsavel: 'carlos' })],
    });

  it('fechar trava notas e votos, mostra o resumo das ações e as ações seguem editáveis', async () => {
    const { api } = await abrir({ retro: comAcoes() });
    await userEvent.click(await screen.findByRole('button', { name: 'Fechar retro' }));
    expect(await screen.findByText('Status: FECHADA')).toBeInTheDocument();
    expect(api.escritas()[0]).toMatchObject({ metodo: 'PUT', caminho: '/api/retros/pl_ret', corpo: { status: 'fechada', autor: 'ana' } });
    expect(screen.getByTestId('retro-fechada-em')).toHaveTextContent(/^Fechada em \d{2}\/\d{2}\/\d{4} por Ana\./);

    expect(screen.getByRole('button', { name: 'Nova nota (Foi bem)' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Votar em: Uma nota' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Excluir a nota: Uma nota' })).toBeNull();
    expect(screen.getByRole('checkbox', { name: 'Notas anônimas' })).toBeDisabled();
    expect(screen.queryByTestId('sugestoes')).toBeNull();

    const resumo = screen.getByTestId('resumo-acoes');
    expect(resumo).toHaveTextContent('Ações pendentes (1)');
    expect(resumo).toHaveTextContent('[ ] Pendente — Ana — até 20/10/2026 (faltam 12 dias)');
    expect(resumo).toHaveTextContent('Ações concluídas (1)');
    expect(resumo).toHaveTextContent('[x] Feita — Carlos — 28/09/2026');

    await userEvent.click(screen.getByRole('checkbox', { name: 'Marcar como feita: Pendente' }));
    await vi.waitFor(() => expect(screen.getByTestId('resumo-acoes')).toHaveTextContent('Ações concluídas (2)'));
  });

  it('reabrir pede confirmação mostrando quem fechou; "Manter fechada" não muda nada', async () => {
    const { api } = await abrir({ retro: retroDe({ status: 'fechada', fechadaEm: '2026-09-26T10:00:00.000Z', fechadaPor: 'bia' }) });
    await userEvent.click(await screen.findByRole('button', { name: 'Reabrir' }));
    const aviso = screen.getByRole('alertdialog', { name: 'Confirmar reabertura' });
    expect(aviso).toHaveTextContent('Foi fechada por Bia em 26/09/2026.');
    await userEvent.click(within(aviso).getByRole('button', { name: 'Manter fechada' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(api.escritas()).toEqual([]);

    await userEvent.click(screen.getByRole('button', { name: 'Reabrir' }));
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Reabrir' }));
    expect(await screen.findByText('Status: ABERTA')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fechar retro' })).toBeInTheDocument();
  });

  it('servidor recusando (retro fechada por outra pessoa) mostra o aviso da tela', async () => {
    const retro = retroDe({ notas: [nota('a', { texto: 'Uma nota' })] });
    const { api } = await abrir({ retro });
    await screen.findByText('Uma nota');
    // Outra pessoa fecha por fora; a tela ainda mostra aberta e o voto é recusado.
    await api.falso('/api/retros/pl_ret', { method: 'PUT', body: JSON.stringify({ status: 'fechada', autor: 'bia' }) });
    await userEvent.click(screen.getByRole('button', { name: 'Votar em: Uma nota' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('A retrospectiva está fechada: reabra para mexer em notas e votos.');
  });
});

describe('Retro — plano ainda em andamento', () => {
  it('explica, mostra quanto falta e deixa abrir a retro de um plano anterior', async () => {
    await abrir({ planoId: 'pl_and' });
    const aviso = await screen.findByTestId('retro-indisponivel');
    expect(aviso).toHaveTextContent('Plano 28/09/26 ainda está em andamento (1 de 2).');
    expect(aviso).toHaveTextContent('A retrospectiva abre quando todos os testes estiverem concluídos.');
    expect(screen.queryByRole('button', { name: 'Fechar retro' })).toBeNull();

    await userEvent.selectOptions(within(aviso).getByLabelText('Retros anteriores'), 'pl_ret');
    expect(await screen.findByRole('heading', { level: 3, name: 'Retrospectiva — Plano 14/09/26' })).toBeInTheDocument();
  });

  it('sem plano nenhum: avisa e oferece ir para Planos', async () => {
    const { onIrParaPlanos } = await abrir({ planoId: null, planos: [] });
    await userEvent.click(screen.getByRole('button', { name: 'Ir para Planos' }));
    expect(onIrParaPlanos).toHaveBeenCalledTimes(1);
  });
});

describe('Retro — dentro do app', () => {
  it('o item Retro do menu abre a retrospectiva do plano escolhido', async () => {
    const api = criarApiFalsa({ planos: [planoConcluido()], pessoas: equipe, incidentes: [] });
    vi.stubGlobal('fetch', api.falso);
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    const menu = screen.getByRole('complementary', { name: 'Navegação' });
    await userEvent.click(within(menu).getByRole('button', { name: /^Retro/ }));
    expect(screen.getByRole('heading', { level: 2, name: 'Retro' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { level: 3, name: 'Retrospectiva — Plano 14/09/26' })).toBeInTheDocument();
  });
});
