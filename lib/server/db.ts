import "server-only";

import { migrate } from "./migrate";
import { buildSeed, type Database } from "./seed";

/**
 * Fachada de persistência.
 *
 *  1. `DATABASE_URL` definido                                       → Postgres via `pg` (Supabase Pooler / Neon)
 *  2. `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`      → Supabase via HTTPS RPC (`@supabase/supabase-js`)
 *  3. Sem variáveis de banco                                        → arquivo JSON em `data/elo.json` (dev/preview local)
 *
 * As rotas de API e o repositório importam só daqui, então trocar de driver
 * não toca em nenhum componente de interface.
 */

type Store = {
  readDb: () => Promise<Database>;
  updateDb: (mutator: (database: Database) => Database | void) => Promise<Database>;
  resetDb: (seed?: Database) => Promise<Database>;
};

export type DriverName = "postgres" | "supabase" | "json";

let storePromise: Promise<Store> | null = null;

export function activeDriver(): DriverName {
  const explicit = process.env.ELO_DB_DRIVER?.trim().toLowerCase();
  if (explicit === "json" || explicit === "postgres" || explicit === "supabase") {
    return explicit;
  }
  if (process.env.DATABASE_URL) return "postgres";
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) return "supabase";
  return "json";
}

export function usingPostgres() {
  return activeDriver() !== "json";
}

async function createStore(): Promise<Store> {
  const driver = activeDriver();

  if (driver === "postgres") {
    const url = process.env.DATABASE_URL as string;
    const { default: pg } = await import("pg");
    const { createPostgresStore } = await import("./store/postgres");

    const isLocal = /localhost|127\.0\.0\.1/.test(url);
    const pool = new pg.Pool({
      connectionString: url,
      ssl: isLocal ? undefined : { rejectUnauthorized: false },
      max: Number(process.env.PG_POOL_MAX ?? 3),
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 15_000,
    });

    return createPostgresStore({
      query: async <T,>(text: string, values?: unknown[]) => {
        const result = await pool.query(text, values as unknown[] | undefined);
        return { rows: result.rows as T[] };
      },
      withTransaction: async (fn) => {
        const client = await pool.connect();
        try {
          await client.query("begin");
          const tx = {
            query: async <T,>(text: string, values?: unknown[]) => {
              const result = await client.query(text, values as unknown[] | undefined);
              return { rows: result.rows as T[] };
            },
          };
          const out = await fn(tx);
          await client.query("commit");
          return out;
        } catch (error) {
          await client.query("rollback").catch(() => undefined);
          throw error;
        } finally {
          client.release();
        }
      },
    });
  }

  if (driver === "supabase") {
    const { createSupabaseStore } = await import("./store/supabase");
    return createSupabaseStore(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.SUPABASE_SERVICE_ROLE_KEY as string,
    );
  }

  // No Vercel o filesystem é somente leitura: sem banco, falhe com mensagem clara
  // em vez de "perder" dados silenciosamente em cada lambda.
  if (process.env.VERCEL) {
    throw new Error(
      "Banco não configurado no Vercel. Defina NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (ou DATABASE_URL) em Settings → Environment Variables.",
    );
  }

  return import("./store/json");
}

function store(): Promise<Store> {
  if (!storePromise) storePromise = createStore();
  return storePromise;
}

export function readDb() {
  return store().then((driver) => driver.readDb().then(migrate));
}

export function updateDb(mutator: (database: Database) => Database | void) {
  return store().then((driver) =>
    driver.updateDb((draft) => {
      const migrated = migrate(draft);
      return mutator(migrated) ?? migrated;
    }),
  );
}

/**
 * Restaura a base de demonstração. A conta da coordenação (nome, e-mail,
 * campus) e vínculos de contas reais do Supabase Auth são preservados quando
 * apontam para registros existentes.
 */
export async function resetDb() {
  const driver = await store();
  const seed = buildSeed();
  try {
    const current = migrate(await driver.readDb());
    seed.profile = current.profile;
    const studentIds = new Set(seed.students.map((s) => s.id));
    const monitorIds = new Set(seed.monitors.map((m) => m.id));
    seed.accounts = current.accounts.filter(
      (acc) =>
        acc.role === "coordinator" ||
        (acc.role === "student" && acc.studentId && studentIds.has(acc.studentId)) ||
        (acc.role === "monitor" && acc.monitorId && monitorIds.has(acc.monitorId)),
    );
  } catch {
    /* base vazia ou ilegível: segue só com a semente */
  }
  return driver.resetDb(seed);
}
