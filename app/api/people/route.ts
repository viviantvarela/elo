import { ok, serverError, unauthorized } from "@/lib/server/http";
import { resolveActor } from "@/lib/server/auth";
import { readDb } from "@/lib/server/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const db = await readDb();
    const actor = await resolveActor(request, db);
    if (!actor) return unauthorized();
    return ok({ coordinator: db.profile, students: db.students, monitors: db.monitors, topics: db.topics });
  } catch {
    return serverError("Não foi possível carregar os usuários.");
  }
}
