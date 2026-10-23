import { badRequest, notFound, ok, readJson, serverError } from "@/lib/server/http";
import { readDb, updateDb } from "@/lib/server/db";
import { cleanParagraph, cleanText, sanitizeSlots } from "@/lib/server/validate";
import type { Monitor } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = await readDb();
    return ok(db.monitors);
  } catch {
    return serverError("Não foi possível carregar os monitores.");
  }
}

/**
 * Perfil do monitor (Configurações → Meu perfil): nome, turma, apresentação,
 * "disponível agora" e janelas de atendimento — que entram direto no
 * pareamento. Tópicos, nível e teto semanal ficam com a coordenação.
 */
export async function PATCH(request: Request) {
  const payload = await readJson<Record<string, unknown>>(request);
  const id = cleanText(payload?.id, 40);
  if (!payload || !id) return badRequest("Informe o monitor que deseja atualizar.");

  const patch: Partial<Pick<Monitor, "name" | "className" | "bio" | "online" | "availability">> = {};
  const name = cleanText(payload.name, 80);
  const className = cleanText(payload.className, 60);
  const bio = cleanParagraph(payload.bio, 280);

  if (name !== undefined) {
    if (!name) return badRequest("Informe seu nome.");
    patch.name = name;
  }
  if (className !== undefined) {
    if (!className) return badRequest("Informe sua turma.");
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

  try {
    const current = await readDb();
    if (!current.monitors.some((monitor) => monitor.id === id)) return notFound("Monitor não encontrado.");

    const db = await updateDb((draft) => {
      const target = draft.monitors.find((monitor) => monitor.id === id);
      if (target) Object.assign(target, patch);
    });

    const updated = db.monitors.find((monitor) => monitor.id === id);
    if (!updated) return notFound("Monitor não encontrado.");
    return ok(updated);
  } catch {
    return serverError("Não foi possível salvar o perfil.");
  }
}
