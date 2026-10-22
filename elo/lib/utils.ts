import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { PastelKey } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** classes de fundo/texto para a paleta pastel de dados */
export const pastelBg: Record<PastelKey, string> = {
  peach: "bg-peach text-ink-peach",
  blue: "bg-blue text-ink-blue",
  sage: "bg-sage text-ink-sage",
  sand: "bg-sand text-ink-sand",
  lilac: "bg-lilac text-ink-lilac",
};

export const pastelDot: Record<PastelKey, string> = {
  peach: "bg-ink-peach",
  blue: "bg-ink-blue",
  sage: "bg-ink-sage",
  sand: "bg-ink-sand",
  lilac: "bg-ink-lilac",
};

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function formatMinutes(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h}h${String(m).padStart(2, "0")}`;
}

export function formatHours(minutes: number) {
  return (minutes / 60).toFixed(1).replace(".", ",");
}

export function formatSlot(start: number, end: number) {
  const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  return `${fmt(start)}–${fmt(end)}`;
}

export function overlapMinutes(a: { start: number; end: number; day: number }, b: { start: number; end: number; day: number }) {
  if (a.day !== b.day) return 0;
  return Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start));
}

export function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}
