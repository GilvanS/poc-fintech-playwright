import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { ContextoPessoas, type ValorPessoas } from '../src/pessoas/ContextoPessoas';
import type { Pessoa } from '../src/pessoas/clientePessoas';

/** Equipe fixa para testar telas que dependem de "quem é quem" sem passar pelo servidor. */
export function valorPessoas(pessoas: Pessoa[], idVoce?: string): ValorPessoas {
  const ativas = pessoas.filter((p) => p.ativa);
  return {
    pessoas,
    ativas,
    voce: ativas.find((p) => p.id === idVoce) ?? null,
    definirVoce: () => {},
    recarregar: async () => {},
    nome: (id) => (id ? (pessoas.find((p) => p.id === id)?.nome ?? id) : '-'),
  };
}

export function renderComPessoas(ui: ReactElement, pessoas: Pessoa[], idVoce?: string) {
  return render(<ContextoPessoas.Provider value={valorPessoas(pessoas, idVoce)}>{ui}</ContextoPessoas.Provider>);
}
