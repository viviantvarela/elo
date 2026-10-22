"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button, Chip, Dialog, Field, Segmented, Textarea } from "@/components/ui";
import { api } from "@/lib/api";
import type { HelpRequest, Monitor } from "@/lib/types";
import { cn } from "@/lib/utils";

export function CompleteSessionDialog({
  open,
  onClose,
  request,
  monitor,
}: {
  open: boolean;
  onClose: () => void;
  request: HelpRequest | null;
  monitor?: Monitor | null;
}) {
  const queryClient = useQueryClient();
  const [minutes, setMinutes] = useState(60);
  const [attendance, setAttendance] = useState<"present" | "absent">("present");
  const [rating, setRating] = useState(5);
  const [notes, setNotes] = useState("");

  const mutation = useMutation({
    mutationFn: api.completeSession,
    onSuccess: () => {
      toast.success("Sessão registrada. As horas já entraram no relatório do monitor.");
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["requests"] });
      void queryClient.invalidateQueries({ queryKey: ["request"] });
      void queryClient.invalidateQueries({ queryKey: ["sessions"] });
      void queryClient.invalidateQueries({ queryKey: ["reports"] });
      onClose();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!request) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Registrar atendimento"
      description={`${monitor?.name ?? "Monitor"} · ${minutes} minutos. Três toques e a sessão vira hora no relatório.`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => mutation.mutate({ requestId: request.id, minutes, attendance, rating, notes })}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Salvando…" : "Salvar sessão"}
          </Button>
        </>
      }
    >
      <div className="space-y-3.5">
        <Field label="Presença">
          <Segmented
            options={[
              { value: "present", label: "Compareceu" },
              { value: "absent", label: "Faltou" },
            ]}
            value={attendance}
            onChange={setAttendance}
          />
        </Field>

        <Field label="Duração">
          <div className="flex flex-wrap gap-1.5">
            {[30, 45, 60, 75, 90].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setMinutes(value)}
                aria-pressed={minutes === value}
                className={cn(
                  "rounded-full border px-3 py-1 text-[12px] font-medium transition-colors",
                  minutes === value
                    ? "border-accent bg-accent-soft text-accent-strong"
                    : "border-line bg-surface text-ink-soft hover:bg-surface-muted",
                )}
              >
                {value} min
              </button>
            ))}
          </div>
        </Field>

        <Field label="Como foi o atendimento?" hint="A nota entra na média do monitor e no indicador de satisfação.">
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setRating(value)}
                aria-label={`${value} estrelas`}
                aria-pressed={rating === value}
                className="rounded-md p-1 transition-transform hover:scale-110"
              >
                <Star
                  className={cn(
                    "size-6",
                    value <= rating ? "fill-warn text-warn" : "text-ink-faint/40",
                  )}
                />
              </button>
            ))}
          </div>
        </Field>

        <Field label="Observação (opcional)">
          <Textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Ex.: resolvemos os exercícios 4 a 9; ficou pendente revisar produto notável."
          />
        </Field>

        <div className="flex items-center gap-2 rounded-[12px] border border-line bg-surface-muted px-3 py-2.5">
          <Chip tone="accent">Automático</Chip>
          <p className="text-[11.5px] leading-snug text-ink-soft">
            O relatório de horas e o painel de demanda são atualizados na hora.
          </p>
        </div>
      </div>
    </Dialog>
  );
}
