/**
 * Faux client Supabase pour les tests unitaires : enregistre chaque appel (table, méthodes,
 * arguments) et renvoie la réponse choisie par le test. Aucun appel réseau.
 */
import { vi } from 'vitest';

export type FakeResponse = { data: unknown; error: unknown; status?: number };
export type FakeCall = { table: string; ops: [string, unknown[]][] };

const METHODS = [
  'select',
  'eq',
  'order',
  'limit',
  'maybeSingle',
  'single',
  'upsert',
  'update',
  'insert',
  'delete',
];

export function fakeSupabase(
  respond: (call: FakeCall) => FakeResponse = () => ({ data: [], error: null }),
  { signedIn = true } = {},
) {
  const calls: FakeCall[] = [];
  const client = {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: signedIn ? { access_token: 'jeton' } : null } })),
    },
    rpc: vi.fn(async (): Promise<FakeResponse> => ({ data: [], error: null })),
    from(table: string) {
      const call: FakeCall = { table, ops: [] };
      calls.push(call);
      const b: Record<string, unknown> = {};
      for (const m of METHODS)
        b[m] = (...args: unknown[]) => {
          call.ops.push([m, args]);
          return b;
        };
      b.then = (ok: (r: FakeResponse) => unknown, ko: (e: unknown) => unknown) =>
        Promise.resolve(respond(call)).then(ok, ko);
      return b;
    },
  };
  /** Arguments du premier appel de `method` sur `table`. */
  const argsOf = (table: string, method: string) =>
    calls
      .find((c) => c.table === table && c.ops.some(([m]) => m === method))
      ?.ops.find(([m]) => m === method)?.[1];
  return { client, calls, argsOf };
}

export const has = (call: FakeCall, method: string) => call.ops.some(([m]) => m === method);
