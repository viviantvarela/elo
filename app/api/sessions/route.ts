import { badRequest, notFound, ok, readJson, serverError } from "@/lib/server/http";
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
  if (!payload.minutes || payload.minutes <= 0) return badRequest("Informe a duração em minutos.");

  try {
    const out = { session: null as Session | null };

    const db = await updateDb((draft) => {
      const target = draft.requests.find((item) => item.id === payload.requestId);
      if (!target || !target.monitorId) return;

      const existing = draft.sessions.find((item) => item.id === target.sessionId);
      const at = existing?.startsAt ?? new Date().toISOString();

      const record: Session = {
        id: existing?.id ?? nextId("s", draft.sessions),
        requestId: target.id,
        monitorId: target.monitorId,
        studentId: target.studentId,
        topicId: target.topicId,
        startsAt: at,
        minutes: payload.minutes,
        attendance: payload.attendance,
        rating: payload.rating,
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
      if (monitor && payload.attendance === "present") {
        monitor.weeklyHours = Math.round((monitor.weeklyHours + payload.minutes / 60) * 10) / 10;
        monitor.sessions += 1;
      }

      out.session = record;
    });

    if (!out.session) return notFound("Pedido sem monitor vinculado.");
    return ok({ session: out.session, requests: db.requests }, { status: 201 });
  } catch {
    return serverError("Não foi possível registrar a sessão.");
  }
}
