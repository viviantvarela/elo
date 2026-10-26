import { badRequest, notFound, ok, readJson, serverError } from "@/lib/server/http";
import { readDb, updateDb } from "@/lib/server/db";
import { cleanParagraph, cleanText, isEmail } from "@/lib/server/validate";
import type { Teacher } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = await readDb();
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
  const name = cleanText(payload.name, 80);
  const className = cleanText(payload.className, 80);
  const email = cleanText(payload.email, 120);
  const bio = cleanParagraph(payload.bio, 280);

  if (name !== undefined) {
    if (!name) return badRequest("Informe seu nome.");
    patch.name = name;
  }
  if (className !== undefined) {
    if (!className) return badRequest("Informe a disciplina ou função.");
    patch.className = className;
  }
  if (email !== undefined) {
    if (email && !isEmail(email)) return badRequest("Informe um e-mail válido.");
    patch.email = email.toLowerCase();
  }
  if (bio !== undefined) patch.bio = bio;

  try {
    const current = await readDb();
    if (!current.teachers.some((teacher) => teacher.id === id)) return notFound("Professor não encontrado.");

    const db = await updateDb((draft) => {
      const target = draft.teachers.find((teacher) => teacher.id === id);
      if (target) Object.assign(target, patch);
    });

    const updated = db.teachers.find((teacher) => teacher.id === id);
    if (!updated) return notFound("Professor não encontrado.");
    return ok(updated);
  } catch {
    return serverError("Não foi possível salvar o perfil.");
  }
}
