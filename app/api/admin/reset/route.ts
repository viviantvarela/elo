import { forbidden, ok, serverError, unauthorized } from "@/lib/server/http";
import { resolveActor } from "@/lib/server/auth";
import { readDb, resetDb } from "@/lib/server/db";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const current = await readDb();
    const actor = await resolveActor(request, current);
    if (!actor) return unauthorized();
    if (actor.role !== "coordinator") {
      return forbidden("Apenas a coordenação pode restaurar a base de demonstração.");
    }

    const db = await resetDb();
    return ok({ ok: true, createdAt: db.meta.createdAt });
  } catch {
    return serverError("Não foi possível restaurar a base de demonstração.");
  }
}
