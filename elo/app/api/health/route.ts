import { ok, serverError } from "@/lib/server/http";
import { readDb, usingPostgres } from "@/lib/server/db";

export const dynamic = "force-dynamic";

/**
 * Diagnóstico do deploy: confirma qual driver está ativo e se o banco responde.
 * Útil logo após configurar `DATABASE_URL` no Vercel.
 */
export async function GET() {
  const started = Date.now();
  try {
    const db = await readDb();
    return ok({
      ok: true,
      driver: usingPostgres() ? "postgres" : "json",
      latencyMs: Date.now() - started,
      counts: {
        topics: db.topics.length,
        students: db.students.length,
        monitors: db.monitors.length,
        requests: db.requests.length,
        sessions: db.sessions.length,
      },
    });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : "Banco indisponível");
  }
}
