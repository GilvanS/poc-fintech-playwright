import { Router, type Response } from 'express';
import type { RepoConfig } from '../config/repo.ts';
import type { RepoIncidentes } from '../incidentes/repo.ts';
import { calcularLembretes, type Lembrete } from '../lembretes/modelo.ts';
import type { RepoLembretes } from '../lembretes/repo.ts';
import { dataValida } from '../planos/modelo.ts';
import type { RepoPlanos } from '../planos/repo.ts';
import type { RepoRetros } from '../retros/repo.ts';

interface Dependencias {
  config: RepoConfig;
  planos: RepoPlanos;
  incidentes: RepoIncidentes;
  retros: RepoRetros;
  lembretes: RepoLembretes;
}

const recusar = (res: Response, mensagens: string[]): void => {
  res.status(400).json({ erro: 'validacao', mensagens });
};

/** Data local de hoje (aaaa-mm-dd), no relógio do servidor. */
function hojeLocal(agora = new Date()): string {
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`;
}

const pessoaDe = (v: unknown): string | null => (typeof v === 'string' && v.trim() && v.trim().length <= 40 ? v.trim() : null);

/** /api/lembretes — o sino. Os lembretes saem dos dados na hora; só "lida" fica gravado, por pessoa. */
export function rotasLembretes({ config, planos, incidentes, retros, lembretes }: Dependencias): Router {
  const rotas = Router();

  async function listar(voce: string | null, hoje: string): Promise<{ lembretes: Lembrete[]; naoLidas: number }> {
    const resumidos = await planos.listar();
    const detalhes = await Promise.all(resumidos.map((p) => planos.obter(p.id)));
    const ligados = (await config.obter()).lembretes;
    const calculados = calcularLembretes({ hoje, voce, planos: detalhes, incidentes: await incidentes.listar(), retros: await retros.listar() }).filter(
      (l) => ligados[l.tipo],
    );
    const lidas = await lembretes.lidasDe(voce);
    const lista = calculados.map((l) => ({ ...l, lida: lidas.has(l.chave) }));
    return { lembretes: lista, naoLidas: lista.filter((l) => !l.lida).length };
  }

  const hojeDe = (v: unknown, mensagens: string[]): string => {
    if (v === undefined || v === '') return hojeLocal();
    if (dataValida(v)) return v;
    mensagens.push('hoje deve ser uma data válida (aaaa-mm-dd).');
    return '';
  };

  rotas.get('/', async (req, res) => {
    const mensagens: string[] = [];
    const hoje = hojeDe(req.query.hoje, mensagens);
    if (mensagens.length > 0) return recusar(res, mensagens);
    res.json(await listar(pessoaDe(req.query.voce), hoje));
  });

  rotas.post('/lidas', async (req, res) => {
    const corpo = (typeof req.body === 'object' && req.body !== null ? req.body : {}) as Record<string, unknown>;
    const mensagens: string[] = [];
    const hoje = hojeDe(corpo.hoje, mensagens);
    const chaves = corpo.chaves;
    if (!Array.isArray(chaves) || chaves.length === 0 || chaves.length > 500 || chaves.some((c) => typeof c !== 'string' || !c || c.length > 200)) {
      mensagens.push('chaves deve ser uma lista de 1 a 500 lembretes.');
    }
    if (corpo.lida !== undefined && typeof corpo.lida !== 'boolean') mensagens.push('lida deve ser verdadeiro ou falso.');
    if (mensagens.length > 0) return recusar(res, mensagens);

    const voce = pessoaDe(corpo.voce);
    const ativas = new Set((await listar(voce, hoje)).lembretes.map((l) => l.chave));
    await lembretes.marcar(voce, chaves as string[], corpo.lida !== false, ativas);
    res.json(await listar(voce, hoje));
  });

  return rotas;
}
