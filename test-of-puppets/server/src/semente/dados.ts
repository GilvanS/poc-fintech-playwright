import type { CenarioEntrada } from '../cenarios/modelo.ts';
import type { NovoIncidente } from '../incidentes/modelo.ts';
import type { CamposPessoa } from '../pessoas/modelo.ts';
import type { CamposItem } from '../planos/modelo.ts';

/**
 * Dados de exemplo (os mesmos de visoes/README.md). TUDO aqui é fictício: os CPFs são números de exemplo
 * de massa de teste, não de pessoas reais, e as datas são fixas (não dependem do dia em que se semeia).
 */

export const CENARIOS_SEMENTE: CenarioEntrada[] = [
  { idCenario: 'CT03.1', nome: 'Pagar valor total', funcionalidade: 'Faturas', idMassa: '0481', cpf: '11144477735', passos: 'tests/features/faturas.feature#CT03.1', resultadoEsperado: 'Fatura quitada e saldo devedor zerado' },
  { idCenario: 'CT03.2', nome: 'Pagar valor mínimo', funcionalidade: 'Faturas', idMassa: '0483', cpf: '52998224725', passos: 'tests/features/faturas.feature#CT03.2', resultadoEsperado: 'Pagamento mínimo registrado; encargos seguem sobre o restante' },
  { idCenario: 'CT03.3', nome: 'Pagar valor parcial', funcionalidade: 'Faturas', idMassa: '0484', cpf: '39053344705', passos: 'tests/features/faturas.feature#CT03.3', resultadoEsperado: 'Pagamento parcial abatido da fatura' },
  // Mesma massa do CT03.2 de propósito: continua de onde o CT03.2 parou.
  { idCenario: 'CT03.7', nome: 'Pagar fatura vencida', funcionalidade: 'Faturas', idMassa: '0483', cpf: '52998224725', passos: 'tests/features/faturas.feature#CT03.7', resultadoEsperado: 'Fatura vencida paga com encargos; segue o estado deixado pelo CT03.2' },
  { idCenario: 'CT04.1', nome: 'Enviar Pix por chave', funcionalidade: 'Pix', idMassa: '0510', cpf: '86288366757', passos: 'tests/features/pix.feature#CT04.1', resultadoEsperado: 'Pix enviado e saldo atualizado' },
  { idCenario: 'CT04.2', nome: 'Agendar Pix', funcionalidade: 'Pix', idMassa: '0511', cpf: '16899535009', passos: 'tests/features/pix.feature#CT04.2', resultadoEsperado: 'Pix agendado aparece na lista de agendamentos' },
  { idCenario: 'CT05.1', nome: 'Cadastro PF', funcionalidade: 'Cadastro', idMassa: '0520', cpf: '71428793860', passos: 'tests/features/cadastro.feature#CT05.1', resultadoEsperado: 'Usuário PF criado e consegue entrar' },
  { idCenario: 'CT05.2', nome: 'Cadastro duplicado', funcionalidade: 'Cadastro', idMassa: '0521', cpf: '45317828791', passos: 'tests/features/cadastro.feature#CT05.2', resultadoEsperado: 'Sistema recusa o CPF já cadastrado com mensagem clara' },
];

export const PESSOAS_SEMENTE: CamposPessoa[] = [
  { nome: 'Ana', capacidadeMinSemana: 120, cor: 'azul' },
  { nome: 'Bia', capacidadeMinSemana: 90, cor: 'verde' },
  { nome: 'Carlos', capacidadeMinSemana: 60, cor: 'roxo' },
];

/** Os 3 INC do visoes/README.md, com os testes afetados e as datas fixas do exemplo. */
export const INCIDENTES_SEMENTE: (NovoIncidente & { comentarios?: { autor: string; texto: string }[] })[] = [
  {
    numero: 'INC0715802225',
    titulo: 'Saldo de Faturamento difere do extrato',
    descricao: 'O valor "fatura aberta" na tela não bate com o extrato após o pagamento mínimo. Massa 0483.',
    status: 'em_analise',
    severidade: 'alta',
    responsavel: 'ana',
    testesAfetados: ['CT03.1', 'CT03.2'],
    autor: 'ana',
    abertoEm: '2026-09-29T15:40:00.000Z',
    comentarios: [{ autor: 'bia', texto: 'Reproduzi com a massa 0484 também.' }],
  },
  {
    numero: 'INC0715799001',
    titulo: 'Cadastro duplicado aceita CPF repetido',
    status: 'novo',
    severidade: 'media',
    responsavel: 'bia',
    testesAfetados: ['CT05.2'],
    autor: 'bia',
    abertoEm: '2026-10-01T14:10:00.000Z',
  },
  {
    numero: 'INC0715790010',
    titulo: 'Botão sem foco no cadastro PF',
    status: 'resolvido',
    severidade: 'baixa',
    responsavel: 'bia',
    testesAfetados: ['CT05.1'],
    autor: 'bia',
    abertoEm: '2026-09-28T10:00:00.000Z',
    resolvidoEm: '2026-09-30T16:30:00.000Z',
  },
];

export interface ItemSemente {
  idCenario: string;
  campos: CamposItem;
}

export interface PlanoSemente {
  nome: string;
  previsao: string;
  itens: ItemSemente[];
}

export const PLANOS_SEMENTE: PlanoSemente[] = [
  {
    nome: '14/09/26',
    previsao: '2026-09-25',
    itens: [
      { idCenario: 'CT05.1', campos: { status: 'concluido', resultado: 'passou', responsavel: 'bia', prioridade: 'P3', estimativaMin: 15, dataPlanejada: '2026-09-15', dataExecucao: '2026-09-15' } },
      { idCenario: 'CT03.1', campos: { status: 'concluido', resultado: 'passou', responsavel: 'ana', prioridade: 'P1', estimativaMin: 20, dataPlanejada: '2026-09-16', dataExecucao: '2026-09-16' } },
    ],
  },
  {
    nome: '28/09/26',
    previsao: '2026-10-13',
    itens: [
      { idCenario: 'CT03.1', campos: { status: 'concluido', resultado: 'passou', responsavel: 'ana', prioridade: 'P1', estimativaMin: 20, dataPlanejada: '2026-09-29', dataExecucao: '2026-09-29' } },
      { idCenario: 'CT03.2', campos: { status: 'em_andamento', responsavel: 'ana', prioridade: 'P1', estimativaMin: 30, dataPlanejada: '2026-10-02' } },
      { idCenario: 'CT03.3', campos: { responsavel: 'bia', prioridade: 'P2', estimativaMin: 25, dataPlanejada: '2026-10-05' } },
      { idCenario: 'CT03.7', campos: { responsavel: 'bia', prioridade: 'P2', estimativaMin: 30, dataPlanejada: '2026-10-06' } },
      { idCenario: 'CT04.1', campos: { responsavel: 'carlos', prioridade: 'P1', estimativaMin: 20, dataPlanejada: '2026-10-07' } },
      { idCenario: 'CT04.2', campos: { status: 'refinamento', responsavel: 'carlos', prioridade: 'P2', estimativaMin: 25, dataPlanejada: '2026-10-08' } },
      { idCenario: 'CT05.1', campos: { status: 'concluido', resultado: 'passou', responsavel: 'bia', prioridade: 'P3', estimativaMin: 15, dataPlanejada: '2026-09-30', dataExecucao: '2026-09-30' } },
      { idCenario: 'CT05.2', campos: { status: 'concluido', resultado: 'falhou', responsavel: 'bia', prioridade: 'P3', estimativaMin: 15, dataPlanejada: '2026-10-01', dataExecucao: '2026-10-01' } },
    ],
  },
  { nome: '05/10/26', previsao: '2026-10-16', itens: [] },
];
