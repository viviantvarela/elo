import { badRequest, ok, readJson, serverError } from "@/lib/server/http";
import { readDb, updateDb } from "@/lib/server/db";
import type { DemoProfile } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = await readDb();
    return ok(db.profile);
  } catch {
    return serverError("Não foi possível carregar o perfil.");
  }
}

export async function PATCH(request: Request) {
  const payload = await readJson<Partial<DemoProfile>>(request);
  if (!payload) return badRequest("Corpo da requisição inválido.");

  try {
    const db = await updateDb((draft) => {
      draft.profile = { ...draft.profile, ...payload };
    });
    return ok(db.profile);
  } catch {
    return serverError("Não foi possível salvar o perfil.");
  }
}
