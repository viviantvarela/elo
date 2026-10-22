"use client";

import { useQuery } from "@tanstack/react-query";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, MapPin } from "lucide-react";
import { useMemo, useState } from "react";

import { PageHeader } from "@/components/page-header";
import { CompleteSessionDialog } from "@/components/requests/complete-session-dialog";
import { Avatar, Button, Chip, EmptyState, Panel, PanelHeader, Skeleton } from "@/components/ui";
import { api } from "@/lib/api";
import { weekdayShort } from "@/lib/constants";
import { timeLabel } from "@/lib/format";
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
  const sessions = useQuery({ queryKey: ["sessions"], queryFn: api.listSessions });
  const dashboard = useQuery({ queryKey: ["dashboard"], queryFn: api.getDashboard });
  const requests = useQuery({ queryKey: ["requests"], queryFn: api.listRequests });

  const [weekOffset, setWeekOffset] = useState(0);
  const [completing, setCompleting] = useState<{ request: HelpRequest; session: Session } | null>(null);

  const weekStart = useMemo(() => {
    const start = startOfWeek(new Date());
    start.setDate(start.getDate() + weekOffset * 7);
    return start;
  }, [weekOffset]);

  const days = useMemo(
    () =>
      Array.from({ length: 5 }, (_, index) => {
        const day = new Date(weekStart);
        day.setDate(day.getDate() + index);
        return day;
      }),
    [weekStart],
  );

  const weekSessions = useMemo(() => {
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 7);
    return (sessions.data ?? [])
      .filter((session) => {
        const at = new Date(session.startsAt);
        return at >= weekStart && at < end;
      })
      .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
  }, [sessions.data, weekStart]);

  const monthLabel = weekStart.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <>
      <PageHeader
        eyebrow="Sessões confirmadas"
        title="Agenda da semana"
        subtitle="Cada atendimento agendado vira uma sessão com duração, presença e avaliação registradas."
        actions={
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" onClick={() => setWeekOffset((value) => value - 1)} aria-label="Semana anterior">
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setWeekOffset(0)}
              className="capitalize"
            >
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
            subtitle={`Semana de ${days[0].toLocaleDateString("pt-BR")} a ${days[4].toLocaleDateString("pt-BR")}.`}
          />
          <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-5">
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
                        const request = requests.data?.requests.find((entry) => entry.id === session.requestId);
                        const monitor = dashboard.data?.monitors.find((entry) => entry.id === session.monitorId);
                        const topic = dashboard.data?.topics.find((entry) => entry.id === session.topicId);
                        const student = dashboard.data?.students.find((entry) => entry.id === session.studentId);
                        const past = new Date(session.startsAt) < new Date();
                        const open = request && request.status === "scheduled";

                        return (
                          <div
                            key={session.id}
                            className="rounded-[11px] border border-line bg-surface p-2 shadow-[var(--shadow-card)]"
                          >
                            <div className="flex items-center justify-between">
                              <span className="num text-[11px] font-semibold text-ink">{timeLabel(session.startsAt)}</span>
                              <Chip tone={past ? "neutral" : "accent"} className="px-1.5 py-0 text-[9.5px]">
                                {past ? `${session.minutes} min` : "confirmado"}
                              </Chip>
                            </div>
                            <p className="mt-1 truncate text-[11.5px] font-medium text-ink">{topic?.name}</p>
                            <p className="truncate text-[10.5px] text-ink-soft">{student?.name.split(" ").slice(0, 2).join(" ")}</p>
                            <div className="mt-1.5 flex items-center justify-between">
                              <Avatar name={monitor?.name ?? ""} color={monitor?.color ?? "blue"} size="xs" />
                              {past && open ? (
                                <button
                                  onClick={() => setCompleting({ request, session })}
                                  className="rounded-full bg-accent-soft px-1.5 py-0.5 text-[10px] font-medium text-accent-strong hover:bg-accent-tint"
                                >
                                  registrar
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
                {
                  label: "Monitores envolvidos",
                  value: String(new Set(weekSessions.map((session) => session.monitorId)).size),
                  icon: MapPin,
                },
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
                "A sessão entra na agenda com dia, hora e duração.",
                "Ao final, o monitor registra presença e o estudante avalia.",
                "As horas caem automaticamente no relatório.",
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

          {weekSessions.length === 0 ? (
            <Panel>
              <EmptyState title="Semana livre" detail="Nenhuma sessão agendada neste período." />
            </Panel>
          ) : null}
        </div>
      </div>

      <CompleteSessionDialog
        open={Boolean(completing)}
        onClose={() => setCompleting(null)}
        request={completing?.request ?? null}
        monitor={dashboard.data?.monitors.find((entry) => entry.id === completing?.session.monitorId) ?? null}
      />
    </>
  );
}
