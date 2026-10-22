"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Button, Chip, Dialog, Field, Segmented, Select, Textarea } from "@/components/ui";
import { api } from "@/lib/api";
import { pilotSlots, urgencyLabels } from "@/lib/constants";
import type { Slot, Student, Topic, Urgency } from "@/lib/types";
import { cn } from "@/lib/utils";

export function NewRequestDialog({
  open,
  onClose,
  students,
  topics,
  defaultStudentId,
  defaultTopicId,
}: {
  open: boolean;
  onClose: () => void;
  students: Student[];
  topics: Topic[];
  defaultStudentId?: string;
  defaultTopicId?: string;
}) {
  const queryClient = useQueryClient();
  const [studentId, setStudentId] = useState(defaultStudentId ?? students[0]?.id ?? "");
  const [topicId, setTopicId] = useState(defaultTopicId ?? topics[0]?.id ?? "");
  const [note, setNote] = useState("");
  const [urgency, setUrgency] = useState<Urgency>("normal");
  const [slots, setSlots] = useState<string[]>([]);

  const mutation = useMutation({
    mutationFn: api.createRequest,
    onSuccess: () => {
      toast.success("Pedido registrado. O pareamento já está calculado.");
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["requests"] });
      setNote("");
      setSlots([]);
      onClose();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function toggleSlot(key: string) {
    setSlots((current) => (current.includes(key) ? current.filter((item) => item !== key) : [...current, key]));
  }

  function submit() {
    const preferred: Slot[] = pilotSlots
      .filter((slot) => slots.includes(slot.key))
      .map((slot) => ({ day: slot.day, start: slot.start, end: slot.end }));

    if (preferred.length === 0) {
      toast.error("Escolha ao menos um horário possível.");
      return;
    }

    mutation.mutate({ studentId, topicId, note, urgency, preferred });
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Novo pedido de ajuda"
      description="Descreva a dúvida e os horários possíveis. O Elo calcula o monitor com melhor afinidade, agenda e carga."
      width="max-w-xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={mutation.isPending}>
            {mutation.isPending ? "Registrando…" : "Registrar pedido"}
          </Button>
        </>
      }
    >
      <div className="space-y-3.5">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Estudante">
            <Select value={studentId} onChange={(event) => setStudentId(event.target.value)}>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.name} · {student.className}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Tópico">
            <Select value={topicId} onChange={(event) => setTopicId(event.target.value)}>
              {topics.map((topic) => (
                <option key={topic.id} value={topic.id}>
                  {topic.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="O que ficou confuso?" hint="Uma frase já ajuda o monitor a chegar preparado.">
          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Ex.: não entendi como achar o vértice da parábola."
          />
        </Field>

        <Field label="Urgência">
          <Segmented
            options={[
              { value: "low", label: urgencyLabels.low },
              { value: "normal", label: urgencyLabels.normal },
              { value: "high", label: urgencyLabels.high },
            ]}
            value={urgency}
            onChange={setUrgency}
          />
        </Field>

        <Field label="Quando você pode?" hint="Marque as janelas em que consegue ser atendido.">
          <div className="flex flex-wrap gap-1.5">
            {pilotSlots.map((slot) => {
              const active = slots.includes(slot.key);
              return (
                <button
                  key={slot.key}
                  type="button"
                  onClick={() => toggleSlot(slot.key)}
                  aria-pressed={active}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition-colors",
                    active
                      ? "border-accent bg-accent-soft text-accent-strong"
                      : "border-line bg-surface text-ink-soft hover:bg-surface-muted",
                  )}
                >
                  {slot.label}
                </button>
              );
            })}
          </div>
        </Field>

        <div className="rounded-[12px] border border-line bg-surface-muted px-3 py-2.5">
          <p className="flex items-start gap-2 text-[11.5px] leading-snug text-ink-soft">
            <Chip tone="neutral" className="shrink-0">
              LGPD
            </Chip>
            <span>
              Só coletamos o necessário para o atendimento. Estudantes menores de 18 anos precisam de autorização do
              responsável registrada no perfil.
            </span>
          </p>
        </div>
      </div>
    </Dialog>
  );
}
