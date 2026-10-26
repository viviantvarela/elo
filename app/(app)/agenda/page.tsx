"use client";

import { useQuery } from "@tanstack/react-query";
import { CalendarDays, ChevronLeft, ChevronRight, ClipboardCheck, Clock3, ExternalLink, MapPin, Star } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { PageHeader } from "@/components/page-header";
import { CompleteSessionDialog } from "@/components/requests/complete-session-dialog";
import { RateSessionDialog } from "@/components/requests/rate-session-dialog";
import { Avatar, Button, Chip, EmptyState, Panel, PanelHeader, Skeleton } from "@/components/ui";
import { api } from "@/lib/api";
import { weekdayShort } from "@/lib/constants";
import { requestPermissions, shortName, useCurrentUser, visibleSessions } from "@/lib/current-user";
import { dateTimeLabel, timeLabel } from "@/lib/format";
import type { HelpRequest, Session } from "@/lib/types";
import { cn } from "@/lib/utils";

function startOfWeek(date: Date) {
  const copy = new Date(date);
  const offset = (copy.getDay() + 6) % 7;
  copy.setDate(copy.getDate() - offset);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export default function AgendaPage() {
  const { user, people } = useCurrentUser();
  const sessions = useQuery({ queryKey: ["sessions"], queryFn: api.listSessions });
  const requests = useQuery({ queryKey: ["requests"], queryFn: api.listRequests });

  const [weekOffset, setWeekOffset] = useState(0);
  const [completing, setCompleting] = useState<{ request: HelpRequest; session: Session } | null>(null);
  const [ratingSession, setRatingSession] = useState<Session | null>(null);

  const role = user?.role ?? "coordinator";
  const mine = useMemo(() => visibleSessions(sessions.data ?? [], user), [sessions.data, user]);

  const weekStart = useMemo(() => {
    const start = startOfWeek(new Date());
    start.setDate(start.getDate() + weekOffset * 7);
    return start;
  }, [weekOffset]);

  const weekSessions = useMemo(() => {
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 7);
    return mine
      .filter((session) => {
        const at = new Date(session.startsAt);
        return at >= weekStart && at < end;
      })
      .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
  }, [mine, weekStart]);

  // Exibe sábado/domingo automaticamente quando houver sessões no fim de semana
  const dayCount = useMemo(() => {
    const hasSunday = weekSessions.some((session) => new Date(session.startsAt).getDay() === 0);
    if (hasSunday) return 7;
    const hasSaturday = weekSessions.some((session) => new Date(session.startsAt).getDay() === 6);
    if (hasSaturday) return 6;
    return 5;
  }, [weekSessions]);

  const days = useMemo(
    () =>
      Array.from({ length: dayCount }, (_, index) => {
        const day = new Date(weekStart);
        day.setDate(day.getDate() + index);
        return day;
      }),
    [weekStart, dayCount],
  );

  const requestOf = (session: Session) => requests.data?.requests.find((entry) => entry.id === session.requestId);
  const canRegister = (session: Session) => {
    const request = requestOf(session);
    return Boolean(request && new Date(session.startsAt) < new Date() && requestPermissions(request, user).register);
  };

  const pending = mine.filter(canRegister).sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));

  const monthLabel = weekStart.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const monitorOf = (id: string) => people?.monitors.find((entry) => entry.id === id);
  const studentOf = (id: string) => people?.students.find((entry) => entry.id === id);
  const topicOf = (id: string) => people?.topics.find((entry) => entry.id === id);

  const header =
    role === "student"
      ? {
          eyebrow: "Seus atendimentos",
          title: "Minha agenda",
          subtitle: "Seus atendimentos agendados e concluídos, com local/link e avaliação.",
        }
      : role === "monitor"
        ? {
            eyebrow: "Seus atendimentos",
            title: "Minha agenda",
            subtitle: "Suas sessões da semana. Depois de cada atendimento, registre presença e avaliação em poucos toques.",
          }
        : {
            eyebrow: "Sessões confirmadas",
            title: "Agenda da semana",
            subtitle: "Cada atendimento agendado vira uma sessão com sala/link, duração, presença e avaliação.",
          };

  const thirdStat =
    role === "student"
      ? { label: "Monitores", value: new Set(weekSessions.map((session) => session.monitorId)).size }
      : role === "monitor"
        ? { label: "Estudantes atendidos", value: new Set(weekSessions.map((session) => session.studentId)).size }
        : { label: "Monitores envolvidos", value: new Set(weekSessions.map((session) => session.monitorId)).size };

  const gridColsClass =
    dayCount === 7 ? "sm:grid-cols-7" : dayCount === 6 ? "sm:grid-cols-6" : "sm:grid-cols-5";

  return (
    <>
      <PageHeader
        eyebrow={header.eyebrow}
        title={header.title}
        subtitle={header.subtitle}
        actions={
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" onClick={() => setWeekOffset((value) => value - 1)} aria-label="Semana anterior">
              <ChevronLeft className="size-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setWeekOffset(0)} className="capitalize">
              {weekOffset === 0 ? "Esta semana" : monthLabel}
            </Button>
            <Button variant="outline" size="icon" onClick={() => setWeekOffset((value) => value + 1)} aria-label="Próxima semana">
              <ChevronRight className="size-4" />
            </Button>
          </div>
        }
      />

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
        <Panel>
          <PanelHeader
            title={`${weekSessions.length} ${weekSessions.length === 1 ? "sessão" : "sessões"} nesta semana`}
            subtitle={`Semana de ${days[0].toLocaleDateString("pt-BR")} a ${days[days.length - 1].toLocaleDateString("pt-BR")}.`}
          />
          <div className={cn("grid grid-cols-1 gap-2 p-3", gridColsClass)}>
            {days.map((day) => {
              const daySessions = weekSessions.filter(
                (session) => new Date(session.startsAt).toDateString() === day.toDateString(),
              );
              const isToday = day.toDateString() === new Date().toDateString();
              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "min-h-[190px] rounded-[14px] border p-2",
                    isToday ? "border-accent/35 bg-accent-tint" : "border-line bg-surface-muted/40",
                  )}
                >
                  <div className="mb-2 flex items-baseline justify-between px-0.5">
                    <span className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-ink-faint">
                      {weekdayShort[day.getDay()]}
                    </span>
                    <span className={cn("num text-[12.5px] font-semibold", isToday ? "text-accent-strong" : "text-ink")}>
                      {String(day.getDate()).padStart(2, "0")}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {sessions.isLoading ? (
                      <Skeleton className="h-16" />
                    ) : daySessions.length === 0 ? (
                      <p className="px-0.5 py-2 text-[10.5px] leading-snug text-ink-faint">sem sessões</p>
                    ) : (
                      daySessions.map((session) => {
                        const request = requestOf(session);
                        const monitor = monitorOf(session.monitorId);
                        const topic = topicOf(session.topicId);
                        const student = studentOf(session.studentId);
                        const past = new Date(session.startsAt) < new Date();
                        const awaiting = past && request?.status === "scheduled";
                        const absent = request?.status === "done" && session.attendance === "absent";
                        const canStudentRate =
                          role === "student" &&
                          request?.status === "done" &&
                          session.attendance !== "absent";
                        const counterpart =
                          role === "student"
                            ? { line: `com ${shortName(monitor?.name ?? "monitor")}`, name: monitor?.name, color: monitor?.color }
                            : role === "monitor"
                              ? { line: shortName(student?.name ?? ""), name: student?.name, color: student?.color }
                              : { line: shortName(student?.name ?? ""), name: monitor?.name, color: monitor?.color };

                        return (
                          <div
                            key={session.id}
                            className="rounded-[11px] border border-line bg-surface p-2 shadow-[var(--shadow-card)]"
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="num text-[11px] font-semibold text-ink">{timeLabel(session.startsAt)}</span>
                              <Chip
                                tone={absent ? "danger" : awaiting ? "warn" : past ? "neutral" : "accent"}
                                className="px-1.5 py-0 text-[9.5px]"
                              >
                                {absent ? "falta" : awaiting ? "a registrar" : past ? `${session.minutes} min` : "confirmado"}
                              </Chip>
                            </div>
                            <Link
                              href={`/pedidos?id=${encodeURIComponent(session.requestId)}`}
                              className="mt-1 block truncate text-[11.5px] font-medium text-ink hover:text-accent-strong hover:underline"
                            >
                              {topic?.name}
                            </Link>
                            <p className="truncate text-[10.5px] text-ink-soft">{counterpart.line}</p>

                            {session.location ? (
                              /^https?:\/\//i.test(session.location) ? (
                                <a
                                  href={session.location}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="mt-1 inline-flex max-w-full items-center gap-1 truncate text-[10px] font-medium text-accent-strong hover:underline"
                                >
                                  <ExternalLink className="size-2.5 shrink-0" /> Abrir link remoto
                                </a>
                              ) : (
                                <p className="mt-0.5 flex items-center gap-1 truncate text-[10px] text-ink-faint">
                                  <MapPin className="size-2.5 shrink-0" /> {session.location}
                                </p>
                              )
                            ) : null}

                            <div className="mt-1.5 flex items-center justify-between gap-1">
                              <Avatar name={counterpart.name ?? ""} color={counterpart.color ?? "blue"} size="xs" />
                              {request && canRegister(session) ? (
                                <button
                                  onClick={() => setCompleting({ request, session })}
                                  className="rounded-full bg-accent-soft px-1.5 py-0.5 text-[10px] font-medium text-accent-strong hover:bg-accent-tint"
                                >
                                  registrar
                                </button>
                              ) : canStudentRate ? (
                                <button
                                  onClick={() => setRatingSession(session)}
                                  className="inline-flex items-center gap-0.5 rounded-full bg-accent-soft px-1.5 py-0.5 text-[10px] font-medium text-accent-strong hover:bg-accent-tint"
                                >
                                  <Star className="size-2.5 fill-current" />
                                  {session.rating ? `${session.rating}★` : "avaliar"}
                                </button>
                              ) : null}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

        <div className="space-y-3">
          {pending.length > 0 ? (
            <Panel>
              <PanelHeader
                title="Registros pendentes"
                subtitle={`${pending.length} ${pending.length === 1 ? "atendimento já aconteceu" : "atendimentos já aconteceram"} e ${pending.length === 1 ? "espera" : "esperam"} presença e avaliação.`}
              />
              <ul className="space-y-1 p-2">
                {pending.slice(0, 5).map((session) => {
                  const request = requestOf(session);
                  return (
                    <li key={session.id} className="flex items-center gap-2 rounded-[12px] px-2 py-1.5 hover:bg-surface-muted/60">
                      <ClipboardCheck className="size-3.5 shrink-0 text-warn" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] font-medium text-ink">{topicOf(session.topicId)?.name}</p>
                        <p className="num truncate text-[10.5px] text-ink-faint">
                          {dateTimeLabel(session.startsAt)} · {shortName(studentOf(session.studentId)?.name ?? "")}
                        </p>
                      </div>
                      {request ? (
                        <Button size="sm" variant="outline" onClick={() => setCompleting({ request, session })}>
                          Registrar
                        </Button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </Panel>
          ) : null}

          <Panel>
            <PanelHeader title="Resumo" subtitle="Desta semana." />
            <div className="space-y-2 p-3">
              {[
                { label: "Sessões", value: String(weekSessions.length), icon: CalendarDays },
                {
                  label: "Minutos previstos",
                  value: String(weekSessions.reduce((sum, session) => sum + session.minutes, 0)),
                  icon: Clock3,
                },
                { label: thirdStat.label, value: String(thirdStat.value), icon: MapPin },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="flex items-center gap-2.5 rounded-[12px] bg-surface-muted/60 px-2.5 py-2">
                    <Icon className="size-3.5 text-ink-faint" />
                    <span className="text-[12px] text-ink-soft">{item.label}</span>
                    <span className="num ml-auto text-[13px] font-semibold text-ink">{item.value}</span>
                  </div>
                );
              })}
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Como funciona" subtitle="A sessão é a unidade de registro." />
            <ol className="space-y-2 p-3 text-[11.5px] leading-snug text-ink-soft">
              {[
                "O pedido é pareado com um monitor que domina o tópico.",
                "A sessão entra na agenda com dia, hora, duração e sala.",
                "Ao final, o monitor registra presença e o estudante avalia.",
                "As horas realizadas caem automaticamente no relatório.",
              ].map((step, index) => (
                <li key={step} className="flex gap-2">
                  <span className="num flex size-4 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[10px] font-semibold text-accent-strong">
                    {index + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </Panel>

          {weekSessions.length === 0 && !sessions.isLoading ? (
            <Panel>
              <EmptyState
                title="Semana livre"
                detail={
                  role === "student"
                    ? "Nenhum atendimento seu nesta semana. Faça um pedido em Pedidos para marcar um."
                    : role === "monitor"
                      ? "Nenhuma sessão sua nesta semana. Aceite um pedido em Pedidos para agendar."
                      : "Nenhuma sessão agendada neste período."
                }
              />
            </Panel>
          ) : null}
        </div>
      </div>

      <CompleteSessionDialog
        open={Boolean(completing)}
        onClose={() => setCompleting(null)}
        request={completing?.request ?? null}
        monitor={completing ? monitorOf(completing.session.monitorId) ?? null : null}
        student={completing ? studentOf(completing.session.studentId) ?? null : null}
        defaultMinutes={completing?.session.minutes}
      />

      <RateSessionDialog
        open={Boolean(ratingSession)}
        onClose={() => setRatingSession(null)}
        session={ratingSession}
        monitor={ratingSession ? monitorOf(ratingSession.monitorId) ?? null : null}
        topic={ratingSession ? topicOf(ratingSession.topicId) ?? null : null}
      />
    </>
  );
}
