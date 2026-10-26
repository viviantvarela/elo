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
import { nextId } from "@/lib/server/repository";
import {
  cleanParagraph,
  cleanText,
  isEmail,
  sanitizeMonitorTopics,
  sanitizePastel,
  sanitizeSlots,
} from "@/lib/server/validate";
import type { Monitor, MonitorKind } from "@/lib/types";

export const dynamic = "force-dynamic";

const kinds: MonitorKind[] = ["bolsista", "voluntario"];

export async function GET(request: Request) {
  try {
    const db = await readDb();
    const actor = await resolveActor(request, db);
    if (!actor) return unauthorized();
    return ok(db.monitors);
  } catch {
    return serverError("Não foi possível carregar os monitores.");
  }
}

/**
 * Cadastro de monitor pela coordenação (ex.: abrir vaga para História ou
 * incluir colega apoiador voluntário). Se um e-mail institucional for
 * informado, o monitor já pode entrar via Supabase Auth.
 */
export async function POST(request: Request) {
  const payload = await readJson<Record<string, unknown>>(request);
  if (!payload) return badRequest("Corpo da requisição inválido.");

  const name = cleanText(payload.name, 80);
  const className = cleanText(payload.className, 60);
  const bio = cleanParagraph(payload.bio, 280) ?? "";
  const rawEmail = cleanText(payload.email, 120);
  const email = rawEmail ? rawEmail.toLowerCase() : undefined;
  const kind: MonitorKind = kinds.includes(payload.kind as MonitorKind) ? (payload.kind as MonitorKind) : "bolsista";
  const capacityHours = Number(payload.capacityHours ?? (kind === "bolsista" ? 8 : 6));
  const color = sanitizePastel(payload.color, "sage");
  const slots = sanitizeSlots(payload.availability);

  if (!name) return badRequest("Informe o nome do monitor.");
  if (!className) return badRequest("Informe a turma do monitor.");
  if (email && !isEmail(email)) return badRequest("Informe um e-mail válido.");
  if (!Number.isFinite(capacityHours) || capacityHours < 1 || capacityHours > 20) {
    return badRequest("Carga semanal máxima deve ficar entre 1 e 20 horas.");
  }
  if (!slots || slots.length === 0) {
    return badRequest("Selecione ao menos uma janela de atendimento.");
  }

  try {
    const current = await readDb();
    const actor = await resolveActor(request, current);
    if (!actor) return unauthorized();
    if (actor.role !== "coordinator") {
      return forbidden("Apenas a coordenação pode cadastrar monitores.");
    }

    const validTopicIds = new Set(current.topics.map((t) => t.id));
    const topics = sanitizeMonitorTopics(payload.topics, validTopicIds);
    if (!topics || topics.length === 0) {
      return badRequest("Escolha ao menos um tópico que o monitor domina.");
    }
    if (email && current.monitors.some((m) => m.email?.toLowerCase() === email)) {
      return conflict("Já existe um monitor com este e-mail.");
    }

    let created: Monitor | null = null;

    await updateDb((draft) => {
      const monitor: Monitor = {
        id: nextId("m", draft.monitors),
        name,
        className,
        kind,
        topics,
        availability: slots,
        rating: 0,
        ratingCount: 0,
        sessions: 0,
        weeklyHours: 0,
        capacityHours: Math.round(capacityHours * 10) / 10,
        color,
        online: Boolean(payload.online ?? true),
        bio,
        email,
      };
      draft.monitors.push(monitor);

      if (email) {
        const existingAcc = draft.accounts.find((a) => a.email.toLowerCase() === email);
        if (existingAcc) {
          existingAcc.role = "monitor";
          existingAcc.monitorId = monitor.id;
        } else {
          draft.accounts.push({
            email,
            role: "monitor",
            monitorId: monitor.id,
            createdAt: new Date().toISOString(),
          });
        }
      }

      created = monitor;
    });

    if (!created) return serverError("Não foi possível cadastrar o monitor.");
    return ok(created, { status: 201 });
  } catch {
    return serverError("Não foi possível cadastrar o monitor.");
  }
}

/**
 * Atualização de monitor:
 *  - O próprio monitor edita nome, turma, bio, "disponível agora" e janelas.
 *  - A coordenação também pode editar tópicos/níveis, vínculo, teto semanal e e-mail.
 */
export async function PATCH(request: Request) {
  const payload = await readJson<Record<string, unknown>>(request);
  const id = cleanText(payload?.id, 40);
  if (!payload || !id) return badRequest("Informe o monitor que deseja atualizar.");

  try {
    const current = await readDb();
    const actor = await resolveActor(request, current);
    if (!actor) return unauthorized();

    const isCoordinator = actor.role === "coordinator";
    const isSelfMonitor = actor.role === "monitor" && actor.monitorId === id;
    if (!isCoordinator && !isSelfMonitor) {
      return forbidden("Você só pode editar o seu próprio perfil de monitor.");
    }

    if (!current.monitors.some((monitor) => monitor.id === id)) return notFound("Monitor não encontrado.");

    const patch: Partial<Monitor> = {};
    const name = cleanText(payload.name, 80);
    const className = cleanText(payload.className, 60);
    const bio = cleanParagraph(payload.bio, 280);

    if (name !== undefined) {
      if (!name) return badRequest("Informe o nome.");
      patch.name = name;
    }
    if (className !== undefined) {
      if (!className) return badRequest("Informe a turma.");
      patch.className = className;
    }
    if (bio !== undefined) patch.bio = bio;
    if (payload.online !== undefined) {
      if (typeof payload.online !== "boolean") return badRequest("Valor inválido para disponibilidade.");
      patch.online = payload.online;
    }
    if (payload.availability !== undefined) {
      const slots = sanitizeSlots(payload.availability);
      if (!slots) return badRequest("Horários de atendimento inválidos.");
      if (slots.length === 0) return badRequest("Mantenha ao menos uma janela de atendimento.");
      patch.availability = slots;
    }

    // Campos exclusivos da coordenação
    if (payload.topics !== undefined || payload.kind !== undefined || payload.capacityHours !== undefined || payload.email !== undefined) {
      if (!isCoordinator) {
        return forbidden("Tópicos, nível e carga semanal são validados pela coordenação.");
      }

      if (payload.topics !== undefined) {
        const validTopicIds = new Set(current.topics.map((t) => t.id));
        const topics = sanitizeMonitorTopics(payload.topics, validTopicIds);
        if (!topics || topics.length === 0) {
          return badRequest("Mantenha ao menos um tópico válido para o monitor.");
        }
        patch.topics = topics;
      }

      if (payload.kind !== undefined) {
        if (!kinds.includes(payload.kind as MonitorKind)) return badRequest("Vínculo inválido.");
        patch.kind = payload.kind as MonitorKind;
      }

      if (payload.capacityHours !== undefined) {
        const cap = Number(payload.capacityHours);
        if (!Number.isFinite(cap) || cap < 1 || cap > 20) {
          return badRequest("Teto semanal deve ficar entre 1 e 20 horas.");
        }
        patch.capacityHours = Math.round(cap * 10) / 10;
      }

      if (payload.email !== undefined) {
        const rawEmail = cleanText(payload.email, 120);
        if (rawEmail && !isEmail(rawEmail)) return badRequest("Informe um e-mail válido.");
        patch.email = rawEmail ? rawEmail.toLowerCase() : undefined;
      }
    }

    const db = await updateDb((draft) => {
      const target = draft.monitors.find((monitor) => monitor.id === id);
      if (!target) return;
      Object.assign(target, patch);

      if (isCoordinator && payload.email !== undefined && target.email) {
        const emailLower = target.email.toLowerCase();
        const acc = draft.accounts.find((a) => a.email.toLowerCase() === emailLower);
        if (acc) {
          acc.role = "monitor";
          acc.monitorId = target.id;
        } else {
          draft.accounts.push({
            email: emailLower,
            role: "monitor",
            monitorId: target.id,
            createdAt: new Date().toISOString(),
          });
        }
      }
    });

    const updated = db.monitors.find((monitor) => monitor.id === id);
    if (!updated) return notFound("Monitor não encontrado.");
    return ok(updated);
  } catch {
    return serverError("Não foi possível salvar os dados do monitor.");
  }
}

export async function DELETE(request: Request) {
  const id = searchParam(request, "id");
  if (!id) return badRequest("Informe o monitor que deseja remover.");

  try {
    const current = await readDb();
    const actor = await resolveActor(request, current);
    if (!actor) return unauthorized();
    if (actor.role !== "coordinator") {
      return forbidden("Apenas a coordenação pode remover monitores.");
    }
    if (!current.monitors.some((m) => m.id === id)) return notFound("Monitor não encontrado.");

    await updateDb((draft) => {
      draft.monitors = draft.monitors.filter((m) => m.id !== id);
      draft.accounts = draft.accounts.filter((a) => a.monitorId !== id);

      // Devolve para a fila pedidos em andamento que estavam com este monitor
      for (const req of draft.requests) {
        if (req.monitorId === id && (req.status === "matched" || req.status === "scheduled")) {
          if (req.sessionId) {
            draft.sessions = draft.sessions.filter((s) => s.id !== req.sessionId);
          }
          req.status = "open";
          req.monitorId = undefined;
          req.matchedAt = undefined;
          req.sessionId = undefined;
        }
      }
    });

    return ok({ ok: true });
  } catch {
    return serverError("Não foi possível remover o monitor.");
  }
}
