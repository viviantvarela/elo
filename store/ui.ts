"use client";

import { create } from "zustand";

import { safeStorage } from "@/lib/storage";
import type { AccentKey, Role } from "@/lib/types";

type Theme = "light" | "dark";

/**
 * Estado de interface + quem está usando o Elo neste navegador.
 *
 * Ainda não há login: o usuário é escolhido em "Trocar de usuário" (menu do
 * topo) e a escolha fica salva no navegador. Quando a tela de login chegar,
 * `role`, `studentId` e `monitorId` passam a vir da sessão autenticada — as
 * telas leem tudo por `useCurrentUser()` e não precisam mudar.
 */
interface UiState {
  role: Role;
  /** estudante ativo quando `role` é "student" */
  studentId: string | null;
  /** monitor ativo quando `role` é "monitor" */
  monitorId: string | null;
  /** professor ativo quando `role` é "teacher" */
  teacherId: string | null;
  accent: AccentKey;
  theme: Theme;
  sidebarOpen: boolean;
  /** diálogo "Trocar de usuário" (aberto pelo menu do topo, ⌘K ou Configurações) */
  switcherOpen: boolean;
  hydrated: boolean;
  hydrate: () => void;
  setIdentity: (role: Role, personId?: string | null) => void;
  setAccent: (accent: AccentKey) => void;
  setTheme: (theme: Theme) => void;
  setSidebarOpen: (open: boolean) => void;
  setSwitcherOpen: (open: boolean) => void;
}

const KEY = "elo.ui.v1";

const roles: Role[] = ["student", "monitor", "coordinator", "teacher"];
const accents: AccentKey[] = ["green", "ocean", "plum", "rose", "amber"];

type Persisted = Pick<UiState, "role" | "studentId" | "monitorId" | "teacherId" | "accent" | "theme">;

function apply(accent: AccentKey, theme: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-accent", accent);
  document.documentElement.classList.toggle("dark", theme === "dark");
}

function save(state: Persisted) {
  safeStorage.set(KEY, JSON.stringify(state));
}

function snapshot(state: UiState): Persisted {
  return {
    role: state.role,
    studentId: state.studentId,
    monitorId: state.monitorId,
    teacherId: state.teacherId,
    accent: state.accent,
    theme: state.theme,
  };
}

export const useUi = create<UiState>((set, get) => ({
  role: "coordinator",
  studentId: null,
  monitorId: null,
  teacherId: null,
  accent: "green",
  theme: "light",
  sidebarOpen: false,
  switcherOpen: false,
  hydrated: false,

  hydrate: () => {
    if (get().hydrated) return;
    try {
      const raw = safeStorage.get(KEY);
      const saved = raw ? (JSON.parse(raw) as Partial<Persisted>) : {};
      const accent = saved.accent && accents.includes(saved.accent) ? saved.accent : "green";
      const theme = saved.theme === "dark" ? "dark" : "light";
      apply(accent, theme);
      set({
        role: saved.role && roles.includes(saved.role) ? saved.role : "coordinator",
        studentId: typeof saved.studentId === "string" ? saved.studentId : null,
        monitorId: typeof saved.monitorId === "string" ? saved.monitorId : null,
        teacherId: typeof saved.teacherId === "string" ? saved.teacherId : null,
        accent,
        theme,
        hydrated: true,
      });
    } catch {
      apply("green", "light");
      set({ hydrated: true });
    }
  },

  setIdentity: (role, personId) => {
    const current = get();
    set({
      role,
      studentId: role === "student" && personId !== undefined ? personId : current.studentId,
      monitorId: role === "monitor" && personId !== undefined ? personId : current.monitorId,
      teacherId: role === "teacher" && personId !== undefined ? personId : current.teacherId,
    });
    save(snapshot(get()));
  },

  setAccent: (accent) => {
    apply(accent, get().theme);
    set({ accent });
    save(snapshot(get()));
  },

  setTheme: (theme) => {
    apply(get().accent, theme);
    set({ theme });
    save(snapshot(get()));
  },

  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),

  setSwitcherOpen: (switcherOpen) => set({ switcherOpen }),
}));
