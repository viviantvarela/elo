import { badRequest, forbidden, notFound, ok, readJson, serverError, unauthorized } from "@/lib/server/http";
import { resolveActor } from "@/lib/server/auth";
import { readDb, updateDb } from "@/lib/server/db";
import { cleanParagraph, cleanText, isEmail } from "@/lib/server/validate";
import type { Teacher } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const db = await readDb();
    const actor = await resolveActor(request, db);
    if (!actor) return unauthorized();
    return ok(db.teachers);
  } catch {
    return serverError("Não foi possível carregar os professores.");
  }
}

/**
 * Perfil do professor (Configurações → Meu perfil). Os tópicos que leciona
 * definem com quais monitores ele se alinha no Espaço de alinhamento; por
 * isso ficam com a coordenação, como nos tópicos do monitor.
 */
export async function PATCH(request: Request) {
  const payload = await readJson<Record<string, unknown>>(request);
  const id = cleanText(payload?.id, 40);
  if (!payload || !id) return badRequest("Informe o professor que deseja atualizar.");

  const patch: Partial<Pick<Teacher, "name" | "className" | "email" | "bio">> = {};
  if (payload.name !== undefined) {
    const name = cleanText(payload.name, 80);
    if (!name) return badRequest("Informe seu nome.");
    patch.name = name;
  }
  if (payload.className !== undefined) {
    const className = cleanText(payload.className, 80);
    if (!className) return badRequest("Informe a disciplina ou função.");
    patch.className = className;
  }
  if (payload.email !== undefined) {
    const email = cleanText(payload.email, 120) ?? "";
    if (email && !isEmail(email)) return badRequest("Informe um e-mail válido.");
    patch.email = email.toLowerCase();
  }
  if (payload.bio !== undefined) {
    patch.bio = cleanParagraph(payload.bio, 280);
  }

  try {
    const current = await readDb();
    const actor = await resolveActor(request, current);
    if (!actor) return unauthorized();

    const isSelf = actor.role === "teacher" && actor.teacherId === id;
    if (actor.role !== "coordinator" && !isSelf) {
      return forbidden("Você só pode editar o seu próprio perfil de professor(a).");
    }

    if (!current.teachers.some((teacher) => teacher.id === id)) {
      return notFound("Professor(a) não encontrado(a).");
    }

    const db = await updateDb((draft) => {
      const target = draft.teachers.find((teacher) => teacher.id === id);
      if (target) Object.assign(target, patch);
    });

    const updated = db.teachers.find((teacher) => teacher.id === id);
    return ok(updated);
  } catch {
    return serverError("Não foi possível atualizar o perfil.");
  }
}
