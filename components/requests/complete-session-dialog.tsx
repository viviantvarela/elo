"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button, Chip, Dialog, Field, Segmented, Textarea } from "@/components/ui";
import { api } from "@/lib/api";
import type { HelpRequest, Monitor, Student } from "@/lib/types";
import { cn } from "@/lib/utils";

const durations = [30, 45, 60, 75, 90];

export function CompleteSessionDialog({
  open,
  onClose,
  request,
  monitor,
  student,
  defaultMinutes,
}: {
  open: boolean;
  onClose: () => void;
  request: HelpRequest | null;
  monitor?: Monitor | null;
  student?: Student | null;
  /** duração agendada — vem pré-selecionada */
  defaultMinutes?: number;
}) {
  const queryClient = useQueryClient();
  const [minutes, setMinutes] = useState(defaultMinutes ?? 60);
  const [attendance, setAttendance] = useState<"present" | "absent">("present");
  const [rating, setRating] = useState(5);
  const [notes, setNotes] = useState("");

  // cada registro começa do zero, com a duração que foi agendada
  useEffect(() => {
    if (!open) return;
    setMinutes(defaultMinutes ?? 60);
    setAttendance("present");
    setRating(5);
    setNotes("");
  }, [open, defaultMinutes]);

  const mutation = useMutation({
    mutationFn: api.completeSession,
    onSuccess: () => {
      toast.success(
        attendance === "present"
          ? "Sessão registrada. As horas já entraram no relatório do monitor."
          : "Falta registrada. O pedido foi encerrado sem somar horas.",
      );
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["requests"] });
      void queryClient.invalidateQueries({ queryKey: ["request"] });
      void queryClient.invalidateQueries({ queryKey: ["sessions"] });
      void queryClient.invalidateQueries({ queryKey: ["reports"] });
      // horas da semana e nota média do monitor mudaram
      void queryClient.invalidateQueries({ queryKey: ["monitors"] });
      void queryClient.invalidateQueries({ queryKey: ["people"] });
      onClose();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!request) return null;

  const present = attendance === "present";
  const durationOptions = durations.includes(minutes) ? durations : [...durations, minutes].sort((a, b) => a - b);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Registrar atendimento"
      description={`${monitor?.name ?? "Monitor"}${student ? ` com ${student.name}` : ""} · ${present ? `${minutes} minutos` : "falta"}. Três toques e a sessão vira hora no relatório.`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() =>
              mutation.mutate({
                requestId: request.id,
                minutes,
                attendance,
                rating: present ? rating : undefined,
                notes,
              })
            }
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Salvando…" : present ? "Salvar sessão" : "Registrar falta"}
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

        {present ? (
          <>
            <Field label="Duração">
              <div className="flex flex-wrap gap-1.5">
                {durationOptions.map((value) => (
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

            <Field
              label="Avaliação do estudante"
              hint="Pergunte ao estudante: a nota entra na média do monitor e no indicador de satisfação."
            >
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setRating(value)}
                    aria-label={`${value} ${value === 1 ? "estrela" : "estrelas"}`}
                    aria-pressed={rating === value}
                    className="rounded-md p-1 transition-transform hover:scale-110"
                  >
                    <Star className={cn("size-6", value <= rating ? "fill-warn text-warn" : "text-ink-faint/40")} />
                  </button>
                ))}
              </div>
            </Field>
          </>
        ) : (
          <p className="rounded-[12px] bg-warn-soft px-3 py-2.5 text-[11.5px] leading-snug text-ink ring-1 ring-inset ring-warn/20">
            O pedido é encerrado como falta: nenhuma hora é somada e não há avaliação. Se o estudante ainda precisar de
            ajuda, ele pode abrir um novo pedido.
          </p>
        )}

        <Field label="Observação (opcional)">
          <Textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder={
              present
                ? "Ex.: resolvemos os exercícios 4 a 9; ficou pendente revisar produto notável."
                : "Ex.: avisou que estava em prova de recuperação."
            }
            maxLength={500}
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
