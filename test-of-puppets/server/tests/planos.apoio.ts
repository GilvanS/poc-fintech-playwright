import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app.ts';

// Apoio dos testes de /api/planos: sobe o servidor numa pasta temporária e monta cenários e planos de exemplo.

export type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export async function iniciar(dirDados?: string) {
  const dir = dirDados ?? (await mkdtemp(join(tmpdir(), 'puppets-planos-')));
  const server = createApp({ dirDados: dir }).listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', () => resolve()));
  const { port } = server.address() as AddressInfo;
  const base = `http://127.0.0.1:${port}`;
  const enviar = (metodo: string, caminho: string, corpo?: unknown) =>
    fetch(`${base}${caminho}`, {
      method: metodo,
      headers: corpo === undefined ? undefined : { 'content-type': 'application/json' },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
  const json = async (metodo: string, caminho: string, corpo?: unknown): Promise<{ status: number; corpo: Json }> => {
    const res = await enviar(metodo, caminho, corpo);
    return { status: res.status, corpo: res.status === 204 ? {} : ((await res.json()) as Json) };
  };
  return { dir, base, enviar, json, fechar: () => new Promise<void>((r) => server.close(() => r())) };
}

export type Servidor = Awaited<ReturnType<typeof iniciar>>;

export async function cadastrarCenarios(s: Servidor) {
  const base = { funcionalidade: 'Faturas' };
  for (const c of [
    { idCenario: 'CT03.1', nome: 'Pagar valor total', idMassa: '0100' },
    { idCenario: 'CT03.2', nome: 'Pagar valor mínimo', idMassa: '0483' },
    { idCenario: 'CT03.7', nome: 'Reenvio do pagamento mínimo', idMassa: '0483' },
    { idCenario: 'CT04.1', nome: 'Bloquear cartão', funcionalidade: 'Cartões' },
  ]) {
    const r = await s.json('POST', '/api/cenarios', { ...base, ...c });
    assert.equal(r.status, 201);
  }
}

export async function planoCom(s: Servidor, idCenarios: string[], extra: Json = {}) {
  const r = await s.json('POST', '/api/planos', { nome: '28/09/26', idCenarios, ...extra });
  assert.equal(r.status, 201, JSON.stringify(r.corpo));
  return r.corpo;
}

export const item = (corpo: Json, id: string): Json => corpo.itens.find((i: Json) => i.idCenario === id);
