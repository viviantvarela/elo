import { ok, serverError } from "@/lib/server/http";
import { readDb } from "@/lib/server/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = await readDb();
    return ok(db.monitors);
  } catch {
    return serverError("Não foi possível carregar os monitores.");
  }
}
