import { badRequest, notFound, ok, readJson, serverError } from "@/lib/server/http";
import { readDb, updateDb } from "@/lib/server/db";
import { cleanText } from "@/lib/server/validate";
import type { Student } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = await readDb();
    return ok(db.students);
  } catch {
    return serverError("Não foi possível carregar os estudantes.");
  }
}

/**
 * Perfil do estudante (Configurações → Meu perfil). A autorização do
 * responsável não é editável aqui: é registrada pela coordenação.
 */
export async function PATCH(request: Request) {
  const payload = await readJson<Record<string, unknown>>(request);
  const id = cleanText(payload?.id, 40);
  if (!payload || !id) return badRequest("Informe o estudante que deseja atualizar.");

  const patch: Partial<Pick<Student, "name" | "className" | "course">> = {};
  const name = cleanText(payload.name, 80);
  const className = cleanText(payload.className, 60);
  const course = cleanText(payload.course, 60);

  if (name !== undefined) {
    if (!name) return badRequest("Informe seu nome.");
    patch.name = name;
  }
  if (className !== undefined) {
    if (!className) return badRequest("Informe sua turma.");
    patch.className = className;
  }
  if (course !== undefined) {
    if (!course) return badRequest("Informe seu curso.");
    patch.course = course;
  }

  try {
    const current = await readDb();
    if (!current.students.some((student) => student.id === id)) return notFound("Estudante não encontrado.");

    const db = await updateDb((draft) => {
      const target = draft.students.find((student) => student.id === id);
      if (target) Object.assign(target, patch);
    });

    const updated = db.students.find((student) => student.id === id);
    if (!updated) return notFound("Estudante não encontrado.");
    return ok(updated);
  } catch {
    return serverError("Não foi possível salvar o perfil.");
  }
}
