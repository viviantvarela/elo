"use client";

import type {
  AccentKey,
  AlignmentAuthorRole,
  AlignmentMeeting,
  AlignmentMessage,
  DashboardSummary,
  DemoProfile,
  HelpRequest,
  Match,
  Monitor,
  ReportPayload,
  Role,
  Session,
  Settings,
  Slot,
  Student,
  Teacher,
  Topic,
  Urgency,
} from "./types";

/**
 * Camada de acesso a dados (cliente). Toda chamada vai para as rotas em
 * `app/api`, que leem e escrevem o store no servidor. As assinaturas são o
 * contrato: apontar para Supabase/Prisma depois é trocar este arquivo e as
 * rotas, nada mais.
 */

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: init?.body ? { "content-type": "application/json", ...init?.headers } : init?.headers,
  });

  if (!response.ok) {
    let message = `Falha na requisição (${response.status})`;
    try {
      const payload = (await response.json()) as { error?: string };
      if (payload?.error) message = payload.error;
    } catch {
      /* mantém a mensagem genérica */
    }
    throw new ApiError(message, response.status);
  }

  return (await response.json()) as T;
}

export interface RequestsPayload {
  requests: HelpRequest[];
  students: Student[];
  topics: Topic[];
  monitors: Monitor[];
  weights: { topic: number; availability: number; rating: number; load: number };
}

export interface RequestDetailPayload {
  request: HelpRequest;
  matches: Match[];
  session: Session | null;
  student: Student | null;
  topic: Topic | null;
  monitors: Monitor[];
}

export interface SettingsPayload {
  settings: Settings;
  profile: DemoProfile;
}

export interface CreateRequestPayload {
  studentId: string;
  topicId: string;
  note: string;
  urgency: Urgency;
  preferred: Slot[];
}

/** Quem pode estar usando o Elo (menu do usuário e troca de usuário). */
export interface PeoplePayload {
  coordinator: DemoProfile;
  students: Student[];
  monitors: Monitor[];
  teachers: Teacher[];
  topics: Topic[];
}

export interface AlignmentPayload {
  messages: AlignmentMessage[];
  meetings: AlignmentMeeting[];
}

export type ProfilePatch = Partial<Pick<DemoProfile, "name" | "email" | "className" | "campus">>;
export type StudentPatch = Partial<Pick<Student, "name" | "className" | "course">>;
export type MonitorPatch = Partial<Pick<Monitor, "name" | "className" | "bio" | "online" | "availability">>;
export type TeacherPatch = Partial<Pick<Teacher, "name" | "className" | "email" | "bio">>;

export const api = {
  /* -------------------------------- painel ------------------------------- */
  getDashboard: () => request<DashboardSummary>("/api/dashboard"),

  /* -------------------------------- pedidos ------------------------------ */
  listRequests: () => request<RequestsPayload>("/api/requests"),
  getRequest: (id: string) => request<RequestDetailPayload>(`/api/requests?id=${encodeURIComponent(id)}`),
  createRequest: (payload: CreateRequestPayload) =>
    request<{ request: HelpRequest; matches: Match[] }>("/api/requests", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  matchRequest: (id: string, monitorId: string) =>
    request<{ request: HelpRequest }>("/api/requests", {
      method: "PATCH",
      body: JSON.stringify({ id, action: "match", monitorId }),
    }),
  scheduleRequest: (id: string, monitorId: string, startsAt: string, minutes: number) =>
    request<{ request: HelpRequest; session: Session | null }>("/api/requests", {
      method: "PATCH",
      body: JSON.stringify({ id, action: "schedule", monitorId, startsAt, minutes }),
    }),
  cancelRequest: (id: string) =>
    request<{ request: HelpRequest }>("/api/requests", {
      method: "PATCH",
      body: JSON.stringify({ id, action: "cancel" }),
    }),
  reopenRequest: (id: string) =>
    request<{ request: HelpRequest }>("/api/requests", {
      method: "PATCH",
      body: JSON.stringify({ id, action: "reopen" }),
    }),

  /* -------------------------------- sessões ------------------------------ */
  listSessions: () => request<Session[]>("/api/sessions"),
  completeSession: (payload: {
    requestId: string;
    minutes: number;
    attendance: "present" | "absent";
    rating?: number;
    notes?: string;
  }) => request<{ session: Session }>("/api/sessions", { method: "POST", body: JSON.stringify(payload) }),

  /* ------------------------------- usuários ------------------------------ */
  getPeople: () => request<PeoplePayload>("/api/people"),
  updateStudent: (id: string, patch: StudentPatch) =>
    request<Student>("/api/students", { method: "PATCH", body: JSON.stringify({ id, ...patch }) }),

  /* ------------------------------- monitores ----------------------------- */
  listMonitors: () => request<Monitor[]>("/api/monitors"),
  updateMonitor: (id: string, patch: MonitorPatch) =>
    request<Monitor>("/api/monitors", { method: "PATCH", body: JSON.stringify({ id, ...patch }) }),

  /* ------------------------------ professores ----------------------------- */
  listTeachers: () => request<Teacher[]>("/api/teachers"),
  updateTeacher: (id: string, patch: TeacherPatch) =>
    request<Teacher>("/api/teachers", { method: "PATCH", body: JSON.stringify({ id, ...patch }) }),

  /* --------------------------- espaço de alinhamento ----------------------- */
  getAlignment: () => request<AlignmentPayload>("/api/alignment"),
  sendAlignmentMessage: (payload: { topicId: string; authorRole: AlignmentAuthorRole; authorId: string; text: string }) =>
    request<{ message: AlignmentMessage }>("/api/alignment", { method: "POST", body: JSON.stringify(payload) }),
  scheduleAlignmentMeeting: (payload: {
    topicId: string;
    authorRole: AlignmentAuthorRole;
    authorId: string;
    title: string;
    scheduledAt: string;
    durationMinutes: number;
  }) => request<{ meeting: AlignmentMeeting }>("/api/alignment/meetings", { method: "POST", body: JSON.stringify(payload) }),
  cancelAlignmentMeeting: (payload: { id: string; authorRole: AlignmentAuthorRole; authorId: string }) =>
    request<{ meeting: AlignmentMeeting }>("/api/alignment/meetings", { method: "PATCH", body: JSON.stringify(payload) }),

  /* ------------------------------- relatórios ---------------------------- */
  getReports: () => request<ReportPayload>("/api/reports"),

  /* ------------------------------ configurações -------------------------- */
  getSettings: () => request<SettingsPayload>("/api/settings"),
  saveSettings: (patch: Partial<Settings>) =>
    request<SettingsPayload>("/api/settings", { method: "PATCH", body: JSON.stringify(patch) }),
  saveProfile: (patch: ProfilePatch) =>
    request<DemoProfile>("/api/profile", { method: "PATCH", body: JSON.stringify(patch) }),
  resetDemo: () => request<{ ok: boolean }>("/api/admin/reset", { method: "POST" }),
};

export type Api = typeof api;
export type { AccentKey, Role };
