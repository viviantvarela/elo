"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button, Dialog, Field, Textarea } from "@/components/ui";
import { api } from "@/lib/api";
import type { Monitor, Session, Topic } from "@/lib/types";
import { cn } from "@/lib/utils";

export function RateSessionDialog({
  open,
  onClose,
  session,
  monitor,
  topic,
}: {
  open: boolean;
  onClose: () => void;
  session: Session | null;
  monitor?: Monitor | null;
  topic?: Topic | null;
}) {
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(session?.rating ?? 5);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    if (!open || !session) return;
    setRating(session.rating ?? 5);
    setFeedback("");
  }, [open, session]);

  const mutation = useMutation({
    mutationFn: api.rateSession,
    onSuccess: () => {
      toast.success("Sua avaliação foi registrada! Obrigado pelo retorno.");
      for (const key of ["dashboard", "requests", "request", "sessions", "reports", "monitors", "people"]) {
        void queryClient.invalidateQueries({ queryKey: [key] });
      }
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (!session) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Avaliar atendimento"
      description={`Como foi a monitoria${topic ? ` de ${topic.name}` : ""}${monitor ? ` com ${monitor.name}` : ""}? Sua nota atualiza o índice de satisfação e ajuda no pareamento.`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() =>
              mutation.mutate({
                sessionId: session.id,
                rating,
                notes: feedback.trim() || undefined,
              })
            }
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Salvando…" : "Enviar avaliação"}
          </Button>
        </>
      }
    >
      <div className="space-y-3.5">
        <Field label="Sua nota para o atendimento">
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setRating(value)}
                aria-label={`${value} ${value === 1 ? "estrela" : "estrelas"}`}
                aria-pressed={rating === value}
                className="rounded-lg p-1.5 transition-transform hover:scale-110"
              >
                <Star className={cn("size-7", value <= rating ? "fill-warn text-warn" : "text-ink-faint/40")} />
              </button>
            ))}
            <span className="ml-2 text-[12.5px] font-medium text-ink-soft">{rating} de 5</span>
          </div>
        </Field>

        <Field label="Comentário para o monitor (opcional)">
          <Textarea
            value={feedback}
            onChange={(event) => setFeedback(event.target.value)}
            placeholder="Ex.: explicou passo a passo e tirou minha dúvida sobre o exercício da lista!"
            maxLength={300}
          />
        </Field>
      </div>
    </Dialog>
  );
}
