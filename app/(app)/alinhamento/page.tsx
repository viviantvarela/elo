"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, Lock, MessagesSquare, Send, Video, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { ScheduleMeetingDialog } from "@/components/alignment/schedule-meeting-dialog";
import { PageHeader } from "@/components/page-header";
import { Avatar, Button, Chip, EmptyState, Panel, PanelHeader, Skeleton, Textarea } from "@/components/ui";
import { api } from "@/lib/api";
import { meetProviderLabels } from "@/lib/constants";
import { alignmentTopicIds, shortName, useCurrentUser } from "@/lib/current-user";
import { dateTimeLabel } from "@/lib/format";
import type { AlignmentMeeting, AlignmentMessage, Topic } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function AlinhamentoPage() {
  const { user, people, isLoading: userLoading } = useCurrentUser();
  const queryClient = useQueryClient();

  const alignment = useQuery({ queryKey: ["alignment"], queryFn: api.getAlignment, staleTime: 15_000 });

  const topicIds = useMemo(() => alignmentTopicIds(user), [user]);
  const topics = useMemo(
    () => topicIds.map((id) => people?.topics.find((topic) => topic.id === id)).filter((t): t is Topic => Boolean(t)),
    [topicIds, people],
  );

  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  useEffect(() => {
    if (selectedTopicId && topicIds.includes(selectedTopicId)) return;
    setSelectedTopicId(topics[0]?.id ?? null);
    // só troca quando a lista de tópicos do usuário muda (não a cada render)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topics.map((t) => t.id).join(",")]);

  const [composerText, setComposerText] = useState("");
  const [schedulingTopic, setSchedulingTopic] = useState<Topic | null>(null);

  const sendMessage = useMutation({
    mutationFn: api.sendAlignmentMessage,
    onSuccess: () => {
      setComposerText("");
      void queryClient.invalidateQueries({ queryKey: ["alignment"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const cancelMeeting = useMutation({
    mutationFn: api.cancelAlignmentMeeting,
    onSuccess: () => {
      toast.success("Reunião cancelada.");
      void queryClient.invalidateQueries({ queryKey: ["alignment"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (userLoading || !user) {
    return (
      <>
        <PageHeader eyebrow="Professor ↔ monitor" title="Alinhamento" subtitle="Carregando…" />
        <Skeleton className="h-[480px] rounded-[20px]" />
      </>
    );
  }

  const isTeacher = user.role === "teacher";
  const counterpartLabel = isTeacher ? "monitores" : "professor(a)";

  const participants = (topicId: string) => {
    if (!people) return [];
    if (isTeacher) {
      return people.monitors
        .filter((monitor) => monitor.topics.some((entry) => entry.topicId === topicId))
        .map((monitor) => ({ id: monitor.id, name: monitor.name, color: monitor.color, detail: "Monitor(a)" }));
    }
    return people.teachers
      .filter((teacher) => teacher.topics.includes(topicId))
      .map((teacher) => ({ id: teacher.id, name: teacher.name, color: teacher.color, detail: "Professor(a)" }));
  };

  const selectedTopic = topics.find((topic) => topic.id === selectedTopicId) ?? null;
  const messages = (alignment.data?.messages ?? [])
    .filter((message) => message.topicId === selectedTopicId)
    .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
  const meetings = (alignment.data?.meetings ?? [])
    .filter((meeting) => meeting.topicId === selectedTopicId)
    .sort((a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt));
  const upcomingMeetings = meetings.filter(
    (meeting) => meeting.status === "scheduled" && new Date(meeting.scheduledAt) >= new Date(Date.now() - 60 * 60_000),
  );

  const lastMessageOf = (topicId: string) => {
    const own = (alignment.data?.messages ?? []).filter((message) => message.topicId === topicId);
    return own.at(-1) ?? null;
  };

  function submitMessage() {
    if (!selectedTopic || !composerText.trim() || !user) return;
    sendMessage.mutate({
      topicId: selectedTopic.id,
      authorRole: isTeacher ? "teacher" : "monitor",
      authorId: user.id,
      text: composerText.trim(),
    });
  }

  if (topics.length === 0) {
    return (
      <>
        <PageHeader
          eyebrow="Professor ↔ monitor"
          title="Alinhamento"
          subtitle="Conversa com quem leciona ou monitora o mesmo tópico, para combinar mudanças nas aulas."
        />
        <Panel>
          <EmptyState
            icon={<Lock className="size-6" />}
            title={isTeacher ? "Nenhum tópico vinculado a você ainda" : "Você ainda não tem tópicos de monitoria"}
            detail={`A coordenação define os tópicos que ${isTeacher ? "você leciona" : "você monitora"}. Assim que houver um tópico em comum com ${counterpartLabel}, a conversa aparece aqui.`}
          />
        </Panel>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Espaço restrito · professor(a) e monitor(a)"
        title="Alinhamento"
        subtitle="Combine mudanças nas aulas com quem está do outro lado da monitoria — e marque reuniões direto no Google Meet."
      />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[280px_minmax(0,1fr)]">
        {/* ------------------------------- tópicos ------------------------------- */}
        <Panel className="flex flex-col overflow-hidden lg:h-[calc(100dvh-220px)]">
          <PanelHeader title="Suas conversas" subtitle={`${topics.length} tópico${topics.length > 1 ? "s" : ""}`} />
          <ul className="flex-1 space-y-1 overflow-y-auto p-2">
            {topics.map((topic) => {
              const active = topic.id === selectedTopicId;
              const last = lastMessageOf(topic.id);
              const others = participants(topic.id);
              return (
                <li key={topic.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedTopicId(topic.id)}
                    className={cn(
                      "flex w-full flex-col gap-1 rounded-[14px] px-3 py-2.5 text-left transition-colors",
                      active ? "bg-accent-tint ring-1 ring-inset ring-accent/25" : "hover:bg-surface-muted",
                    )}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-[13px] font-medium text-ink">{topic.name}</span>
                      {others.length === 0 ? (
                        <Chip tone="warn" className="shrink-0 px-1.5 py-0 text-[9.5px]">
                          sem {isTeacher ? "monitor" : "professor"}
                        </Chip>
                      ) : null}
                    </span>
                    <span className="truncate text-[11px] text-ink-soft">
                      {others.length > 0 ? others.map((entry) => shortName(entry.name)).join(", ") : "ninguém vinculado ainda"}
                    </span>
                    {last ? (
                      <span className="truncate text-[10.5px] text-ink-faint">
                        {last.authorName.split(" ")[0]}: {last.text}
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </Panel>

        {/* -------------------------------- conversa ------------------------------ */}
        <Panel className="flex flex-col overflow-hidden lg:h-[calc(100dvh-220px)]">
          {selectedTopic ? (
            <>
              <PanelHeader
                title={selectedTopic.name}
                subtitle={`Com ${participants(selectedTopic.id).map((entry) => entry.name).join(", ") || `nenhum(a) ${counterpartLabel} vinculado(a) ainda`}`}
                action={
                  <Button size="sm" variant="outline" onClick={() => setSchedulingTopic(selectedTopic)}>
                    <CalendarPlus className="size-3.5" /> Agendar no Meet
                  </Button>
                }
              />

              {upcomingMeetings.length > 0 ? (
                <div className="mx-5 mt-3 space-y-2">
                  {upcomingMeetings.map((meeting) => (
                    <MeetingCard
                      key={meeting.id}
                      meeting={meeting}
                      onCancel={() =>
                        cancelMeeting.mutate({ id: meeting.id, authorRole: isTeacher ? "teacher" : "monitor", authorId: user.id })
                      }
                    />
                  ))}
                </div>
              ) : null}

              <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
                {alignment.isLoading ? (
                  <>
                    <Skeleton className="h-14 w-2/3" />
                    <Skeleton className="ml-auto h-14 w-2/3" />
                  </>
                ) : messages.length === 0 ? (
                  <EmptyState
                    icon={<MessagesSquare className="size-6" />}
                    title="Nenhuma mensagem ainda"
                    detail="Conte o que precisa mudar na aula ou o que apareceu na monitoria — só vocês dois veem esta conversa."
                  />
                ) : (
                  messages.map((message) => <MessageBubble key={message.id} message={message} mine={message.authorId === user.id} />)
                )}
              </div>

              <div className="flex items-end gap-2 border-t border-line p-3">
                <Textarea
                  value={composerText}
                  onChange={(event) => setComposerText(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      submitMessage();
                    }
                  }}
                  placeholder={`Escreva para ${counterpartLabel}…`}
                  maxLength={600}
                  className="min-h-[44px]"
                />
                <Button onClick={submitMessage} disabled={!composerText.trim() || sendMessage.isPending} size="icon" aria-label="Enviar">
                  <Send className="size-4" />
                </Button>
              </div>
            </>
          ) : (
            <EmptyState title="Escolha um tópico" detail="Selecione uma conversa na lista ao lado." />
          )}
        </Panel>
      </div>

      <ScheduleMeetingDialog open={Boolean(schedulingTopic)} onClose={() => setSchedulingTopic(null)} topic={schedulingTopic} user={user} />
    </>
  );
}

function MessageBubble({ message, mine }: { message: AlignmentMessage; mine: boolean }) {
  return (
    <div className={cn("flex items-end gap-2", mine && "flex-row-reverse")}>
      <Avatar name={message.authorName} color={message.authorColor} size="xs" />
      <div className={cn("max-w-[78%] rounded-[16px] px-3 py-2", mine ? "bg-accent-soft text-ink" : "bg-surface-muted text-ink")}>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-semibold text-ink-soft">{shortName(message.authorName)}</span>
          <Chip tone={message.authorRole === "teacher" ? "info" : "accent"} className="px-1.5 py-0 text-[9px]">
            {message.authorRole === "teacher" ? "Professor(a)" : "Monitor(a)"}
          </Chip>
        </div>
        <p className="mt-0.5 whitespace-pre-wrap break-words text-[13px] leading-snug">{message.text}</p>
        <p className="num mt-1 text-[10px] text-ink-faint">{dateTimeLabel(message.createdAt)}</p>
      </div>
    </div>
  );
}

function MeetingCard({ meeting, onCancel }: { meeting: AlignmentMeeting; onCancel: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-[14px] border border-accent/25 bg-accent-tint px-3 py-2.5">
      <Video className="size-4 shrink-0 text-accent-strong" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12.5px] font-medium text-ink">{meeting.title}</p>
        <p className="num truncate text-[11px] text-ink-soft">
          {dateTimeLabel(meeting.scheduledAt)} · {meeting.durationMinutes} min ·{" "}
          <span className={meeting.provider === "demo" ? "text-warn" : undefined}>{meetProviderLabels[meeting.provider]}</span>
        </p>
      </div>
      <a
        href={meeting.meetLink}
        target="_blank"
        rel="noreferrer"
        className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-accent px-3 text-[12px] font-medium text-white transition-colors hover:bg-accent-strong"
      >
        <Video className="size-3.5" /> Entrar
      </a>
      <button
        type="button"
        onClick={onCancel}
        aria-label="Cancelar reunião"
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-ink-faint transition-colors hover:bg-surface hover:text-danger"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

