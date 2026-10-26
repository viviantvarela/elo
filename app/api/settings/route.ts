import { badRequest, forbidden, ok, readJson, serverError, unauthorized } from "@/lib/server/http";
import { resolveActor } from "@/lib/server/auth";
import { readDb, updateDb } from "@/lib/server/db";
import type { AccentKey, PairingWeights, Settings } from "@/lib/types";

export const dynamic = "force-dynamic";

const accents: AccentKey[] = ["green", "ocean", "plum", "rose", "amber"];

function sanitizeWeight(value: unknown, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(1, Math.round(value * 100) / 100));
}

export async function GET(request: Request) {
  try {
    const db = await readDb();
    const actor = await resolveActor(request, db);
    if (!actor) return unauthorized();
    return ok({ settings: db.settings, profile: db.profile });
  } catch {
    return serverError("Não foi possível carregar as configurações.");
  }
}

export async function PATCH(request: Request) {
  const payload = await readJson<Record<string, unknown>>(request);
  if (!payload) return badRequest("Corpo da requisição inválido.");

  try {
    const current = await readDb();
    const actor = await resolveActor(request, current);
    if (!actor) return unauthorized();
    if (actor.role !== "coordinator") {
      return forbidden("Apenas a coordenação pode alterar as configurações do piloto.");
    }

    const db = await updateDb((draft) => {
      const next: Settings = { ...draft.settings };

      if (payload.weights && typeof payload.weights === "object") {
        const w = payload.weights as Partial<PairingWeights>;
        next.weights = {
          topic: sanitizeWeight(w.topic, next.weights.topic),
          availability: sanitizeWeight(w.availability, next.weights.availability),
          rating: sanitizeWeight(w.rating, next.weights.rating),
          load: sanitizeWeight(w.load, next.weights.load),
        };
      }

      if (typeof payload.consentRequired === "boolean") next.consentRequired = payload.consentRequired;
      if (typeof payload.guardianConsentRequired === "boolean") {
        next.guardianConsentRequired = payload.guardianConsentRequired;
      }
      if (typeof payload.aggregateOnly === "boolean") next.aggregateOnly = payload.aggregateOnly;
      if (typeof payload.retentionDays === "number" && Number.isInteger(payload.retentionDays)) {
        if (payload.retentionDays >= 30 && payload.retentionDays <= 3650) {
          next.retentionDays = payload.retentionDays;
        }
      }
      if (typeof payload.accent === "string" && accents.includes(payload.accent as AccentKey)) {
        next.accent = payload.accent as AccentKey;
      }
      if (payload.theme === "light" || payload.theme === "dark") {
        next.theme = payload.theme;
      }

      draft.settings = next;
    });

    return ok({ settings: db.settings, profile: db.profile });
  } catch {
    return serverError("Não foi possível salvar as configurações.");
  }
}
