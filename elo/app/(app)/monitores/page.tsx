"use client";

import { useQuery } from "@tanstack/react-query";
import { Clock3, GraduationCap, Search, Star, Users } from "lucide-react";
import { useMemo, useState } from "react";

import { PageHeader } from "@/components/page-header";
import { Avatar, Button, Chip, Dialog, EmptyState, Panel, ProgressBar, Segmented, Skeleton } from "@/components/ui";
import { api } from "@/lib/api";
import { weekdayShort } from "@/lib/constants";
import type { Monitor } from "@/lib/types";
import { cn, formatSlot } from "@/lib/utils";

export default function MonitoresPage() {
  const monitors = useQuery({ queryKey: ["monitors"], queryFn: api.listMonitors });
  const dashboard = useQuery({ queryKey: ["dashboard"], queryFn: api.getDashboard });
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState("all");
  const [selected, setSelected] = useState<Monitor | null>(null);

  const topics = dashboard.data?.topics ?? [];

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

  return (
    <>
      <PageHeader
        eyebrow={`${monitors.data?.length ?? 0} pessoas no piloto`}
        title="Monitores e colegas apoiadores"
        subtitle="Quem domina cada tópico, quando pode atender e quanta agenda já está comprometida."
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
        <Segmented
          size="sm"
          value={topic}
          onChange={setTopic}
          options={[{ value: "all", label: "Todos os tópicos" }, ...topics.map((entry) => ({ value: entry.id, label: entry.name }))]}
        />
      </Panel>

      {monitors.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-[190px] rounded-[20px]" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Panel>
          <EmptyState icon={<Users className="size-6" />} title="Nenhum monitor neste filtro" detail="Tente outro tópico." />
        </Panel>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((monitor, index) => {
            const load = monitor.capacityHours > 0 ? monitor.weeklyHours / monitor.capacityHours : 0;
            return (
              <button
                key={monitor.id}
                onClick={() => setSelected(monitor)}
                style={{ animationDelay: `${index * 40}ms` }}
                className="rise card-hover rounded-[20px] border border-line bg-surface p-4 text-left shadow-[var(--shadow-card)]"
              >
                <div className="flex items-start gap-3">
                  <Avatar name={monitor.name} color={monitor.color} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-[13.5px] font-semibold text-ink">
                      {monitor.name}
                      {monitor.online ? <span className="live-dot size-1.5 shrink-0 rounded-full bg-accent" /> : null}
                    </p>
                    <p className="truncate text-[11.5px] text-ink-soft">
                      {monitor.className} · {monitor.kind === "bolsista" ? "bolsista" : "voluntário(a)"}
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
        onClose={() => setSelected(null)}
        title={selected?.name ?? "Monitor"}
        description={selected ? `${selected.className} · ${selected.bio}` : undefined}
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
                      <span className="w-32 truncate text-[12.5px] text-ink">{info?.name ?? entry.topicId}</span>
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
              <div className="grid grid-cols-5 gap-1.5">
                {[1, 2, 3, 4, 5].map((day) => {
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
              <Chip tone="neutral">{selected.kind === "bolsista" ? "bolsista" : "voluntário(a)"}</Chip>
            </div>

            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setSelected(null)}>
                Fechar
              </Button>
            </div>
          </div>
        ) : null}
      </Dialog>
    </>
  );
}
