"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Avatar, Button, Chip, Dialog, Field, Segmented, Select, Textarea } from "@/components/ui";
import { api } from "@/lib/api";
import { pilotSlots, urgencyLabels } from "@/lib/constants";
import type { HelpRequest, Monitor, Slot, Student, Topic, Urgency } from "@/lib/types";
import { cn } from "@/lib/utils";

export function NewRequestDialog({
  open,
  onClose,
  students,
  topics,
  monitors,
  lockedStudent,
  defaultStudentId,
  defaultTopicId,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  students: Student[];
  topics: Topic[];
  monitors?: Monitor[];
  lockedStudent?: Student | null;
  defaultStudentId?: string;
  defaultTopicId?: string;
  onCreated?: (request: HelpRequest) => void;
}) {
  const queryClient = useQueryClient();
  const { data: settingsData } = useQuery({
    queryKey: ["settings"],
    queryFn: api.getSettings,
    staleTime: 60_000,
    enabled: open,
  });

  const [studentId, setStudentId] = useState(lockedStudent?.id ?? defaultStudentId ?? students[0]?.id ?? "");
  const [topicId, setTopicId] = useState(defaultTopicId ?? topics[0]?.id ?? "");
  const [note, setNote] = useState("");
  const [urgency, setUrgency] = useState<Urgency>("normal");
  const [slots, setSlots] = useState<string[]>([]);
  const [acceptConsent, setAcceptConsent] = useState(false);

  const consentRequired = settingsData?.settings.consentRequired ?? true;
  const guardianRequired = settingsData?.settings.guardianConsentRequired ?? true;

  useEffect(() => {
    if (!open) return;
    const chosenId = lockedStudent?.id ?? defaultStudentId ?? students[0]?.id ?? "";
    setStudentId(chosenId);
    setTopicId(defaultTopicId ?? topics[0]?.id ?? "");
    setNote("");
    setUrgency("normal");
    setSlots([]);
    const chosenStudent = lockedStudent ?? students.find((s) => s.id === chosenId);
    setAcceptConsent(Boolean(chosenStudent?.consentAcceptedAt));
  }, [open, lockedStudent?.id]);

  const effectiveStudentId = lockedStudent?.id ?? studentId;
  const selectedStudent =
    lockedStudent ?? students.find((student) => student.id === effectiveStudentId) ?? null;

  useEffect(() => {
    if (selectedStudent?.consentAcceptedAt) {
      setAcceptConsent(true);
    }
  }, [selectedStudent?.id, selectedStudent?.consentAcceptedAt]);

  const missingGuardianConsent = Boolean(
    guardianRequired && selectedStudent && !selectedStudent.guardianConsent,
  );

  const mutation = useMutation({
    mutationFn: api.createRequest,
    onSuccess: ({ request }) => {
      toast.success(
        lockedStudent
          ? "Pedido enviado. Os monitores do tópico já podem ver e aceitar."
          : "Pedido registrado. O pareamento já está calculado.",
      );
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["requests"] });
      void queryClient.invalidateQueries({ queryKey: ["reports"] });
      void queryClient.invalidateQueries({ queryKey: ["people"] });
      onCreated?.(request);
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

    if (!effectiveStudentId || !topicId) {
      toast.error("Selecione o estudante e o tópico.");
      return;
    }
    if (missingGuardianConsent) {
      toast.error("Este estudante ainda não possui autorização do responsável registrada.");
      return;
    }
    if (preferred.length === 0) {
      toast.error("Escolha ao menos um horário possível.");
      return;
    }
    if (consentRequired && !acceptConsent) {
      toast.error("Confirme o termo de consentimento LGPD antes de enviar o pedido.");
      return;
    }

    mutation.mutate({
      studentId: effectiveStudentId,
      topicId,
      note,
      urgency,
      preferred,
      acceptConsent,
    });
  }

  const uncovered =
    monitors !== undefined &&
    topicId !== "" &&
    !monitors.some((monitor) => monitor.topics.some((entry) => entry.topicId === topicId));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Novo pedido de ajuda"
      description={
        lockedStudent
          ? "Conte sua dúvida e quando você pode. O Elo sugere o monitor com melhor afinidade, horário e carga."
          : "Descreva a dúvida e os horários possíveis. O Elo calcula o monitor com melhor afinidade, agenda e carga."
      }
      width="max-w-xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={mutation.isPending || missingGuardianConsent}>
            {mutation.isPending ? "Enviando…" : lockedStudent ? "Enviar pedido" : "Registrar pedido"}
          </Button>
        </>
      }
    >
      <div className="space-y-3.5">
        <div className="grid gap-3 sm:grid-cols-2">
          {lockedStudent ? (
            <div className="block">
              <span className="mb-1.5 block text-[12px] font-medium text-ink-soft">Estudante</span>
              <div className="flex h-10 items-center gap-2 rounded-[12px] border border-line bg-surface-muted px-2.5">
                <Avatar name={lockedStudent.name} color={lockedStudent.color} size="xs" />
                <span className="min-w-0 truncate text-[13px] text-ink">
                  {lockedStudent.name} <span className="text-ink-faint">· {lockedStudent.className}</span>
                </span>
              </div>
            </div>
          ) : (
            <Field label="Estudante">
              <Select value={studentId} onChange={(event) => setStudentId(event.target.value)}>
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.name} · {student.className}
                    {!student.guardianConsent ? " (sem termo responsável)" : ""}
                  </option>
                ))}
              </Select>
            </Field>
          )}
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

        {missingGuardianConsent ? (
          <div className="flex items-start gap-2 rounded-[12px] bg-warn-soft px-3 py-2.5 text-[11.5px] leading-snug text-ink ring-1 ring-inset ring-warn/25">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warn" />
            <span>
              <strong>Autorização do responsável pendente (LGPD).</strong> A política atual exige o termo assinado antes do
              primeiro atendimento. A coordenação pode liberar o cadastro em{" "}
              <span className="font-medium">Configurações → Estudantes & LGPD</span>.
            </span>
          </div>
        ) : null}

        {uncovered ? (
          <p className="rounded-[12px] bg-warn-soft px-3 py-2 text-[11.5px] leading-snug text-ink ring-1 ring-inset ring-warn/20">
            Este tópico ainda não tem monitor. O pedido fica registrado e entra no painel de demanda não atendida, que a
            coordenação usa para abrir vagas.
          </p>
        ) : null}

        <Field label="O que ficou confuso?" hint="Uma frase já ajuda o monitor a chegar preparado.">
          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Ex.: não entendi como achar o vértice da parábola."
            maxLength={500}
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

        <Field
          label={lockedStudent ? "Quando você pode?" : "Quando o estudante pode?"}
          hint="Marque as janelas em que o atendimento é possível."
        >
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
          {consentRequired ? (
            <label className="flex cursor-pointer items-start gap-2.5 text-[11.5px] leading-snug text-ink-soft">
              <input
                type="checkbox"
                checked={acceptConsent}
                onChange={(event) => setAcceptConsent(event.target.checked)}
                className="mt-0.5 accent-[var(--accent)]"
              />
              <span>
                <Chip tone="neutral" className="mr-1.5 px-1.5 py-0 text-[10px]">
                  LGPD
                </Chip>
                Autorizo o uso dos dados estritamente necessários (nome, turma, tópico e horários) para organizar o
                pareamento e contabilizar horas de monitoria no IFRN.
              </span>
            </label>
          ) : (
            <p className="flex items-start gap-2 text-[11.5px] leading-snug text-ink-soft">
              <Chip tone="neutral" className="shrink-0">
                LGPD
              </Chip>
              <span>Só coletamos o necessário para o atendimento e geração de indicadores institucionais.</span>
            </p>
          )}
        </div>
      </div>
    </Dialog>
  );
}
