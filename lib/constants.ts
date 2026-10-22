"use client";

import type { PairingWeights, Role } from "./types";

export const CAMPUS = "IFRN — Campus Parnamirim";

export const topicCatalog = [
  { id: "mat", name: "Matemática", component: "Matemática I", color: "sage" },
  { id: "port", name: "Língua Portuguesa", component: "Língua Portuguesa I", color: "peach" },
  { id: "fis", name: "Física", component: "Física I", color: "blue" },
  { id: "prog", name: "Programação", component: "Lógica e Programação", color: "lilac" },
  { id: "quim", name: "Química", component: "Química I", color: "sand" },
] as const;

export const statusLabels: Record<string, string> = {
  open: "Aberto",
  matched: "Em pareamento",
  scheduled: "Agendado",
  done: "Concluído",
  cancelled: "Cancelado",
};

export const urgencyLabels: Record<string, string> = {
  low: "Tranquilo",
  normal: "Normal",
  high: "Urgente",
};

export const roleLabels: Record<Role, string> = {
  student: "Estudante",
  monitor: "Monitor(a)",
  coordinator: "Coordenação",
};

/** pesos iniciais do algoritmo de pareamento (calibráveis no piloto) */
export const defaultWeights: PairingWeights = {
  topic: 0.4,
  availability: 0.3,
  rating: 0.2,
  load: 0.1,
};

export const navItems = [
  { href: "/painel", label: "Painel", icon: "gauge", roles: ["coordinator", "monitor", "student"] },
  { href: "/pedidos", label: "Pedidos de ajuda", icon: "life-buoy", roles: ["coordinator", "monitor", "student"] },
  { href: "/monitores", label: "Monitores", icon: "users", roles: ["coordinator", "monitor", "student"] },
  { href: "/agenda", label: "Agenda", icon: "calendar", roles: ["coordinator", "monitor", "student"] },
  { href: "/relatorios", label: "Relatórios", icon: "chart", roles: ["coordinator", "monitor"] },
  { href: "/configuracoes", label: "Configurações", icon: "settings", roles: ["coordinator", "monitor", "student"] },
] as const;

export const accentOptions = [
  { key: "green", label: "Verde Elo" },
  { key: "ocean", label: "Oceano" },
  { key: "plum", label: "Ameixa" },
  { key: "rose", label: "Rosé" },
  { key: "amber", label: "Âmbar" },
] as const;

/** horas úteis do piloto: 13h às 22h, segunda a sexta */
export const dayStart = 13 * 60;
export const dayEnd = 22 * 60;

/** janelas oferecidas no pedido de ajuda (evita date-picker na demo) */
export const pilotSlots = [
  { key: "seg-13", label: "Seg · 13h–15h", day: 1, start: 13 * 60, end: 15 * 60 },
  { key: "ter-15", label: "Ter · 15h–17h", day: 2, start: 15 * 60, end: 17 * 60 },
  { key: "ter-18", label: "Ter · 18h–20h", day: 2, start: 18 * 60, end: 20 * 60 },
  { key: "qua-13", label: "Qua · 13h–14h", day: 3, start: 13 * 60, end: 14 * 60 },
  { key: "qua-17", label: "Qua · 17h–19h", day: 3, start: 17 * 60, end: 19 * 60 },
  { key: "qui-13", label: "Qui · 13h–16h", day: 4, start: 13 * 60, end: 16 * 60 },
  { key: "sex-13", label: "Sex · 13h–15h", day: 5, start: 13 * 60, end: 15 * 60 },
  { key: "sex-15", label: "Sex · 15h–18h", day: 5, start: 15 * 60, end: 18 * 60 },
] as const;

export const weekdayShort = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"] as const;
