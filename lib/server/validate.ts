import type { Slot } from "../types";

/** Texto vindo do cliente: aceita só string, tira espaços extras e limita o tamanho. */
export function cleanText(value: unknown, max = 120): string | undefined {
  if (typeof value !== "string") return undefined;
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

/** Igual a `cleanText`, mas preserva quebras de linha (bio, observações). */
export function cleanParagraph(value: unknown, max = 400): string | undefined {
  if (typeof value !== "string") return undefined;
  return value
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);
}

export function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

/**
 * Janelas de horário vindas do cliente: só segunda a sábado, minutos do dia
 * válidos, início antes do fim e sem repetir o mesmo início no mesmo dia
 * (é a chave da tabela de disponibilidade no Postgres).
 */
export function sanitizeSlots(value: unknown, limit = 24): Slot[] | null {
  if (!Array.isArray(value)) return null;

  const seen = new Set<string>();
  const slots: Slot[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const { day, start, end } = item as Record<string, unknown>;
    if (![day, start, end].every((n) => typeof n === "number" && Number.isInteger(n))) return null;

    const slot = { day: day as number, start: start as number, end: end as number };
    if (slot.day < 1 || slot.day > 6) return null;
    if (slot.start < 0 || slot.end > 24 * 60 || slot.start >= slot.end) return null;

    const key = `${slot.day}-${slot.start}`;
    if (seen.has(key)) continue;
    seen.add(key);
    slots.push(slot);
  }

  if (slots.length > limit) return null;
  return slots.sort((a, b) => a.day - b.day || a.start - b.start);
}
