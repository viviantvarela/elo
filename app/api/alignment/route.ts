import { badRequest, forbidden, ok, readJson, serverError, unauthorized } from "@/lib/server/http";
import { resolveActor } from "@/lib/server/auth";
import { readDb, updateDb } from "@/lib/server/db";
import { canUseAlignmentTopic, nextId } from "@/lib/server/repository";
import { cleanParagraph, cleanText } from "@/lib/server/validate";
import type { AlignmentAuthorRole } from "@/lib/types";

export const dynamic = "force-dynamic";

function parseAuthorRole(value: unknown): AlignmentAuthorRole | null {
  return value === "teacher" || value === "monitor" ? value : null;
}

/**
 * Espaço de alinhamento: mensagens entre professor(a) e monitor(a) do mesmo
 * tópico, para combinar mudanças nas aulas. Fora do alcance de estudantes e
 * coordenação — o menu já esconde a página (`lib/constants.ts`), e aqui o
 * servidor confere de novo antes de ler ou gravar qualquer mensagem.
 */
export async function GET(request: Request) {
  try {
    const db = await readDb();
    const actor = await resolveActor(request, db);
    if (!actor) return unauthorized();
    if (actor.role !== "teacher" && actor.role !== "monitor") {
      return forbidden("O Espaço de alinhamento é exclusivo de professor(a) e monitor(a).");
    }

    const allowedTopics = new Set(
      actor.role === "teacher"
        ? (db.teachers.find((t) => t.id === actor.teacherId)?.topics ?? [])
        : (db.monitors.find((m) => m.id === actor.monitorId)?.topics.map((t) => t.topicId) ?? []),
    );

    return ok({
      messages: db.alignmentMessages.filter((m) => allowedTopics.has(m.topicId)),
      meetings: db.alignmentMeetings.filter((m) => allowedTopics.has(m.topicId)),
    });
  } catch {
    return serverError("Não foi possível carregar o espaço de alinhamento.");
  }
}

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
    const text = cleanParagraph(payload.text, 600);

    if (!topicId || !authorId) return badRequest("Informe o tópico e quem está enviando a mensagem.");
    if (!text) return badRequest("Escreva uma mensagem antes de enviar.");
    if (authorRole !== actor.role || authorId !== expectedId) {
      return forbidden("Você só pode enviar mensagens em seu próprio nome.");
    }

    if (!canUseAlignmentTopic(current, authorRole, authorId, topicId)) {
      return forbidden("Este espaço é só para o professor e os monitores do tópico.");
    }

    const author =
      authorRole === "teacher"
        ? current.teachers.find((teacher) => teacher.id === authorId)
        : current.monitors.find((monitor) => monitor.id === authorId);
    if (!author) return badRequest("Pessoa não encontrada.");

    const db = await updateDb((draft) => {
      const id = nextId("am", draft.alignmentMessages);
      draft.alignmentMessages.push({
        id,
        topicId,
        authorRole,
        authorId,
        authorName: author.name,
        authorColor: author.color,
        text,
        createdAt: new Date().toISOString(),
      });
    });

    const created = db.alignmentMessages.at(-1);
    return ok({ message: created });
  } catch {
    return serverError("Não foi possível enviar a mensagem.");
  }
}
