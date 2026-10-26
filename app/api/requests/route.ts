import {
  badRequest,
  conflict,
  forbidden,
  notFound,
  ok,
  readJson,
  searchParam,
  serverError,
  unauthorized,
} from "@/lib/server/http";
import { resolveActor } from "@/lib/server/auth";
import { readDb, updateDb } from "@/lib/server/db";
import {
  findRequest,
  listRequests,
  matchesFor,
  nextId,
  revertCompletedSessionFromMonitor,
} from "@/lib/server/repository";
import { cleanParagraph, cleanText, sanitizeSlots } from "@/lib/server/validate";
import type { HelpRequest, Session, Slot, Urgency } from "@/lib/types";

const urgencies: Urgency[] = ["low", "normal", "high"];

type Action = "match" | "schedule" | "cancel" | "reopen";

/** Em que estados cada ação faz sentido — evita sessão duplicada, pedido concluído cancelado etc. */
const transitions: Record<Action, { from: HelpRequest["status"][]; message: string }> = {
  match: { from: ["open", "matched"], message: "Este pedido já foi agendado ou encerrado." },
  schedule: { from: ["open", "matched", "scheduled"], message: "Este pedido já foi encerrado." },
  cancel: { from: ["open", "matched", "scheduled"], message: "Só dá para cancelar pedidos ainda não concluídos." },
  reopen: {
    from: ["matched", "scheduled", "cancelled", "done"],
    message: "Este pedido já está aberto na fila.",
  },
};

export const dynamic = "force-dynamic";

interface CreatePayload {
  studentId: string;
  topicId: string;
  note: string;
  urgency: Urgency;
  preferred: Slot[];
  acceptConsent?: boolean;
}

interface PatchPayload {
  id: string;
  action?: Action;
  monitorId?: string;
  startsAt?: string;
  minutes?: number;
  location?: string;
}

export async function GET(request: Request) {
  try {
    const db = await readDb();
    const actor = await resolveActor(request, db);
    if (!actor) return unauthorized();

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
      privacy: {
        consentRequired: db.settings.consentRequired,
        guardianConsentRequired: db.settings.guardianConsentRequired,
        aggregateOnly: db.settings.aggregateOnly,
      },
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
    const actor = await resolveActor(request, current);
    if (!actor) return unauthorized();

    if (actor.role === "monitor") {
      return forbidden("Monitores atendem pedidos; para pedir ajuda, entre como estudante.");
    }
    if (actor.role === "student" && actor.studentId !== payload.studentId) {
      return forbidden("Você só pode abrir pedidos em seu próprio nome.");
    }

    const student = current.students.find((entry) => entry.id === payload.studentId);
    if (!student) {
      return badRequest("Estudante não encontrado. Atualize a página e tente de novo.");
    }
    if (!current.topics.some((topic) => topic.id === payload.topicId)) {
      return badRequest("Tópico não encontrado.");
    }

    // Regras reais de LGPD configuradas pela coordenação
    if (current.settings.guardianConsentRequired && !student.guardianConsent) {
      return forbidden(
        "Autorização do responsável pendente (LGPD). Peça à coordenação para registrar a autorização no seu cadastro.",
      );
    }
    if (actor.role === "student" && current.settings.consentRequired && !student.consentAcceptedAt && !payload.acceptConsent) {
      return conflict("Confirme o termo de uso de dados (LGPD) antes de enviar seu primeiro pedido.");
    }

    const out = { id: "" };

    const db = await updateDb((draft) => {
      const targetStudent = draft.students.find((s) => s.id === payload.studentId);
      if (targetStudent && payload.acceptConsent && !targetStudent.consentAcceptedAt) {
        targetStudent.consentAcceptedAt = new Date().toISOString();
      }

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
  if (!payload.action) return badRequest("Informe a ação que deseja executar no pedido.");

  const rule = transitions[payload.action];
  if (!rule) return badRequest("Ação desconhecida.");

  if (payload.action === "match" && !payload.monitorId) return badRequest("Escolha o monitor do pedido.");
  if (payload.action === "schedule") {
    if (!payload.startsAt || Number.isNaN(Date.parse(payload.startsAt))) {
      return badRequest("Escolha o horário do atendimento.");
    }
    if (payload.minutes !== undefined && (!Number.isInteger(payload.minutes) || payload.minutes <= 0 || payload.minutes > 240)) {
      return badRequest("Duração inválida.");
    }
  }

  const location = payload.location !== undefined ? cleanText(payload.location, 160) : undefined;

  try {
    const current = await readDb();
    const actor = await resolveActor(request, current);
    if (!actor) return unauthorized();

    const existing = current.requests.find((item) => item.id === payload.id);
    if (!existing) return notFound("Pedido não encontrado.");
    if (!rule.from.includes(existing.status)) return conflict(rule.message);

    const isCoordinator = actor.role === "coordinator";
    const isOwner = actor.role === "student" && actor.studentId === existing.studentId;
    const isAssignedMonitor = actor.role === "monitor" && Boolean(existing.monitorId) && actor.monitorId === existing.monitorId;

    // Verificação de permissões por papel no servidor
    if (payload.action === "match") {
      if (actor.role === "monitor") {
        if (existing.status !== "open") return conflict("Este pedido já foi assumido por outro monitor.");
        if (payload.monitorId !== actor.monitorId) {
          return forbidden("Você só pode aceitar pedidos em seu próprio nome.");
        }
        const me = current.monitors.find((m) => m.id === actor.monitorId);
        if (!me?.topics.some((t) => t.topicId === existing.topicId)) {
          return forbidden("Este pedido é de um tópico fora da sua área de monitoria.");
        }
      } else if (!isCoordinator) {
        return forbidden("Apenas monitores ou a coordenação podem parear pedidos.");
      }
    }

    if (payload.action === "schedule" && !isCoordinator && !isAssignedMonitor) {
      return forbidden("Apenas o monitor responsável ou a coordenação podem agendar o atendimento.");
    }

    if (payload.action === "cancel" && !isCoordinator && !isOwner) {
      return forbidden("Apenas o estudante autor ou a coordenação podem cancelar o pedido.");
    }

    if (payload.action === "reopen") {
      if (existing.status === "done" && !isCoordinator) {
        return forbidden("Apenas a coordenação pode reabrir um pedido já concluído.");
      }
      if ((existing.status === "matched" || existing.status === "scheduled") && !isCoordinator && !isAssignedMonitor) {
        return forbidden("Apenas o monitor responsável ou a coordenação podem devolver o pedido à fila.");
      }
      if (existing.status === "cancelled" && !isCoordinator && !isOwner) {
        return forbidden("Apenas o estudante autor ou a coordenação podem reabrir este pedido.");
      }
    }

    const monitorId = payload.monitorId ?? (payload.action === "schedule" ? existing.monitorId : undefined);
    if ((payload.action === "match" || payload.action === "schedule") && !current.monitors.some((m) => m.id === monitorId)) {
      return badRequest("Monitor não encontrado.");
    }

    const out = { session: null as Session | null };

    const db = await updateDb((draft) => {
      const target = draft.requests.find((item) => item.id === payload.id);
      if (!target || !rule.from.includes(target.status)) return;

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

        const existingSession = target.sessionId
          ? draft.sessions.find((s) => s.id === target.sessionId)
          : undefined;

        if (existingSession) {
          existingSession.monitorId = target.monitorId ?? existingSession.monitorId;
          existingSession.startsAt = payload.startsAt;
          existingSession.minutes = payload.minutes ?? existingSession.minutes;
          if (location !== undefined) existingSession.location = location || undefined;
          out.session = existingSession;
        } else {
          const session: Session = {
            id: nextId("s", draft.sessions),
            requestId: target.id,
            monitorId: target.monitorId ?? "",
            studentId: target.studentId,
            topicId: target.topicId,
            startsAt: payload.startsAt,
            minutes: payload.minutes ?? 60,
            attendance: "present",
            location: location || undefined,
          };
          draft.sessions.push(session);
          target.sessionId = session.id;
          out.session = session;
        }
        target.status = "scheduled";
      }

      if (payload.action === "cancel") {
        if (target.sessionId && target.status !== "done") {
          draft.sessions = draft.sessions.filter((s) => s.id !== target.sessionId);
          target.sessionId = undefined;
        }
        target.status = "cancelled";
        target.closedAt = new Date().toISOString();
      }

      if (payload.action === "reopen") {
        if (target.sessionId) {
          const oldSession = draft.sessions.find((s) => s.id === target.sessionId);
          if (oldSession && target.status === "done") {
            const monitor = draft.monitors.find((m) => m.id === oldSession.monitorId);
            if (monitor) revertCompletedSessionFromMonitor(monitor, oldSession);
          }
          draft.sessions = draft.sessions.filter((s) => s.id !== target.sessionId);
        }
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
