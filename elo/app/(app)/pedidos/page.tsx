"use client";

import { useQuery } from "@tanstack/react-query";
import { Filter, Plus, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { PageHeader } from "@/components/page-header";
import { NewRequestDialog } from "@/components/requests/new-request-dialog";
import { RequestDetail } from "@/components/requests/request-detail";
import { RequestRow } from "@/components/requests/request-row";
import { Button, EmptyState, Panel, Segmented, Skeleton } from "@/components/ui";
import { api } from "@/lib/api";
import type { RequestStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

type FilterValue = "all" | RequestStatus;

export default function PedidosPage() {
  const { data, isLoading } = useQuery({ queryKey: ["requests"], queryFn: api.listRequests });
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterValue>("all");
  const [query, setQuery] = useState("");
  const [newOpen, setNewOpen] = useState(false);

  useEffect(() => {
    if (!data || selected) return;
    const firstOpen = data.requests.find((request) => request.status === "open") ?? data.requests[0];
    if (firstOpen) setSelected(firstOpen.id);
  }, [data, selected]);

  const counts = useMemo(() => {
    const requests = data?.requests ?? [];
    return {
      all: requests.length,
      open: requests.filter((request) => request.status === "open").length,
      matched: requests.filter((request) => request.status === "matched").length,
      scheduled: requests.filter((request) => request.status === "scheduled").length,
      done: requests.filter((request) => request.status === "done").length,
    };
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.requests.filter((request) => {
      const student = data.students.find((entry) => entry.id === request.studentId);
      const topic = data.topics.find((entry) => entry.id === request.topicId);
      const matchesQuery =
        query.trim().length === 0 ||
        `${student?.name} ${topic?.name} ${request.note}`.toLowerCase().includes(query.toLowerCase());
      const matchesFilter = filter === "all" || request.status === filter;
      return matchesQuery && matchesFilter;
    });
  }, [data, filter, query]);

  return (
    <>
      <PageHeader
        eyebrow="Fila de pareamento"
        title="Pedidos de ajuda"
        subtitle="Cada pedido guarda o tópico, a dúvida e as janelas possíveis — a base do pareamento e do painel de demanda."
        actions={
          <Button onClick={() => setNewOpen(true)}>
            <Plus className="size-4" /> Novo pedido
          </Button>
        }
      />

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <div className="space-y-3">
          <Panel className="p-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[160px] flex-1">
                <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-ink-faint" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar por estudante, tópico ou dúvida…"
                  className="h-9 w-full rounded-full border border-line bg-surface-muted pl-8 pr-3 text-[12.5px] text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
                />
              </div>
              <Segmented
                size="sm"
                value={filter}
                onChange={setFilter}
                options={[
                  { value: "all", label: `Todos ${counts.all}` },
                  { value: "open", label: `Abertos ${counts.open}` },
                  { value: "matched", label: `Pareando ${counts.matched}` },
                  { value: "scheduled", label: `Agendados ${counts.scheduled}` },
                  { value: "done", label: `Concluídos ${counts.done}` },
                ]}
              />
            </div>
          </Panel>

          <Panel className="p-1.5">
            {isLoading ? (
              <div className="space-y-2 p-2">
                {Array.from({ length: 6 }).map((_, index) => (
                  <Skeleton key={index} className="h-12" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={<Filter className="size-5" />}
                title="Nenhum pedido neste filtro"
                detail="Ajuste a busca ou registre um novo pedido."
              />
            ) : (
              <div className="space-y-0.5">
                {filtered.map((request) => (
                  <div
                    key={request.id}
                    className={cn(
                      "rounded-[14px]",
                      selected === request.id && "bg-accent-tint ring-1 ring-inset ring-accent/25",
                    )}
                  >
                    <RequestRow
                      request={request}
                      student={data?.students.find((student) => student.id === request.studentId)}
                      topic={data?.topics.find((topic) => topic.id === request.topicId)}
                      onClick={() => setSelected(request.id)}
                    />
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>

        <div className="lg:sticky lg:top-0 lg:self-start">
          <RequestDetail requestId={selected} />
        </div>
      </div>

      {data ? (
        <NewRequestDialog
          open={newOpen}
          onClose={() => setNewOpen(false)}
          students={data.students}
          topics={data.topics}
        />
      ) : null}
    </>
  );
}
