import "server-only";

import { migrate } from "./migrate";
import { buildSeed, type Database } from "./seed";

/**
 * Fachada de persistência.
 *
 *  - `DATABASE_URL` definido  → Postgres (Neon no Vercel)
 *  - sem `DATABASE_URL`       → arquivo JSON em `data/elo.json` (local/preview)
 *
 * As rotas de API e o repositório importam só daqui, então trocar de driver
 * não toca em nenhum componente de interface.
 */

type Store = {
  readDb: () => Promise<Database>;
  updateDb: (mutator: (database: Database) => Database | void) => Promise<Database>;
  resetDb: (seed?: Database) => Promise<Database>;
};

let storePromise: Promise<Store> | null = null;

async function createStore(): Promise<Store> {
  const url = process.env.DATABASE_URL;

  if (!url) {
    // No Vercel o filesystem é somente leitura: sem banco, falhe com mensagem clara
    // em vez de "perder" dados silenciosamente em cada lambda.
    if (process.env.VERCEL) {
      throw new Error(
        "DATABASE_URL não configurada. Adicione a connection string do Neon em Settings → Environment Variables e faça o redeploy.",
      );
    }
    return import("./store/json");
  }

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
  });
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
 * campus) é de quem usa o Elo, não dado de demonstração — por isso é mantida.
 */
export async function resetDb() {
  const driver = await store();
  const seed = buildSeed();
  try {
    const current = migrate(await driver.readDb());
    seed.profile = current.profile;
  } catch {
    /* base vazia ou ilegível: segue só com a semente */
  }
  return driver.resetDb(seed);
}

export function usingPostgres() {
  return Boolean(process.env.DATABASE_URL);
}
