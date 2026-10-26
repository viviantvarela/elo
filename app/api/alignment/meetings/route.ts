import { badRequest, forbidden, notFound, ok, readJson, serverError, unauthorized } from "@/lib/server/http";
import { resolveActor } from "@/lib/server/auth";
import { readDb, updateDb } from "@/lib/server/db";
import { createGoogleMeetSpace } from "@/lib/server/google-meet";
import { canUseAlignmentTopic, nextId } from "@/lib/server/repository";
import { cleanText } from "@/lib/server/validate";
import type { AlignmentAuthorRole } from "@/lib/types";

export const dynamic = "force-dynamic";

function parseAuthorRole(value: unknown): AlignmentAuthorRole | null {
  return value === "teacher" || value === "monitor" ? value : null;
}

/**
 * Agenda uma reunião do Espaço de alinhamento e cria o link de verdade na
 * Google Meet API (`meet.googleapis.com/v2/spaces`) — ou um link de
 * demonstração quando as credenciais do Google não estão configuradas (ver
 * `lib/server/google-meet.ts`).
 */
export async function POST(request: Request) {
  const payload = await readJson<Record<string, unknown>>(request);
  if (!payload) return badRequest("Corpo da requisição inválido.");

  try {
    const current = await readDb();
    const actor = await resolveActor(request, current);
    if (!actor) return unauthorized();
    if (actor.role !== "teacher" && actor.role !== "monitor") {
      return forbidden("O Espaço de alinhamento é exclusivo de professor(a) e monitor(a).");
    }

    const topicId = cleanText(payload.topicId, 40);
    const authorRole = parseAuthorRole(payload.authorRole) ?? actor.role;
    const expectedId = actor.role === "teacher" ? actor.teacherId : actor.monitorId;
    const authorId = cleanText(payload.authorId, 40) || expectedId || "";
    const title = cleanText(payload.title, 120);
    const scheduledAtRaw = payload.scheduledAt;
    const durationMinutes = Number(payload.durationMinutes);

    if (!topicId || !authorId) return badRequest("Informe o tópico e quem está marcando a reunião.");
    if (!title) return badRequest("Dê um título para a reunião.");
    if (typeof scheduledAtRaw !== "string" || Number.isNaN(Date.parse(scheduledAtRaw))) {
      return badRequest("Informe uma data e hora válidas.");
    }
    if (!Number.isFinite(durationMinutes) || durationMinutes < 10 || durationMinutes > 180) {
      return badRequest("A duração deve ficar entre 10 e 180 minutos.");
    }
    if (authorRole !== actor.role || authorId !== expectedId) {
      return forbidden("Você só pode agendar reuniões em seu próprio nome.");
    }

    if (!canUseAlignmentTopic(current, authorRole, authorId, topicId)) {
      return forbidden("Este espaço é só para o professor e os monitores do tópico.");
    }

    const author =
      authorRole === "teacher"
        ? current.teachers.find((teacher) => teacher.id === authorId)
        : current.monitors.find((monitor) => monitor.id === authorId);
    if (!author) return badRequest("Pessoa não encontrada.");

    const space = await createGoogleMeetSpace();
    const scheduledAt = new Date(scheduledAtRaw).toISOString();

    const db = await updateDb((draft) => {
      const id = nextId("ak", draft.alignmentMeetings);
      draft.alignmentMeetings.push({
        id,
        topicId,
        title,
        scheduledAt,
        durationMinutes,
        meetLink: space.meetLink,
        meetCode: space.meetCode,
        provider: space.provider,
        createdByRole: authorRole,
        createdById: authorId,
        createdByName: author.name,
        createdAt: new Date().toISOString(),
        status: "scheduled",
      });

      const messageId = nextId("am", draft.alignmentMessages);
      draft.alignmentMessages.push({
        id: messageId,
        topicId,
        authorRole,
        authorId,
        authorName: author.name,
        authorColor: author.color,
        text: `Agendou "${title}" no Google Meet.`,
        createdAt: new Date().toISOString(),
      });
    });

    const created = db.alignmentMeetings.at(-1);
    return ok({ meeting: created });
  } catch {
    return serverError("Não foi possível agendar a reunião.");
  }
}

/** Cancela uma reunião marcada (quem criou ou qualquer participante do tópico). */
export async function PATCH(request: Request) {
  const payload = await readJson<Record<string, unknown>>(request);
  if (!payload) return badRequest("Corpo da requisição inválido.");

  try {
    const current = await readDb();
    const actor = await resolveActor(request, current);
    if (!actor) return unauthorized();
    if (actor.role !== "teacher" && actor.role !== "monitor") {
      return forbidden("O Espaço de alinhamento é exclusivo de professor(a) e monitor(a).");
    }

    const id = cleanText(payload.id, 40);
    const authorRole = parseAuthorRole(payload.authorRole) ?? actor.role;
    const expectedId = actor.role === "teacher" ? actor.teacherId : actor.monitorId;
    const authorId = cleanText(payload.authorId, 40) || expectedId || "";
    if (!id || !authorId) return badRequest("Informe a reunião e quem está cancelando.");
    if (authorRole !== actor.role || authorId !== expectedId) {
      return forbidden("Operação inválida para o usuário autenticado.");
    }

    const meeting = current.alignmentMeetings.find((entry) => entry.id === id);
    if (!meeting) return notFound("Reunião não encontrada.");
    if (!canUseAlignmentTopic(current, authorRole, authorId, meeting.topicId)) {
      return forbidden("Este espaço é só para o professor e os monitores do tópico.");
    }

    const db = await updateDb((draft) => {
      const target = draft.alignmentMeetings.find((entry) => entry.id === id);
      if (target) target.status = "cancelled";
    });

    const updated = db.alignmentMeetings.find((entry) => entry.id === id);
    return ok({ meeting: updated });
  } catch {
    return serverError("Não foi possível cancelar a reunião.");
  }
}
