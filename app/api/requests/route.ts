import { badRequest, conflict, notFound, ok, readJson, searchParam, serverError } from "@/lib/server/http";
import { readDb, updateDb } from "@/lib/server/db";
import { findRequest, listRequests, matchesFor, nextId } from "@/lib/server/repository";
import { cleanParagraph, sanitizeSlots } from "@/lib/server/validate";
import type { HelpRequest, Session, Slot, Urgency } from "@/lib/types";

const urgencies: Urgency[] = ["low", "normal", "high"];

type Action = NonNullable<PatchPayload["action"]>;

/** Em que estados cada ação faz sentido — evita sessão duplicada, pedido concluído cancelado etc. */
const transitions: Record<Action, { from: HelpRequest["status"][]; message: string }> = {
  match: { from: ["open", "matched"], message: "Este pedido já foi agendado ou encerrado." },
  schedule: { from: ["open", "matched"], message: "Este pedido já foi agendado ou encerrado." },
  cancel: { from: ["open", "matched"], message: "Só dá para cancelar pedidos que ainda não foram agendados." },
  reopen: { from: ["matched", "cancelled", "done"], message: "Este pedido não pode voltar para a fila agora." },
};

export const dynamic = "force-dynamic";

interface CreatePayload {
  studentId: string;
  topicId: string;
  note: string;
  urgency: Urgency;
  preferred: Slot[];
}

interface PatchPayload {
  id: string;
  action?: "match" | "schedule" | "cancel" | "reopen";
  monitorId?: string;
  startsAt?: string;
  minutes?: number;
  patch?: Partial<HelpRequest>;
}

export async function GET(request: Request) {
  try {
    const db = await readDb();
    const id = searchParam(request, "id");

    if (id) {
      const found = findRequest(db, id);
      if (!found) return notFound("Pedido não encontrado.");
      return ok({
        request: found,
        matches: matchesFor(db, found),
        session: db.sessions.find((item) => item.id === found.sessionId) ?? null,
        student: db.students.find((student) => student.id === found.studentId) ?? null,
        topic: db.topics.find((topic) => topic.id === found.topicId) ?? null,
        monitors: db.monitors,
      });
    }

    return ok({
      requests: listRequests(db),
      students: db.students,
      topics: db.topics,
      monitors: db.monitors,
      weights: db.settings.weights,
    });
  } catch {
    return serverError("Não foi possível carregar os pedidos.");
  }
}

export async function POST(request: Request) {
  const payload = await readJson<CreatePayload>(request);
  if (!payload) return badRequest("Corpo da requisição inválido.");

  if (!payload.studentId || !payload.topicId) {
    return badRequest("Selecione o estudante e o tópico do pedido.");
  }
  const preferred = sanitizeSlots(payload.preferred);
  if (!preferred || preferred.length === 0) {
    return badRequest("Escolha ao menos um horário possível para o atendimento.");
  }

  try {
    const current = await readDb();
    if (!current.students.some((student) => student.id === payload.studentId)) {
      return badRequest("Estudante não encontrado. Atualize a página e tente de novo.");
    }
    if (!current.topics.some((topic) => topic.id === payload.topicId)) {
      return badRequest("Tópico não encontrado.");
    }

    const out = { id: "" };

    const db = await updateDb((draft) => {
      const created: HelpRequest = {
        id: nextId("r", draft.requests),
        studentId: payload.studentId,
        topicId: payload.topicId,
        note: cleanParagraph(payload.note, 500) || "Sem detalhes adicionais.",
        urgency: urgencies.includes(payload.urgency) ? payload.urgency : "normal",
        status: "open",
        createdAt: new Date().toISOString(),
        preferred,
      };
      draft.requests.push(created);
      out.id = created.id;
    });

    const created = findRequest(db, out.id);
    if (!created) return serverError("Pedido criado, mas não pôde ser relido.");

    return ok({ request: created, matches: matchesFor(db, created) }, { status: 201 });
  } catch {
    return serverError("Não foi possível registrar o pedido.");
  }
}

export async function PATCH(request: Request) {
  const payload = await readJson<PatchPayload>(request);
  if (!payload?.id) return badRequest("Informe o pedido que deseja atualizar.");

  if (payload.action === "match" && !payload.monitorId) return badRequest("Escolha o monitor do pedido.");
  if (payload.action === "schedule") {
    if (!payload.startsAt || Number.isNaN(Date.parse(payload.startsAt))) {
      return badRequest("Escolha o horário do atendimento.");
    }
    if (payload.minutes !== undefined && (!Number.isInteger(payload.minutes) || payload.minutes <= 0 || payload.minutes > 240)) {
      return badRequest("Duração inválida.");
    }
  }

  try {
    const current = await readDb();
    const existing = current.requests.find((item) => item.id === payload.id);
    if (!existing) return notFound("Pedido não encontrado.");

    if (payload.action) {
      const rule = transitions[payload.action];
      if (!rule) return badRequest("Ação desconhecida.");
      if (!rule.from.includes(existing.status)) return conflict(rule.message);
    }

    const monitorId = payload.monitorId ?? (payload.action === "schedule" ? existing.monitorId : undefined);
    if ((payload.action === "match" || payload.action === "schedule") && !current.monitors.some((m) => m.id === monitorId)) {
      return badRequest("Monitor não encontrado.");
    }

    const out = { session: null as Session | null };

    const db = await updateDb((draft) => {
      const target = draft.requests.find((item) => item.id === payload.id);
      if (!target) return;

      if (payload.patch && !payload.action) {
        Object.assign(target, payload.patch);
      }

      if (payload.action === "match") {
        if (!payload.monitorId) return;
        target.monitorId = payload.monitorId;
        target.matchedAt = new Date().toISOString();
        target.status = "matched";
      }

      if (payload.action === "schedule") {
        if (!payload.startsAt) return;
        if (payload.monitorId) target.monitorId = payload.monitorId;
        if (!target.matchedAt) target.matchedAt = new Date().toISOString();

        const session: Session = {
          id: nextId("s", draft.sessions),
          requestId: target.id,
          monitorId: target.monitorId ?? "",
          studentId: target.studentId,
          topicId: target.topicId,
          startsAt: payload.startsAt,
          minutes: payload.minutes ?? 60,
          attendance: "present",
        };
        draft.sessions.push(session);
        target.sessionId = session.id;
        target.status = "scheduled";
        out.session = session;
      }

      if (payload.action === "cancel") {
        target.status = "cancelled";
        target.closedAt = new Date().toISOString();
      }

      if (payload.action === "reopen") {
        target.status = "open";
        target.monitorId = undefined;
        target.matchedAt = undefined;
        target.sessionId = undefined;
        target.closedAt = undefined;
      }
    });

    const updated = db.requests.find((item) => item.id === payload.id);
    if (!updated) return notFound("Pedido não encontrado.");

    return ok({ request: updated, session: out.session });
  } catch {
    return serverError("Não foi possível atualizar o pedido.");
  }
}
