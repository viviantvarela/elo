import { ok, serverError } from "@/lib/server/http";
import { activeDriver, readDb } from "@/lib/server/db";

export const dynamic = "force-dynamic";

/**
 * Diagnóstico do deploy: confirma qual driver está ativo (`supabase`, `postgres`
 * ou `json`) e se o banco responde.
 */
export async function GET() {
  const started = Date.now();
  try {
    const db = await readDb();
    return ok({
      ok: true,
      driver: activeDriver(),
      supabaseAuthConfigured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      latencyMs: Date.now() - started,
      counts: {
        topics: db.topics.length,
        students: db.students.length,
        monitors: db.monitors.length,
        requests: db.requests.length,
        sessions: db.sessions.length,
        accounts: db.accounts.length,
      },
    });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : "Banco indisponível");
  }
}
