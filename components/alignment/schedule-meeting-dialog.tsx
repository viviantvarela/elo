"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button, Chip, Dialog, Field, Input } from "@/components/ui";
import { api } from "@/lib/api";
import { meetingDurations } from "@/lib/constants";
import type { CurrentUser } from "@/lib/current-user";
import type { Topic } from "@/lib/types";
import { cn } from "@/lib/utils";

/** próximo horário "redondo" (cheio ou meia hora) para já vir pré-preenchido */
function defaultDateTime() {
  const date = new Date();
  date.setMinutes(date.getMinutes() + 60);
  date.setMinutes(date.getMinutes() < 30 ? 0 : 30, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function ScheduleMeetingDialog({
  open,
  onClose,
  topic,
  user,
}: {
  open: boolean;
  onClose: () => void;
  topic: Topic | null;
  user: CurrentUser;
}) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [when, setWhen] = useState(defaultDateTime());
  const [duration, setDuration] = useState<number>(30);

  useEffect(() => {
    if (!open || !topic) return;
    setTitle(`Alinhamento — ${topic.name}`);
    setWhen(defaultDateTime());
    setDuration(30);
  }, [open, topic?.id]);

  const mutation = useMutation({
    mutationFn: api.scheduleAlignmentMeeting,
    onSuccess: ({ meeting }) => {
      toast.success(
        meeting.provider === "google-meet-api"
          ? "Reunião criada no Google Meet."
          : "Reunião marcada com um link de demonstração (configure as credenciais do Google para usar a API real).",
      );
      void queryClient.invalidateQueries({ queryKey: ["alignment"] });
      onClose();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!topic) return null;

  function submit() {
    if (!topic) return;
    if (!title.trim()) {
      toast.error("Dê um título para a reunião.");
      return;
    }
    const scheduledAt = new Date(when);
    if (Number.isNaN(scheduledAt.getTime())) {
      toast.error("Escolha uma data e hora válidas.");
      return;
    }

    mutation.mutate({
      topicId: topic.id,
      authorRole: user.role === "teacher" ? "teacher" : "monitor",
      authorId: user.id,
      title: title.trim(),
      scheduledAt: scheduledAt.toISOString(),
      durationMinutes: duration,
    });
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Agendar no Google Meet"
      description={`Cria o link da reunião e avisa na conversa de ${topic.name}.`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={mutation.isPending}>
            {mutation.isPending ? "Agendando…" : "Agendar reunião"}
          </Button>
        </>
      }
    >
      <div className="space-y-3.5">
        <Field label="Título">
          <Input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} />
        </Field>

        <Field label="Data e hora">
          <Input type="datetime-local" value={when} onChange={(event) => setWhen(event.target.value)} />
        </Field>

        <Field label="Duração">
          <div className="flex flex-wrap gap-1.5">
            {meetingDurations.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setDuration(value)}
                aria-pressed={duration === value}
                className={cn(
                  "rounded-full border px-3 py-1 text-[12px] font-medium transition-colors",
                  duration === value
                    ? "border-accent bg-accent-soft text-accent-strong"
                    : "border-line bg-surface text-ink-soft hover:bg-surface-muted",
                )}
              >
                {value} min
              </button>
            ))}
          </div>
        </Field>

        <div className="flex items-start gap-2 rounded-[12px] border border-line bg-surface-muted px-3 py-2.5">
          <Chip tone="accent" className="shrink-0">
            Google Meet
          </Chip>
          <p className="text-[11.5px] leading-snug text-ink-soft">
            O link é criado pela API do Google Meet quando as credenciais estão configuradas no servidor; sem elas, o
            Elo usa um link de demonstração para não travar o piloto.
          </p>
        </div>
      </div>
    </Dialog>
  );
}
