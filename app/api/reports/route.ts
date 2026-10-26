import { forbidden, ok, serverError, unauthorized } from "@/lib/server/http";
import { resolveActor } from "@/lib/server/auth";
import { readDb } from "@/lib/server/db";
import { getReports } from "@/lib/server/repository";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const db = await readDb();
    const actor = await resolveActor(request, db);
    if (!actor) return unauthorized();
    if (actor.role === "student") {
      return forbidden("Os relatórios agregados são restritos a monitores e à coordenação.");
    }
    return ok(getReports(db));
  } catch {
    return serverError("Não foi possível gerar os relatórios.");
  }
}
