"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeftRight, Clock3, Save, ShieldCheck, Undo2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";

import { Avatar, Button, Chip, Field, Input, Panel, PanelHeader, Switch, Textarea } from "@/components/ui";
import { api } from "@/lib/api";
import { monitorKindLabels, pilotSlots, weekdayShort } from "@/lib/constants";
import type { CurrentUser } from "@/lib/current-user";
import type { DemoProfile, Monitor, Slot, Student, Topic } from "@/lib/types";
import { cn, formatSlot } from "@/lib/utils";
import { useUi } from "@/store/ui";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const BIO_MAX = 280;

/** "Meu perfil" de quem está usando o Elo — os campos mudam com o papel. */
export function ProfilePanel({ user, topics }: { user: CurrentUser; topics: Topic[] }) {
  const setSwitcherOpen = useUi((state) => state.setSwitcherOpen);
  const ref = useRef<HTMLDivElement>(null);

  // chegou por "Meu perfil" (/configuracoes#perfil): rola até aqui e foca o nome
  useEffect(() => {
    if (window.location.hash !== "#perfil") return;
    const node = ref.current;
    if (!node) return;
    node.scrollIntoView({ block: "start", behavior: "smooth" });
    node.querySelector<HTMLInputElement>("input")?.focus({ preventScroll: true });
  }, []);

  const subtitle =
    user.role === "coordinator"
      ? "Conta da coordenação: o nome aparece no topo e identifica quem responde pelo piloto."
      : user.role === "student"
        ? "Seus dados de estudante. O monitor vê seu nome e sua turma no pedido."
        : "Seus dados de monitor. Os horários de atendimento entram direto no pareamento.";

  return (
    <div id="perfil" ref={ref} className="scroll-mt-4">
      <Panel>
        <PanelHeader
          title="Meu perfil"
          subtitle={subtitle}
          action={
            <Button variant="ghost" size="sm" onClick={() => setSwitcherOpen(true)}>
              <ArrowLeftRight className="size-3.5" /> Trocar de usuário
            </Button>
          }
        />

        <div className="mx-5 mt-4 flex items-center gap-3 rounded-[16px] border border-line bg-surface-muted/60 p-3">
          <Avatar name={user.displayName} color={user.color} size="lg" />
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold text-ink">{user.displayName}</p>
            <p className="truncate text-[12px] text-ink-soft">{user.detail}</p>
            <p className="mt-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-accent-strong">
              {user.roleLabel}
            </p>
          </div>
        </div>

        {user.role === "coordinator" && user.coordinator ? (
          <CoordinatorForm key={user.id} profile={user.coordinator} />
        ) : null}
        {user.role === "student" && user.student ? <StudentForm key={user.id} student={user.student} /> : null}
        {user.role === "monitor" && user.monitor ? (
          <MonitorForm key={user.id} monitor={user.monitor} topics={topics} />
        ) : null}
      </Panel>
    </div>
  );
}

/* --------------------------------- shared --------------------------------- */

function useSaveProfile<T, R>(mutationFn: (input: T) => Promise<R>, onSaved: (saved: R) => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (saved) => {
      toast.success("Perfil atualizado.");
      // o formulário passa a refletir o que o servidor gravou (espaços, caixa do e-mail…)
      onSaved(saved);
      // nome, turma e horários aparecem em várias telas: recarrega tudo
      void queryClient.invalidateQueries();
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

function FormFooter({
  dirty,
  pending,
  error,
  onDiscard,
}: {
  dirty: boolean;
  pending: boolean;
  error: string | null;
  onDiscard: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3.5">
      <Button type="submit" disabled={!dirty || pending || Boolean(error)}>
        <Save className="size-4" /> {pending ? "Salvando…" : "Salvar perfil"}
      </Button>
      {dirty && !pending ? (
        <Button type="button" variant="ghost" onClick={onDiscard}>
          <Undo2 className="size-4" /> Descartar
        </Button>
      ) : null}
      <span className={cn("ml-auto text-[11.5px]", error ? "text-danger" : "text-ink-faint")} aria-live="polite">
        {error ?? (dirty ? "Alterações não salvas" : "Tudo salvo")}
      </span>
    </div>
  );
}

function ReadOnlyNote({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-[12px] border border-line bg-surface-muted/60 px-3 py-2.5 text-[11.5px] leading-snug text-ink-soft">
      <span className="mt-px shrink-0 text-accent">{icon}</span>
      <p>{children}</p>
    </div>
  );
}

/* ------------------------------- coordenação ------------------------------ */

const coordinatorForm = (profile: DemoProfile) => ({
  name: profile.name,
  email: profile.email,
  className: profile.className,
  campus: profile.campus,
});

function CoordinatorForm({ profile }: { profile: DemoProfile }) {
  const initial = useMemo(() => coordinatorForm(profile), [profile]);
  const [form, setForm] = useState(initial);
  const [touched, setTouched] = useState(false);
  const save = useSaveProfile(api.saveProfile, (saved) => {
    setForm(coordinatorForm(saved));
    setTouched(false);
  });

  const clean = {
    name: form.name.trim(),
    email: form.email.trim().toLowerCase(),
    className: form.className.trim(),
    campus: form.campus.trim(),
  };
  const dirty = (Object.keys(clean) as (keyof typeof clean)[]).some((key) => clean[key] !== initial[key]);
  const error = !clean.name
    ? "Informe seu nome."
    : clean.email && !EMAIL.test(clean.email)
      ? "Informe um e-mail válido."
      : null;

  const update = (key: keyof typeof form) => (value: string) => {
    setTouched(true);
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (!dirty || error) return;
    save.mutate(clean);
  };

  return (
    <form className="space-y-3 p-5" onSubmit={submit} noValidate>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nome" hint={profile.name ? undefined : "Aparece no topo, no lugar de “Coordenação”."}>
          <Input
            value={form.name}
            onChange={(event) => update("name")(event.target.value)}
            placeholder="Seu nome completo"
            autoComplete="name"
            maxLength={80}
            aria-invalid={touched && !clean.name}
          />
        </Field>
        <Field label="E-mail institucional">
          <Input
            type="email"
            value={form.email}
            onChange={(event) => update("email")(event.target.value)}
            placeholder="nome@ifrn.edu.br"
            autoComplete="email"
            maxLength={120}
            aria-invalid={Boolean(clean.email && !EMAIL.test(clean.email))}
          />
        </Field>
        <Field label="Função">
          <Input
            value={form.className}
            onChange={(event) => update("className")(event.target.value)}
            placeholder="Coordenação pedagógica"
            maxLength={80}
          />
        </Field>
        <Field label="Campus">
          <Input
            value={form.campus}
            onChange={(event) => update("campus")(event.target.value)}
            placeholder="IFRN — Campus Parnamirim"
            maxLength={80}
          />
        </Field>
      </div>
      <FormFooter
        dirty={dirty}
        pending={save.isPending}
        error={touched ? error : null}
        onDiscard={() => {
          setForm(initial);
          setTouched(false);
        }}
      />
    </form>
  );
}

/* -------------------------------- estudante ------------------------------- */

const studentForm = (student: Student) => ({
  name: student.name,
  className: student.className,
  course: student.course,
});

function StudentForm({ student }: { student: Student }) {
  const initial = useMemo(() => studentForm(student), [student]);
  const [form, setForm] = useState(initial);
  const save = useSaveProfile(
    (patch: ReturnType<typeof studentForm>) => api.updateStudent(student.id, patch),
    (saved) => setForm(studentForm(saved)),
  );

  const clean = { name: form.name.trim(), className: form.className.trim(), course: form.course.trim() };
  const dirty = (Object.keys(clean) as (keyof typeof clean)[]).some((key) => clean[key] !== initial[key]);
  const error = !clean.name ? "Informe seu nome." : !clean.className ? "Informe sua turma." : !clean.course ? "Informe seu curso." : null;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!dirty || error) return;
    save.mutate(clean);
  };

  return (
    <form className="space-y-3 p-5" onSubmit={submit} noValidate>
      <Field label="Nome">
        <Input
          value={form.name}
          onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
          autoComplete="name"
          maxLength={80}
          aria-invalid={!clean.name}
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Turma">
          <Input
            value={form.className}
            onChange={(event) => setForm((current) => ({ ...current, className: event.target.value }))}
            placeholder="1º ano INFO"
            maxLength={60}
            aria-invalid={!clean.className}
          />
        </Field>
        <Field label="Curso">
          <Input
            value={form.course}
            onChange={(event) => setForm((current) => ({ ...current, course: event.target.value }))}
            placeholder="Informática"
            maxLength={60}
            aria-invalid={!clean.course}
          />
        </Field>
      </div>
      <ReadOnlyNote icon={<ShieldCheck className="size-3.5" />}>
        Autorização do responsável:{" "}
        <span className={cn("font-medium", student.guardianConsent ? "text-accent-strong" : "text-warn")}>
          {student.guardianConsent ? "registrada" : "pendente"}
        </span>
        . O registro é feito pela coordenação (exigido para menores de 18 anos).
      </ReadOnlyNote>
      <FormFooter dirty={dirty} pending={save.isPending} error={error} onDiscard={() => setForm(initial)} />
    </form>
  );
}

/* --------------------------------- monitor -------------------------------- */

const slotKey = (slot: Slot) => `${slot.day}-${slot.start}-${slot.end}`;

const monitorForm = (monitor: Monitor) => ({
  name: monitor.name,
  className: monitor.className,
  bio: monitor.bio,
  online: monitor.online,
  slots: monitor.availability.map(slotKey).sort(),
});

function MonitorForm({ monitor, topics }: { monitor: Monitor; topics: Topic[] }) {
  // janelas do piloto + qualquer janela já salva fora delas (não some ao editar)
  const options = useMemo(() => {
    const base = pilotSlots.map((slot) => ({ key: slotKey(slot), label: slot.label, day: slot.day, start: slot.start, end: slot.end }));
    const extras = monitor.availability
      .filter((slot) => !base.some((option) => option.key === slotKey(slot)))
      .map((slot) => ({
        key: slotKey(slot),
        label: `${weekdayShort[slot.day]?.replace(/^./, (c) => c.toUpperCase())} · ${formatSlot(slot.start, slot.end)}`,
        ...slot,
      }));
    return [...base, ...extras].sort((a, b) => a.day - b.day || a.start - b.start);
  }, [monitor.availability]);

  const initial = useMemo(() => monitorForm(monitor), [monitor]);
  const [form, setForm] = useState(initial);
  const save = useSaveProfile(
    (patch: Parameters<typeof api.updateMonitor>[1]) => api.updateMonitor(monitor.id, patch),
    (saved) => setForm(monitorForm(saved)),
  );

  const clean = { name: form.name.trim(), className: form.className.trim(), bio: form.bio.trim() };
  const slots = [...form.slots].sort();
  const dirty =
    clean.name !== initial.name ||
    clean.className !== initial.className ||
    clean.bio !== initial.bio ||
    form.online !== initial.online ||
    slots.join("|") !== initial.slots.join("|");
  const error = !clean.name
    ? "Informe seu nome."
    : !clean.className
      ? "Informe sua turma."
      : slots.length === 0
        ? "Marque ao menos uma janela de atendimento."
        : null;

  const toggleSlot = (key: string) =>
    setForm((current) => ({
      ...current,
      slots: current.slots.includes(key) ? current.slots.filter((item) => item !== key) : [...current.slots, key],
    }));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!dirty || error) return;
    save.mutate({
      ...clean,
      online: form.online,
      availability: options
        .filter((option) => form.slots.includes(option.key))
        .map(({ day, start, end }) => ({ day, start, end })),
    });
  };

  return (
    <form className="space-y-3.5 p-5" onSubmit={submit} noValidate>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nome">
          <Input
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            autoComplete="name"
            maxLength={80}
            aria-invalid={!clean.name}
          />
        </Field>
        <Field label="Turma">
          <Input
            value={form.className}
            onChange={(event) => setForm((current) => ({ ...current, className: event.target.value }))}
            placeholder="3º ano INFO"
            maxLength={60}
            aria-invalid={!clean.className}
          />
        </Field>
      </div>

      <Field label="Sobre você" hint={`Aparece no seu cartão em Monitores · ${form.bio.length}/${BIO_MAX}`}>
        <Textarea
          value={form.bio}
          onChange={(event) => setForm((current) => ({ ...current, bio: event.target.value.slice(0, BIO_MAX) }))}
          placeholder="Como você gosta de explicar, em que assuntos se sente mais à vontade…"
          maxLength={BIO_MAX}
        />
      </Field>

      <div className="flex items-center gap-3 rounded-[14px] border border-line p-3">
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-medium text-ink">Disponível agora</p>
          <p className="text-[11px] leading-snug text-ink-soft">Mostra o ponto verde no seu cartão para quem procura ajuda.</p>
        </div>
        <Switch
          checked={form.online}
          onChange={(online) => setForm((current) => ({ ...current, online }))}
          label="Disponível agora"
        />
      </div>

      <div>
        <p className="mb-1.5 text-[12px] font-medium text-ink-soft">Janelas de atendimento</p>
        <div className="flex flex-wrap gap-1.5">
          {options.map((option) => {
            const active = form.slots.includes(option.key);
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => toggleSlot(option.key)}
                aria-pressed={active}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition-colors",
                  active
                    ? "border-accent bg-accent-soft text-accent-strong"
                    : "border-line bg-surface text-ink-soft hover:bg-surface-muted",
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        <p className="mt-1 text-[11.5px] text-ink-faint">O Elo só sugere você para pedidos com horário em comum com estas janelas.</p>
      </div>

      <div>
        <p className="mb-1.5 text-[12px] font-medium text-ink-soft">Tópicos que você atende</p>
        <div className="flex flex-wrap gap-1.5">
          {monitor.topics.map((entry) => (
            <Chip key={entry.topicId} tone="neutral">
              {topics.find((topic) => topic.id === entry.topicId)?.name ?? entry.topicId}
              <span className="num text-ink-faint">nível {entry.level}/5</span>
            </Chip>
          ))}
        </div>
      </div>

      <ReadOnlyNote icon={<Clock3 className="size-3.5" />}>
        Tópicos, nível e teto semanal ({monitor.capacityHours} h, {monitorKindLabels[monitor.kind]}) são validados pela
        coordenação. Esta semana: <span className="num font-medium text-ink">{monitor.weeklyHours} h</span> comprometidas.
      </ReadOnlyNote>

      <FormFooter dirty={dirty} pending={save.isPending} error={error} onDiscard={() => setForm(initial)} />
    </form>
  );
}
