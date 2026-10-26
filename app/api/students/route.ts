import { badRequest, conflict, forbidden, notFound, ok, readJson, serverError, unauthorized } from "@/lib/server/http";
import { resolveActor } from "@/lib/server/auth";
import { readDb, updateDb } from "@/lib/server/db";
import { nextId } from "@/lib/server/repository";
import { cleanText, isEmail, sanitizePastel } from "@/lib/server/validate";
import type { Student } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const db = await readDb();
    const actor = await resolveActor(request, db);
    if (!actor) return unauthorized();
    return ok(db.students);
  } catch {
    return serverError("Não foi possível carregar os estudantes.");
  }
}

/** Cadastro de estudante pela coordenação. */
export async function POST(request: Request) {
  const payload = await readJson<Record<string, unknown>>(request);
  if (!payload) return badRequest("Corpo da requisição inválido.");

  const name = cleanText(payload.name, 80);
  const className = cleanText(payload.className, 60);
  const course = cleanText(payload.course, 60);
  const rawEmail = cleanText(payload.email, 120);
  const email = rawEmail ? rawEmail.toLowerCase() : undefined;
  const guardianConsent = Boolean(payload.guardianConsent ?? false);
  const color = sanitizePastel(payload.color, "blue");

  if (!name) return badRequest("Informe o nome do estudante.");
  if (!className) return badRequest("Informe a turma.");
  if (!course) return badRequest("Informe o curso.");
  if (email && !isEmail(email)) return badRequest("Informe um e-mail válido.");

  try {
    const current = await readDb();
    const actor = await resolveActor(request, current);
    if (!actor) return unauthorized();
    if (actor.role !== "coordinator") {
      return forbidden("Apenas a coordenação pode cadastrar estudantes manualmente.");
    }
    if (email && current.students.some((s) => s.email?.toLowerCase() === email)) {
      return conflict("Já existe um estudante com este e-mail.");
    }

    let created: Student | null = null;

    await updateDb((draft) => {
      const student: Student = {
        id: nextId("a", draft.students),
        name,
        className,
        course,
        color,
        guardianConsent,
        email,
      };
      draft.students.push(student);
      created = student;
    });

    if (!created) return serverError("Não foi possível cadastrar o estudante.");
    return ok(created, { status: 201 });
  } catch {
    return serverError("Não foi possível cadastrar o estudante.");
  }
}

/**
 * Atualização de estudante:
 *  - O próprio estudante edita nome, turma, curso e aceita o termo LGPD (`acceptConsent`).
 *  - A coordenação registra `guardianConsent` (autorização do responsável) e dados cadastrais.
 */
export async function PATCH(request: Request) {
  const payload = await readJson<Record<string, unknown>>(request);
  const id = cleanText(payload?.id, 40);
  if (!payload || !id) return badRequest("Informe o estudante que deseja atualizar.");

  try {
    const current = await readDb();
    const actor = await resolveActor(request, current);
    if (!actor) return unauthorized();

    const isCoordinator = actor.role === "coordinator";
    const isSelfStudent = actor.role === "student" && actor.studentId === id;
    if (!isCoordinator && !isSelfStudent) {
      return forbidden("Você só pode editar o seu próprio perfil de estudante.");
    }

    if (!current.students.some((student) => student.id === id)) return notFound("Estudante não encontrado.");

    const patch: Partial<Student> = {};
    const name = cleanText(payload.name, 80);
    const className = cleanText(payload.className, 60);
    const course = cleanText(payload.course, 60);

    if (name !== undefined) {
      if (!name) return badRequest("Informe o nome.");
      patch.name = name;
    }
    if (className !== undefined) {
      if (!className) return badRequest("Informe a turma.");
      patch.className = className;
    }
    if (course !== undefined) {
      if (!course) return badRequest("Informe o curso.");
      patch.course = course;
    }
    if (payload.acceptConsent === true) {
      patch.consentAcceptedAt = new Date().toISOString();
    }

    if (payload.guardianConsent !== undefined || payload.email !== undefined) {
      if (!isCoordinator) {
        return forbidden("A autorização do responsável é registrada apenas pela coordenação.");
      }
      if (payload.guardianConsent !== undefined) {
        if (typeof payload.guardianConsent !== "boolean") return badRequest("Valor inválido para autorização.");
        patch.guardianConsent = payload.guardianConsent;
      }
      if (payload.email !== undefined) {
        const rawEmail = cleanText(payload.email, 120);
        if (rawEmail && !isEmail(rawEmail)) return badRequest("Informe um e-mail válido.");
        patch.email = rawEmail ? rawEmail.toLowerCase() : undefined;
      }
    }

    const db = await updateDb((draft) => {
      const target = draft.students.find((student) => student.id === id);
      if (!target) return;
      if (patch.consentAcceptedAt && target.consentAcceptedAt) {
        delete patch.consentAcceptedAt;
      }
      Object.assign(target, patch);
    });

    const updated = db.students.find((student) => student.id === id);
    if (!updated) return notFound("Estudante não encontrado.");
    return ok(updated);
  } catch {
    return serverError("Não foi possível salvar os dados do estudante.");
  }
}
