"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useUi } from "@/store/ui";

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
  MonitorKind,
  PastelKey,
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

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function buildAuthHeaders(): Promise<Record<string, string>> {
  const state = useUi.getState();

  if (state.authMode === "supabase") {
    let token = state.accessToken;
    if (!token) {
      const sb = getSupabaseBrowserClient();
      if (sb) {
        const { data } = await sb.auth.getSession();
        token = data.session?.access_token ?? null;
      }
    }
    if (token) {
      return { authorization: `Bearer ${token}` };
    }
  }

  if (state.authMode === "demo") {
    if (state.role === "student") {
      return { "x-elo-actor": state.studentId ? `student:${state.studentId}` : "student" };
    }
    if (state.role === "monitor") {
      return { "x-elo-actor": state.monitorId ? `monitor:${state.monitorId}` : "monitor" };
    }
    if (state.role === "teacher") {
      return { "x-elo-actor": state.teacherId ? `teacher:${state.teacherId}` : "teacher" };
    }
    return { "x-elo-actor": "coordinator" };
  }

  return {};
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const authHeaders = await buildAuthHeaders();
  const headers: Record<string, string> = {
    ...authHeaders,
    ...(init?.body ? { "content-type": "application/json" } : {}),
    ...((init?.headers as Record<string, string> | undefined) ?? {}),
  };

  const response = await fetch(path, {
    ...init,
    headers,
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
  privacy: {
    consentRequired: boolean;
    guardianConsentRequired: boolean;
    aggregateOnly: boolean;
  };
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
  acceptConsent?: boolean;
}

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

export interface AuthSyncResponse {
  actor: {
    mode: "supabase" | "demo";
    role: Role;
    studentId?: string;
    monitorId?: string;
    teacherId?: string;
    email?: string;
  };
}

export type ProfilePatch = Partial<Pick<DemoProfile, "name" | "email" | "className" | "campus">>;
export type StudentPatch = Partial<Pick<Student, "name" | "className" | "course" | "guardianConsent" | "email">> & {
  acceptConsent?: boolean;
};
export type MonitorPatch = Partial<
  Pick<Monitor, "name" | "className" | "bio" | "online" | "availability" | "topics" | "kind" | "capacityHours" | "email">
>;
export type TeacherPatch = Partial<Pick<Teacher, "name" | "className" | "email" | "bio">>;

export interface CreateMonitorPayload {
  name: string;
  className: string;
  kind: MonitorKind;
  capacityHours: number;
  topics: { topicId: string; level: number }[];
  availability: Slot[];
  bio?: string;
  email?: string;
  color?: PastelKey;
  online?: boolean;
}

export interface CreateStudentPayload {
  name: string;
  className: string;
  course: string;
  guardianConsent?: boolean;
  email?: string;
  color?: PastelKey;
}

export interface CreateTopicPayload {
  name: string;
  component: string;
  color: PastelKey;
}

export const api = {
  /* ------------------------------ autenticação ---------------------------- */
  syncAuthAccount: (
    accessToken: string,
    payload?: {
      name?: string;
      className?: string;
      course?: string;
      campus?: string;
      desiredRole?: Role;
      guardianConsent?: boolean;
      acceptConsent?: boolean;
    },
  ) =>
    request<AuthSyncResponse>("/api/auth", {
      method: "POST",
      headers: { authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(payload ?? {}),
    }),

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
  scheduleRequest: (id: string, monitorId: string, startsAt: string, minutes: number, location?: string) =>
    request<{ request: HelpRequest; session: Session | null }>("/api/requests", {
      method: "PATCH",
      body: JSON.stringify({ id, action: "schedule", monitorId, startsAt, minutes, location }),
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
    location?: string;
  }) => request<{ session: Session }>("/api/sessions", { method: "POST", body: JSON.stringify(payload) }),
  rateSession: (payload: { requestId?: string; sessionId?: string; rating: number; notes?: string }) =>
    request<{ session: Session }>("/api/sessions", { method: "PATCH", body: JSON.stringify(payload) }),

  /* ------------------------------- usuários ------------------------------ */
  getPeople: () => request<PeoplePayload>("/api/people"),
  createStudent: (payload: CreateStudentPayload) =>
    request<Student>("/api/students", { method: "POST", body: JSON.stringify(payload) }),
  updateStudent: (id: string, patch: StudentPatch) =>
    request<Student>("/api/students", { method: "PATCH", body: JSON.stringify({ id, ...patch }) }),

  /* ------------------------------- monitores ----------------------------- */
  listMonitors: () => request<Monitor[]>("/api/monitors"),
  createMonitor: (payload: CreateMonitorPayload) =>
    request<Monitor>("/api/monitors", { method: "POST", body: JSON.stringify(payload) }),
  updateMonitor: (id: string, patch: MonitorPatch) =>
    request<Monitor>("/api/monitors", { method: "PATCH", body: JSON.stringify({ id, ...patch }) }),
  deleteMonitor: (id: string) =>
    request<{ ok: boolean }>(`/api/monitors?id=${encodeURIComponent(id)}`, { method: "DELETE" }),

  /* -------------------------------- tópicos ------------------------------ */
  listTopics: () => request<Topic[]>("/api/topics"),
  createTopic: (payload: CreateTopicPayload) =>
    request<Topic>("/api/topics", { method: "POST", body: JSON.stringify(payload) }),
  deleteTopic: (id: string) =>
    request<{ ok: boolean }>(`/api/topics?id=${encodeURIComponent(id)}`, { method: "DELETE" }),

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
