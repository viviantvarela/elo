"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookPlus,
  Clock3,
  GraduationCap,
  Pencil,
  Plus,
  Search,
  Star,
  Trash2,
  UserRoundPen,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { NewTopicDialog } from "@/components/topics/new-topic-dialog";
import {
  Avatar,
  Button,
  Chip,
  Dialog,
  EmptyState,
  Field,
  Input,
  Panel,
  ProgressBar,
  Segmented,
  Select,
  Skeleton,
  Switch,
  Textarea,
} from "@/components/ui";
import { api, type MonitorPatch } from "@/lib/api";
import { monitorKindLabels, pilotSlots, weekdayShort } from "@/lib/constants";
import { useCurrentUser } from "@/lib/current-user";
import type { Monitor, MonitorKind, Slot, Topic } from "@/lib/types";
import { cn, formatSlot } from "@/lib/utils";

type TopicSkill = Monitor["topics"][number];

export default function MonitoresPage() {
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();
  const monitors = useQuery({ queryKey: ["monitors"], queryFn: api.listMonitors });
  const topicsQuery = useQuery({ queryKey: ["topics"], queryFn: api.listTopics });
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editorState, setEditorState] = useState<{ open: boolean; monitor: Monitor | null }>({
    open: false,
    monitor: null,
  });
  const [topicOpen, setTopicOpen] = useState(false);

  const selected = monitors.data?.find((monitor) => monitor.id === selectedId) ?? null;
  const isMe = (id: string) => user?.role === "monitor" && user.id === id;
  const isCoordinator = user?.role === "coordinator";

  const topics = topicsQuery.data ?? [];

  const filtered = useMemo(() => {
    const list = monitors.data ?? [];
    return list.filter((monitor) => {
      const matchesTopic = topic === "all" || monitor.topics.some((entry) => entry.topicId === topic);
      const matchesQuery =
        query.trim().length === 0 ||
        monitor.name.toLowerCase().includes(query.toLowerCase()) ||
        monitor.topics.some((entry) =>
          topics.find((t) => t.id === entry.topicId)?.name.toLowerCase().includes(query.toLowerCase()),
        );
      return matchesTopic && matchesQuery;
    });
  }, [monitors.data, query, topic, topics]);

  const deleteMutation = useMutation({
    mutationFn: api.deleteMonitor,
    onSuccess: () => {
      setSelectedId(null);
      toast.success("Monitor removido.");
      for (const key of ["monitors", "people", "dashboard", "reports", "requests"]) {
        void queryClient.invalidateQueries({ queryKey: [key] });
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <>
      <PageHeader
        eyebrow={`${monitors.data?.length ?? 0} pessoas no piloto`}
        title="Monitores e colegas apoiadores"
        subtitle="Quem domina cada tópico, quando pode atender e quanta agenda já está comprometida."
        actions={
          isCoordinator ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={() => setTopicOpen(true)}>
                <BookPlus className="size-4" /> Novo tópico
              </Button>
              <Button onClick={() => setEditorState({ open: true, monitor: null })}>
                <Plus className="size-4" /> Novo monitor
              </Button>
            </div>
          ) : null
        }
      />

      <Panel className="mb-3 flex flex-wrap items-center gap-2 p-3">
        <div className="relative min-w-[180px] flex-1">
          <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-ink-faint" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar monitor ou tópico…"
            className="h-9 w-full rounded-full border border-line bg-surface-muted pl-8 pr-3 text-[12.5px] text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
          />
        </div>
        <div className="-m-1 max-w-[calc(100%+0.5rem)] overflow-x-auto p-1">
          <Segmented
            size="sm"
            className="w-max"
            value={topic}
            onChange={setTopic}
            options={[
              { value: "all", label: "Todos os tópicos" },
              ...topics.map((entry) => ({ value: entry.id, label: entry.name })),
            ]}
          />
        </div>
      </Panel>

      {monitors.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-[190px] rounded-[20px]" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Panel>
          <EmptyState
            icon={<Users className="size-6" />}
            title="Nenhum monitor neste filtro"
            detail={
              isCoordinator
                ? "Tente outro tópico ou cadastre um novo monitor para cobrir esta demanda."
                : "Tente outro tópico."
            }
            action={
              isCoordinator ? (
                <Button onClick={() => setEditorState({ open: true, monitor: null })}>
                  <Plus className="size-4" /> Cadastrar monitor
                </Button>
              ) : undefined
            }
          />
        </Panel>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((monitor, index) => {
            const load = monitor.capacityHours > 0 ? monitor.weeklyHours / monitor.capacityHours : 0;
            return (
              <button
                key={monitor.id}
                onClick={() => setSelectedId(monitor.id)}
                style={{ animationDelay: `${index * 40}ms` }}
                className={cn(
                  "rise card-hover rounded-[20px] border bg-surface p-4 text-left shadow-[var(--shadow-card)]",
                  isMe(monitor.id) ? "border-accent/45 ring-1 ring-inset ring-accent/20" : "border-line",
                )}
              >
                <div className="flex items-start gap-3">
                  <Avatar name={monitor.name} color={monitor.color} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-[13.5px] font-semibold text-ink">
                      <span className="truncate">{monitor.name}</span>
                      {monitor.online ? <span className="live-dot size-1.5 shrink-0 rounded-full bg-accent" /> : null}
                      {isMe(monitor.id) ? (
                        <Chip tone="accent" className="shrink-0">
                          você
                        </Chip>
                      ) : null}
                    </p>
                    <p className="truncate text-[11.5px] text-ink-soft">
                      {monitor.className} · {monitorKindLabels[monitor.kind]}
                    </p>
                  </div>
                  <span className="num flex shrink-0 items-center gap-1 text-[12px] font-medium text-ink">
                    <Star className="size-3.5 fill-warn text-warn" />
                    {monitor.rating.toFixed(1)}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {monitor.topics.map((entry) => {
                    const info = topics.find((item) => item.id === entry.topicId);
                    return (
                      <Chip key={entry.topicId} tone="neutral">
                        {info?.name ?? entry.topicId}
                        <span className="flex items-center gap-[1.5px]" aria-label={`nível ${entry.level} de 5`}>
                          {[1, 2, 3, 4, 5].map((step) => (
                            <span
                              key={step}
                              className={cn(
                                "size-1 rounded-full",
                                step <= entry.level ? "bg-accent" : "bg-ink-faint/25",
                              )}
                            />
                          ))}
                        </span>
                      </Chip>
                    );
                  })}
                </div>

                <div className="mt-3.5">
                  <div className="mb-1 flex items-center justify-between text-[10.5px] text-ink-faint">
                    <span className="flex items-center gap-1">
                      <Clock3 className="size-3" /> carga da semana
                    </span>
                    <span className="num">
                      {monitor.weeklyHours} / {monitor.capacityHours} h
                    </span>
                  </div>
                  <ProgressBar value={load} tone={load >= 0.85 ? "warn" : "accent"} />
                </div>

                <div className="mt-3 flex items-center justify-between text-[11px] text-ink-soft">
                  <span>{monitor.sessions} sessões</span>
                  <span className="flex items-center gap-1">
                    <GraduationCap className="size-3" /> {monitor.availability.length} janelas
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <Dialog
        open={Boolean(selected)}
        onClose={() => setSelectedId(null)}
        title={selected?.name ?? "Monitor"}
        description={selected ? [selected.className, selected.email, selected.bio].filter(Boolean).join(" · ") : undefined}
        width="max-w-lg"
      >
        {selected ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Avaliação", value: `${selected.rating.toFixed(1)}★`, hint: `${selected.ratingCount} notas` },
                { label: "Sessões", value: String(selected.sessions), hint: "no piloto" },
                {
                  label: "Carga",
                  value: `${selected.weeklyHours}h`,
                  hint: `de ${selected.capacityHours} h`,
                },
              ].map((item) => (
                <div key={item.label} className="rounded-[14px] border border-line bg-surface-muted/60 p-2.5">
                  <p className="label-xs">{item.label}</p>
                  <p className="num mt-1 text-[16px] font-semibold text-ink">{item.value}</p>
                  <p className="text-[10.5px] text-ink-faint">{item.hint}</p>
                </div>
              ))}
            </div>

            <div>
              <p className="label-xs mb-1.5">Tópicos e nível</p>
              <div className="space-y-1.5">
                {selected.topics.map((entry) => {
                  const info = topics.find((item) => item.id === entry.topicId);
                  return (
                    <div key={entry.topicId} className="flex items-center gap-2">
                      <span className="w-36 truncate text-[12.5px] text-ink">{info?.name ?? entry.topicId}</span>
                      <div className="flex flex-1 items-center gap-1">
                        {[1, 2, 3, 4, 5].map((step) => (
                          <span
                            key={step}
                            className={cn("h-1.5 flex-1 rounded-full", step <= entry.level ? "bg-accent" : "bg-surface-muted")}
                          />
                        ))}
                      </div>
                      <span className="num w-6 text-right text-[11px] text-ink-faint">{entry.level}/5</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="label-xs mb-1.5">Disponibilidade</p>
              <div
                className={cn(
                  "grid gap-1.5",
                  selected.availability.some((slot) => slot.day === 6) ? "grid-cols-6" : "grid-cols-5",
                )}
              >
                {(selected.availability.some((slot) => slot.day === 6) ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5]).map((day) => {
                  const slots = selected.availability.filter((slot) => slot.day === day);
                  return (
                    <div key={day} className="rounded-[10px] border border-line p-1.5 text-center">
                      <p className="text-[10px] uppercase tracking-[0.06em] text-ink-faint">{weekdayShort[day]}</p>
                      {slots.length === 0 ? (
                        <p className="mt-1 text-[10.5px] text-ink-faint/60">—</p>
                      ) : (
                        slots.map((slot) => (
                          <p key={slot.start} className="num mt-1 text-[10.5px] font-medium text-ink">
                            {formatSlot(slot.start, slot.end)}
                          </p>
                        ))
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Chip tone={selected.online ? "accent" : "neutral"}>
                {selected.online ? "disponível agora" : "offline"}
              </Chip>
              <Chip tone="neutral">{monitorKindLabels[selected.kind]}</Chip>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              {isCoordinator ? (
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const target = selected;
                      setSelectedId(null);
                      setEditorState({ open: true, monitor: target });
                    }}
                  >
                    <Pencil className="size-3.5" /> Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-danger hover:bg-danger/10"
                    disabled={deleteMutation.isPending}
                    onClick={() => deleteMutation.mutate(selected.id)}
                  >
                    <Trash2 className="size-3.5" /> Remover
                  </Button>
                </div>
              ) : (
                <span />
              )}

              <div className="flex items-center gap-2">
                {isMe(selected.id) ? (
                  <Link
                    href="/configuracoes#perfil"
                    className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-[12px] font-medium text-ink transition-colors hover:bg-surface-muted"
                  >
                    <UserRoundPen className="size-3.5" /> Editar meu perfil
                  </Link>
                ) : null}
                <Button variant="outline" size="sm" onClick={() => setSelectedId(null)}>
                  Fechar
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </Dialog>

      <MonitorEditorDialog
        open={editorState.open}
        monitor={editorState.monitor}
        topics={topics}
        onClose={() => setEditorState({ open: false, monitor: null })}
      />

      <NewTopicDialog open={topicOpen} onClose={() => setTopicOpen(false)} />
    </>
  );
}

function slotKeyOf(slot: Slot) {
  return `${slot.day}-${slot.start}-${slot.end}`;
}

function MonitorEditorDialog({
  open,
  monitor,
  topics,
  onClose,
}: {
  open: boolean;
  monitor: Monitor | null;
  topics: Topic[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [className, setClassName] = useState("2º ano INFO");
  const [kind, setKind] = useState<MonitorKind>("bolsista");
  const [capacityHours, setCapacityHours] = useState(6);
  const [online, setOnline] = useState(true);
  const [bio, setBio] = useState("");
  const [skills, setSkills] = useState<TopicSkill[]>([]);
  const [slotKeys, setSlotKeys] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    if (monitor) {
      setName(monitor.name);
      setEmail(monitor.email ?? "");
      setClassName(monitor.className);
      setKind(monitor.kind);
      setCapacityHours(monitor.capacityHours);
      setOnline(monitor.online);
      setBio(monitor.bio);
      setSkills(monitor.topics);
      setSlotKeys(
        pilotSlots
          .filter((ps) => monitor.availability.some((a) => slotKeyOf(a) === slotKeyOf(ps)))
          .map((ps) => ps.key),
      );
    } else {
      setName("");
      setEmail("");
      setClassName("2º ano INFO");
      setKind("bolsista");
      setCapacityHours(6);
      setOnline(true);
      setBio("");
      setSkills(topics[0] ? [{ topicId: topics[0].id, level: 4 }] : []);
      setSlotKeys(pilotSlots.slice(0, 2).map((ps) => ps.key));
    }
  }, [open, monitor, topics]);

  const invalidateAll = () => {
    for (const key of ["monitors", "people", "dashboard", "reports", "requests"]) {
      void queryClient.invalidateQueries({ queryKey: [key] });
    }
  };

  const createMutation = useMutation({
    mutationFn: api.createMonitor,
    onSuccess: () => {
      toast.success("Monitor cadastrado com sucesso!");
      invalidateAll();
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: MonitorPatch }) => api.updateMonitor(id, patch),
    onSuccess: () => {
      toast.success("Monitor atualizado!");
      invalidateAll();
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleTopic = (topicId: string) => {
    setSkills((current) =>
      current.some((s) => s.topicId === topicId)
        ? current.filter((s) => s.topicId !== topicId)
        : [...current, { topicId, level: 4 }],
    );
  };

  const setLevel = (topicId: string, level: 1 | 2 | 3 | 4 | 5) => {
    setSkills((current) => current.map((s) => (s.topicId === topicId ? { ...s, level } : s)));
  };

  const toggleSlot = (key: string) => {
    setSlotKeys((current) => (current.includes(key) ? current.filter((k) => k !== key) : [...current, key]));
  };

  const handleSave = () => {
    if (!name.trim()) {
      toast.error("Informe o nome do monitor.");
      return;
    }
    if (skills.length === 0) {
      toast.error("Selecione ao menos um tópico que o monitor atende.");
      return;
    }
    const availability: Slot[] = pilotSlots
      .filter((ps) => slotKeys.includes(ps.key))
      .map((ps) => ({ day: ps.day, start: ps.start, end: ps.end }));

    if (availability.length === 0) {
      toast.error("Selecione ao menos uma janela de disponibilidade.");
      return;
    }

    if (monitor) {
      updateMutation.mutate({
        id: monitor.id,
        patch: {
          name: name.trim(),
          email: email.trim(),
          className: className.trim(),
          kind,
          capacityHours,
          online,
          bio: bio.trim(),
          topics: skills,
          availability,
        },
      });
    } else {
      createMutation.mutate({
        name: name.trim(),
        email: email.trim() || undefined,
        className: className.trim(),
        kind,
        capacityHours,
        online,
        bio: bio.trim(),
        topics: skills,
        availability,
      });
    }
  };

  const saving = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={monitor ? "Editar monitor" : "Cadastrar novo monitor"}
      description="Defina vínculo, tópicos atendidos, carga semanal máxima e janelas disponíveis."
      width="max-w-xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvando…" : monitor ? "Salvar alterações" : "Cadastrar monitor"}
          </Button>
        </>
      }
    >
      <div className="max-h-[68vh] space-y-3.5 overflow-y-auto pr-1">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nome completo">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Lucas Almeida" maxLength={80} />
          </Field>
          <Field label="E-mail institucional (opcional)" hint="Vincula automaticamente ao login Supabase.">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="lucas@escolar.ifrn.edu.br"
              maxLength={120}
            />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Turma / curso">
            <Input value={className} onChange={(e) => setClassName(e.target.value)} placeholder="2º ano INFO" maxLength={60} />
          </Field>
          <Field label="Carga máxima / semana">
            <Select value={String(capacityHours)} onChange={(e) => setCapacityHours(Number(e.target.value))}>
              {[2, 4, 6, 8, 10, 12].map((h) => (
                <option key={h} value={String(h)}>
                  {h} horas
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-line bg-surface-muted/60 px-3 py-2.5">
          <div>
            <p className="text-[12px] font-medium text-ink">Tipo de vínculo</p>
            <Segmented
              size="sm"
              className="mt-1"
              value={kind}
              onChange={(val) => setKind(val)}
              options={[
                { value: "bolsista", label: "Monitor bolsista" },
                { value: "voluntario", label: "Colega apoiador / voluntário" },
              ]}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-ink-soft">Disponível agora</span>
            <Switch checked={online} onChange={setOnline} label="Disponível agora" />
          </div>
        </div>

        <Field label="Tópicos e nível de domínio (1 a 5)">
          <div className="space-y-1.5 rounded-[12px] border border-line p-2.5">
            {topics.map((t) => {
              const skill = skills.find((s) => s.topicId === t.id);
              return (
                <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-1">
                  <label className="flex cursor-pointer items-center gap-2 text-[12.5px] text-ink">
                    <input
                      type="checkbox"
                      checked={Boolean(skill)}
                      onChange={() => toggleTopic(t.id)}
                      className="accent-[var(--accent)]"
                    />
                    <span>{t.name}</span>
                    <span className="text-[11px] text-ink-faint">({t.component})</span>
                  </label>
                  {skill ? (
                    <div className="flex items-center gap-1">
                      {([1, 2, 3, 4, 5] as const).map((lvl) => (
                        <button
                          key={lvl}
                          type="button"
                          onClick={() => setLevel(t.id, lvl)}
                          className={cn(
                            "num size-6 rounded-full border text-[11px] font-medium transition-colors",
                            skill.level === lvl
                              ? "border-accent bg-accent-soft text-accent-strong"
                              : "border-line bg-surface text-ink-soft hover:bg-surface-muted",
                          )}
                        >
                          {lvl}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </Field>

        <Field label="Janelas disponíveis">
          <div className="flex flex-wrap gap-1.5">
            {pilotSlots.map((slot) => {
              const active = slotKeys.includes(slot.key);
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

        <Field label="Apresentação / foco de apoio (opcional)">
          <Textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Ex.: Apoio em resolução passo a passo de listas e laboratório."
            maxLength={240}
          />
        </Field>
      </div>
    </Dialog>
  );
}
