"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, CalendarCheck, Check, Clock3, Sparkles, Star, UserRound, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { CompleteSessionDialog } from "@/components/requests/complete-session-dialog";
import { Avatar, Button, Chip, Dot, EmptyState, Field, Panel, PanelHeader, ProgressBar, Select, Skeleton } from "@/components/ui";
import { api } from "@/lib/api";
import { statusLabels, urgencyLabels, weekdayShort } from "@/lib/constants";
import { dateTimeLabel, weekdayLabel } from "@/lib/format";
import type { HelpRequest, Match, Slot } from "@/lib/types";
import { cn, formatSlot } from "@/lib/utils";

const statusTone = {
  open: "warn",
  matched: "info",
  scheduled: "accent",
  done: "neutral",
  cancelled: "neutral",
} as const;

function nextOccurrence(day: number, startMinutes: number) {
  const now = new Date();
  const date = new Date(now);
  const diff = (day - now.getDay() + 7) % 7;
  date.setDate(date.getDate() + diff);
  date.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0);
  if (date.getTime() <= now.getTime()) date.setDate(date.getDate() + 7);
  return date;
}

export function RequestDetail({ requestId }: { requestId: string | null }) {
  const queryClient = useQueryClient();
  const [minutes, setMinutes] = useState(60);
  const [completing, setCompleting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["request", requestId],
    queryFn: () => api.getRequest(requestId as string),
    enabled: Boolean(requestId),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    void queryClient.invalidateQueries({ queryKey: ["requests"] });
    void queryClient.invalidateQueries({ queryKey: ["request"] });
    void queryClient.invalidateQueries({ queryKey: ["reports"] });
  };

  const match = useMutation({
    mutationFn: (monitorId: string) => api.matchRequest(requestId as string, monitorId),
    onSuccess: () => {
      toast.success("Monitor vinculado ao pedido.");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const schedule = useMutation({
    mutationFn: ({ monitorId, startsAt }: { monitorId: string; startsAt: string }) =>
      api.scheduleRequest(requestId as string, monitorId, startsAt, minutes),
    onSuccess: () => {
      toast.success("Atendimento agendado.");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const cancel = useMutation({
    mutationFn: () => api.cancelRequest(requestId as string),
    onSuccess: () => {
      toast.success("Pedido cancelado.");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const reopen = useMutation({
    mutationFn: () => api.reopenRequest(requestId as string),
    onSuccess: () => {
      toast.success("Pedido reaberto para pareamento.");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!requestId) {
    return (
      <Panel className="h-full">
        <EmptyState
          icon={<Sparkles className="size-6" />}
          title="Selecione um pedido"
          detail="Escolha um pedido na lista ao lado para ver o ranking de monitores calculado pelo Elo."
        />
      </Panel>
    );
  }

  if (isLoading || !data) {
    return (
      <Panel className="space-y-3 p-5">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-32 w-full" />
      </Panel>
    );
  }

  const { request, matches, student, topic, monitors, session } = data;
  const chosen = monitors.find((monitor) => monitor.id === request.monitorId);
  const top = matches[0];

  return (
    <div className="space-y-3">
      <Panel className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Avatar name={student?.name ?? "Estudante"} color={student?.color ?? "sage"} size="md" />
            <div>
              <p className="flex items-center gap-2 text-[13px] font-semibold text-ink">
                {topic?.name}
                <Dot tone="neutral" className="opacity-40" />
                <span className="text-[11.5px] font-normal text-ink-faint">{student?.className}</span>
              </p>
              <p className="text-[11.5px] text-ink-soft">
                {student?.name} · pedido em {dateTimeLabel(request.createdAt)}
              </p>
            </div>
          </div>
          <Chip tone={statusTone[request.status]}>{statusLabels[request.status]}</Chip>
        </div>

        <blockquote className="mt-4 rounded-[14px] border border-line bg-surface-muted/70 p-3.5 text-[13px] leading-relaxed text-ink">
          “{request.note}”
        </blockquote>

        <div className="mt-4 grid grid-cols-2 gap-3 text-[12px] sm:grid-cols-3">
          <div>
            <p className="label-xs mb-1">Urgência</p>
            <p className="font-medium text-ink">{urgencyLabels[request.urgency]}</p>
          </div>
          <div>
            <p className="label-xs mb-1">Componente</p>
            <p className="font-medium text-ink">{topic?.component}</p>
          </div>
          <div>
            <p className="label-xs mb-1">Pareado em</p>
            <p className="font-medium text-ink">
              {request.matchedAt ? dateTimeLabel(request.matchedAt) : "ainda não"}
            </p>
          </div>
        </div>

        <div className="mt-4">
          <p className="label-xs mb-1.5">Horários possíveis do estudante</p>
          <div className="flex flex-wrap gap-1.5">
            {request.preferred.map((slot: Slot) => (
              <Chip key={`${slot.day}-${slot.start}`} tone="neutral" className="num">
                <Clock3 className="size-3" />
                {weekdayShort[slot.day]} · {formatSlot(slot.start, slot.end)}
              </Chip>
            ))}
          </div>
        </div>

        {(request.status === "open" || request.status === "matched") && chosen ? (
          <MatchedActions
            request={request}
            monitorName={chosen.name}
            minutes={minutes}
            setMinutes={setMinutes}
            onSchedule={(startsAt) => schedule.mutate({ monitorId: chosen.id, startsAt })}
            pending={schedule.isPending}
          />
        ) : null}

        {request.status === "scheduled" ? (
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-[14px] border border-accent/30 bg-accent-tint p-3">
            <CalendarCheck className="size-4 text-accent-strong" />
            <p className="text-[12.5px] text-ink">
              Agendado com <span className="font-medium">{chosen?.name}</span> —{" "}
              <span className="num font-medium">{session ? dateTimeLabel(session.startsAt) : "a confirmar"}</span>
            </p>
            <Button size="sm" className="ml-auto" onClick={() => setCompleting(true)}>
              Registrar atendimento
            </Button>
          </div>
        ) : null}

        {request.status === "done" ? (
          <div className="mt-4 rounded-[14px] border border-line bg-surface-muted/60 p-3 text-[12.5px] text-ink-soft">
            Atendimento concluído com {chosen?.name}. As horas já estão no relatório do monitor.
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          {request.status === "open" || request.status === "matched" ? (
            <Button variant="ghost" size="sm" onClick={() => cancel.mutate()} disabled={cancel.isPending}>
              <X className="size-3.5" /> Cancelar pedido
            </Button>
          ) : null}
          {request.status === "cancelled" || request.status === "done" ? (
            <Button variant="outline" size="sm" onClick={() => reopen.mutate()} disabled={reopen.isPending}>
              Reabrir pedido
            </Button>
          ) : null}
        </div>
      </Panel>

      {request.status === "open" ? (
        <Panel>
          <PanelHeader
            title="Monitores sugeridos"
            subtitle={`Ranking calculado com os pesos atuais. ${
              top ? `Melhor score: ${top.score}/100.` : "Nenhum monitor domina este tópico."
            }`}
          />
          <div className="space-y-2 p-3">
            {matches.length === 0 ? (
              <EmptyState
                title="Nenhum monitor para este tópico"
                detail="O pedido entra no painel de demanda não atendida — dado que a coordenação usa para abrir vagas de monitoria."
              />
            ) : (
              matches.slice(0, 4).map((item: Match, index) => {
                const monitor = monitors.find((entry) => entry.id === item.monitorId);
                return (
                  <div
                    key={item.monitorId}
                    className={cn(
                      "rounded-[16px] border p-3 transition-colors",
                      index === 0 ? "border-accent/40 bg-accent-tint" : "border-line bg-surface",
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <Avatar name={monitor?.name ?? ""} color={monitor?.color ?? "blue"} size="sm" />
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 truncate text-[13px] font-medium text-ink">
                          {monitor?.name}
                          {index === 0 ? <Chip tone="accent">melhor match</Chip> : null}
                        </p>
                        <p className="truncate text-[11px] text-ink-soft">
                          {monitor?.topics.map((topicItem) => topicItem.topicId).join(" · ")} ·{" "}
                          {monitor?.rating.toFixed(1)}★ ({monitor?.ratingCount})
                        </p>
                      </div>
                      <div className="ml-auto text-right">
                        <span className="num text-[16px] font-semibold text-ink">{item.score}</span>
                        <span className="text-[10px] text-ink-faint">/100</span>
                      </div>
                    </div>

                    <div className="mt-2.5 grid grid-cols-4 gap-2">
                      {(
                        [
                          ["tópico", item.breakdown.topic],
                          ["horário", item.breakdown.availability],
                          ["nota", item.breakdown.rating],
                          ["folga", item.breakdown.load],
                        ] as const
                      ).map(([label, value]) => (
                        <div key={label}>
                          <div className="mb-1 flex items-center justify-between text-[9.5px] uppercase tracking-[0.05em] text-ink-faint">
                            <span>{label}</span>
                            <span className="num">{Math.round(value * 100)}</span>
                          </div>
                          <ProgressBar value={value} height="h-1" />
                        </div>
                      ))}
                    </div>

                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                      {item.reasons.slice(0, 3).map((reason) => (
                        <Chip key={reason} tone="neutral">
                          {reason}
                        </Chip>
                      ))}
                      <Button
                        size="sm"
                        variant={index === 0 ? "primary" : "outline"}
                        className="ml-auto"
                        onClick={() => match.mutate(item.monitorId)}
                        disabled={match.isPending}
                      >
                        <Check className="size-3.5" /> Parear
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Panel>
      ) : null}

      <CompleteSessionDialog
        open={completing}
        onClose={() => setCompleting(false)}
        request={request}
        monitor={chosen ?? null}
      />
    </div>
  );
}

function MatchedActions({
  request,
  monitorName,
  minutes,
  setMinutes,
  onSchedule,
  pending,
}: {
  request: HelpRequest;
  monitorName: string;
  minutes: number;
  setMinutes: (value: number) => void;
  onSchedule: (startsAt: string) => void;
  pending: boolean;
}) {
  const [slotIndex, setSlotIndex] = useState("0");
  const slot = request.preferred[Number(slotIndex)] ?? request.preferred[0];
  const occurrence = nextOccurrence(slot.day, slot.start);

  return (
    <div className="mt-4 rounded-[14px] border border-accent/30 bg-accent-tint p-3">
      <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-accent-strong">
        <Check className="size-3.5" /> Vinculado a {monitorName}
      </p>
      <p className="mt-0.5 text-[11.5px] text-ink-soft">
        Escolha a janela do estudante e confirme para gerar a sessão na agenda.
      </p>
      <div className="mt-2.5 flex flex-wrap items-end gap-2">
        <Field label="Janela" className="min-w-[190px] flex-1">
          <Select value={slotIndex} onChange={(event) => setSlotIndex(event.target.value)}>
            {request.preferred.map((item, index) => (
              <option key={`${item.day}-${item.start}`} value={String(index)}>
                {weekdayLabel(item.day)} · {formatSlot(item.start, item.end)} · {occurrence.toLocaleDateString("pt-BR")}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Duração" className="w-28">
          <Select value={String(minutes)} onChange={(event) => setMinutes(Number(event.target.value))}>
            {[30, 45, 60, 90].map((value) => (
              <option key={value} value={String(value)}>
                {value} min
              </option>
            ))}
          </Select>
        </Field>
        <Button onClick={() => onSchedule(occurrence.toISOString())} disabled={pending}>
          <ArrowRight className="size-4" /> Agendar
        </Button>
      </div>
    </div>
  );
}


export function StarRating({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((score) => (
        <Star
          key={score}
          className={cn("size-3", score <= value ? "fill-warn text-warn" : "text-ink-faint/40")}
        />
      ))}
    </span>
  );
}

export function PersonLine({ name, detail }: { name: string; detail: string }) {
  return (
    <span className="flex items-center gap-1.5 text-[11.5px] text-ink-soft">
      <UserRound className="size-3" /> {name} · {detail}
    </span>
  );
}
