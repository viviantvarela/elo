import { ok, serverError } from "@/lib/server/http";
import { resetDb } from "@/lib/server/db";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const db = await resetDb();
    return ok({ ok: true, createdAt: db.meta.createdAt });
  } catch {
    return serverError("Não foi possível restaurar a base de demonstração.");
  }
}
