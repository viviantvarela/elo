import "server-only";

import { createClient } from "@supabase/supabase-js";

import { buildSeed, type Database } from "../seed";

/**
 * Store Supabase via HTTPS (`@supabase/supabase-js` + RPCs PL/pgSQL).
 *
 * Usa `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` para chamar as
 * funções transacionais `public.elo_read_snapshot()` e
 * `public.elo_write_snapshot(snap jsonb)` diretamente por HTTPS (porta 443).
 *
 * Vantagens no serverless (Vercel):
 *  - Não depende de string de conexão TCP nem de senha do banco
 *  - Uma única chamada HTTPS lê ou grava as 16 tabelas dentro de uma transação
 *    Postgres protegida por `pg_advisory_xact_lock`
 *  - Row Level Security permanece ativo nas tabelas públicas (`service_role` only)
 */

export function createSupabaseStore(url: string, serviceRoleKey: string) {
  const client = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let queue: Promise<unknown> = Promise.resolve();

  async function fetchSnapshot(): Promise<Database | null> {
    const { data, error } = await client.rpc("elo_read_snapshot");
    if (error) {
      throw new Error(`Supabase RPC elo_read_snapshot falhou: ${error.message}`);
    }
    return (data as Database | null) ?? null;
  }

  async function saveSnapshot(database: Database): Promise<void> {
    const { error } = await client.rpc("elo_write_snapshot", { snap: database });
    if (error) {
      throw new Error(`Supabase RPC elo_write_snapshot falhou: ${error.message}`);
    }
  }

  async function readDb(): Promise<Database> {
    const existing = await fetchSnapshot();
    if (existing) return existing;
    const seeded = buildSeed();
    await saveSnapshot(seeded);
    return seeded;
  }

  async function updateDb(mutator: (database: Database) => Database | void): Promise<Database> {
    const run = async () => {
      const current = (await fetchSnapshot()) ?? buildSeed();
      const draft = structuredClone(current);
      const next = mutator(draft) ?? draft;
      await saveSnapshot(next);
      return structuredClone(next);
    };

    queue = queue.then(run, run);
    return queue as Promise<Database>;
  }

  async function resetDb(seed: Database = buildSeed()): Promise<Database> {
    const run = async () => {
      await saveSnapshot(seed);
      return structuredClone(seed);
    };

    queue = queue.then(run, run);
    return queue as Promise<Database>;
  }

  return { readDb, updateDb, resetDb };
}
