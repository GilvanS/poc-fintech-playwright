import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Cenarios from '../src/pages/cenarios/Cenarios';
import type { CenarioVisao } from '../src/pages/cenarios/clienteApi';

const AGORA = '2026-10-03T10:00:00.000Z';

function cenario(idCenario: string, extra: Partial<CenarioVisao> = {}): CenarioVisao {
  return {
    idCenario,
    nome: `Nome de ${idCenario}`,
    funcionalidade: 'Faturas',
    versao: 1,
    criadoEm: AGORA,
    atualizadoEm: AGORA,
    dependeDe: [],
    massaCompartilhadaCom: [],
    ...extra,
  };
}

function ordem(id: string): [number, number] {
  const [a, b] = id.replace('CT', '').split('.').map(Number);
  return [a, b];
}

/** Recalcula o que o servidor calcula sozinho: massa repetida => o de numeração maior depende do menor. */
function derivar(base: CenarioVisao[]): CenarioVisao[] {
  const ordenados = [...base].sort((x, y) => {
    const [a1, a2] = ordem(x.idCenario);
    const [b1, b2] = ordem(y.idCenario);
    return a1 - b1 || a2 - b2;
  });
  return ordenados.map((c) => {
    const grupo = c.idMassa ? ordenados.filter((o) => o.idMassa === c.idMassa).map((o) => o.idCenario) : [];
    const pos = grupo.indexOf(c.idCenario);
    return { ...c, dependeDe: grupo.slice(0, Math.max(pos, 0)), massaCompartilhadaCom: grupo.filter((i) => i !== c.idCenario) };
  });
}

interface Chamada {
  metodo: string;
  caminho: string;
  corpo?: Record<string, unknown>;
}

/** Servidor em memória que responde como a API real (inclusive 400/409). */
function servidorFalso(inicial: CenarioVisao[] = [], opcoes: { forcarVersaoAntiga?: boolean; fora?: boolean } = {}) {
  let cenarios = derivar(inicial);
  const chamadas: Chamada[] = [];
  const json = (status: number, corpo: unknown) =>
    new Response(status === 204 ? null : JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json' } });

  const falso = vi.fn(async (entrada: RequestInfo | URL, init?: RequestInit) => {
    if (opcoes.fora) throw new TypeError('Failed to fetch');
    const caminho = String(entrada);
    const metodo = init?.method ?? 'GET';
    const corpo = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined;
    chamadas.push({ metodo, caminho, corpo });

    if (metodo === 'GET') {
      return json(200, { cenarios, funcionalidades: [...new Set(cenarios.map((c) => c.funcionalidade))].sort() });
    }
    if (metodo === 'POST') {
      if (!/^CT\d{2}\.\d{1,2}$/.test(String(corpo?.idCenario ?? ''))) {
        return json(400, { erro: 'validacao', mensagens: ['ID do cenário deve seguir o formato CTnn.n (ex.: CT03.2).'] });
      }
      if (cenarios.some((c) => c.idCenario === corpo?.idCenario)) {
        return json(409, { erro: 'id_duplicado', mensagem: `Já existe um cenário ${String(corpo?.idCenario)}.` });
      }
      const novo = cenario(String(corpo?.idCenario), corpo as Partial<CenarioVisao>);
      cenarios = derivar([...cenarios, novo]);
      return json(201, novo);
    }
    const id = decodeURIComponent(caminho.split('/').pop() ?? '');
    if (metodo === 'PUT') {
      if (opcoes.forcarVersaoAntiga) {
        return json(409, { erro: 'versao_antiga', mensagem: `O cenário ${id} foi alterado por outra pessoa. Recarregue antes de salvar.` });
      }
      const atual = cenarios.find((c) => c.idCenario === id);
      if (!atual) return json(404, { erro: 'nao_encontrado', mensagem: 'não existe' });
      const novo = { ...atual, ...(corpo as Partial<CenarioVisao>), idCenario: id, versao: atual.versao + 1 };
      cenarios = derivar(cenarios.map((c) => (c.idCenario === id ? novo : c)));
      return json(200, novo);
    }
    if (metodo === 'DELETE') {
      cenarios = derivar(cenarios.filter((c) => c.idCenario !== id));
      return json(204, null);
    }
    return json(404, { erro: 'nao_encontrado' });
  });

  return { falso, chamadas, escritas: () => chamadas.filter((c) => c.metodo !== 'GET') };
}

function usar(servidor: ReturnType<typeof servidorFalso>) {
  vi.stubGlobal('fetch', servidor.falso);
}

async function abrir(servidor: ReturnType<typeof servidorFalso>) {
  usar(servidor);
  render(<Cenarios />);
  await screen.findByRole('heading', { level: 2, name: 'Cenários e massa' });
}

/** A linha é achada pelo ID na primeira célula (as outras linhas podem citar esse ID em "Depende de…"). */
function linha(id: string): HTMLElement {
  const achada = screen.getAllByRole('row').find((l) => within(l).queryAllByRole('cell')[0]?.textContent === id);
  if (!achada) throw new Error(`Linha ${id} não encontrada`);
  return achada;
}

beforeEach(() => {
  vi.unstubAllGlobals();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Cenários — lista', () => {
  it('sem cenários mostra o estado vazio e o botão para cadastrar o primeiro', async () => {
    await abrir(servidorFalso());
    expect(await screen.findByText('Nenhum cenário cadastrado ainda')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Novo cenário' })).toBeInTheDocument();
  });

  it('lista os cenários em ordem, com ID, nome, funcionalidade e massa', async () => {
    await abrir(
      servidorFalso([
        cenario('CT03.10', { nome: 'Dez' }),
        cenario('CT03.2', { nome: 'Pagar valor mínimo', idMassa: '0483' }),
        cenario('CT01.1', { nome: 'Login', funcionalidade: 'Acesso' }),
      ]),
    );
    const linhas = (await screen.findAllByRole('row')).slice(1); // sem o cabeçalho
    expect(linhas.map((l) => within(l).getAllByRole('cell')[0].textContent)).toEqual(['CT01.1', 'CT03.2', 'CT03.10']);
    const ct32 = linha('CT03.2');
    expect(within(ct32).getByText('Pagar valor mínimo')).toBeInTheDocument();
    expect(within(ct32).getByText('Faturas')).toBeInTheDocument();
    expect(within(ct32).getByText('0483')).toBeInTheDocument();
  });

  it('mostra o CPF da massa inteiro, sem máscara (são CPFs fictícios de massa de teste), e avisa isso na tela', async () => {
    await abrir(servidorFalso([cenario('CT03.2', { idMassa: '0483', cpf: '12345678909' }), cenario('CT01.1')]));
    await screen.findByText('Nome de CT03.2');
    expect(within(linha('CT03.2')).getByText('123.456.789-09')).toBeInTheDocument();
    expect(within(linha('CT01.1')).queryByText(/\d{3}\.\d{3}\.\d{3}-\d{2}/)).toBeNull();
    expect(screen.queryByText(/\*\*\*/)).toBeNull();
    expect(screen.getByText('CPFs fictícios de massa de teste, não são dados reais. Esta ferramenta roda só nesta máquina.')).toBeInTheDocument();
  });

  it('massa repetida aparece como marca neutra e a dependência é automática (sem alerta de erro)', async () => {
    await abrir(
      servidorFalso([
        cenario('CT03.2', { idMassa: '0483' }),
        cenario('CT03.7', { idMassa: '0483' }),
        cenario('CT04.1', { idMassa: '0500' }),
      ]),
    );
    await screen.findByText('Nome de CT03.2');
    expect(within(linha('CT03.2')).getByText('= compartilhada com CT03.7')).toBeInTheDocument();
    expect(within(linha('CT03.7')).getByText('= compartilhada com CT03.2')).toBeInTheDocument();
    expect(within(linha('CT03.7')).getByText('Depende de CT03.2')).toBeInTheDocument();
    expect(within(linha('CT03.2')).queryByText(/Depende de/)).toBeNull();
    expect(within(linha('CT04.1')).queryByText(/compartilhada/)).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('busca por ID, nome, funcionalidade ou massa e mostra "n de m"', async () => {
    await abrir(
      servidorFalso([
        cenario('CT03.2', { nome: 'Pagar fatura', idMassa: '0483' }),
        cenario('CT01.1', { nome: 'Login', funcionalidade: 'Acesso' }),
        cenario('CT05.1', { nome: 'Bloquear cartão', funcionalidade: 'Cartões' }),
      ]),
    );
    await screen.findByText('Login');
    expect(screen.getByText('3 cenários')).toBeInTheDocument();

    const busca = screen.getByRole('searchbox', { name: 'Buscar cenário' });
    await userEvent.type(busca, 'cartões');
    expect(screen.getByText('1 de 3 cenários')).toBeInTheDocument();
    expect(screen.queryByText('Login')).toBeNull();
    expect(screen.getByText('Bloquear cartão')).toBeInTheDocument();

    await userEvent.clear(busca);
    await userEvent.type(busca, '0483');
    expect(screen.getByText('Pagar fatura')).toBeInTheDocument();
    expect(screen.queryByText('Login')).toBeNull();

    await userEvent.clear(busca);
    await userEvent.type(busca, 'zzz');
    expect(screen.getByText('Nenhum cenário encontrado para esta busca')).toBeInTheDocument();
  });

  it('servidor fora do ar: avisa e "Tentar de novo" busca outra vez', async () => {
    const fora = servidorFalso([], { fora: true });
    usar(fora);
    render(<Cenarios />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar os cenários');

    const dentro = servidorFalso([cenario('CT01.1')]);
    usar(dentro);
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('Nome de CT01.1')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('Cenários — modal M16 (novo)', () => {
  it('cadastra um cenário: envia os campos, fecha o modal e a lista já mostra o novo', async () => {
    const servidor = servidorFalso([cenario('CT03.2', { idMassa: '0483' })]);
    await abrir(servidor);
    await screen.findByText('Nome de CT03.2');

    await userEvent.click(screen.getByRole('button', { name: 'Novo cenário' }));
    const modal = screen.getByRole('dialog', { name: 'Novo cenário' });
    await userEvent.type(within(modal).getByLabelText('ID do cenário'), 'CT03.8');
    await userEvent.type(within(modal).getByLabelText('Nome'), 'Pagar fatura com cartão bloqueado');
    await userEvent.type(within(modal).getByLabelText('Funcionalidade'), 'Faturas');
    await userEvent.type(within(modal).getByLabelText('Massa (ID)'), '0777');
    await userEvent.type(within(modal).getByLabelText('CPF (opcional)'), '12345678909');
    await userEvent.type(within(modal).getByLabelText('Passos'), 'tests/features/faturas.feature#CT03.8');
    await userEvent.type(within(modal).getByLabelText('Resultado esperado'), 'Pagamento recusado');
    expect(within(modal).getByLabelText('CPF (opcional)')).toHaveValue('123.456.789-09');
    await userEvent.click(within(modal).getByRole('button', { name: 'Salvar cenário' }));

    expect(await screen.findByText('Pagar fatura com cartão bloqueado')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(servidor.escritas()).toEqual([
      {
        metodo: 'POST',
        caminho: '/api/cenarios',
        corpo: {
          idCenario: 'CT03.8',
          nome: 'Pagar fatura com cartão bloqueado',
          funcionalidade: 'Faturas',
          idMassa: '0777',
          cpf: '12345678909',
          passos: 'tests/features/faturas.feature#CT03.8',
          resultadoEsperado: 'Pagamento recusado',
        },
      },
    ]);
  });

  it('o campo CPF explica que é fictício e usa exemplo sem asteriscos', async () => {
    await abrir(servidorFalso());
    await userEvent.click(await screen.findByRole('button', { name: 'Novo cenário' }));
    const modal = screen.getByRole('dialog', { name: 'Novo cenário' });
    expect(within(modal).getByLabelText('CPF (opcional)')).toHaveAttribute('placeholder', '000.000.000-00');
    expect(within(modal).getByText('CPF fictício de massa de teste (não é dado real). Senha e PIN nunca são guardados.')).toBeInTheDocument();
  });

  it('campos opcionais vazios nem são enviados', async () => {
    const servidor = servidorFalso();
    await abrir(servidor);
    await userEvent.click(await screen.findByRole('button', { name: 'Novo cenário' }));
    const modal = screen.getByRole('dialog', { name: 'Novo cenário' });
    await userEvent.type(within(modal).getByLabelText('ID do cenário'), 'CT01.1');
    await userEvent.type(within(modal).getByLabelText('Nome'), 'Login');
    await userEvent.type(within(modal).getByLabelText('Funcionalidade'), 'Acesso');
    await userEvent.click(within(modal).getByRole('button', { name: 'Salvar cenário' }));
    await screen.findByText('Login');
    expect(servidor.escritas()[0].corpo).toEqual({ idCenario: 'CT01.1', nome: 'Login', funcionalidade: 'Acesso' });
  });

  it('mostra na hora a massa já usada e a dependência automática, antes de salvar', async () => {
    await abrir(servidorFalso([cenario('CT03.2', { idMassa: '0483' })]));
    await screen.findByText('Nome de CT03.2');
    await userEvent.click(screen.getByRole('button', { name: 'Novo cenário' }));
    const modal = screen.getByRole('dialog', { name: 'Novo cenário' });

    expect(within(modal).queryByText(/já usada/)).toBeNull();
    await userEvent.type(within(modal).getByLabelText('ID do cenário'), 'CT03.7');
    await userEvent.type(within(modal).getByLabelText('Massa (ID)'), '0483');

    expect(within(modal).getByText('Massa 0483 já usada por CT03.2 (detectado sozinho)')).toBeInTheDocument();
    expect(within(modal).getByText('Dependência automática: roda depois de CT03.2')).toBeInTheDocument();
    expect(within(modal).queryByRole('alert')).toBeNull();
  });

  it('erro de validação do servidor aparece no modal e ele continua aberto com o que foi digitado', async () => {
    await abrir(servidorFalso());
    await userEvent.click(await screen.findByRole('button', { name: 'Novo cenário' }));
    const modal = screen.getByRole('dialog', { name: 'Novo cenário' });
    await userEvent.type(within(modal).getByLabelText('ID do cenário'), 'ct3');
    await userEvent.type(within(modal).getByLabelText('Nome'), 'Algo');
    await userEvent.click(within(modal).getByRole('button', { name: 'Salvar cenário' }));

    expect(await within(modal).findByRole('alert')).toHaveTextContent('ID do cenário deve seguir o formato CTnn.n (ex.: CT03.2).');
    expect(screen.getByRole('dialog', { name: 'Novo cenário' })).toBeInTheDocument();
    expect(within(modal).getByLabelText('Nome')).toHaveValue('Algo');
  });

  it('ID repetido (409) aparece no modal', async () => {
    await abrir(servidorFalso([cenario('CT03.2')]));
    await screen.findByText('Nome de CT03.2');
    await userEvent.click(screen.getByRole('button', { name: 'Novo cenário' }));
    const modal = screen.getByRole('dialog', { name: 'Novo cenário' });
    await userEvent.type(within(modal).getByLabelText('ID do cenário'), 'CT03.2');
    await userEvent.type(within(modal).getByLabelText('Nome'), 'Outro');
    await userEvent.type(within(modal).getByLabelText('Funcionalidade'), 'Faturas');
    await userEvent.click(within(modal).getByRole('button', { name: 'Salvar cenário' }));
    expect(await within(modal).findByRole('alert')).toHaveTextContent('Já existe um cenário CT03.2.');
  });

  it('Cancelar e Esc fecham sem enviar nada', async () => {
    const servidor = servidorFalso();
    await abrir(servidor);
    await userEvent.click(await screen.findByRole('button', { name: 'Novo cenário' }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Novo cenário' }));
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(servidor.escritas()).toEqual([]);
  });

  it('as sugestões de funcionalidade vêm das já cadastradas, mas dá para digitar uma nova', async () => {
    await abrir(servidorFalso([cenario('CT01.1', { funcionalidade: 'Acesso' }), cenario('CT05.1', { funcionalidade: 'Cartões' })]));
    await screen.findByText('Nome de CT01.1');
    await userEvent.click(screen.getByRole('button', { name: 'Novo cenário' }));
    const modal = screen.getByRole('dialog', { name: 'Novo cenário' });
    const sugestoes = Array.from(modal.querySelectorAll('datalist option')).map((o) => o.getAttribute('value'));
    expect(sugestoes).toEqual(['Acesso', 'Cartões']);
    await userEvent.type(within(modal).getByLabelText('Funcionalidade'), 'Pix');
    expect(within(modal).getByLabelText('Funcionalidade')).toHaveValue('Pix');
  });
});

describe('Cenários — editar', () => {
  const inicial = () => [
    cenario('CT03.2', { nome: 'Pagar valor mínimo', idMassa: '0483', cpf: '12345678909', passos: 'a.feature#CT03.2', resultadoEsperado: 'Pago' }),
  ];

  it('abre com os valores atuais, ID travado e CPF mascarado', async () => {
    await abrir(servidorFalso(inicial()));
    await screen.findByText('Pagar valor mínimo');
    await userEvent.click(screen.getByRole('button', { name: 'Editar CT03.2' }));
    const modal = screen.getByRole('dialog', { name: 'Editar cenário CT03.2' });
    expect(within(modal).getByLabelText('ID do cenário')).toBeDisabled();
    expect(within(modal).getByLabelText('ID do cenário')).toHaveValue('CT03.2');
    expect(within(modal).getByLabelText('Nome')).toHaveValue('Pagar valor mínimo');
    expect(within(modal).getByLabelText('Massa (ID)')).toHaveValue('0483');
    expect(within(modal).getByLabelText('CPF (opcional)')).toHaveValue('123.456.789-09');
    expect(within(modal).getByLabelText('Passos')).toHaveValue('a.feature#CT03.2');
    expect(within(modal).getByLabelText('Resultado esperado')).toHaveValue('Pago');
  });

  it('salva com PUT mandando a versão que a pessoa viu, e a lista mostra o novo nome', async () => {
    const servidor = servidorFalso(inicial());
    await abrir(servidor);
    await screen.findByText('Pagar valor mínimo');
    await userEvent.click(screen.getByRole('button', { name: 'Editar CT03.2' }));
    const modal = screen.getByRole('dialog');
    const nome = within(modal).getByLabelText('Nome');
    await userEvent.clear(nome);
    await userEvent.type(nome, 'Pagar o mínimo');
    await userEvent.click(within(modal).getByRole('button', { name: 'Salvar cenário' }));

    expect(await screen.findByText('Pagar o mínimo')).toBeInTheDocument();
    const [put] = servidor.escritas();
    expect(put.metodo).toBe('PUT');
    expect(put.caminho).toBe('/api/cenarios/CT03.2');
    expect(put.corpo).toMatchObject({ nome: 'Pagar o mínimo', versao: 1, idMassa: '0483', cpf: '12345678909' });
  });

  it('limpar um campo opcional o remove (não manda texto vazio)', async () => {
    const servidor = servidorFalso(inicial());
    await abrir(servidor);
    await screen.findByText('Pagar valor mínimo');
    await userEvent.click(screen.getByRole('button', { name: 'Editar CT03.2' }));
    const modal = screen.getByRole('dialog');
    await userEvent.clear(within(modal).getByLabelText('Massa (ID)'));
    await userEvent.clear(within(modal).getByLabelText('CPF (opcional)'));
    await userEvent.click(within(modal).getByRole('button', { name: 'Salvar cenário' }));
    await screen.findByText('Pagar valor mínimo');
    expect(servidor.escritas()[0].corpo).not.toHaveProperty('idMassa');
    expect(servidor.escritas()[0].corpo).not.toHaveProperty('cpf');
  });

  it('alguém alterou antes (409): mostra o aviso no modal e não fecha', async () => {
    await abrir(servidorFalso(inicial(), { forcarVersaoAntiga: true }));
    await screen.findByText('Pagar valor mínimo');
    await userEvent.click(screen.getByRole('button', { name: 'Editar CT03.2' }));
    const modal = screen.getByRole('dialog');
    await userEvent.click(within(modal).getByRole('button', { name: 'Salvar cenário' }));
    expect(await within(modal).findByRole('alert')).toHaveTextContent('foi alterado por outra pessoa');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

describe('Cenários — excluir', () => {
  it('pede confirmação; confirmar remove a linha e manda DELETE', async () => {
    const servidor = servidorFalso([cenario('CT03.2'), cenario('CT03.7')]);
    await abrir(servidor);
    await screen.findByText('Nome de CT03.2');

    await userEvent.click(screen.getByRole('button', { name: 'Excluir CT03.2' }));
    const confirmacao = screen.getByRole('alertdialog', { name: 'Confirmar exclusão' });
    expect(confirmacao).toHaveTextContent('Excluir o cenário CT03.2?');
    await userEvent.click(within(confirmacao).getByRole('button', { name: 'Excluir' }));

    await vi.waitFor(() => expect(screen.queryByText('Nome de CT03.2')).toBeNull());
    expect(screen.getByText('Nome de CT03.7')).toBeInTheDocument();
    expect(servidor.escritas()).toEqual([{ metodo: 'DELETE', caminho: '/api/cenarios/CT03.2', corpo: undefined }]);
  });

  it('"Manter" desiste e não envia nada', async () => {
    const servidor = servidorFalso([cenario('CT03.2')]);
    await abrir(servidor);
    await screen.findByText('Nome de CT03.2');
    await userEvent.click(screen.getByRole('button', { name: 'Excluir CT03.2' }));
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Manter' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.getByText('Nome de CT03.2')).toBeInTheDocument();
    expect(servidor.escritas()).toEqual([]);
  });
});
