import type { Incidente } from '../incidentes/modelo.ts';
import type { DetalhePlano } from '../planos/repo.ts';
import type { Retro } from '../retros/modelo.ts';

export const TIPOS_LEMBRETE = ['teste_hoje', 'plano_vencido', 'inc_aberto', 'acao_retro'] as const;
export type TipoLembrete = (typeof TIPOS_LEMBRETE)[number];

/** Um lembrete do sino. Calculado na hora a partir dos dados; só o "lida" é guardado (por pessoa). */
export interface Lembrete {
  /** Estável enquanto o motivo existir: serve para guardar "lida". Inclui a data quando o motivo é do dia. */
  chave: string;
  tipo: TipoLembrete;
  titulo: string;
  detalhe: string;
  planoId?: string;
  idCenario?: string;
  numero?: string;
  lida: boolean;
}

export interface FonteLembretes {
  /** aaaa-mm-dd */
  hoje: string;
  /** Id da pessoa ("Você"); sem ela, aparece tudo. */
  voce: string | null;
  planos: DetalhePlano[];
  incidentes: Incidente[];
  retros: Retro[];
}

const ORDEM_SEVERIDADE: Record<string, number> = { alta: 0, media: 1, baixa: 2 };

const data = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/');
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/**
 * Lembretes de quem é `voce`: o que é dela ou de ninguém (sem responsável). Ordem: testes de hoje, planos vencidos,
 * INC (Alta primeiro) e ações de retro (as atrasadas primeiro). Nenhum vem marcado como lido.
 */
export function calcularLembretes({ hoje, voce, planos, incidentes, retros }: FonteLembretes): Lembrete[] {
  const meu = (responsavel: string | null | undefined) => !voce || !responsavel || responsavel === voce;
  const lista: Lembrete[] = [];

  for (const { plano, itens } of planos) {
    for (const i of itens) {
      if (i.dataPlanejada !== hoje || i.status === 'concluido' || !meu(i.responsavel)) continue;
      lista.push({
        chave: `teste-hoje:${plano.id}:${i.idCenario}:${hoje}`,
        tipo: 'teste_hoje',
        titulo: `Teste de hoje · Plano ${plano.nome}`,
        detalhe: i.nome ? `${i.idCenario} — ${i.nome}` : i.idCenario,
        planoId: plano.id,
        idCenario: i.idCenario,
        lida: false,
      });
    }
  }

  for (const { plano, resumo } of planos) {
    if (!plano.previsao || plano.previsao >= hoje || resumo.executado) continue;
    lista.push({
      chave: `plano-vencido:${plano.id}:${plano.previsao}`,
      tipo: 'plano_vencido',
      titulo: `Plano ${plano.nome} passou da previsão`,
      detalhe: `Previsão era ${data(plano.previsao)} · ${plural(resumo.pendentes, 'teste pendente', 'testes pendentes')}`,
      planoId: plano.id,
      lida: false,
    });
  }

  const abertos = incidentes
    .filter((inc) => inc.status !== 'resolvido' && meu(inc.responsavel))
    .sort((a, b) => (ORDEM_SEVERIDADE[a.severidade] ?? 9) - (ORDEM_SEVERIDADE[b.severidade] ?? 9) || a.numero.localeCompare(b.numero));
  for (const inc of abertos) {
    lista.push({
      chave: `inc-aberto:${inc.numero}`,
      tipo: 'inc_aberto',
      titulo: `INC aberto · ${inc.numero} (${plural(inc.testesAfetados.length, 'teste', 'testes')})`,
      detalhe: inc.titulo,
      numero: inc.numero,
      lida: false,
    });
  }

  const nomeDoPlano = new Map(planos.map((p) => [p.plano.id, p.plano.nome]));
  const acoes = retros
    .filter((r) => nomeDoPlano.has(r.planoId))
    .flatMap((r) => r.acoes.filter((a) => !a.feito && meu(a.responsavel)).map((a) => ({ r, a })))
    .sort((x, y) => (x.a.prazo ?? '9999-99-99').localeCompare(y.a.prazo ?? '9999-99-99'));
  for (const { r, a } of acoes) {
    const prazo = a.prazo ? (a.prazo < hoje ? ` · atrasada desde ${data(a.prazo)}` : ` · até ${data(a.prazo)}`) : '';
    lista.push({
      chave: `acao-retro:${r.planoId}:${a.id}`,
      tipo: 'acao_retro',
      titulo: `Ação da retro · Plano ${nomeDoPlano.get(r.planoId)}`,
      detalhe: `${a.texto}${prazo}`,
      planoId: r.planoId,
      lida: false,
    });
  }

  return lista;
}
