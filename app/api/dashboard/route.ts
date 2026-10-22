import { ok, serverError } from "@/lib/server/http";
import { readDb } from "@/lib/server/db";
import { getDashboard } from "@/lib/server/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = await readDb();
    return ok(getDashboard(db));
  } catch {
    return serverError("Não foi possível carregar o painel.");
  }
}
