/**
 * Sobe um Postgres (PGlite) via socket TCP, aponta DATABASE_URL para ele e
 * exercita o caminho completo: pg.Pool → store Postgres → rotas de API.
 */
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import pg from "pg";

const db = new PGlite();
const server = new PGLiteSocketServer({ db, port: 55432, host: "127.0.0.1" });
await server.start();
console.log("postgres de teste ouvindo em 127.0.0.1:55432");

process.env.DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:55432/postgres";

const { createPostgresStore } = await import("../lib/server/store/postgres");
// o socket do PGlite atende uma conexão por vez; o pool serializa as consultas
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });

const store = createPostgresStore({
  query: async <T,>(text: string, values?: unknown[]) => {
    const result = await pool.query(text, values as unknown[] | undefined);
    return { rows: result.rows as T[] };
  },
});

const t0 = Date.now();
const first = await store.readDb();
console.log(`semeou ${first.requests.length} pedidos e ${first.sessions.length} sessões em ${Date.now() - t0} ms`);

const second = await store.readDb();
if (second.requests.length !== first.requests.length) throw new Error("leitura duplicou dados");
console.log("segunda leitura estável:", second.requests.length, "pedidos");

await store.updateDb((draft) => {
  const request = draft.requests.find((r) => r.status === "open");
  if (request) {
    request.status = "cancelled";
    request.closedAt = new Date().toISOString();
  }
});

const third = await store.readDb();
const cancelled = third.requests.filter((r) => r.status === "cancelled").length;
console.log("cancelados após mutação:", cancelled, "(era", first.requests.filter((r) => r.status === "cancelled").length, ")");

const monitor = await pool.query("select count(*)::text as count from elo_monitors");
console.log("consulta direta no banco:", monitor.rows[0].count, "monitores");

await pool.end();
await server.stop();
await db.close();
console.log("e2e com pg.Pool: OK");
