"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlarmClock,
  ArrowRight,
  BellRing,
  CalendarClock,
  CheckCircle2,
  HandHeart,
  LifeBuoy,
  Percent,
  Plus,
  Sparkles,
  Star,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { AreaTrend, DonutChart, HBars, MiniRing } from "@/components/charts";
import { PageHeader } from "@/components/page-header";
import { RequestRow } from "@/components/requests/request-row";
import { NewRequestDialog } from "@/components/requests/new-request-dialog";
import { SessionRow } from "@/components/session-row";
import { StatCard } from "@/components/stat-card";
import { Avatar, Button, Chip, EmptyState, Panel, PanelHeader, ProgressBar, Skeleton } from "@/components/ui";
import { api } from "@/lib/api";
import { roleLabels } from "@/lib/constants";
import { dayLabel } from "@/lib/format";
import type { DashboardSummary } from "@/lib/types";
import { formatHours } from "@/lib/utils";
import { useUi } from "@/store/ui";

export default function PainelPage() {
  const role = useUi((state) => state.role);
  const { data, isLoading, isError } = useQuery({ queryKey: ["dashboard"], queryFn: api.getDashboard });
  const [newOpen, setNewOpen] = useState(false);

  if (isLoading) return <DashboardSkeleton />;
  if (isError || !data) {
    return (
      <Panel>
        <EmptyState
          title="Não foi possível carregar o painel"
          detail="Recarregue a página. Se o problema persistir, restaure a base de demonstração em Configurações."
        />
      </Panel>
    );
  }

  const meStudent = data.students[0];
  const meMonitor = data.monitors[0];

  const myRequests = data.requests.filter((request) => request.studentId === meStudent?.id);
  const myOpen = myRequests.filter((request) => request.status === "open" || request.status === "matched");
  const mySessions = data.todaySessions.filter((session) => session.monitorId === meMonitor?.id);

  const monitorSessionsWeek = data.weekly[data.weekly.length - 1]?.current ?? 0;
  const myTopicRequests = data.requests.filter(
    (request) =>
      request.status === "open" &&
      meMonitor?.topics.some((topic) => topic.topicId === request.topicId),
  );

  const greeting =
    role === "coordinator"
      ? "Painel do piloto"
      : role === "student"
        ? `Olá, ${meStudent?.name.split(" ")[0] ?? "estudante"}`
        : `Olá, ${meMonitor?.name.split(" ")[0] ?? "monitor"}`;

  const subtitle =
    role === "coordinator"
      ? "IFRN — Campus Parnamirim · acompanhe demanda, tempo de pareamento e horas registradas."
      : role === "student"
        ? "Peça ajuda por tópico, escolha os horários possíveis e acompanhe cada atendimento."
        : "Veja o que combina com a sua agenda, registre sessões e acompanhe suas horas.";

  return (
    <>
      <PageHeader
        eyebrow={`Vendo como ${roleLabels[role]}`}
        title={greeting}
        subtitle={subtitle}
        actions={
          <>
            <Link
              href="/relatorios"
              className="inline-flex h-9.5 items-center gap-2 rounded-full border border-line bg-surface px-4 text-[13px] font-medium text-ink transition-colors hover:bg-surface-muted"
            >
              <TrendingUp className="size-3.5" /> Relatórios
            </Link>
            <Button onClick={() => setNewOpen(true)}>
              <Plus className="size-4" /> Novo pedido
            </Button>
          </>
        }
      />

      {/* ------------------------------- stats ------------------------------- */}
      {role === "coordinator" ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label="Pedidos abertos"
            value={data.stats.open}
            hint={`${data.stats.matched} em pareamento · ${data.stats.scheduled} agendados`}
            icon={LifeBuoy}
            tone={data.stats.open > 0 ? "warn" : "neutral"}
            index={0}
          />
          <StatCard
            label="Pareados em até 48 h"
            value={Math.round(data.stats.matchedUnder48h * 100)}
            unit="%"
            hint="Meta do piloto: 70%"
            icon={Percent}
            tone={data.stats.matchedUnder48h >= 0.7 ? "accent" : "warn"}
            index={1}
          />
          <StatCard
            label="Horas de monitoria no mês"
            value={formatHours(data.stats.hoursThisMonth)}
            unit="h"
            hint={`${data.stats.done} atendimentos concluídos`}
            icon={CheckCircle2}
            tone="accent"
            index={2}
          />
          <StatCard
            label="Satisfação média"
            value={data.stats.satisfaction.toFixed(1).replace(".", ",")}
            unit="/ 5"
            hint={`Alcance: ${Math.round(data.stats.reach * 100)}% dos estudantes`}
            icon={Star}
            tone="neutral"
            index={3}
          />
        </div>
      ) : role === "student" ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Seus pedidos abertos" value={myOpen.length} hint="Aguardando ou em pareamento" icon={LifeBuoy} tone="warn" index={0} />
          <StatCard label="Atendimentos concluídos" value={myRequests.filter((r) => r.status === "done").length} hint="Sessões registradas" icon={CheckCircle2} tone="accent" index={1} />
          <StatCard label="Próximo atendimento" value={data.upcoming[0] ? dayLabel(data.upcoming[0].startsAt) : "—"} hint={data.upcoming[0] ? "confirmado com monitor" : "nenhum agendado"} icon={CalendarClock} index={2} />
          <StatCard label="Horas de apoio no mês" value={formatHours(data.stats.hoursThisMonth)} unit="h" hint="Somando toda a turma" icon={TrendingUp} index={3} />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Atendimentos na semana" value={monitorSessionsWeek} hint="Sessões concluídas" icon={HandHeart} tone="accent" index={0} />
          <StatCard label="Suas horas" value={formatHours((meMonitor?.weeklyHours ?? 0) * 60)} unit="h" hint={`de ${meMonitor?.capacityHours ?? 0} h de capacidade`} icon={AlarmClock} index={1} />
          <StatCard label="Sua avaliação" value={(meMonitor?.rating ?? 0).toFixed(1).replace(".", ",")} unit="/ 5" hint={`${meMonitor?.ratingCount ?? 0} avaliações`} icon={Star} index={2} />
          <StatCard label="Pedidos no seu tópico" value={myTopicRequests.length} hint="Aguardando monitor" icon={Sparkles} tone={myTopicRequests.length > 0 ? "warn" : "neutral"} index={3} />
        </div>
      )}

      {/* -------------------------------- row 2 ------------------------------ */}
      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelHeader
            title="Atendimentos por semana"
            subtitle={role === "coordinator" ? "Sessões registradas na plataforma nas últimas 4 semanas." : "Movimento do piloto no campus."}
            action={
              <div className="flex items-center gap-3 text-[11px] text-ink-faint">
                <span className="flex items-center gap-1.5">
                  <span className="h-0.5 w-4 rounded-full bg-accent" /> atual
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-0.5 w-4 rounded-full border-t border-dashed border-ink-faint" /> período anterior
                </span>
              </div>
            }
          />
          <div className="px-3 pb-3 pt-2">
            <AreaTrend data={data.weekly} />
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Pontos de atenção" subtitle="O que pede decisão da coordenação." />
          <div className="space-y-2 p-3">
            {data.alerts.length === 0 ? (
              <EmptyState title="Nada pendente" detail="Fila de pareamento em dia." />
            ) : (
              data.alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="flex gap-2.5 rounded-[14px] border border-line bg-surface-muted/60 p-3"
                >
                  <span
                    className={
                      alert.tone === "danger"
                        ? "mt-0.5 text-danger"
                        : alert.tone === "warn"
                          ? "mt-0.5 text-warn"
                          : "mt-0.5 text-info"
                    }
                  >
                    <BellRing className="size-4" />
                  </span>
                  <div>
                    <p className="text-[12.5px] font-medium leading-snug text-ink">{alert.title}</p>
                    <p className="mt-0.5 text-[11.5px] leading-snug text-ink-soft">{alert.detail}</p>
                  </div>
                </div>
              ))
            )}
            <Link
              href="/pedidos"
              className="flex items-center justify-between rounded-[12px] px-2.5 py-2 text-[12px] font-medium text-accent-strong transition-colors hover:bg-accent-tint"
            >
              Abrir fila de pedidos <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </Panel>
      </div>

      {/* -------------------------------- row 3 ------------------------------ */}
      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelHeader
            title={role === "student" ? "Seus pedidos" : role === "monitor" ? "Pedidos que combinam com você" : "Fila de pedidos"}
            subtitle={
              role === "student"
                ? "Cada pedido já tem um monitor sugerido pelo algoritmo."
                : role === "monitor"
                  ? "Abertos nos tópicos em que você atua."
                  : "Os mais recentes, com status e tópico."
            }
            action={
              <Link href="/pedidos" className="text-[12px] font-medium text-accent-strong hover:underline">
                Ver todos
              </Link>
            }
          />
          <div className="p-1.5">
            {(role === "student" ? myRequests : role === "monitor" ? myTopicRequests : data.requests).slice(0, 6).map((request) => (
              <RequestRow
                key={request.id}
                request={request}
                student={data.students.find((student) => student.id === request.studentId)}
                topic={data.topics.find((topic) => topic.id === request.topicId)}
                compact
              />
            ))}
            {(role === "student" ? myRequests : role === "monitor" ? myTopicRequests : data.requests).length === 0 ? (
              <EmptyState
                title="Nenhum pedido por aqui"
                detail="Quando alguém pedir ajuda, o pedido aparece nesta lista."
              />
            ) : null}
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            title="Próximos atendimentos"
            subtitle="Sessões confirmadas pela plataforma."
            action={
              <Link href="/agenda" className="text-[12px] font-medium text-accent-strong hover:underline">
                Agenda
              </Link>
            }
          />
          <div className="space-y-0.5 p-1.5">
            {data.upcoming.length === 0 ? (
              <EmptyState title="Sem sessões agendadas" detail="Pareie um pedido para criar a primeira." />
            ) : (
              data.upcoming.slice(0, 4).map((session) => (
                <SessionRow
                  key={session.id}
                  session={session}
                  monitor={data.monitors.find((monitor) => monitor.id === session.monitorId)}
                  topic={data.topics.find((topic) => topic.id === session.topicId)}
                />
              ))
            )}
          </div>
        </Panel>
      </div>

      {/* -------------------------------- row 4 ------------------------------ */}
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Demanda por tópico" subtitle="Pedidos registrados no piloto." />
          <div className="p-5">
            <DonutChart
              data={data.topicDemand.map((topic) => ({ label: topic.name, value: topic.total, color: topic.color }))}
              total={data.topicDemand.reduce((sum, topic) => sum + topic.total, 0)}
              caption="Pedidos por tópico"
            />
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            title="Carga dos monitores"
            subtitle="Horas comprometidas na semana vs. capacidade."
            action={
              <Chip tone="accent">
                <TrendingUp className="size-3" /> equilíbrio
              </Chip>
            }
          />
          <div className="p-5">
            <HBars
              rows={data.monitors
                .slice()
                .sort((a, b) => b.weeklyHours / b.capacityHours - a.weeklyHours / a.capacityHours)
                .slice(0, 5)
                .map((monitor) => ({
                  label: monitor.name,
                  value: monitor.weeklyHours,
                  max: monitor.capacityHours,
                  hint: `${monitor.capacityHours} h de capacidade · ${monitor.sessions} sessões`,
                }))}
              suffix="h"
            />
            <div className="mt-4 flex items-center justify-between rounded-[12px] bg-surface-muted px-3 py-2">
              <span className="text-[11.5px] text-ink-soft">Meta de pareamento em 48 h</span>
              <div className="w-28">
                <ProgressBar value={data.stats.matchedUnder48h} />
              </div>
            </div>
          </div>
        </Panel>
      </div>

      {role !== "coordinator" ? (
        <Panel className="mt-3">
          <PanelHeader title="Como o Elo escolhe o monitor" subtitle="Transparência do pareamento, componente por componente." />
          <div className="grid gap-3 p-5 sm:grid-cols-4">
            {[
              { label: "Afinidade", value: 0.4, detail: "domina o tópico" },
              { label: "Horário", value: 0.3, detail: "janela em comum" },
              { label: "Avaliação", value: 0.2, detail: "média recebida" },
              { label: "Carga", value: 0.1, detail: "evita sobrecarga" },
            ].map((item) => (
              <div key={item.label}>
                <MiniRing value={item.value} label={`${item.label} · ${item.detail}`} />
              </div>
            ))}
          </div>
        </Panel>
      ) : (
        <Panel className="mt-3">
          <PanelHeader title="Monitores em destaque" subtitle="Quem mais atendeu e quem está disponível agora." />
          <div className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-4">
            {data.monitors.slice(0, 4).map((monitor) => (
              <div key={monitor.id} className="flex items-center gap-2.5 rounded-[14px] border border-line p-2.5">
                <Avatar name={monitor.name} color={monitor.color} size="sm" />
                <div className="min-w-0">
                  <p className="truncate text-[12.5px] font-medium text-ink">{monitor.name}</p>
                  <p className="truncate text-[11px] text-ink-soft">
                    {monitor.topics.length} tópicos · {monitor.rating.toFixed(1)}★
                  </p>
                </div>
                {monitor.online ? <span className="live-dot ml-auto size-2 shrink-0 rounded-full bg-accent" /> : null}
              </div>
            ))}
          </div>
        </Panel>
      )}

      <NewRequestDialog
        open={newOpen}
        onClose={() => setNewOpen(false)}
        students={data.students}
        topics={data.topics}
        defaultStudentId={role === "student" ? meStudent?.id : undefined}
      />
    </>
  );
}

function DashboardSkeleton() {
  return (
    <>
      <div className="mb-5 space-y-2">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-8 w-64" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-[118px] rounded-[20px]" />
        ))}
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <Skeleton className="h-[248px] rounded-[20px] lg:col-span-2" />
        <Skeleton className="h-[248px] rounded-[20px]" />
      </div>
    </>
  );
}
