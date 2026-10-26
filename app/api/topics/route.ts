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
import { nextId } from "@/lib/server/repository";
import { cleanText, sanitizePastel } from "@/lib/server/validate";
import type { Topic } from "@/lib/types";

export const dynamic = "force-dynamic";

function slugifyTopic(name: string) {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 8);
}

export async function GET(request: Request) {
  try {
    const db = await readDb();
    const actor = await resolveActor(request, db);
    if (!actor) return unauthorized();
    return ok(db.topics);
  } catch {
    return serverError("Não foi possível carregar os tópicos.");
  }
}

export async function POST(request: Request) {
  const payload = await readJson<Record<string, unknown>>(request);
  if (!payload) return badRequest("Corpo da requisição inválido.");

  const name = cleanText(payload.name, 60);
  const component = cleanText(payload.component, 80);
  const color = sanitizePastel(payload.color, "sage");

  if (!name) return badRequest("Informe o nome do tópico.");
  if (!component) return badRequest("Informe o componente curricular.");

  try {
    const current = await readDb();
    const actor = await resolveActor(request, current);
    if (!actor) return unauthorized();
    if (actor.role !== "coordinator") {
      return forbidden("Apenas a coordenação pode cadastrar novos tópicos.");
    }

    if (current.topics.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
      return conflict("Já existe um tópico com este nome.");
    }

    let created: Topic | null = null;

    await updateDb((draft) => {
      const baseSlug = slugifyTopic(name);
      const id =
        baseSlug && !draft.topics.some((t) => t.id === baseSlug) ? baseSlug : nextId("t", draft.topics);

      const topic: Topic = { id, name, component, color };
      draft.topics.push(topic);
      created = topic;
    });

    if (!created) return serverError("Não foi possível criar o tópico.");
    return ok(created, { status: 201 });
  } catch {
    return serverError("Não foi possível cadastrar o tópico.");
  }
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get("id")?.trim();
  if (!id) return badRequest("Informe o tópico a remover.");

  try {
    const current = await readDb();
    const actor = await resolveActor(request, current);
    if (!actor) return unauthorized();
    if (actor.role !== "coordinator") {
      return forbidden("Apenas a coordenação pode remover tópicos.");
    }

    const exists = current.topics.find((t) => t.id === id);
    if (!exists) return notFound("Tópico não encontrado.");

    const inRequests = current.requests.some((r) => r.topicId === id);
    const inMonitors = current.monitors.some((m) => m.topics.some((t) => t.topicId === id));
    if (inRequests || inMonitors) {
      return conflict("Este tópico já possui pedidos ou monitores vinculados e não pode ser removido.");
    }

    await updateDb((draft) => {
      draft.topics = draft.topics.filter((t) => t.id !== id);
    });

    return ok({ ok: true });
  } catch {
    return serverError("Não foi possível remover o tópico.");
  }
}
