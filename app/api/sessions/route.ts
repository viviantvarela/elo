import {
  badRequest,
  conflict,
  forbidden,
  notFound,
  ok,
  readJson,
  serverError,
  unauthorized,
} from "@/lib/server/http";
import { resolveActor } from "@/lib/server/auth";
import { readDb, updateDb } from "@/lib/server/db";
import {
  applyCompletedSessionToMonitor,
  applySessionRatingToMonitor,
  nextId,
} from "@/lib/server/repository";
import { cleanParagraph, cleanText } from "@/lib/server/validate";
import type { Session } from "@/lib/types";

export const dynamic = "force-dynamic";

interface CompletePayload {
  requestId: string;
  minutes: number;
  attendance: "present" | "absent";
  rating?: number;
  notes?: string;
  location?: string;
}

interface RatePayload {
  requestId?: string;
  sessionId?: string;
  rating: number;
  notes?: string;
}

export async function GET(request: Request) {
  try {
    const db = await readDb();
    const actor = await resolveActor(request, db);
    if (!actor) return unauthorized();
    return ok(db.sessions);
  } catch {
    return serverError("Não foi possível carregar as sessões.");
  }
}

/**
 * Registra a sessão concluída pelo monitor (ou coordenação):
 * grava duração, presença e observações, fecha o pedido e soma as horas no
 * relatório do monitor. A nota pode ser informada na hora ou depois pelo
 * próprio estudante em `PATCH /api/sessions`.
 */
export async function POST(request: Request) {
  const payload = await readJson<CompletePayload>(request);
  if (!payload?.requestId) return badRequest("Informe o pedido da sessão.");
  const minutes = Math.round(Number(payload.minutes));
  if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 240) {
    return badRequest("Informe a duração em minutos (até 4 horas).");
  }

  const attendance = payload.attendance === "absent" ? "absent" : "present";
  const rating =
    attendance === "present" && Number.isInteger(payload.rating) && (payload.rating as number) >= 1 && (payload.rating as number) <= 5
      ? (payload.rating as number)
      : undefined;
  const notes = cleanParagraph(payload.notes, 500) || undefined;
  const location = payload.location !== undefined ? cleanText(payload.location, 160) || undefined : undefined;

  try {
    const current = await readDb();
    const actor = await resolveActor(request, current);
    if (!actor) return unauthorized();

    const found = current.requests.find((item) => item.id === payload.requestId);
    if (!found) return notFound("Pedido não encontrado.");

    const isCoordinator = actor.role === "coordinator";
    const isAssignedMonitor = actor.role === "monitor" && Boolean(found.monitorId) && actor.monitorId === found.monitorId;
    if (!isCoordinator && !isAssignedMonitor) {
      return forbidden("Apenas o monitor responsável ou a coordenação podem registrar o atendimento.");
    }

    if (found.status === "done") return conflict("Este atendimento já foi registrado.");
    if (found.status === "cancelled") return conflict("Pedido cancelado: reabra antes de registrar.");

    const out = { session: null as Session | null };

    const db = await updateDb((draft) => {
      const target = draft.requests.find((item) => item.id === payload.requestId);
      if (!target || !target.monitorId || target.status === "done" || target.status === "cancelled") return;

      const existing = draft.sessions.find((item) => item.id === target.sessionId);
      const at = existing?.startsAt ?? new Date().toISOString();

      const record: Session = {
        id: existing?.id ?? nextId("s", draft.sessions),
        requestId: target.id,
        monitorId: target.monitorId,
        studentId: target.studentId,
        topicId: target.topicId,
        startsAt: at,
        minutes,
        attendance,
        rating,
        notes,
        location: location ?? existing?.location,
      };

      if (existing) {
        Object.assign(existing, record);
      } else {
        draft.sessions.push(record);
      }

      target.sessionId = record.id;
      target.status = "done";
      target.closedAt = new Date().toISOString();

      const monitor = draft.monitors.find((item) => item.id === target.monitorId);
      if (monitor && attendance === "present") {
        applyCompletedSessionToMonitor(monitor, minutes, rating);
      }

      out.session = record;
    });

    if (!out.session) return notFound("Pedido sem monitor vinculado.");
    return ok({ session: out.session, requests: db.requests }, { status: 201 });
  } catch {
    return serverError("Não foi possível registrar a sessão.");
  }
}

/**
 * Avaliação do atendimento pelo próprio estudante (1 a 5 estrelas),
 * atualizando a média do monitor e o indicador de satisfação do piloto.
 */
export async function PATCH(request: Request) {
  const payload = await readJson<RatePayload>(request);
  if (!payload || (!payload.requestId && !payload.sessionId)) {
    return badRequest("Informe o atendimento que deseja avaliar.");
  }
  const rating = Number(payload.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return badRequest("Escolha uma nota de 1 a 5 estrelas.");
  }

  const studentNote = cleanParagraph(payload.notes, 300);

  try {
    const current = await readDb();
    const actor = await resolveActor(request, current);
    if (!actor) return unauthorized();

    const targetSession = current.sessions.find(
      (s) => (payload.sessionId && s.id === payload.sessionId) || (payload.requestId && s.requestId === payload.requestId),
    );
    if (!targetSession) return notFound("Sessão não encontrada.");

    const linkedRequest = current.requests.find((r) => r.id === targetSession.requestId);
    if (linkedRequest && linkedRequest.status !== "done") {
      return conflict("Só é possível avaliar atendimentos já concluídos.");
    }
    if (targetSession.attendance === "absent") {
      return conflict("Atendimentos com falta não recebem avaliação.");
    }

    const isCoordinator = actor.role === "coordinator";
    const isOwner = actor.role === "student" && actor.studentId === targetSession.studentId;
    if (!isCoordinator && !isOwner) {
      return forbidden("Apenas o estudante atendido pode avaliar esta sessão.");
    }

    let updatedSession: Session | null = null;

    await updateDb((draft) => {
      const session = draft.sessions.find((s) => s.id === targetSession.id);
      if (!session) return;

      const previousRating = session.rating;
      session.rating = rating;
      if (studentNote) {
        session.notes = session.notes ? `${session.notes}\nFeedback do estudante: ${studentNote}` : studentNote;
      }

      const monitor = draft.monitors.find((m) => m.id === session.monitorId);
      if (monitor) {
        applySessionRatingToMonitor(monitor, previousRating, rating);
      }

      updatedSession = session;
    });

    if (!updatedSession) return notFound("Sessão não encontrada.");
    return ok({ session: updatedSession });
  } catch {
    return serverError("Não foi possível salvar sua avaliação.");
  }
}
