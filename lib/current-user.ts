"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";

import { api, type PeoplePayload } from "@/lib/api";
import { monitorKindLabels, roleLabels } from "@/lib/constants";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { DemoProfile, HelpRequest, Monitor, PastelKey, Role, Session, Student, Teacher } from "@/lib/types";
import { useUi } from "@/store/ui";

/**
 * Quem está usando o Elo agora: autenticado via Supabase Auth ou em modo
 * demonstração (`store/ui.ts`).
 */
export interface CurrentUser {
  authMode: "supabase" | "demo";
  email?: string;
  role: Role;
  roleLabel: string;
  /** id do registro: estudante, monitor, professor ou conta da coordenação */
  id: string;
  /** nome cadastrado — vazio enquanto a coordenação não preencher o perfil */
  name: string;
  /** nome para exibir (com o papel como alternativa) */
  displayName: string;
  firstName: string;
  /** linha de apoio: "1º ano INFO · Informática", "3º ano INFO · bolsista"… */
  detail: string;
  color: PastelKey;
  /** perfil sem nome: a interface convida a completar */
  incomplete: boolean;
  student: Student | null;
  monitor: Monitor | null;
  teacher: Teacher | null;
  coordinator: DemoProfile | null;
}

export const peopleQueryKey = ["people"] as const;

export function firstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? "";
}

/** Nome curto para listas apertadas: "Maria Eduarda Souza" → "Maria Eduarda". */
export function shortName(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).join(" ");
}

function fromStudent(student: Student, authMode: "supabase" | "demo", email?: string | null): CurrentUser {
  return {
    authMode,
    email: email ?? student.email,
    role: "student",
    roleLabel: roleLabels.student,
    id: student.id,
    name: student.name,
    displayName: student.name,
    firstName: firstName(student.name),
    detail: [student.className, student.course].filter(Boolean).join(" · "),
    color: student.color,
    incomplete: false,
    student,
    monitor: null,
    teacher: null,
    coordinator: null,
  };
}

function fromMonitor(monitor: Monitor, authMode: "supabase" | "demo", email?: string | null): CurrentUser {
  return {
    authMode,
    email: email ?? monitor.email,
    role: "monitor",
    roleLabel: roleLabels.monitor,
    id: monitor.id,
    name: monitor.name,
    displayName: monitor.name,
    firstName: firstName(monitor.name),
    detail: [monitor.className, monitorKindLabels[monitor.kind]].filter(Boolean).join(" · "),
    color: monitor.color,
    incomplete: false,
    student: null,
    monitor,
    teacher: null,
    coordinator: null,
  };
}

function fromTeacher(teacher: Teacher, authMode: "supabase" | "demo", email?: string | null): CurrentUser {
  return {
    authMode,
    email: email ?? (teacher.email || undefined),
    role: "teacher",
    roleLabel: roleLabels.teacher,
    id: teacher.id,
    name: teacher.name,
    displayName: teacher.name,
    firstName: firstName(teacher.name),
    detail: teacher.className,
    color: teacher.color,
    incomplete: false,
    student: null,
    monitor: null,
    teacher,
    coordinator: null,
  };
}

function fromCoordinator(profile: DemoProfile, authMode: "supabase" | "demo", email?: string | null): CurrentUser {
  const name = profile.name.trim();
  return {
    authMode,
    email: email ?? (profile.email || undefined),
    role: "coordinator",
    roleLabel: roleLabels.coordinator,
    id: profile.id,
    name,
    displayName: name || roleLabels.coordinator,
    firstName: name ? firstName(name) : "",
    detail: [profile.className, profile.campus].filter(Boolean).join(" · "),
    color: "sage",
    incomplete: !name,
    student: null,
    monitor: null,
    teacher: null,
    coordinator: profile,
  };
}

export function resolveCurrentUser(
  people: PeoplePayload | undefined,
  authMode: "supabase" | "demo",
  authEmail: string | null,
  role: Role,
  studentId: string | null,
  monitorId: string | null,
  teacherId: string | null,
): CurrentUser | null {
  if (!people) return null;

  if (role === "student") {
    const student = people.students.find((entry) => entry.id === studentId) ?? people.students[0];
    if (student) return fromStudent(student, authMode, authEmail);
  }

  if (role === "monitor") {
    const monitor = people.monitors.find((entry) => entry.id === monitorId) ?? people.monitors[0];
    if (monitor) return fromMonitor(monitor, authMode, authEmail);
  }

  if (role === "teacher") {
    const teacher = people.teachers.find((entry) => entry.id === teacherId) ?? people.teachers[0];
    if (teacher) return fromTeacher(teacher, authMode, authEmail);
  }

  return fromCoordinator(people.coordinator, authMode, authEmail);
}

/** Mantém a sessão do Supabase Auth sincronizada com `store/ui.ts` no navegador. */
export function useSupabaseAuthSync() {
  const queryClient = useQueryClient();
  const hydrated = useUi((s) => s.hydrated);
  const setSupabaseSession = useUi((s) => s.setSupabaseSession);
  const signOutState = useUi((s) => s.signOutState);

  useEffect(() => {
    if (!hydrated) return;
    const sb = getSupabaseBrowserClient();
    if (!sb) return;

    let active = true;

    const syncToken = async (accessToken: string, email: string) => {
      try {
        const { actor } = await api.syncAuthAccount(accessToken);
        if (!active) return;
        setSupabaseSession({
          email,
          accessToken,
          role: actor.role,
          studentId: actor.studentId ?? null,
          monitorId: actor.monitorId ?? null,
          teacherId: actor.teacherId ?? null,
        });
        void queryClient.invalidateQueries();
      } catch {
        /* mantém o estado atual caso o e-mail não pertença ao domínio permitido */
      }
    };

    void sb.auth.getSession().then(({ data }) => {
      if (!active) return;
      const session = data.session;
      if (session?.access_token && session.user?.email) {
        void syncToken(session.access_token, session.user.email);
      } else if (useUi.getState().authMode === "supabase") {
        signOutState();
      }
    });

    const { data: sub } = sb.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "SIGNED_OUT") {
        if (useUi.getState().authMode === "supabase") signOutState();
        return;
      }
      if (session?.access_token && session.user?.email) {
        void syncToken(session.access_token, session.user.email);
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [hydrated, queryClient, setSupabaseSession, signOutState]);
}

export function useCurrentUser() {
  const authMode = useUi((state) => state.authMode);
  const authEmail = useUi((state) => state.authEmail);
  const role = useUi((state) => state.role);
  const studentId = useUi((state) => state.studentId);
  const monitorId = useUi((state) => state.monitorId);
  const teacherId = useUi((state) => state.teacherId);
  const hydrated = useUi((state) => state.hydrated);

  const signedOut = hydrated && authMode === "signed_out";

  const people = useQuery({
    queryKey: peopleQueryKey,
    queryFn: api.getPeople,
    staleTime: 60_000,
    enabled: hydrated && !signedOut,
  });

  const user = useMemo(
    () =>
      hydrated && !signedOut
        ? resolveCurrentUser(
            people.data,
            authMode === "supabase" ? "supabase" : "demo",
            authEmail,
            role,
            studentId,
            monitorId,
            teacherId,
          )
        : null,
    [hydrated, signedOut, people.data, authMode, authEmail, role, studentId, monitorId, teacherId],
  );

  return {
    user,
    signedOut,
    people: people.data,
    isLoading: !hydrated || (!signedOut && people.isLoading),
    isError: !signedOut && people.isError && !people.data,
    retry: people.refetch,
  };
}

/* --------------------------- espaço de alinhamento ------------------------- */

/** Tópicos do Espaço de alinhamento que o usuário atual pode ver (professor leciona / monitor atende). */
export function alignmentTopicIds(user: CurrentUser | null): string[] {
  if (!user) return [];
  if (user.role === "teacher") return user.teacher?.topics ?? [];
  if (user.role === "monitor") return user.monitor?.topics.map((entry) => entry.topicId) ?? [];
  return [];
}

/* ------------------------------ visibilidade ------------------------------ */

export function visibleRequests(requests: HelpRequest[], user: CurrentUser | null) {
  if (!user) return [];
  if (user.role === "student") return requests.filter((request) => request.studentId === user.id);
  if (user.role === "monitor") {
    const topics = new Set(user.monitor?.topics.map((topic) => topic.topicId) ?? []);
    return requests.filter(
      (request) => request.monitorId === user.id || (request.status === "open" && topics.has(request.topicId)),
    );
  }
  return requests;
}

export function visibleSessions(sessions: Session[], user: CurrentUser | null) {
  if (!user) return [];
  if (user.role === "student") return sessions.filter((session) => session.studentId === user.id);
  if (user.role === "monitor") return sessions.filter((session) => session.monitorId === user.id);
  return sessions;
}

/* ------------------------------- permissões ------------------------------- */

export function requestPermissions(request: HelpRequest, user: CurrentUser | null) {
  const coordinator = user?.role === "coordinator";
  const owner = user?.role === "student" && request.studentId === user.id;
  const assigned = user?.role === "monitor" && request.monitorId === user.id;
  const activeOrScheduled =
    request.status === "open" || request.status === "matched" || request.status === "scheduled";

  return {
    pairAny: coordinator && request.status === "open",
    accept: user?.role === "monitor" && request.status === "open",
    schedule:
      (coordinator || assigned) &&
      (request.status === "open" || request.status === "matched" || request.status === "scheduled") &&
      Boolean(request.monitorId),
    register: (coordinator || assigned) && request.status === "scheduled",
    cancel: (coordinator || owner) && activeOrScheduled,
    release: (coordinator || assigned) && (request.status === "matched" || request.status === "scheduled"),
    reopen: coordinator
      ? request.status === "cancelled" || request.status === "done"
      : owner && request.status === "cancelled",
    rate: (owner || coordinator) && request.status === "done",
  };
}
