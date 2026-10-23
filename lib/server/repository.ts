import { matchHours, rankMonitors, slaBucket } from "../pairing";
import type {
  DashboardSummary,
  HelpRequest,
  Indicator,
  Match,
  ReportPayload,
  Settings,
  DemoProfile,
} from "../types";
import type { Database } from "./seed";

/* --------------------------------- helpers -------------------------------- */

function startOfWeek(date: Date) {
  const copy = new Date(date);
  const offset = (copy.getDay() + 6) % 7; // segunda = 0
  copy.setDate(copy.getDate() - offset);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function topicName(db: Database, topicId: string) {
  return db.topics.find((topic) => topic.id === topicId)?.name ?? topicId;
}

function canServe(db: Database, topicId: string) {
  return db.monitors.filter((monitor) =>
    monitor.topics.some((topic) => topic.topicId === topicId && topic.level >= 3),
  );
}

/* --------------------------------- pedidos -------------------------------- */

export function listRequests(db: Database) {
  return [...db.requests].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
}

export function findRequest(db: Database, id: string) {
  return db.requests.find((request) => request.id === id) ?? null;
}

export function matchesFor(db: Database, request: HelpRequest): Match[] {
  return rankMonitors(request, db.monitors, db.settings.weights);
}

/* -------------------------------- dashboard ------------------------------- */

export function getDashboard(db: Database, now = new Date()): DashboardSummary {
  const requests = db.requests;
  const sessions = db.sessions;

  const open = requests.filter((request) => request.status === "open").length;
  const matched = requests.filter((request) => request.status === "matched").length;
  const scheduled = requests.filter((request) => request.status === "scheduled").length;
  const done = requests.filter((request) => request.status === "done").length;

  const paired = requests.filter((request) => request.matchedAt);
  const pairedWithin48 = paired.filter((request) => matchHours(request, +now) <= 48).length;
  const matchTimes = paired.map((request) => matchHours(request, +now));

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const hoursThisMonth = sessions
    .filter((session) => new Date(session.startsAt) >= monthStart && new Date(session.startsAt) <= now)
    // falta não vira hora de monitoria
    .reduce((sum, session) => sum + (session.attendance === "absent" ? 0 : session.minutes), 0);

  const reachStudents = new Set(requests.map((request) => request.studentId)).size;
  const rated = sessions.filter((session) => typeof session.rating === "number");
  const satisfaction = rated.length
    ? rated.reduce((sum, session) => sum + (session.rating ?? 0), 0) / rated.length
    : 0;

  // série semanal — 4 semanas, atual vs. período anterior
  const currentWeek = startOfWeek(now);
  const weekly = Array.from({ length: 4 }, (_, index) => {
    const start = new Date(currentWeek);
    start.setDate(start.getDate() - 7 * (3 - index));
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    const previousStart = new Date(start);
    previousStart.setDate(previousStart.getDate() - 28);
    const previousEnd = new Date(previousStart);
    previousEnd.setDate(previousEnd.getDate() + 7);

    const count = (from: Date, to: Date) =>
      sessions.filter((session) => {
        const at = new Date(session.startsAt);
        return at >= from && at < to;
      }).length;

    return {
      label: `${String(start.getDate()).padStart(2, "0")}/${String(start.getMonth() + 1).padStart(2, "0")}`,
      current: count(start, end),
      previous: count(previousStart, previousEnd),
    };
  });

  const topicDemand = db.topics.map((topic) => {
    const all = requests.filter((request) => request.topicId === topic.id);
    const unserved = all.filter(
      (request) =>
        (request.status === "open" || request.status === "matched") && canServe(db, topic.id).length === 0,
    ).length;
    return { topicId: topic.id, name: topic.name, color: topic.color, total: all.length, unserved };
  });

  const upcoming = sessions
    .filter((session) => new Date(session.startsAt) >= now)
    .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt))
    .slice(0, 5);

  const todaySessions = sessions.filter((session) => {
    const at = new Date(session.startsAt);
    return at.toDateString() === now.toDateString();
  });

  const alerts: DashboardSummary["alerts"] = [];

  const stale = requests.filter(
    (request) => request.status === "open" && matchHours(request, +now) > 48,
  );
  if (stale.length > 0) {
    alerts.push({
      id: "stale",
      tone: "warn",
      title: `${stale.length} pedido${stale.length > 1 ? "s" : ""} aberto${stale.length > 1 ? "s" : ""} há mais de 48 h`,
      detail: "O indicador do piloto pede pareamento em até 48 horas. Vale checar a fila de monitores.",
    });
  }

  const overloaded = db.monitors.filter((monitor) => monitor.weeklyHours / monitor.capacityHours >= 0.85);
  if (overloaded.length > 0) {
    alerts.push({
      id: "load",
      tone: "info",
      title: `${overloaded.length} monitor${overloaded.length > 1 ? "es" : ""} com agenda acima de 85%`,
      detail: "O algoritmo penaliza carga, mas a fila pode travar se nenhum monitor tiver folga.",
    });
  }

  const unservedTopics = topicDemand.filter((topic) => topic.unserved > 0);
  if (unservedTopics.length > 0) {
    alerts.push({
      id: "unserved",
      tone: "danger",
      title: `Demanda sem monitor em ${unservedTopics.map((topic) => topic.name).join(", ")}`,
      detail: "Há pedidos abertos em tópicos sem monitor de nível 3 ou superior.",
    });
  }

  return {
    stats: {
      open,
      matched,
      scheduled,
      done,
      total: requests.length,
      matchedUnder48h: paired.length ? pairedWithin48 / paired.length : 0,
      medianMatchHours: median(matchTimes),
      hoursThisMonth,
      reach: reachStudents / Math.max(1, db.students.length),
      satisfaction,
    },
    requests: listRequests(db).slice(0, 8),
    monitors: db.monitors,
    topicDemand,
    weekly,
    upcoming,
    todaySessions,
    students: db.students,
    topics: db.topics,
    alerts: alerts.slice(0, 3),
  };
}

/* -------------------------------- relatórios ------------------------------ */

export function getReports(db: Database, now = new Date()): ReportPayload {
  const sessions = db.sessions;
  const requests = db.requests;
  const paired = requests.filter((request) => request.matchedAt);

  const positive = sessions.filter((session) => (session.rating ?? 0) >= 4).length;
  const rated = sessions.filter((session) => typeof session.rating === "number").length;
  const positiveRate = rated ? positive / rated : 0;
  const within48 = paired.filter((request) => matchHours(request, +now) <= 48).length;
  const within48Rate = paired.length ? within48 / paired.length : 0;
  const reach = new Set(requests.map((request) => request.studentId)).size / Math.max(1, db.students.length);

  const indicators: Indicator[] = [
    {
      key: "requests",
      label: "Pedidos registrados no piloto",
      target: "≥ 30",
      value: String(requests.length),
      progress: Math.min(1, requests.length / 30),
      hint: "Meta de referência do projeto (Parte 3).",
    },
    {
      key: "sla",
      label: "Pedidos pareados em até 48 h",
      target: "≥ 70%",
      value: `${Math.round(within48Rate * 100)}%`,
      progress: within48Rate / 0.7,
      hint: "Conta apenas pedidos que já receberam monitor.",
    },
    {
      key: "median",
      label: "Tempo mediano até o pareamento",
      target: "≤ 24 h",
      value: `${median(paired.map((request) => matchHours(request, +now))).toFixed(1).replace(".", ",")} h`,
      progress: null,
      hint: "Da abertura do pedido até a confirmação do monitor.",
    },
    {
      key: "satisfaction",
      label: "Satisfação positiva dos atendidos",
      target: "≥ 80%",
      value: `${Math.round(positiveRate * 100)}%`,
      progress: positiveRate / 0.8,
      hint: "Sessões avaliadas com nota 4 ou 5.",
    },
    {
      key: "reports",
      label: "Monitores com relatório automático",
      target: "100%",
      value: "100%",
      progress: 1,
      hint: "Toda sessão registrada gera horas no relatório do monitor.",
    },
    {
      key: "reach",
      label: "Estudantes com ao menos 1 pedido",
      target: "≥ 50%",
      value: `${Math.round(reach * 100)}%`,
      progress: reach / 0.5,
      hint: "Alcance dentro das turmas do piloto.",
    },
  ];

  const hoursByMonitor = db.monitors
    .map((monitor) => {
      const mine = sessions.filter((session) => session.monitorId === monitor.id);
      const minutes = mine.reduce((sum, session) => sum + (session.attendance === "absent" ? 0 : session.minutes), 0);
      const last = mine
        .map((session) => session.startsAt)
        .sort((a, b) => +new Date(b) - +new Date(a))[0] ?? null;

      return {
        monitorId: monitor.id,
        name: monitor.name,
        color: monitor.color,
        sessions: mine.length,
        minutes,
        hours: minutes / 60,
        lastReportAt: last,
      };
    })
    .sort((a, b) => b.minutes - a.minutes);

  const demandByTopic = db.topics.map((topic) => {
    const all = requests.filter((request) => request.topicId === topic.id);
    const openOnes = all.filter((request) => request.status === "open" || request.status === "matched");
    const waits = all
      .filter((request) => request.matchedAt)
      .map((request) => matchHours(request, +now));
    return {
      topicId: topic.id,
      name: topic.name,
      color: topic.color,
      total: all.length,
      unserved: openOnes.filter(() => canServe(db, topic.id).length === 0).length,
      avgWaitHours: waits.length ? waits.reduce((sum, value) => sum + value, 0) / waits.length : 0,
    };
  });

  const buckets = ["até 24 h", "24–48 h", "48–96 h", "mais de 96 h"];
  const slaMap = new Map(buckets.map((bucket) => [bucket, 0]));
  paired.forEach((request) => {
    const bucket = slaBucket(matchHours(request, +now));
    slaMap.set(bucket, (slaMap.get(bucket) ?? 0) + 1);
  });

  const satisfaction = [1, 2, 3, 4, 5].map((score) => ({
    score,
    count: sessions.filter((session) => session.rating === score).length,
  }));

  return {
    indicators,
    hoursByMonitor,
    demandByTopic,
    sla: buckets.map((bucket) => ({ bucket, count: slaMap.get(bucket) ?? 0 })),
    satisfaction,
  };
}

/* ------------------------------- mutações -------------------------------- */

export function nextId(prefix: string, existing: { id: string }[]) {
  const max = existing.reduce((acc, item) => {
    const numeric = Number(item.id.replace(/\D/g, ""));
    return Number.isFinite(numeric) ? Math.max(acc, numeric) : acc;
  }, 0);
  return `${prefix}${String(max + 1).padStart(2, "0")}`;
}

export function topicLabel(db: Database, topicId: string) {
  return topicName(db, topicId);
}

export type { Settings, DemoProfile };
