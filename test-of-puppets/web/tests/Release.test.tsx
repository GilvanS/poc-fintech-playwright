import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// O mosaico usa canvas; no jsdom basta saber que ele foi montado.
vi.mock('../src/shared/GridRevealBackdrop', () => ({ default: () => <div data-testid="fundo-animado" /> }));
vi.mock('../src/shared/MatrixDotLoader', () => ({ default: () => null }));

import App from '../src/App';
import type { Incidente } from '../src/incidentes/clienteIncidentes';
import { IncidentesProvider } from '../src/incidentes/ContextoIncidentes';
import type { Decisao } from '../src/pages/planos/clientePlanos';
import Release from '../src/pages/release/Release';
import { criarApiFalsa, item, pessoa, plano } from './apiFalsa';
import { renderComPessoas } from './ajudantes';

const HOJE = '2026-10-03';
const equipe = [pessoa('ana'), pessoa('bia'), pessoa('carlos')];

function inc(numero: string, extra: Partial<Incidente> = {}): Incidente {
  return {
    numero,
    titulo: `Titulo de ${numero}`,
    descricao: '',
    status: 'novo',
    severidade: 'media',
    responsavel: null,
    testesAfetados: [],
    comentarios: [],
    historico: [],
    abertoEm: '2026-10-01T14:10:00.000Z',
    resolvidoEm: null,
    atualizadoEm: '2026-10-01T14:10:00.000Z',
    versao: 1,
    ...extra,
  };
}

const planoMaster = (extra: { decisoes?: Decisao[]; atualizadoEm?: string } = {}) =>
  plano(
    'pl_master',
    '28/09/26',
    [
      item('CT03.1', { status: 'concluido', resultado: 'passou', responsavel: 'ana', prioridade: 'P1', estimativaMin: 20, ...(extra.atualizadoEm ? { atualizadoEm: extra.atualizadoEm } : {}) }),
      item('CT03.2', { status: 'em_andamento', responsavel: 'ana', prioridade: 'P1', estimativaMin: 30, idMassa: '0483' }),
      item('CT03.3', { responsavel: 'bia', prioridade: 'P2', estimativaMin: 25 }),
      item('CT03.7', { responsavel: 'bia', prioridade: 'P2', estimativaMin: 30, idMassa: '0483', dependeDe: ['CT03.2'] }),
      item('CT04.1', { responsavel: 'carlos', prioridade: 'P1', estimativaMin: 20, dataPlanejada: '2026-10-07' }),
      item('CT05.2', { status: 'concluido', resultado: 'falhou', responsavel: 'bia' }),
    ],
    { previsao: '2026-10-13', ...(extra.decisoes ? { decisoes: extra.decisoes } : {}) },
  );

/** Tudo cumprido: dois testes concluídos que passaram, com dono e estimativa. */
const planoPronto = (decisoes?: Decisao[], atualizadoEm?: string) =>
  plano(
    'pl_pronto',
    '05/10/26',
    [
      item('CT01.1', { status: 'concluido', resultado: 'passou', responsavel: 'ana', prioridade: 'P1', estimativaMin: 10, ...(atualizadoEm ? { atualizadoEm } : {}) }),
      item('CT01.2', { status: 'concluido', resultado: 'passou', responsavel: 'bia', prioridade: 'P2', estimativaMin: 10 }),
    ],
    { previsao: '2026-10-13', ...(decisoes ? { decisoes } : {}) },
  );

const incidentes = () => [
  inc('INC0715802225', { severidade: 'alta', status: 'em_analise', responsavel: 'ana', testesAfetados: ['CT03.1', 'CT03.2'] }),
  inc('INC0715799001', { severidade: 'media', responsavel: 'bia', testesAfetados: ['CT05.2'] }),
];

async function abrir(
  opcoes: { planos?: ReturnType<typeof plano>[]; planoId?: string | null; incidentes?: Incidente[]; voce?: string } = {},
) {
  const api = criarApiFalsa({ planos: opcoes.planos ?? [planoMaster()], pessoas: equipe, incidentes: opcoes.incidentes ?? incidentes() });
  vi.stubGlobal('fetch', api.falso);
  const onAbrirIncidentes = vi.fn();
  const onAbrirTeste = vi.fn();
  const onIrParaPlanos = vi.fn();
  renderComPessoas(
    <IncidentesProvider>
      <Release
        planoId={opcoes.planoId === undefined ? 'pl_master' : opcoes.planoId}
        hoje={HOJE}
        onAbrirIncidentes={onAbrirIncidentes}
        onAbrirTeste={onAbrirTeste}
        onIrParaPlanos={onIrParaPlanos}
      />
    </IncidentesProvider>,
    equipe,
    opcoes.voce === undefined ? 'ana' : opcoes.voce || undefined,
  );
  if (opcoes.planoId !== null) await screen.findByTestId('criterio-1');
  return { api, onAbrirIncidentes, onAbrirTeste, onIrParaPlanos };
}

const linha = (n: number) => screen.getByTestId(`criterio-${n}`);

beforeEach(() => vi.unstubAllGlobals());
afterEach(() => vi.unstubAllGlobals());

describe('Release — critérios', () => {
  it('mostra o plano, o alvo em dias úteis, a situação e quantos critérios estão cumpridos', async () => {
    await abrir();
    await screen.findByTestId('cumpridos');
    expect(screen.getByRole('heading', { level: 3, name: 'Release do plano 28/09/26' })).toBeInTheDocument();
    expect(screen.getByTestId('alvo')).toHaveTextContent('Alvo 13/10/2026 (7 dias úteis)');
    expect(screen.getByTestId('situacao')).toHaveTextContent('Situação: NO-GO');
    expect(screen.getByTestId('cumpridos')).toHaveTextContent('Critérios cumpridos 1 de 7');
    expect(screen.getByRole('progressbar', { name: 'Critérios cumpridos' })).toHaveAttribute('aria-valuenow', '14');
  });

  it('lista os 7 critérios com o valor de hoje e o estado', async () => {
    await abrir();
    const celulas = (n: number) => within(linha(n)).getAllByRole('cell').map((c) => c.textContent);
    expect(within(linha(1)).getByRole('rowheader')).toHaveTextContent('Todos os testes executados');
    expect(celulas(1)[1]).toBe('2 de 6');
    expect(celulas(2)[1]).toBe('1 falha (CT05.2)');
    expect(celulas(3)[1]).toBe('2 abertos (Alta 1, Média 1)');
    expect(celulas(4)[1]).toBe('1 de 3 (CT03.2, CT04.1 pendem)');
    expect(celulas(7)[1]).toBe('alvo em 7 dias úteis');
    expect(linha(1)).toHaveTextContent('Pendente');
    expect(linha(7)).toHaveTextContent('Cumprido');
    expect(within(linha(7)).queryByRole('button', { name: /critério 7/ })).toBeNull();
  });

  it('"ver" abre o que falta no critério e "abrir INC" leva para a tela de Incidentes', async () => {
    const { onAbrirIncidentes } = await abrir();
    await userEvent.click(screen.getByRole('button', { name: 'Ver critério 3' }));
    expect(screen.getByText('INC0715802225 · Alta · Em análise · Ana · afeta CT03.1 CT03.2')).toBeInTheDocument();
    expect(screen.getByText('INC0715799001 · Média · Novo · Bia · afeta CT05.2')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Abrir o INC INC0715802225' }));
    expect(onAbrirIncidentes).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: 'Ocultar critério 3' }));
    expect(screen.queryByText(/INC0715799001 · Média/)).toBeNull();
  });

  it('"abrir teste" em cada item do critério leva o teste para a Lista', async () => {
    const { onAbrirTeste } = await abrir();
    await userEvent.click(screen.getByRole('button', { name: 'Ver critério 4' }));
    await userEvent.click(screen.getByRole('button', { name: 'Abrir o teste CT04.1' }));
    expect(onAbrirTeste).toHaveBeenLastCalledWith('CT04.1');
    await userEvent.click(screen.getByRole('button', { name: 'Ver critério 5' }));
    await userEvent.click(screen.getByRole('button', { name: 'Abrir o teste CT03.7' }));
    expect(onAbrirTeste).toHaveBeenLastCalledWith('CT03.7');
  });

  it('critério sem teste (prazo) não tem "abrir teste"', async () => {
    const { onAbrirTeste } = await abrir({ planos: [plano('pl_sem_prazo', '05/10/26', [item('CT01.1', { responsavel: 'ana', estimativaMin: 5 })])], planoId: 'pl_sem_prazo' });
    await userEvent.click(screen.getByRole('button', { name: 'Ver critério 7' }));
    expect(screen.getByText('O plano não tem previsão: defina uma para medir o prazo')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Abrir o teste/ })).toBeNull();
    expect(onAbrirTeste).not.toHaveBeenCalled();
  });

  it('cada pendência é clicável: o teste abre na Lista e o INC leva para Incidentes', async () => {
    const { onAbrirTeste, onAbrirIncidentes } = await abrir();
    await userEvent.click(screen.getByRole('button', { name: 'Abrir pendência: CT03.2' }));
    expect(onAbrirTeste).toHaveBeenLastCalledWith('CT03.2');
    await userEvent.click(screen.getByRole('button', { name: 'Abrir pendência: INC0715802225' }));
    expect(onAbrirIncidentes).toHaveBeenCalledTimes(1);
    expect(onAbrirTeste).toHaveBeenCalledTimes(1);
  });

  it('a pendência do plano (prazo) não é botão', async () => {
    await abrir({ planos: [plano('pl_sem_prazo', '05/10/26', [item('CT01.1')])], planoId: 'pl_sem_prazo', incidentes: [] });
    const lista = within(screen.getByTestId('pendencias')).getAllByRole('listitem');
    const doPlano = lista.find((l) => l.textContent?.includes('definir a previsão do plano'));
    expect(doPlano).toBeTruthy();
    expect(within(doPlano as HTMLElement).queryByRole('button')).toBeNull();
  });

  it('prontidão por prioridade e por pessoa', async () => {
    await abrir();
    expect(screen.getByTestId('prontidao-P1')).toHaveTextContent('P11/3');
    expect(screen.getByTestId('prontidao-P2')).toHaveTextContent('P20/2');
    expect(screen.getByTestId('prontidao-sem')).toHaveTextContent('Sem prioridade');
    expect(screen.getByTestId('prontidao-bia')).toHaveTextContent('Bia0/3 passou (1 falha)');
    expect(screen.getByTestId('prontidao-ana')).toHaveTextContent('Ana1/2 passou');
  });

  it('pendências em ordem de impacto, 5 de cada vez, com "Ver todos"', async () => {
    await abrir();
    const lista = () => within(screen.getByTestId('pendencias')).getAllByRole('listitem');
    expect(lista()).toHaveLength(5);
    expect(lista()[0]).toHaveTextContent('1. INC0715802225 [Alta]Anaresolver o INC "Titulo de INC0715802225"');
    expect(lista()[1]).toHaveTextContent('2. CT03.2 [P1]Anaconcluir o teste (em andamento)');
    expect(lista()[2]).toHaveTextContent('3. CT04.1 [P1]Carlosexecutar (planejado 07/10)');
    await userEvent.click(screen.getByRole('button', { name: '... 2 itens a mais · Ver todos' }));
    expect(lista()).toHaveLength(7);
    expect(lista()[6]).toHaveTextContent('7. CT05.2 [sem prioridade]Biareexecutar após INC0715799001 · definir estimativa');
    await userEvent.click(screen.getByRole('button', { name: 'Mostrar menos' }));
    expect(lista()).toHaveLength(5);
  });

  it('sem plano: avisa e oferece ir para Planos', async () => {
    const { onIrParaPlanos } = await abrir({ planoId: null });
    expect(screen.getByText('Nenhum plano para mostrar. Crie um plano e escolha-o no cabeçalho.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Ir para Planos' }));
    expect(onIrParaPlanos).toHaveBeenCalledTimes(1);
  });

  it('"Atualizar" busca o plano e os INC de novo', async () => {
    const { api } = await abrir();
    const antes = api.chamadas.length;
    await userEvent.click(screen.getByRole('button', { name: 'Atualizar' }));
    await vi.waitFor(() => expect(api.chamadas.length).toBeGreaterThanOrEqual(antes + 2));
    expect(api.chamadas.slice(antes).map((c) => c.caminho).sort()).toEqual(['/api/incidentes', '/api/planos/pl_master']);
  });
});

describe('Release — decisão (M15)', () => {
  const abrirModal = async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Registrar decisão GO/NO-GO' }));
    return screen.getByRole('dialog', { name: 'Decisão do release — Plano 28/09/26' });
  };

  it('diz a situação atual e começa sem histórico', async () => {
    await abrir();
    expect(screen.getByTestId('situacao-atual')).toHaveTextContent('Situação atual: NO-GO — critérios 1, 2, 3, 4, 5 e 6 não atendidos.');
    expect(screen.getByText('(nenhuma ainda)')).toBeInTheDocument();
  });

  it('com critério pendente: GO fica desabilitado, NO-GO vem marcado e GO com exceção está livre', async () => {
    await abrir();
    const modal = await abrirModal();
    expect(within(modal).getByRole('radio', { name: 'GO' })).toBeDisabled();
    expect(within(modal).getByRole('radio', { name: 'NO-GO' })).toBeChecked();
    expect(within(modal).getByRole('radio', { name: 'GO com exceção' })).toBeEnabled();
    expect(within(modal).getByText(/Critérios não atendidos: 1, 2, 3, 4, 5 e 6\./)).toBeInTheDocument();
    expect(within(modal).getByText('Ana (você)')).toBeInTheDocument();
  });

  it('exige justificativa; ao registrar grava no plano, fecha e mostra no histórico', async () => {
    const { api } = await abrir();
    const modal = await abrirModal();
    await userEvent.click(within(modal).getByRole('button', { name: 'Registrar' }));
    expect(within(modal).getByRole('alert')).toHaveTextContent('Justificativa é obrigatória.');
    expect(api.escritas()).toEqual([]);

    await userEvent.type(within(modal).getByLabelText('Justificativa (obrigatória)'), '  Aguardar correção do INC0715802225.  ');
    await userEvent.click(within(modal).getByRole('button', { name: 'Registrar' }));

    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(api.escritas()).toEqual([
      {
        metodo: 'POST',
        caminho: '/api/planos/pl_master/decisoes',
        corpo: { decisao: 'no_go', justificativa: 'Aguardar correção do INC0715802225.', por: 'ana', criterios: [1, 2, 3, 4, 5, 6] },
      },
    ]);
    const historico = within(screen.getByTestId('historico-decisoes')).getAllByRole('listitem');
    expect(historico).toHaveLength(1);
    expect(historico[0]).toHaveTextContent('NO-GOAna"Aguardar correção do INC0715802225."');
    expect(screen.queryByText('(nenhuma ainda)')).toBeNull();
    expect(screen.getByTestId('situacao')).toHaveTextContent('Situação: NO-GO');
  });

  it('GO com exceção fica destacado no histórico com os critérios abertos', async () => {
    await abrir();
    const modal = await abrirModal();
    await userEvent.click(within(modal).getByRole('radio', { name: 'GO com exceção' }));
    await userEvent.type(within(modal).getByLabelText('Justificativa (obrigatória)'), 'Risco aceito pelo PO.');
    await userEvent.click(within(modal).getByRole('button', { name: 'Registrar' }));
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const [linhaHistorico] = within(screen.getByTestId('historico-decisoes')).getAllByRole('listitem');
    expect(linhaHistorico).toHaveTextContent('GO com exceçãoAna"Risco aceito pelo PO."exceção nos critérios 1, 2, 3, 4, 5 e 6');
    expect(screen.getByTestId('selo-liberado')).toHaveTextContent(/^Liberado em \d{2}\/\d{2}\/\d{4} por Ana$/);
  });

  it('Esc e Cancelar fecham sem gravar', async () => {
    const { api } = await abrir();
    await abrirModal();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    await abrirModal();
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(api.escritas()).toEqual([]);
  });

  it('sem "Você": escolhe quem decidiu na lista, e é obrigatório', async () => {
    const { api } = await abrir({ voce: '' });
    const modal = await abrirModal();
    await userEvent.type(within(modal).getByLabelText('Justificativa (obrigatória)'), 'Sem tempo.');
    await userEvent.click(within(modal).getByRole('button', { name: 'Registrar' }));
    expect(within(modal).getByRole('alert')).toHaveTextContent('Escolha quem está decidindo.');
    await userEvent.selectOptions(within(modal).getByRole('combobox', { name: 'Decidido por' }), 'bia');
    await userEvent.click(within(modal).getByRole('button', { name: 'Registrar' }));
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(api.escritas()[0].corpo).toMatchObject({ por: 'bia', decisao: 'no_go' });
  });

  it('com 7 de 7: GO habilita, GO com exceção desabilita e o plano ganha o selo "Liberado"', async () => {
    await abrir({ planos: [planoPronto()], planoId: 'pl_pronto', incidentes: [] });
    expect(screen.getByTestId('cumpridos')).toHaveTextContent('Critérios cumpridos 7 de 7');
    expect(screen.getByTestId('situacao')).toHaveTextContent('Situação: GO');
    expect(screen.getByTestId('situacao-atual')).toHaveTextContent('Situação atual: GO — todos os critérios cumpridos.');
    expect(screen.getByText('Nada pendente.')).toBeInTheDocument();
    expect(screen.queryByTestId('selo-liberado')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Registrar decisão GO/NO-GO' }));
    const modal = screen.getByRole('dialog');
    expect(within(modal).getByRole('radio', { name: 'GO' })).toBeChecked();
    expect(within(modal).getByRole('radio', { name: 'GO com exceção' })).toBeDisabled();
    await userEvent.type(within(modal).getByLabelText('Justificativa (obrigatória)'), 'Tudo verde.');
    await userEvent.click(within(modal).getByRole('button', { name: 'Registrar' }));
    expect(await screen.findByTestId('selo-liberado')).toHaveTextContent(/^Liberado em \d{2}\/\d{2}\/\d{4} por Ana$/);
  });

  it('servidor recusando mostra a mensagem no modal e mantém aberto', async () => {
    const api = criarApiFalsa({ planos: [planoMaster()], pessoas: equipe, incidentes: incidentes() });
    const original = api.falso;
    vi.stubGlobal('fetch', (entrada: RequestInfo | URL, init?: RequestInit) =>
      String(entrada).includes('/decisoes')
        ? Promise.resolve(new Response(JSON.stringify({ erro: 'validacao', mensagens: ['Justificativa deve ter no máximo 1000 caracteres.'] }), { status: 400, headers: { 'content-type': 'application/json' } }))
        : original(entrada, init),
    );
    renderComPessoas(
      <IncidentesProvider>
        <Release planoId="pl_master" hoje={HOJE} onAbrirIncidentes={vi.fn()} onAbrirTeste={vi.fn()} onIrParaPlanos={vi.fn()} />
      </IncidentesProvider>,
      equipe,
      'ana',
    );
    await screen.findByTestId('criterio-1');
    const modal = await abrirModal();
    await userEvent.type(within(modal).getByLabelText('Justificativa (obrigatória)'), 'x');
    await userEvent.click(within(modal).getByRole('button', { name: 'Registrar' }));
    expect(await within(modal).findByRole('alert')).toHaveTextContent('Justificativa deve ter no máximo 1000 caracteres.');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

describe('Release — depois do GO', () => {
  const go: Decisao = { id: 'dc_1', decisao: 'go', justificativa: 'Tudo verde.', por: 'bia', em: '2026-10-02T14:05:00.000Z', criterios: [] };

  it('GO valendo: mostra o selo com a data e quem liberou', async () => {
    await abrir({ planos: [planoPronto([go])], planoId: 'pl_pronto', incidentes: [] });
    expect(screen.getByTestId('selo-liberado')).toHaveTextContent('Liberado em 02/10/2026 por Bia');
    expect(screen.queryByTestId('aviso-reavaliar')).toBeNull();
  });

  it('teste alterado depois do GO: situação REAVALIAR e aviso a quem decidiu', async () => {
    await abrir({ planos: [planoPronto([go], '2026-10-02T15:00:00.000Z')], planoId: 'pl_pronto', incidentes: [] });
    expect(screen.getByTestId('situacao')).toHaveTextContent('Situação: REAVALIAR');
    expect(screen.getByTestId('aviso-reavaliar')).toHaveTextContent('Bia decidiu GO em 02/10/2026, mas CT01.1 mudou depois. Reavalie e registre uma nova decisão.');
    expect(screen.queryByTestId('selo-liberado')).toBeNull();
  });

  it('INC aberto depois do GO também volta a situação para REAVALIAR e diz qual INC', async () => {
    const depois = inc('INC0000009', { severidade: 'alta', abertoEm: '2026-10-03T09:00:00.000Z', testesAfetados: ['CT01.1'] });
    await abrir({ planos: [planoPronto([go])], planoId: 'pl_pronto', incidentes: [depois] });
    expect(screen.getByTestId('situacao')).toHaveTextContent('Situação: REAVALIAR');
    expect(screen.getByTestId('aviso-reavaliar')).toHaveTextContent('Bia decidiu GO em 02/10/2026, mas INC0000009 foi aberto depois. Reavalie e registre uma nova decisão.');
    expect(screen.queryByTestId('selo-liberado')).toBeNull();
  });

  it('INC aberto antes do GO, resolvido ou de outro plano não muda o GO', async () => {
    const incs = [
      inc('INC0000001', { abertoEm: '2026-10-01T09:00:00.000Z', testesAfetados: ['CT01.1'] }), // antes do GO
      inc('INC0000002', { abertoEm: '2026-10-03T09:00:00.000Z', status: 'resolvido', testesAfetados: ['CT01.1'] }), // já resolvido
      inc('INC0000003', { abertoEm: '2026-10-03T09:00:00.000Z', testesAfetados: ['CT99.9'] }), // não é deste plano
    ];
    await abrir({ planos: [planoPronto([go])], planoId: 'pl_pronto', incidentes: incs });
    // O INC1 (antes do GO) ainda reprova o critério 3, mas não "invalida" a decisão já tomada.
    expect(screen.getByTestId('situacao')).not.toHaveTextContent('REAVALIAR');
    expect(screen.queryByTestId('aviso-reavaliar')).toBeNull();
  });

  it('teste alterado e INC novo depois do GO aparecem juntos no aviso', async () => {
    const depois = inc('INC0000009', { abertoEm: '2026-10-03T09:00:00.000Z', testesAfetados: ['CT01.2'] });
    await abrir({ planos: [planoPronto([go], '2026-10-02T15:00:00.000Z')], planoId: 'pl_pronto', incidentes: [depois] });
    expect(screen.getByTestId('aviso-reavaliar')).toHaveTextContent('mas CT01.1 mudou e INC0000009 foi aberto depois.');
  });

  it('o histórico mostra a mais nova primeiro', async () => {
    const antigo: Decisao = { id: 'dc_0', decisao: 'no_go', justificativa: 'Faltou o P1.', por: 'ana', em: '2026-10-01T10:00:00.000Z', criterios: [4] };
    await abrir({ planos: [planoPronto([antigo, go])], planoId: 'pl_pronto', incidentes: [] });
    const itens = within(screen.getByTestId('historico-decisoes')).getAllByRole('listitem');
    expect(itens[0]).toHaveTextContent('GO');
    expect(itens[0]).toHaveTextContent('"Tudo verde."');
    expect(itens[1]).toHaveTextContent('NO-GO');
    expect(itens[1]).toHaveTextContent('"Faltou o P1."');
  });
});

describe('Release — dentro do app', () => {
  it('o item Release do menu abre a tela do plano escolhido', async () => {
    const api = criarApiFalsa({ planos: [planoMaster()], pessoas: equipe, incidentes: incidentes() });
    vi.stubGlobal('fetch', api.falso);
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    const menu = screen.getByRole('complementary', { name: 'Navegação' });
    await userEvent.click(within(menu).getByRole('button', { name: /^Release/ }));
    expect(screen.getByRole('heading', { level: 2, name: 'Release' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { level: 3, name: 'Release do plano 28/09/26' })).toBeInTheDocument();
    expect(await screen.findByTestId('criterio-3')).toHaveTextContent('2 abertos (Alta 1, Média 1)');

    await userEvent.click(screen.getByRole('button', { name: 'Ver critério 3' }));
    await userEvent.click(screen.getByRole('button', { name: 'Abrir o INC INC0715802225' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Incidentes' })).toBeInTheDocument();
  });

  it('"abrir teste" de um critério leva para a Lista com o detalhe daquele teste já aberto; o menu "Lista" volta a mostrar só a lista', async () => {
    const api = criarApiFalsa({ planos: [planoMaster()], pessoas: equipe, incidentes: incidentes() });
    vi.stubGlobal('fetch', api.falso);
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    const menu = screen.getByRole('complementary', { name: 'Navegação' });
    await userEvent.click(within(menu).getByRole('button', { name: /^Release/ }));
    await screen.findByTestId('criterio-4');
    await userEvent.click(screen.getByRole('button', { name: 'Ver critério 4' }));
    await userEvent.click(screen.getByRole('button', { name: 'Abrir o teste CT04.1' }));

    expect(await screen.findByRole('heading', { level: 2, name: 'Lista' })).toBeInTheDocument();
    expect(await screen.findByRole('dialog', { name: 'Detalhe do teste' })).toHaveTextContent('CT04.1');

    await userEvent.keyboard('{Escape}');
    await userEvent.click(within(menu).getByRole('button', { name: 'Kanban' }));
    await userEvent.click(within(menu).getByRole('button', { name: 'Lista' }));
    await screen.findByRole('heading', { level: 3, name: 'Plano: 28/09/26' });
    expect(screen.queryByRole('dialog', { name: 'Detalhe do teste' })).toBeNull();
  });

  it('uma pendência de teste também abre o detalhe na Lista', async () => {
    const api = criarApiFalsa({ planos: [planoMaster()], pessoas: equipe, incidentes: incidentes() });
    vi.stubGlobal('fetch', api.falso);
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    await userEvent.click(within(screen.getByRole('complementary', { name: 'Navegação' })).getByRole('button', { name: /^Release/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Abrir pendência: CT03.2' }));
    expect(await screen.findByRole('dialog', { name: 'Detalhe do teste' })).toHaveTextContent('CT03.2');
  });
});
