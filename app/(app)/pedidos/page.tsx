"use client";

import { useQuery } from "@tanstack/react-query";
import { Filter, Inbox, Plus, Search } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

import { PageHeader } from "@/components/page-header";
import { NewRequestDialog } from "@/components/requests/new-request-dialog";
import { RequestDetail } from "@/components/requests/request-detail";
import { RequestRow } from "@/components/requests/request-row";
import { Button, EmptyState, Panel, Segmented, Skeleton } from "@/components/ui";
import { api } from "@/lib/api";
import { shortName, useCurrentUser, visibleRequests } from "@/lib/current-user";
import type { RequestStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

type FilterValue = "all" | RequestStatus;

const normalize = (value: string) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** A seleção vive na URL (?id=): links do painel abrem o pedido certo e voltar/avançar funciona. */
function selectInUrl(id: string) {
  window.history.replaceState(null, "", `/pedidos?id=${encodeURIComponent(id)}`);
}

export default function PedidosPage() {
  return (
    <Suspense fallback={null}>
      <PedidosView />
    </Suspense>
  );
}

function PedidosView() {
  const { user } = useCurrentUser();
  const searchParams = useSearchParams();
  const requestedId = searchParams.get("id");
  const { data, isLoading } = useQuery({ queryKey: ["requests"], queryFn: api.listRequests });
  const [filter, setFilter] = useState<FilterValue>("all");
  const [query, setQuery] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  // pedido recém-criado: fica selecionado enquanto a lista recarrega
  const [pendingId, setPendingId] = useState<string | null>(null);

  const role = user?.role ?? "coordinator";
  const identity = user ? `${user.role}:${user.id}` : "";

  // cada usuário começa com a lista inteira
  useEffect(() => {
    setFilter("all");
    setQuery("");
  }, [identity]);

  const visible = useMemo(() => visibleRequests(data?.requests ?? [], user), [data, user]);
  const visibleIds = useMemo(() => new Set(visible.map((request) => request.id)), [visible]);
  const selected = pendingId ?? (requestedId && visibleIds.has(requestedId) ? requestedId : null);

  useEffect(() => {
    if (!data || !user) return;
    if (pendingId) {
      if (visibleIds.has(pendingId)) {
        selectInUrl(pendingId);
        setPendingId(null);
      }
      return;
    }
    if (requestedId && visibleIds.has(requestedId)) return;
    // sem seleção válida para este usuário: o primeiro aberto (ou o mais recente)
    const fallback = visible.find((request) => request.status === "open") ?? visible[0];
    if (fallback) selectInUrl(fallback.id);
  }, [data, user, pendingId, requestedId, visible, visibleIds]);

  const counts = useMemo(
    () => ({
      all: visible.length,
      open: visible.filter((request) => request.status === "open").length,
      matched: visible.filter((request) => request.status === "matched").length,
      scheduled: visible.filter((request) => request.status === "scheduled").length,
      done: visible.filter((request) => request.status === "done").length,
    }),
    [visible],
  );

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = normalize(query.trim());
    return visible.filter((request) => {
      const student = data.students.find((entry) => entry.id === request.studentId);
      const topic = data.topics.find((entry) => entry.id === request.topicId);
      const matchesQuery = q.length === 0 || normalize(`${student?.name} ${topic?.name} ${request.note}`).includes(q);
      const matchesFilter = filter === "all" || request.status === filter;
      return matchesQuery && matchesFilter;
    });
  }, [data, visible, filter, query]);

  const monitorTopics =
    user?.monitor?.topics
      .map((entry) => data?.topics.find((topic) => topic.id === entry.topicId)?.name)
      .filter(Boolean)
      .join(", ") ?? "";

  const header =
    role === "student"
      ? {
          eyebrow: "Sua ajuda",
          title: "Meus pedidos",
          subtitle: "Acompanhe seus pedidos de ajuda: quem vai te atender, quando, e o que já foi resolvido.",
        }
      : role === "monitor"
        ? {
            eyebrow: "Sua fila",
            title: "Pedidos para você",
            subtitle: `Pedidos abertos nos tópicos que você atende${monitorTopics ? ` (${monitorTopics})` : ""} e os que já são seus. Aceite, combine o horário e registre o atendimento.`,
          }
        : {
            eyebrow: "Fila de pareamento",
            title: "Pedidos de ajuda",
            subtitle:
              "Cada pedido guarda o tópico, a dúvida e as janelas possíveis — a base do pareamento e do painel de demanda.",
          };

  const canCreate = role !== "monitor";

  return (
    <>
      <PageHeader
        eyebrow={header.eyebrow}
        title={header.title}
        subtitle={header.subtitle}
        actions={
          canCreate ? (
            <Button onClick={() => setNewOpen(true)}>
              <Plus className="size-4" /> Novo pedido
            </Button>
          ) : null
        }
      />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <div className="space-y-3">
          <Panel className="p-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[160px] flex-1">
                <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-ink-faint" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={role === "student" ? "Buscar por tópico ou dúvida…" : "Buscar por estudante, tópico ou dúvida…"}
                  aria-label="Buscar pedidos"
                  className="h-9 w-full rounded-full border border-line bg-surface-muted pl-8 pr-3 text-[12.5px] text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
                />
              </div>
              <div className="-m-1 overflow-x-auto p-1">
                <Segmented
                  size="sm"
                  className="w-max"
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
            </div>
          </Panel>

          <Panel className="p-1.5">
            {isLoading || !user ? (
              <div className="space-y-2 p-2">
                {Array.from({ length: 6 }).map((_, index) => (
                  <Skeleton key={index} className="h-12" />
                ))}
              </div>
            ) : visible.length === 0 ? (
              <EmptyState
                icon={<Inbox className="size-5" />}
                title={
                  role === "student"
                    ? "Você ainda não fez pedidos"
                    : role === "monitor"
                      ? "Nenhum pedido para você agora"
                      : "Nenhum pedido ainda"
                }
                detail={
                  role === "student"
                    ? "Conte o que ficou confuso e quando você pode: o Elo encontra um monitor para te ajudar."
                    : role === "monitor"
                      ? `Quando um estudante pedir ajuda${monitorTopics ? ` em ${monitorTopics}` : " nos seus tópicos"}, o pedido aparece aqui.`
                      : "Os pedidos registrados pelos estudantes aparecem aqui."
                }
                action={
                  canCreate ? (
                    <Button onClick={() => setNewOpen(true)}>
                      <Plus className="size-4" /> Novo pedido
                    </Button>
                  ) : undefined
                }
              />
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={<Filter className="size-5" />}
                title="Nenhum pedido neste filtro"
                detail={canCreate ? "Ajuste a busca ou registre um novo pedido." : "Ajuste a busca ou o filtro."}
              />
            ) : (
              <div className="space-y-0.5">
                {filtered.map((request) => {
                  const monitor = data?.monitors.find((entry) => entry.id === request.monitorId);
                  return (
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
                        meta={
                          role === "student"
                            ? monitor
                              ? `com ${shortName(monitor.name)}`
                              : request.status === "cancelled"
                                ? "cancelado"
                                : "aguardando monitor"
                            : undefined
                        }
                        onClick={() => {
                          setPendingId(null);
                          selectInUrl(request.id);
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>
        </div>

        <div className="lg:sticky lg:top-0 lg:self-start">
          <RequestDetail requestId={selected} />
        </div>
      </div>

      {data && canCreate ? (
        <NewRequestDialog
          open={newOpen}
          onClose={() => setNewOpen(false)}
          students={data.students}
          topics={data.topics}
          monitors={data.monitors}
          lockedStudent={role === "student" ? user?.student : null}
          onCreated={(request) => {
            setFilter("all");
            setQuery("");
            setPendingId(request.id);
          }}
        />
      ) : null}
    </>
  );
}
