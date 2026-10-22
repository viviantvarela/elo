import { badRequest, ok, readJson, serverError } from "@/lib/server/http";
import { readDb, updateDb } from "@/lib/server/db";
import type { Settings } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = await readDb();
    return ok({ settings: db.settings, profile: db.profile });
  } catch {
    return serverError("Não foi possível carregar as configurações.");
  }
}

export async function PATCH(request: Request) {
  const payload = await readJson<Partial<Settings>>(request);
  if (!payload) return badRequest("Corpo da requisição inválido.");

  try {
    const db = await updateDb((draft) => {
      draft.settings = {
        ...draft.settings,
        ...payload,
        weights: { ...draft.settings.weights, ...(payload.weights ?? {}) },
      };
      // o papel escolhido na topbar também alimenta o perfil de demonstração
      if (payload.role) draft.profile.role = payload.role;
    });
    return ok({ settings: db.settings, profile: db.profile });
  } catch {
    return serverError("Não foi possível salvar as configurações.");
  }
}
