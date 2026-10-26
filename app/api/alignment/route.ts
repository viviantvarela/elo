import { badRequest, forbidden, ok, readJson, serverError } from "@/lib/server/http";
import { readDb, updateDb } from "@/lib/server/db";
import { canUseAlignmentTopic, nextId } from "@/lib/server/repository";
import { cleanParagraph, cleanText } from "@/lib/server/validate";
import type { AlignmentAuthorRole } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Espaço de alinhamento: mensagens entre professor(a) e monitor(a) do mesmo
 * tópico, para combinar mudanças nas aulas. Fora do alcance de estudantes e
 * coordenação — o menu já esconde a página (`lib/constants.ts`), e aqui o
 * servidor confere de novo antes de ler ou gravar qualquer mensagem.
 */
export async function GET() {
  try {
    const db = await readDb();
    return ok({ messages: db.alignmentMessages, meetings: db.alignmentMeetings });
  } catch {
    return serverError("Não foi possível carregar o espaço de alinhamento.");
  }
}

function parseAuthorRole(value: unknown): AlignmentAuthorRole | null {
  return value === "teacher" || value === "monitor" ? value : null;
}

export async function POST(request: Request) {
  const payload = await readJson<Record<string, unknown>>(request);
  if (!payload) return badRequest("Corpo da requisição inválido.");

  const topicId = cleanText(payload.topicId, 40);
  const authorRole = parseAuthorRole(payload.authorRole);
  const authorId = cleanText(payload.authorId, 40);
  const text = cleanParagraph(payload.text, 600);

  if (!topicId || !authorRole || !authorId) return badRequest("Informe o tópico e quem está enviando a mensagem.");
  if (!text) return badRequest("Escreva uma mensagem antes de enviar.");

  try {
    const current = await readDb();
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
