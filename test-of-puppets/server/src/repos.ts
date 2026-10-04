import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { criarRepoCenarios, type RepoCenarios } from './cenarios/repo.ts';
import { criarRepoConfig, type RepoConfig } from './config/repo.ts';
import { criarRepoIncidentes, type RepoIncidentes } from './incidentes/repo.ts';
import { criarRepoLembretes, type RepoLembretes } from './lembretes/repo.ts';
import { criarRepoPessoas, type RepoPessoas } from './pessoas/repo.ts';
import { criarRepoPlanos, type RepoPlanos } from './planos/repo.ts';
import { criarRepoRetros, type RepoRetros } from './retros/repo.ts';
import { criarRepoVisoes, type RepoVisoes } from './visoes/repo.ts';

/** Pasta `dados/` da própria ferramenta (nunca a pasta `data/` do projeto de testes). */
export const DADOS_PADRAO = resolve(fileURLToPath(new URL('../../dados', import.meta.url)));

export interface Repos {
  cenarios: RepoCenarios;
  planos: RepoPlanos;
  pessoas: RepoPessoas;
  visoes: RepoVisoes;
  config: RepoConfig;
  incidentes: RepoIncidentes;
  retros: RepoRetros;
  lembretes: RepoLembretes;
}

/** Monta os repositórios ligados entre si, gravando em `dirDados`. */
export function criarRepos(dirDados: string): Repos {
  const cenarios = criarRepoCenarios(join(dirDados, 'cenarios.json'));
  const planos = criarRepoPlanos(join(dirDados, 'planos.json'), { catalogo: () => cenarios.listar() });
  const pessoas = criarRepoPessoas(join(dirDados, 'pessoas.json'), { planosComResponsavel: (id) => planos.planosComResponsavel(id) });
  const visoes = criarRepoVisoes(join(dirDados, 'visoes.json'));
  const config = criarRepoConfig(join(dirDados, 'config.json'));
  const incidentes = criarRepoIncidentes(join(dirDados, 'incidentes.json'), { catalogo: () => cenarios.listar() });
  const retros = criarRepoRetros(join(dirDados, 'retros.json'), {
    plano: async (id) => {
      const { plano, resumo } = await planos.obter(id);
      return { executado: resumo.executado, nome: plano.nome };
    },
  });
  const lembretes = criarRepoLembretes(join(dirDados, 'lembretes.json'));
  return { cenarios, planos, pessoas, visoes, config, incidentes, retros, lembretes };
}
