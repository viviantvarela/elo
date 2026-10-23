"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  CalendarCheck,
  Check,
  Clock3,
  HandHeart,
  RotateCcw,
  Sparkles,
  Star,
  Undo2,
  UserRound,
  X,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { CompleteSessionDialog } from "@/components/requests/complete-session-dialog";
import { Avatar, Button, Chip, Dot, EmptyState, Field, Panel, PanelHeader, ProgressBar, Select, Skeleton } from "@/components/ui";
import { api } from "@/lib/api";
import { statusLabels, urgencyLabels, weekdayShort } from "@/lib/constants";
import { requestPermissions, useCurrentUser } from "@/lib/current-user";
import { dateTimeLabel } from "@/lib/format";
import type { HelpRequest, Match, Monitor, Session, Slot, Topic } from "@/lib/types";
import { cn, formatSlot, overlapMinutes } from "@/lib/utils";

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

/** Janelas do estudante, recortadas pela agenda do monitor quando há horário em comum. */
function windowsFor(request: HelpRequest, monitor: Monitor) {
  return request.preferred.map((slot) => {
    let best: Slot | null = null;
    for (const have of monitor.availability) {
      const overlap = overlapMinutes(slot, have);
      if (overlap > 0 && (!best || overlap > best.end - best.start)) {
        best = { day: slot.day, start: Math.max(slot.start, have.start), end: Math.min(slot.end, have.end) };
      }
    }
    const window = best ?? slot;
    return { slot: window, shared: Boolean(best), date: nextOccurrence(window.day, window.start) };
  });
}

export function RequestDetail({ requestId }: { requestId: string | null }) {
  const queryClient = useQueryClient();
  const { user, people } = useCurrentUser();
  const [minutes, setMinutes] = useState(60);
  const [completing, setCompleting] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["request", requestId],
    queryFn: () => api.getRequest(requestId as string),
    enabled: Boolean(requestId),
  });

  const invalidate = () => {
    for (const key of ["dashboard", "requests", "request", "reports", "sessions"]) {
      void queryClient.invalidateQueries({ queryKey: [key] });
    }
  };
  const onError = (error: Error) => {
    toast.error(error.message);
    invalidate();
  };

  const match = useMutation({
    mutationFn: (monitorId: string) => api.matchRequest(requestId as string, monitorId),
    onSuccess: () => {
      toast.success(
        user?.role === "monitor" ? "Pedido aceito. Agora escolha o horário do atendimento." : "Monitor vinculado ao pedido.",
      );
      invalidate();
    },
    onError,
  });

  const schedule = useMutation({
    mutationFn: ({ monitorId, startsAt }: { monitorId: string; startsAt: string }) =>
      api.scheduleRequest(requestId as string, monitorId, startsAt, minutes),
    onSuccess: () => {
      toast.success("Atendimento agendado. Já aparece na agenda.");
      invalidate();
    },
    onError,
  });

  const cancel = useMutation({
    mutationFn: () => api.cancelRequest(requestId as string),
    onSuccess: () => {
      toast.success("Pedido cancelado.");
      invalidate();
    },
    onError,
  });

  const release = useMutation({
    mutationFn: () => api.reopenRequest(requestId as string),
    onSuccess: () => {
      toast.success("Pedido devolvido à fila. Outros monitores já podem aceitar.");
      invalidate();
    },
    onError,
  });

  const reopen = useMutation({
    mutationFn: () => api.reopenRequest(requestId as string),
    onSuccess: () => {
      toast.success("Pedido reaberto para pareamento.");
      invalidate();
    },
    onError,
  });

  if (!requestId) {
    return (
      <Panel className="h-full">
        <EmptyState
          icon={<Sparkles className="size-6" />}
          title="Selecione um pedido"
          detail={
            user?.role === "student"
              ? "Escolha um dos seus pedidos para acompanhar o andamento."
              : user?.role === "monitor"
                ? "Escolha um pedido para ver a dúvida, os horários do estudante e aceitar o atendimento."
                : "Escolha um pedido na lista ao lado para ver o ranking de monitores calculado pelo Elo."
          }
        />
      </Panel>
    );
  }

  if (isError) {
    return (
      <Panel className="h-full">
        <EmptyState title="Pedido não encontrado" detail="Ele pode ter sido removido ao restaurar a base de demonstração." />
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
  const topics = people?.topics ?? (topic ? [topic] : []);
  const can = requestPermissions(request, user);
  const viewer = user?.role ?? "coordinator";
  const myAvailability = viewer === "monitor" ? user?.monitor?.availability ?? [] : [];
  const busy = cancel.isPending || release.isPending || reopen.isPending;

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
                {viewer === "student" ? "Seu pedido" : student?.name} · {dateTimeLabel(request.createdAt)}
              </p>
            </div>
          </div>
          <Chip tone={statusTone[request.status]}>{statusLabels[request.status]}</Chip>
        </div>

        <blockquote className="mt-4 rounded-[14px] border border-line bg-surface-muted/70 p-3.5 text-[13px] leading-relaxed text-ink">
          “{request.note}”
        </blockquote>

        <div className="mt-4 grid grid-cols-2 gap-3 text-[12px] sm:grid-cols-4">
          <div>
            <p className="label-xs mb-1">Urgência</p>
            <p className="font-medium text-ink">{urgencyLabels[request.urgency]}</p>
          </div>
          <div>
            <p className="label-xs mb-1">Componente</p>
            <p className="font-medium text-ink">{topic?.component}</p>
          </div>
          <div className="min-w-0">
            <p className="label-xs mb-1">Monitor</p>
            <p className="truncate font-medium text-ink">{chosen?.name ?? "a definir"}</p>
          </div>
          <div>
            <p className="label-xs mb-1">Pareado em</p>
            <p className="font-medium text-ink">{request.matchedAt ? dateTimeLabel(request.matchedAt) : "ainda não"}</p>
          </div>
        </div>

        <div className="mt-4">
          <p className="label-xs mb-1.5">
            {viewer === "student" ? "Horários que você marcou" : "Horários possíveis do estudante"}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {request.preferred.map((slot: Slot) => {
              const shared = myAvailability.some((have) => overlapMinutes(slot, have) > 0);
              return (
                <Chip key={`${slot.day}-${slot.start}`} tone={shared ? "accent" : "neutral"} className="num">
                  <Clock3 className="size-3" />
                  {weekdayShort[slot.day]} · {formatSlot(slot.start, slot.end)}
                </Chip>
              );
            })}
          </div>
          {viewer === "monitor" && myAvailability.length > 0 ? (
            <p className="mt-1.5 text-[11px] text-ink-faint">
              {request.preferred.some((slot) => myAvailability.some((have) => overlapMinutes(slot, have) > 0))
                ? "Em verde: janelas que batem com a sua agenda."
                : "Nenhuma dessas janelas bate com a sua agenda."}
            </p>
          ) : null}
        </div>

        {viewer === "student" ? (
          <StudentProgress request={request} session={session} monitorName={chosen?.name} />
        ) : null}

        {/* ------------------------------ pareado ---------------------------- */}
        {(request.status === "open" || request.status === "matched") && chosen ? (
          can.schedule ? (
            <MatchedActions
              key={`${request.id}-${chosen.id}`}
              request={request}
              monitor={chosen}
              viewerIsMonitor={viewer === "monitor"}
              minutes={minutes}
              setMinutes={setMinutes}
              onSchedule={(startsAt) => schedule.mutate({ monitorId: chosen.id, startsAt })}
              pending={schedule.isPending}
            />
          ) : (
            <Notice tone="info" icon={<Check className="size-3.5" />}>
              {viewer === "student" ? (
                <>
                  <span className="font-medium">{chosen.name}</span> vai te atender. O horário sai de uma das janelas que
                  você marcou — assim que for agendado, aparece na sua agenda.
                </>
              ) : (
                <>
                  Pedido assumido por <span className="font-medium">{chosen.name}</span>.
                </>
              )}
            </Notice>
          )
        ) : null}

        {/* ----------------------------- agendado ---------------------------- */}
        {request.status === "scheduled" ? (
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-[14px] border border-accent/30 bg-accent-tint p-3">
            <CalendarCheck className="size-4 text-accent-strong" />
            <p className="text-[12.5px] text-ink">
              {viewer === "student" ? "Seu atendimento com " : "Agendado com "}
              <span className="font-medium">{chosen?.name}</span> —{" "}
              <span className="num font-medium">{session ? dateTimeLabel(session.startsAt) : "a confirmar"}</span>
              {session ? <span className="text-ink-soft"> · {session.minutes} min</span> : null}
            </p>
            {can.register ? (
              <Button size="sm" className="ml-auto" onClick={() => setCompleting(true)}>
                Registrar atendimento
              </Button>
            ) : null}
          </div>
        ) : null}

        {/* ----------------------------- concluído --------------------------- */}
        {request.status === "done" ? (
          <div className="mt-4 space-y-1.5 rounded-[14px] border border-line bg-surface-muted/60 p-3 text-[12.5px] text-ink-soft">
            {session?.attendance === "absent" ? (
              <p>Encerrado como falta: o estudante não compareceu ao atendimento com {chosen?.name}. Nenhuma hora foi somada.</p>
            ) : viewer === "student" ? (
              <p>
                Atendimento concluído com <span className="font-medium text-ink">{chosen?.name}</span>
                {session ? ` em ${dateTimeLabel(session.startsAt)}` : ""}.
              </p>
            ) : (
              <p>Atendimento concluído com {chosen?.name}. As horas já estão no relatório do monitor.</p>
            )}
            {typeof session?.rating === "number" ? (
              <p className="flex items-center gap-1.5">
                Avaliação: <StarRating value={session.rating} />
              </p>
            ) : null}
            {session?.notes ? <p className="text-ink">Observação: {session.notes}</p> : null}
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2 empty:hidden">
          {can.release ? (
            <Button variant="outline" size="sm" onClick={() => release.mutate()} disabled={busy}>
              <Undo2 className="size-3.5" /> Devolver à fila
            </Button>
          ) : null}
          {can.cancel ? (
            <Button variant="ghost" size="sm" onClick={() => cancel.mutate()} disabled={busy}>
              <X className="size-3.5" /> {viewer === "student" ? "Cancelar meu pedido" : "Cancelar pedido"}
            </Button>
          ) : null}
          {can.reopen ? (
            <Button variant="outline" size="sm" onClick={() => reopen.mutate()} disabled={busy}>
              <RotateCcw className="size-3.5" /> Reabrir pedido
            </Button>
          ) : null}
        </div>
      </Panel>

      {/* ----------------------- ranking (coordenação) ----------------------- */}
      {can.pairAny ? (
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
              matches.slice(0, 4).map((item: Match, index) => (
                <MatchCard
                  key={item.monitorId}
                  item={item}
                  monitor={monitors.find((entry) => entry.id === item.monitorId)}
                  topics={topics}
                  highlight={index === 0}
                  badge={index === 0 ? <Chip tone="accent">melhor match</Chip> : null}
                  action={
                    <Button
                      size="sm"
                      variant={index === 0 ? "primary" : "outline"}
                      className="ml-auto"
                      onClick={() => match.mutate(item.monitorId)}
                      disabled={match.isPending}
                    >
                      <Check className="size-3.5" /> Parear
                    </Button>
                  }
                />
              ))
            )}
          </div>
        </Panel>
      ) : null}

      {/* -------------------------- monitor: aceitar ------------------------- */}
      {can.accept && user ? (
        <MonitorAccept
          matches={matches}
          monitors={monitors}
          topics={topics}
          monitorId={user.id}
          pending={match.isPending}
          onAccept={() => match.mutate(user.id)}
        />
      ) : null}

      {/* ---------------------- estudante: quem pode ajudar ------------------ */}
      {viewer === "student" && request.status === "open" ? (
        <Panel className="p-4">
          <p className="flex items-start gap-2 text-[12.5px] leading-snug text-ink-soft">
            <UserRound className="mt-0.5 size-3.5 shrink-0 text-accent" />
            {matches.length === 0 ? (
              <span>
                Ainda não há monitor para este tópico. Seu pedido entra no painel de demanda, que a coordenação usa para
                abrir novas vagas de monitoria.
              </span>
            ) : (
              <span>
                <span className="font-medium text-ink">
                  {matches.length} {matches.length === 1 ? "monitor atende" : "monitores atendem"} este tópico
                </span>
                {(() => {
                  const shared = matches.filter((item) => item.breakdown.availability > 0).length;
                  return shared > 0
                    ? ` — ${shared} com horário em comum com você.`
                    : ", mas nenhum tem horário em comum com você ainda. Marcar mais janelas num novo pedido ajuda.";
                })()}{" "}
                Assim que um deles aceitar, o pedido muda para “Em pareamento”.
              </span>
            )}
          </p>
        </Panel>
      ) : null}

      <CompleteSessionDialog
        open={completing}
        onClose={() => setCompleting(false)}
        request={request}
        monitor={chosen ?? null}
        student={student}
        defaultMinutes={session?.minutes}
      />
    </div>
  );
}

/* ------------------------------- componentes ------------------------------ */

function Notice({ tone, icon, children }: { tone: "info" | "accent"; icon: ReactNode; children: ReactNode }) {
  return (
    <div
      className={cn(
        "mt-4 flex items-start gap-2 rounded-[14px] border p-3 text-[12.5px] leading-snug text-ink",
        tone === "accent" ? "border-accent/30 bg-accent-tint" : "border-line bg-surface-muted/60",
      )}
    >
      <span className="mt-0.5 shrink-0 text-accent-strong">{icon}</span>
      <p>{children}</p>
    </div>
  );
}

function StudentProgress({
  request,
  session,
  monitorName,
}: {
  request: HelpRequest;
  session: Session | null;
  monitorName?: string;
}) {
  if (request.status === "cancelled") {
    return (
      <Notice tone="info" icon={<X className="size-3.5" />}>
        Este pedido foi cancelado{request.closedAt ? ` em ${dateTimeLabel(request.closedAt)}` : ""}. Se ainda precisar
        de ajuda, reabra o pedido ou faça um novo.
      </Notice>
    );
  }

  const steps = [
    { label: "Pedido enviado", detail: dateTimeLabel(request.createdAt), done: true },
    { label: "Monitor definido", detail: monitorName ?? "aguardando", done: Boolean(request.monitorId) },
    {
      label: "Agendado",
      detail: session ? dateTimeLabel(session.startsAt) : "a combinar",
      done: request.status === "scheduled" || request.status === "done",
    },
    {
      label: "Concluído",
      detail: request.status === "done" && request.closedAt ? dateTimeLabel(request.closedAt) : "—",
      done: request.status === "done",
    },
  ];

  return (
    <ol className="mt-4 grid grid-cols-2 gap-x-3 gap-y-3 sm:grid-cols-4" aria-label="Andamento do pedido">
      {steps.map((step) => (
        <li key={step.label} className="min-w-0">
          <div className={cn("h-1 rounded-full", step.done ? "bg-accent" : "bg-surface-muted")} />
          <p className={cn("mt-1.5 text-[11.5px] font-medium", step.done ? "text-ink" : "text-ink-faint")}>{step.label}</p>
          <p className="num truncate text-[10.5px] text-ink-faint">{step.detail}</p>
        </li>
      ))}
    </ol>
  );
}

function MatchCard({
  item,
  monitor,
  topics,
  highlight,
  badge,
  action,
}: {
  item: Match;
  monitor?: Monitor;
  topics: Topic[];
  highlight: boolean;
  badge?: ReactNode;
  action?: ReactNode;
}) {
  const topicNames = monitor?.topics
    .map((entry) => topics.find((topic) => topic.id === entry.topicId)?.name ?? entry.topicId)
    .join(" · ");

  return (
    <div
      className={cn(
        "rounded-[16px] border p-3 transition-colors",
        highlight ? "border-accent/40 bg-accent-tint" : "border-line bg-surface",
      )}
    >
      <div className="flex items-center gap-2.5">
        <Avatar name={monitor?.name ?? ""} color={monitor?.color ?? "blue"} size="sm" />
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 truncate text-[13px] font-medium text-ink">
            {monitor?.name}
            {badge}
          </p>
          <p className="truncate text-[11px] text-ink-soft">
            {topicNames} · {monitor?.rating.toFixed(1)}★ ({monitor?.ratingCount})
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
        {action}
      </div>
    </div>
  );
}

function MonitorAccept({
  matches,
  monitors,
  topics,
  monitorId,
  pending,
  onAccept,
}: {
  matches: Match[];
  monitors: Monitor[];
  topics: Topic[];
  monitorId: string;
  pending: boolean;
  onAccept: () => void;
}) {
  const index = matches.findIndex((item) => item.monitorId === monitorId);
  const mine = matches[index];

  if (!mine) {
    return (
      <Panel>
        <EmptyState
          title="Fora dos seus tópicos"
          detail="Este pedido é de um assunto que você não atende. A coordenação vê o ranking completo e pareia com quem domina o tópico."
        />
      </Panel>
    );
  }

  return (
    <Panel>
      <PanelHeader
        title="Você neste pedido"
        subtitle={`Você é a ${index + 1}ª opção entre ${matches.length} ${
          matches.length === 1 ? "monitor" : "monitores"
        } do tópico. Ao aceitar, o pedido fica com você e sai da fila dos outros.`}
      />
      <div className="p-3">
        <MatchCard
          item={mine}
          monitor={monitors.find((entry) => entry.id === monitorId)}
          topics={topics}
          highlight
          badge={<Chip tone="accent">você</Chip>}
          action={
            <Button size="sm" className="ml-auto" onClick={onAccept} disabled={pending}>
              <HandHeart className="size-3.5" /> {pending ? "Aceitando…" : "Aceitar pedido"}
            </Button>
          }
        />
        {mine.breakdown.availability === 0 ? (
          <p className="mt-2 px-1 text-[11.5px] leading-snug text-warn">
            Nenhuma janela do estudante bate com a sua agenda. Se aceitar, o atendimento será num dos horários dele.
          </p>
        ) : null}
      </div>
    </Panel>
  );
}

function MatchedActions({
  request,
  monitor,
  viewerIsMonitor,
  minutes,
  setMinutes,
  onSchedule,
  pending,
}: {
  request: HelpRequest;
  monitor: Monitor;
  viewerIsMonitor: boolean;
  minutes: number;
  setMinutes: (value: number) => void;
  onSchedule: (startsAt: string) => void;
  pending: boolean;
}) {
  const windows = useMemo(() => windowsFor(request, monitor), [request, monitor]);
  const [index, setIndex] = useState(() => String(Math.max(0, windows.findIndex((item) => item.shared))));
  const chosen = windows[Number(index)] ?? windows[0];

  if (!chosen) return null;

  return (
    <div className="mt-4 rounded-[14px] border border-accent/30 bg-accent-tint p-3">
      <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-accent-strong">
        <Check className="size-3.5" /> {viewerIsMonitor ? "Pedido aceito por você" : `Vinculado a ${monitor.name}`}
      </p>
      <p className="mt-0.5 text-[11.5px] text-ink-soft">
        {viewerIsMonitor
          ? "Escolha uma janela do estudante — as marcadas “em comum” batem com a sua agenda — e confirme para gerar a sessão."
          : "Escolha a janela do estudante e confirme para gerar a sessão na agenda."}
      </p>
      <div className="mt-2.5 flex flex-wrap items-end gap-2">
        <Field label="Janela" className="min-w-[min(300px,100%)] flex-1">
          <Select value={index} onChange={(event) => setIndex(event.target.value)}>
            {windows.map((item, position) => (
              <option key={`${item.slot.day}-${item.slot.start}-${position}`} value={String(position)}>
                {weekdayShort[item.slot.day]} {item.date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} ·{" "}
                {formatSlot(item.slot.start, item.slot.end)}
                {item.shared ? " · em comum" : ""}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Duração" className="w-24">
          <Select value={String(minutes)} onChange={(event) => setMinutes(Number(event.target.value))}>
            {[30, 45, 60, 90].map((value) => (
              <option key={value} value={String(value)}>
                {value} min
              </option>
            ))}
          </Select>
        </Field>
        <Button className="ml-auto" onClick={() => onSchedule(chosen.date.toISOString())} disabled={pending}>
          <ArrowRight className="size-4" /> {pending ? "Agendando…" : "Agendar"}
        </Button>
      </div>
    </div>
  );
}

export function StarRating({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} de 5`}>
      {[1, 2, 3, 4, 5].map((score) => (
        <Star key={score} className={cn("size-3", score <= value ? "fill-warn text-warn" : "text-ink-faint/40")} />
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
