"use client";

import { create } from "zustand";

import { safeStorage } from "@/lib/storage";
import { isDemoModeEnabled } from "@/lib/supabase-browser";
import type { AccentKey, Role } from "@/lib/types";

type Theme = "light" | "dark";
export type AuthMode = "supabase" | "demo" | "signed_out";

/**
 * Estado de interface + sessão de quem está usando o Elo neste navegador.
 *
 * Suporta dois modos:
 *  - `"supabase"`: usuário autenticado de verdade via Supabase Auth
 *  - `"demo"`: modo demonstração (troca rápida entre Coordenação, Monitor, Professor e Estudante)
 *  - `"signed_out"`: usuário saiu da conta e vê a tela `/entrar`
 */
interface UiState {
  authMode: AuthMode;
  authEmail: string | null;
  accessToken: string | null;
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
  /** diálogo "Trocar de usuário" (disponível no modo demonstração) */
  switcherOpen: boolean;
  hydrated: boolean;
  hydrate: () => void;
  setIdentity: (role: Role, personId?: string | null) => void;
  setSupabaseSession: (payload: {
    email: string;
    accessToken: string;
    role: Role;
    studentId?: string | null;
    monitorId?: string | null;
    teacherId?: string | null;
  }) => void;
  signOutState: () => void;
  setAccent: (accent: AccentKey) => void;
  setTheme: (theme: Theme) => void;
  setSidebarOpen: (open: boolean) => void;
  setSwitcherOpen: (open: boolean) => void;
}

const KEY = "elo.ui.v2";
const LEGACY_KEY = "elo.ui.v1";

const roles: Role[] = ["student", "monitor", "coordinator", "teacher"];
const accents: AccentKey[] = ["green", "ocean", "plum", "rose", "amber"];

type Persisted = Pick<
  UiState,
  "authMode" | "authEmail" | "role" | "studentId" | "monitorId" | "teacherId" | "accent" | "theme"
>;

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
    authMode: state.authMode,
    authEmail: state.authEmail,
    role: state.role,
    studentId: state.studentId,
    monitorId: state.monitorId,
    teacherId: state.teacherId,
    accent: state.accent,
    theme: state.theme,
  };
}

export const useUi = create<UiState>((set, get) => ({
  authMode: isDemoModeEnabled() ? "demo" : "signed_out",
  authEmail: null,
  accessToken: null,
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
      const raw = safeStorage.get(KEY) ?? safeStorage.get(LEGACY_KEY);
      const saved = raw ? (JSON.parse(raw) as Partial<Persisted>) : {};
      const accent = saved.accent && accents.includes(saved.accent) ? saved.accent : "green";
      const theme = saved.theme === "dark" ? "dark" : "light";
      const demoAllowed = isDemoModeEnabled();
      let authMode: AuthMode = demoAllowed ? "demo" : "signed_out";
      if (saved.authMode === "signed_out") authMode = "signed_out";
      if (saved.authMode === "supabase") authMode = "supabase";
      if (saved.authMode === "demo" && demoAllowed) authMode = "demo";

      apply(accent, theme);
      set({
        authMode,
        authEmail: typeof saved.authEmail === "string" ? saved.authEmail : null,
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
      authMode: "demo",
      authEmail: null,
      accessToken: null,
      role,
      studentId: role === "student" && personId !== undefined ? personId : current.studentId,
      monitorId: role === "monitor" && personId !== undefined ? personId : current.monitorId,
      teacherId: role === "teacher" && personId !== undefined ? personId : current.teacherId,
    });
    save(snapshot(get()));
  },

  setSupabaseSession: ({ email, accessToken, role, studentId, monitorId, teacherId }) => {
    set({
      authMode: "supabase",
      authEmail: email,
      accessToken,
      role,
      studentId: role === "student" ? (studentId ?? null) : null,
      monitorId: role === "monitor" ? (monitorId ?? null) : null,
      teacherId: role === "teacher" ? (teacherId ?? null) : null,
    });
    save(snapshot(get()));
  },

  signOutState: () => {
    set({
      authMode: "signed_out",
      authEmail: null,
      accessToken: null,
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
