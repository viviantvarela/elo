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
  UserRoundPen,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { AreaTrend, DonutChart, HBars, MiniRing } from "@/components/charts";
import { PageHeader } from "@/components/page-header";
import { NewRequestDialog } from "@/components/requests/new-request-dialog";
import { RequestRow } from "@/components/requests/request-row";
import { SessionRow } from "@/components/session-row";
import { StatCard } from "@/components/stat-card";
import { Avatar, Button, Chip, EmptyState, Panel, PanelHeader, ProgressBar, Skeleton } from "@/components/ui";
import { api } from "@/lib/api";
import { canAccess, defaultWeights, monitorKindLabels } from "@/lib/constants";
import { shortName, useCurrentUser, visibleRequests, visibleSessions } from "@/lib/current-user";
import { dayLabel, timeLabel } from "@/lib/format";
import { matchHours, scoreMonitor } from "@/lib/pairing";
import type { HelpRequest, Session } from "@/lib/types";
import { cn, formatHours } from "@/lib/utils";

interface Notice {
  id: string;
  tone: "danger" | "warn" | "info" | "accent";
  title: string;
  detail: string;
  href?: string;
}

const linkButton =
  "inline-flex h-9.5 items-center gap-2 rounded-full px-4 text-[13px] font-medium transition-colors";

function startOfWeek(date: Date) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() - ((copy.getDay() + 6) % 7));
  copy.setHours(0, 0, 0, 0);
  return copy;
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

export default function PainelPage() {
  const { user } = useCurrentUser();
  const dashboard = useQuery({ queryKey: ["dashboard"], queryFn: api.getDashboard });
  const requests = useQuery({ queryKey: ["requests"], queryFn: api.listRequests });
  const sessions = useQuery({ queryKey: ["sessions"], queryFn: api.listSessions });
  const [newOpen, setNewOpen] = useState(false);

  const role = user?.role ?? "coordinator";
  const personal = role !== "coordinator";

  if (dashboard.isLoading || !user || (personal && (requests.isLoading || sessions.isLoading))) {
    return <DashboardSkeleton />;
  }

  const data = dashboard.data;
  if (dashboard.isError || !data || (personal && (!requests.data || !sessions.data))) {
    return (
      <Panel>
        <EmptyState
          title="Não foi possível carregar o painel"
          detail="Recarregue a página. Se o problema persistir, restaure a base de demonstração em Configurações."
        />
      </Panel>
    );
  }

  /* ----------------------------- dados pessoais ---------------------------- */

  const now = Date.now();
  const allRequests = requests.data?.requests ?? data.requests;
  const weights = requests.data?.weights ?? defaultWeights;
  const mine = visibleRequests(allRequests, user);
  const mySessions = visibleSessions(sessions.data ?? [], user);

  const requestById = new Map(allRequests.map((request) => [request.id, request]));
  const topicName = (id: string) => data.topics.find((topic) => topic.id === id)?.name ?? "Tópico";
  const monitorById = (id?: string) => data.monitors.find((monitor) => monitor.id === id);
  const studentById = (id?: string) => data.students.find((student) => student.id === id);

  /** sessão que já aconteceu mas ainda não foi registrada */
  const awaitingRegistration = (session: Session) => {
    const request = requestById.get(session.requestId);
    return +new Date(session.startsAt) < now && request?.status === "scheduled" && request.sessionId === session.id;
  };
  const upcomingMine = mySessions
    .filter((session) => +new Date(session.startsAt) >= now)
    .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));

  // estudante
  const openMine = mine.filter((request) => request.status === "open" || request.status === "matched");
  const doneMine = mine.filter((request) => request.status === "done");
  const minutesReceived = mySessions
    .filter((session) => +new Date(session.startsAt) < now && session.attendance !== "absent" && !awaitingRegistration(session))
    .reduce((sum, session) => sum + session.minutes, 0);

  // monitor
  const meMonitor = user.monitor;
  const weekStart = startOfWeek(new Date());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekSessions = mySessions.filter((session) => {
    const at = new Date(session.startsAt);
    return at >= weekStart && at < weekEnd;
  });
  const topicOpen = meMonitor
    ? mine
        .filter((request) => request.status === "open")
        .map((request) => ({ request, score: scoreMonitor(request, meMonitor, weights).score }))
        .sort((a, b) => b.score - a.score)
    : [];
  const load = meMonitor && meMonitor.capacityHours > 0 ? meMonitor.weeklyHours / meMonitor.capacityHours : 0;

  /* --------------------------------- avisos -------------------------------- */

  const notices: Notice[] = [];
  if (role === "student") {
    for (const session of upcomingMine.filter((item) => +new Date(item.startsAt) - now < 7 * 864e5)) {
      notices.push({
        id: `next-${session.id}`,
        tone: "accent",
        title: `Atendimento ${dayLabel(session.startsAt)} às ${timeLabel(session.startsAt)}`,
        detail: `${topicName(session.topicId)} com ${shortName(monitorById(session.monitorId)?.name ?? "monitor")} · ${session.minutes} min`,
        href: `/pedidos?id=${session.requestId}`,
      });
    }
    for (const request of openMine) {
      const topic = topicName(request.topicId);
      if (request.status === "matched") {
        notices.push({
          id: `matched-${request.id}`,
          tone: "info",
          title: `${shortName(monitorById(request.monitorId)?.name ?? "Um monitor")} vai te atender em ${topic}`,
          detail: "O horário sai de uma das janelas que você marcou.",
          href: `/pedidos?id=${request.id}`,
        });
      } else {
        const hours = matchHours(request, now);
        notices.push({
          id: `open-${request.id}`,
          tone: hours > 48 ? "warn" : "info",
          title: hours > 48 ? `Pedido de ${topic} aberto há ${Math.floor(hours)} h` : `Pedido de ${topic} na fila`,
          detail:
            hours > 48
              ? "Ainda sem monitor. A coordenação acompanha pedidos parados há mais de 48 h."
              : "Os monitores do tópico já podem ver e aceitar.",
          href: `/pedidos?id=${request.id}`,
        });
      }
    }
  }

  if (role === "monitor" && meMonitor) {
    const toRegister = mySessions.filter(awaitingRegistration);
    if (toRegister.length > 0) {
      notices.push({
        id: "register",
        tone: "danger",
        title: `${plural(toRegister.length, "atendimento", "atendimentos")} para registrar`,
        detail: "Registre presença e avaliação para as horas entrarem no seu relatório.",
        href: "/agenda",
      });
    }
    const accepted = mine.filter((request) => request.status === "matched" && request.monitorId === meMonitor.id);
    if (accepted.length > 0) {
      notices.push({
        id: "accepted",
        tone: "warn",
        title: `${plural(accepted.length, "pedido aceito", "pedidos aceitos")} sem horário`,
        detail: "Escolha uma janela do estudante para agendar o atendimento.",
        href: `/pedidos?id=${accepted[0].id}`,
      });
    }
    const next = upcomingMine[0];
    if (next && +new Date(next.startsAt) - now < 2 * 864e5) {
      notices.push({
        id: `next-${next.id}`,
        tone: "accent",
        title: `Próximo atendimento ${dayLabel(next.startsAt)} às ${timeLabel(next.startsAt)}`,
        detail: `${topicName(next.topicId)} com ${shortName(studentById(next.studentId)?.name ?? "estudante")}`,
        href: `/pedidos?id=${next.requestId}`,
      });
    }
    if (topicOpen.length > 0) {
      notices.push({
        id: "queue",
        tone: "info",
        title: `${plural(topicOpen.length, "pedido aberto", "pedidos abertos")} nos seus tópicos`,
        detail: "O primeiro da lista é o que mais combina com você.",
        href: `/pedidos?id=${topicOpen[0].request.id}`,
      });
    }
    if (load >= 0.85) {
      notices.push({
        id: "load",
        tone: "info",
        title: `Sua agenda está em ${Math.round(load * 100)}% da capacidade`,
        detail: "Com a agenda cheia, o algoritmo passa a sugerir outros monitores primeiro.",
      });
    }
  }

  /* ------------------------------- cabeçalho ------------------------------- */

  const eyebrow =
    role === "coordinator"
      ? "Painel da coordenação"
      : role === "student"
        ? `Estudante · ${user.student?.className ?? ""}`
        : `Monitor · ${meMonitor ? monitorKindLabels[meMonitor.kind] : ""}`;

  const greeting = role === "coordinator" && !user.firstName ? "Painel do piloto" : `Olá, ${user.firstName}`;

  const subtitle =
    role === "coordinator"
      ? `${user.coordinator?.campus || "IFRN — Campus Parnamirim"} · acompanhe demanda, tempo de pareamento e horas registradas.`
      : role === "student"
        ? "Peça ajuda por tópico, escolha os horários possíveis e acompanhe cada atendimento."
        : "Veja o que combina com a sua agenda, registre sessões e acompanhe suas horas.";

  const listRequestsForRole: { request: HelpRequest; meta?: string }[] =
    role === "student"
      ? mine.map((request) => {
          const monitor = monitorById(request.monitorId);
          return {
            request,
            meta: monitor
              ? `com ${shortName(monitor.name)}`
              : request.status === "cancelled"
                ? "cancelado"
                : "aguardando monitor",
          };
        })
      : role === "monitor"
        ? topicOpen.map(({ request, score }) => ({ request, meta: `score ${score}/100` }))
        : data.requests.map((request) => ({ request }));

  const upcomingForRole = personal ? upcomingMine : data.upcoming;
  const weightSum = weights.topic + weights.availability + weights.rating + weights.load || 1;
  const monitorTopics = meMonitor?.topics.map((entry) => topicName(entry.topicId)).join(", ") ?? "";

  return (
    <>
      <PageHeader
        eyebrow={eyebrow}
        title={greeting}
        subtitle={subtitle}
        actions={
          <>
            {canAccess("/relatorios", role) ? (
              <Link href="/relatorios" className={cn(linkButton, "border border-line bg-surface text-ink hover:bg-surface-muted")}>
                <TrendingUp className="size-3.5" /> Relatórios
              </Link>
            ) : null}
            {role === "monitor" ? (
              <Link href="/pedidos" className={cn(linkButton, "bg-accent text-white hover:bg-accent-strong")}>
                <HandHeart className="size-4" /> Pedidos para você
              </Link>
            ) : (
              <Button onClick={() => setNewOpen(true)}>
                <Plus className="size-4" /> Novo pedido
              </Button>
            )}
          </>
        }
      />

      {user.incomplete ? (
        <Link
          href="/configuracoes#perfil"
          className="mb-3 flex items-center gap-3 rounded-[16px] bg-warn-soft px-4 py-3 ring-1 ring-inset ring-warn/20 transition-[filter] hover:brightness-[0.98]"
        >
          <UserRoundPen className="size-4 shrink-0 text-warn" />
          <p className="min-w-0 flex-1 text-[12.5px] leading-snug text-ink">
            <span className="font-medium">Complete seu perfil.</span> Adicione seu nome e e-mail para se identificar no
            Elo — hoje o topo mostra só “Coordenação”.
          </p>
          <span className="flex shrink-0 items-center gap-1 text-[12px] font-medium text-ink">
            Completar <ArrowRight className="size-3.5" />
          </span>
        </Link>
      ) : null}

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
          <StatCard
            label="Seus pedidos abertos"
            value={openMine.length}
            hint={`${openMine.filter((request) => request.status === "open").length} aguardando · ${openMine.filter((request) => request.status === "matched").length} em pareamento`}
            icon={LifeBuoy}
            tone={openMine.length > 0 ? "warn" : "neutral"}
            index={0}
          />
          <StatCard
            label="Atendimentos concluídos"
            value={doneMine.length}
            hint="Sessões registradas"
            icon={CheckCircle2}
            tone="accent"
            index={1}
          />
          <StatCard
            label="Próximo atendimento"
            value={upcomingMine[0] ? dayLabel(upcomingMine[0].startsAt) : "—"}
            hint={
              upcomingMine[0]
                ? `${timeLabel(upcomingMine[0].startsAt)} · com ${shortName(monitorById(upcomingMine[0].monitorId)?.name ?? "monitor")}`
                : "nenhum agendado"
            }
            icon={CalendarClock}
            index={2}
          />
          <StatCard
            label="Suas horas de apoio"
            value={formatHours(minutesReceived)}
            unit="h"
            hint="Desde o início do piloto"
            icon={TrendingUp}
            index={3}
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label="Atendimentos na semana"
            value={weekSessions.length}
            hint={`${plural(weekSessions.filter((session) => +new Date(session.startsAt) < now).length, "realizado", "realizados")} · ${weekSessions.filter((session) => +new Date(session.startsAt) >= now).length} por vir`}
            icon={HandHeart}
            tone="accent"
            index={0}
          />
          <StatCard
            label="Suas horas"
            value={formatHours((meMonitor?.weeklyHours ?? 0) * 60)}
            unit="h"
            hint={`de ${meMonitor?.capacityHours ?? 0} h de capacidade na semana`}
            icon={AlarmClock}
            tone={load >= 0.85 ? "warn" : "neutral"}
            index={1}
          />
          <StatCard
            label="Sua avaliação"
            value={(meMonitor?.rating ?? 0).toFixed(1).replace(".", ",")}
            unit="/ 5"
            hint={plural(meMonitor?.ratingCount ?? 0, "avaliação", "avaliações")}
            icon={Star}
            index={2}
          />
          <StatCard
            label="Pedidos nos seus tópicos"
            value={topicOpen.length}
            hint="Aguardando monitor"
            icon={Sparkles}
            tone={topicOpen.length > 0 ? "warn" : "neutral"}
            index={3}
          />
        </div>
      )}

      {/* -------------------------------- row 2 ------------------------------ */}
      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
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
          <PanelHeader
            title={role === "coordinator" ? "Pontos de atenção" : "Seus avisos"}
            subtitle={role === "coordinator" ? "O que pede decisão da coordenação." : "O que pede sua atenção agora."}
          />
          <div className="space-y-2 p-3">
            {role === "coordinator" ? (
              data.alerts.length === 0 ? (
                <EmptyState title="Nada pendente" detail="Fila de pareamento em dia." />
              ) : (
                data.alerts.map((alert) => <NoticeItem key={alert.id} notice={alert} />)
              )
            ) : notices.length === 0 ? (
              <EmptyState
                title="Tudo em dia"
                detail={
                  role === "student"
                    ? "Quando houver novidade nos seus pedidos, ela aparece aqui."
                    : "Sem pendências. Novos pedidos nos seus tópicos aparecem aqui."
                }
              />
            ) : (
              notices.slice(0, 4).map((notice) => <NoticeItem key={notice.id} notice={notice} />)
            )}
            <Link
              href="/pedidos"
              className="flex items-center justify-between rounded-[12px] px-2.5 py-2 text-[12px] font-medium text-accent-strong transition-colors hover:bg-accent-tint"
            >
              {role === "student" ? "Abrir meus pedidos" : role === "monitor" ? "Abrir pedidos para você" : "Abrir fila de pedidos"}{" "}
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </Panel>
      </div>

      {/* -------------------------------- row 3 ------------------------------ */}
      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelHeader
            title={role === "student" ? "Seus pedidos" : role === "monitor" ? "Pedidos que combinam com você" : "Fila de pedidos"}
            subtitle={
              role === "student"
                ? "Do mais recente para o mais antigo."
                : role === "monitor"
                  ? `Abertos nos seus tópicos${monitorTopics ? ` (${monitorTopics})` : ""}, do mais compatível para o menos.`
                  : "Os mais recentes, com status e tópico."
            }
            action={
              <Link href="/pedidos" className="text-[12px] font-medium text-accent-strong hover:underline">
                Ver todos
              </Link>
            }
          />
          <div className="p-1.5">
            {listRequestsForRole.slice(0, 6).map(({ request, meta }) => (
              <RequestRow
                key={request.id}
                request={request}
                student={studentById(request.studentId)}
                topic={data.topics.find((topic) => topic.id === request.topicId)}
                meta={meta}
                href={`/pedidos?id=${request.id}`}
                compact
              />
            ))}
            {listRequestsForRole.length === 0 ? (
              <EmptyState
                title={
                  role === "student"
                    ? "Você ainda não fez pedidos"
                    : role === "monitor"
                      ? "Nenhum pedido aberto nos seus tópicos"
                      : "Nenhum pedido por aqui"
                }
                detail={
                  role === "student"
                    ? "Conte o que ficou confuso e quando você pode: o Elo encontra um monitor para te ajudar."
                    : role === "monitor"
                      ? "Quando um estudante pedir ajuda nos seus tópicos, o pedido aparece aqui."
                      : "Quando alguém pedir ajuda, o pedido aparece nesta lista."
                }
                action={
                  role === "student" ? (
                    <Button onClick={() => setNewOpen(true)}>
                      <Plus className="size-4" /> Novo pedido
                    </Button>
                  ) : undefined
                }
              />
            ) : null}
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            title={personal ? "Seus próximos atendimentos" : "Próximos atendimentos"}
            subtitle={personal ? "Sessões já agendadas." : "Sessões confirmadas pela plataforma."}
            action={
              <Link href="/agenda" className="text-[12px] font-medium text-accent-strong hover:underline">
                Agenda
              </Link>
            }
          />
          <div className="space-y-0.5 p-1.5">
            {upcomingForRole.length === 0 ? (
              <EmptyState
                title={personal ? "Nenhum atendimento marcado" : "Sem sessões agendadas"}
                detail={
                  role === "student"
                    ? "Quando um monitor agendar seu atendimento, ele aparece aqui."
                    : role === "monitor"
                      ? "Aceite um pedido e escolha o horário para agendar."
                      : "Pareie um pedido para criar a primeira."
                }
              />
            ) : (
              upcomingForRole.slice(0, 4).map((session) => {
                const student = studentById(session.studentId);
                return (
                  <SessionRow
                    key={session.id}
                    session={session}
                    monitor={monitorById(session.monitorId)}
                    topic={data.topics.find((topic) => topic.id === session.topicId)}
                    counterpart={role === "monitor" && student ? { name: student.name, color: student.color } : null}
                    href={`/pedidos?id=${session.requestId}`}
                  />
                );
              })
            )}
          </div>
        </Panel>
      </div>

      {/* -------------------------------- row 4 ------------------------------ */}
      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
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

        {role === "coordinator" ? (
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
        ) : (
          <Panel>
            <PanelHeader
              title="Como o Elo escolhe o monitor"
              subtitle="Transparência do pareamento: o peso de cada componente hoje."
            />
            <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2">
              {[
                { label: "Afinidade", value: weights.topic / weightSum, detail: "domina o tópico" },
                { label: "Horário", value: weights.availability / weightSum, detail: "janela em comum" },
                { label: "Avaliação", value: weights.rating / weightSum, detail: "média recebida" },
                { label: "Carga", value: weights.load / weightSum, detail: "evita sobrecarga" },
              ].map((item) => (
                <div key={item.label}>
                  <MiniRing value={item.value} label={`${item.label} · ${item.detail}`} />
                </div>
              ))}
            </div>
          </Panel>
        )}
      </div>

      {role === "coordinator" ? (
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
      ) : null}

      {role !== "monitor" ? (
        <NewRequestDialog
          open={newOpen}
          onClose={() => setNewOpen(false)}
          students={data.students}
          topics={data.topics}
          monitors={data.monitors}
          lockedStudent={role === "student" ? user.student : null}
        />
      ) : null}
    </>
  );
}

function NoticeItem({ notice }: { notice: Notice }) {
  const toneClass =
    notice.tone === "danger"
      ? "text-danger"
      : notice.tone === "warn"
        ? "text-warn"
        : notice.tone === "accent"
          ? "text-accent-strong"
          : "text-info";

  const body = (
    <>
      <span className={cn("mt-0.5", toneClass)}>
        <BellRing className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="text-[12.5px] font-medium leading-snug text-ink">{notice.title}</p>
        <p className="mt-0.5 text-[11.5px] leading-snug text-ink-soft">{notice.detail}</p>
      </div>
    </>
  );

  const className = "flex gap-2.5 rounded-[14px] border border-line bg-surface-muted/60 p-3";
  return notice.href ? (
    <Link href={notice.href} className={cn(className, "transition-colors hover:bg-surface-muted")}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
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
      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Skeleton className="h-[248px] rounded-[20px] lg:col-span-2" />
        <Skeleton className="h-[248px] rounded-[20px]" />
      </div>
    </>
  );
}
