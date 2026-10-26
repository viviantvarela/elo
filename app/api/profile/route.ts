import { badRequest, forbidden, ok, readJson, serverError, unauthorized } from "@/lib/server/http";
import { resolveActor } from "@/lib/server/auth";
import { readDb, updateDb } from "@/lib/server/db";
import { cleanText, isEmail } from "@/lib/server/validate";
import type { DemoProfile } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Conta da coordenação — editada em Configurações → Meu perfil. */
export async function GET(request: Request) {
  try {
    const db = await readDb();
    const actor = await resolveActor(request, db);
    if (!actor) return unauthorized();
    return ok(db.profile);
  } catch {
    return serverError("Não foi possível carregar o perfil.");
  }
}

export async function PATCH(request: Request) {
  const payload = await readJson<Record<string, unknown>>(request);
  if (!payload) return badRequest("Corpo da requisição inválido.");

  const patch: Partial<Pick<DemoProfile, "name" | "email" | "className" | "campus">> = {};
  const name = cleanText(payload.name, 80);
  const email = cleanText(payload.email, 120);
  const className = cleanText(payload.className, 80);
  const campus = cleanText(payload.campus, 80);

  if (name !== undefined) {
    if (!name) return badRequest("Informe seu nome.");
    patch.name = name;
  }
  if (email !== undefined) {
    if (email && !isEmail(email)) return badRequest("Informe um e-mail válido.");
    patch.email = email.toLowerCase();
  }
  if (className !== undefined) patch.className = className;
  if (campus !== undefined) patch.campus = campus;

  try {
    const current = await readDb();
    const actor = await resolveActor(request, current);
    if (!actor) return unauthorized();
    if (actor.role !== "coordinator") {
      return forbidden("Apenas a coordenação pode editar o perfil institucional.");
    }

    const db = await updateDb((draft) => {
      draft.profile = { ...draft.profile, ...patch };
    });
    return ok(db.profile);
  } catch {
    return serverError("Não foi possível salvar o perfil.");
  }
}
