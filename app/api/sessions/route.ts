import { badRequest, conflict, notFound, ok, readJson, serverError } from "@/lib/server/http";
import { readDb, updateDb } from "@/lib/server/db";
import { nextId } from "@/lib/server/repository";
import type { Session } from "@/lib/types";

export const dynamic = "force-dynamic";

interface CompletePayload {
  requestId: string;
  minutes: number;
  attendance: "present" | "absent";
  rating?: number;
  notes?: string;
}

export async function GET() {
  try {
    const db = await readDb();
    return ok(db.sessions);
  } catch {
    return serverError("Não foi possível carregar as sessões.");
  }
}

/**
 * Registra a sessão concluída (o "registro em poucos toques" do projeto):
 * grava duração, presença e avaliação, fecha o pedido e soma as horas no
 * relatório do monitor.
 */
export async function POST(request: Request) {
  const payload = await readJson<CompletePayload>(request);
  if (!payload?.requestId) return badRequest("Informe o pedido da sessão.");
  const minutes = Math.round(Number(payload.minutes));
  if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 240) {
    return badRequest("Informe a duração em minutos (até 4 horas).");
  }

  const attendance = payload.attendance === "absent" ? "absent" : "present";
  // só quem compareceu avalia; a nota é um inteiro de 1 a 5
  const rating =
    attendance === "present" && Number.isInteger(payload.rating) && (payload.rating as number) >= 1 && (payload.rating as number) <= 5
      ? (payload.rating as number)
      : undefined;

  try {
    const current = await readDb();
    const found = current.requests.find((item) => item.id === payload.requestId);
    if (!found) return notFound("Pedido não encontrado.");
    // registrar duas vezes somaria as horas em dobro no relatório do monitor
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
        notes: payload.notes?.trim() || undefined,
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
        monitor.weeklyHours = Math.round((monitor.weeklyHours + minutes / 60) * 10) / 10;
        monitor.sessions += 1;
        // a nota do atendimento entra na média do monitor
        if (rating !== undefined) {
          const total = monitor.rating * monitor.ratingCount + rating;
          monitor.ratingCount += 1;
          monitor.rating = Math.round((total / monitor.ratingCount) * 100) / 100;
        }
      }

      out.session = record;
    });

    if (!out.session) return notFound("Pedido sem monitor vinculado.");
    return ok({ session: out.session, requests: db.requests }, { status: 201 });
  } catch {
    return serverError("Não foi possível registrar a sessão.");
  }
}
