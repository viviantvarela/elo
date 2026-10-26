"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { api, type PeoplePayload } from "@/lib/api";
import { monitorKindLabels, roleLabels } from "@/lib/constants";
import type { DemoProfile, HelpRequest, Monitor, PastelKey, Role, Session, Student, Teacher } from "@/lib/types";
import { useUi } from "@/store/ui";

/**
 * Quem está usando o Elo agora.
 *
 * Sem login, a identidade é escolhida em "Trocar de usuário" e guardada no
 * navegador (`store/ui.ts`); os dados da pessoa vêm de `/api/people`. Quando a
 * tela de login chegar, só muda a origem da identidade — as telas continuam
 * lendo tudo daqui.
 */
export interface CurrentUser {
  role: Role;
  roleLabel: string;
  /** id do registro: estudante, monitor ou conta da coordenação */
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

function fromStudent(student: Student): CurrentUser {
  return {
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

function fromMonitor(monitor: Monitor): CurrentUser {
  return {
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

function fromTeacher(teacher: Teacher): CurrentUser {
  return {
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

function fromCoordinator(profile: DemoProfile): CurrentUser {
  const name = profile.name.trim();
  return {
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
  role: Role,
  studentId: string | null,
  monitorId: string | null,
  teacherId: string | null,
): CurrentUser | null {
  if (!people) return null;

  if (role === "student") {
    // id salvo que não existe mais (ex.: base restaurada) cai no primeiro da lista
    const student = people.students.find((entry) => entry.id === studentId) ?? people.students[0];
    if (student) return fromStudent(student);
  }

  if (role === "monitor") {
    const monitor = people.monitors.find((entry) => entry.id === monitorId) ?? people.monitors[0];
    if (monitor) return fromMonitor(monitor);
  }

  if (role === "teacher") {
    const teacher = people.teachers.find((entry) => entry.id === teacherId) ?? people.teachers[0];
    if (teacher) return fromTeacher(teacher);
  }

  return fromCoordinator(people.coordinator);
}

export function useCurrentUser() {
  const role = useUi((state) => state.role);
  const studentId = useUi((state) => state.studentId);
  const monitorId = useUi((state) => state.monitorId);
  const teacherId = useUi((state) => state.teacherId);
  const hydrated = useUi((state) => state.hydrated);

  const people = useQuery({ queryKey: peopleQueryKey, queryFn: api.getPeople, staleTime: 60_000 });

  const user = useMemo(
    () => (hydrated ? resolveCurrentUser(people.data, role, studentId, monitorId, teacherId) : null),
    [hydrated, people.data, role, studentId, monitorId, teacherId],
  );

  return {
    user,
    people: people.data,
    isLoading: !hydrated || people.isLoading,
    isError: people.isError && !people.data,
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

/**
 * Pedidos que cada usuário vê: o estudante, só os próprios; o monitor, os
 * abertos nos tópicos que domina e os que já são dele; a coordenação, todos.
 */
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

/** Sessões de cada usuário: as próprias para estudante e monitor; todas para a coordenação. */
export function visibleSessions(sessions: Session[], user: CurrentUser | null) {
  if (!user) return [];
  if (user.role === "student") return sessions.filter((session) => session.studentId === user.id);
  if (user.role === "monitor") return sessions.filter((session) => session.monitorId === user.id);
  return sessions;
}

/* ------------------------------- permissões ------------------------------- */

/**
 * O que o usuário pode fazer num pedido. Sem login ainda é só interface; quando
 * a autenticação chegar, as mesmas regras vão para as rotas de API.
 */
export function requestPermissions(request: HelpRequest, user: CurrentUser | null) {
  const coordinator = user?.role === "coordinator";
  const owner = user?.role === "student" && request.studentId === user.id;
  const assigned = user?.role === "monitor" && request.monitorId === user.id;
  const active = request.status === "open" || request.status === "matched";

  return {
    /** escolher qualquer monitor do ranking */
    pairAny: coordinator && request.status === "open",
    /** monitor assume o pedido (se estiver no ranking) */
    accept: user?.role === "monitor" && request.status === "open",
    schedule: (coordinator || assigned) && active && Boolean(request.monitorId),
    register: (coordinator || assigned) && request.status === "scheduled",
    cancel: (coordinator || owner) && active,
    /** desfaz o pareamento e devolve o pedido à fila */
    release: (coordinator || assigned) && request.status === "matched",
    reopen: coordinator
      ? request.status === "cancelled" || request.status === "done"
      : owner && request.status === "cancelled",
  };
}
