"use client";

import { create } from "zustand";

import { safeStorage } from "@/lib/storage";
import type { AccentKey, Role } from "@/lib/types";

type Theme = "light" | "dark";

interface UiState {
  role: Role;
  accent: AccentKey;
  theme: Theme;
  sidebarOpen: boolean;
  hydrated: boolean;
  hydrate: () => void;
  setRole: (role: Role) => void;
  setAccent: (accent: AccentKey) => void;
  setTheme: (theme: Theme) => void;
  setSidebarOpen: (open: boolean) => void;
}

const KEY = "elo.ui.v1";

function apply(accent: AccentKey, theme: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-accent", accent);
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export const useUi = create<UiState>((set, get) => ({
  role: "coordinator",
  accent: "green",
  theme: "light",
  sidebarOpen: false,
  hydrated: false,

  hydrate: () => {
    if (get().hydrated) return;
    try {
      const raw = safeStorage.get(KEY);
      const saved = raw ? (JSON.parse(raw) as Partial<UiState>) : {};
      const accent = saved.accent ?? "green";
      const theme = saved.theme ?? "light";
      apply(accent, theme);
      set({
        role: saved.role ?? "coordinator",
        accent,
        theme,
        hydrated: true,
      });
    } catch {
      apply("green", "light");
      set({ hydrated: true });
    }
  },

  setRole: (role) => {
    set({ role });
    const { accent, theme } = get();
    safeStorage.set(KEY, JSON.stringify({ role, accent, theme }));
  },

  setAccent: (accent) => {
    const { theme, role } = get();
    apply(accent, theme);
    set({ accent });
    safeStorage.set(KEY, JSON.stringify({ role, accent, theme }));
  },

  setTheme: (theme) => {
    const { accent, role } = get();
    apply(accent, theme);
    set({ theme });
    safeStorage.set(KEY, JSON.stringify({ role, accent, theme }));
  },

  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
}));
