/**
 * Modelo de domínio do Elo.
 *
 * Espelha o contrato que o `lib/api.ts` entrega à interface — trocar o backend
 * (Postgres/Supabase) significa reescrever a camada de servidor e este contrato,
 * nunca os componentes.
 */

export type AccentKey = "green" | "ocean" | "plum" | "rose" | "amber";

export type PastelKey = "peach" | "blue" | "sage" | "sand" | "lilac";

/**
 * Papel de quem está usando o Elo. Ainda não há login: o usuário é escolhido
 * no menu do topo e vale para o navegador (ver `lib/current-user.ts`).
 */
export type Role = "student" | "monitor" | "coordinator";

/* ------------------------------- catálogo -------------------------------- */

export interface Topic {
  id: string;
  name: string;
  /** componente curricular a que o tópico pertence */
  component: string;
  color: PastelKey;
}

/** janela de disponibilidade: dia da semana (1=seg … 5=sex) + minutos do dia */
export interface Slot {
  day: number;
  start: number;
  end: number;
}

/* --------------------------------- pessoas -------------------------------- */

export interface Student {
  id: string;
  name: string;
  className: string;
  course: string;
  color: PastelKey;
  /** autorização de responsável registrada (menores de 18) */
  guardianConsent: boolean;
}

export type MonitorKind = "bolsista" | "voluntario";

export interface Monitor {
  id: string;
  name: string;
  className: string;
  kind: MonitorKind;
  /** tópicos que domina, com nível autodeclarado/validado de 1 a 5 */
  topics: { topicId: string; level: number }[];
  availability: Slot[];
  rating: number;
  ratingCount: number;
  sessions: number;
  /** horas já comprometidas na semana corrente */
  weeklyHours: number;
  /** teto semanal de atendimentos, para evitar sobrecarga */
  capacityHours: number;
  color: PastelKey;
  online: boolean;
  bio: string;
}

/* --------------------------------- pedidos -------------------------------- */

export type RequestStatus = "open" | "matched" | "scheduled" | "done" | "cancelled";
export type Urgency = "low" | "normal" | "high";

export interface HelpRequest {
  id: string;
  studentId: string;
  topicId: string;
  /** o que o estudante não entendeu, em uma frase */
  note: string;
  urgency: Urgency;
  status: RequestStatus;
  createdAt: string;
  /** janelas em que o estudante pode ser atendido */
  preferred: Slot[];
  /** preenchido quando há pareamento */
  monitorId?: string;
  matchedAt?: string;
  sessionId?: string;
  closedAt?: string;
}

export interface Session {
  id: string;
  requestId: string;
  monitorId: string;
  studentId: string;
  topicId: string;
  startsAt: string;
  minutes: number;
  attendance: "present" | "absent";
  /** 1..5 — avaliação do atendimento pelo estudante */
  rating?: number;
  notes?: string;
}

/* ------------------------------ pareamento -------------------------------- */

export interface PairingWeights {
  topic: number;
  availability: number;
  rating: number;
  load: number;
}

export interface MatchBreakdown {
  topic: number;
  availability: number;
  rating: number;
  load: number;
}

export interface Match {
  monitorId: string;
  score: number;
  breakdown: MatchBreakdown;
  /** frases prontas para a interface ("domina o tópico", "2 h de sobreposição"…) */
  reasons: string[];
  tieBreak: number;
}

/* ------------------------------- agregados -------------------------------- */

export interface Indicator {
  key: string;
  label: string;
  target: string;
  value: string;
  /** 0..1 — progresso rumo à meta, quando a meta é numérica */
  progress: number | null;
  hint: string;
}

export interface DashboardSummary {
  stats: {
    open: number;
    matched: number;
    scheduled: number;
    done: number;
    total: number;
    matchedUnder48h: number;
    medianMatchHours: number;
    hoursThisMonth: number;
    reach: number;
    satisfaction: number;
  };
  requests: HelpRequest[];
  monitors: Monitor[];
  topicDemand: { topicId: string; name: string; color: PastelKey; total: number; unserved: number }[];
  weekly: { label: string; current: number; previous: number }[];
  upcoming: Session[];
  todaySessions: Session[];
  students: Student[];
  topics: Topic[];
  alerts: { id: string; tone: "danger" | "warn" | "info"; title: string; detail: string }[];
}

export interface ReportPayload {
  indicators: Indicator[];
  hoursByMonitor: {
    monitorId: string;
    name: string;
    color: PastelKey;
    sessions: number;
    minutes: number;
    hours: number;
    lastReportAt: string | null;
  }[];
  demandByTopic: { topicId: string; name: string; color: PastelKey; total: number; unserved: number; avgWaitHours: number }[];
  sla: { bucket: string; count: number }[];
  satisfaction: { score: number; count: number }[];
}

export interface Settings {
  weights: PairingWeights;
  role: Role;
  accent: AccentKey;
  theme: "light" | "dark";
  /** consentimento e minimização (LGPD) */
  consentRequired: boolean;
  guardianConsentRequired: boolean;
  aggregateOnly: boolean;
  retentionDays: number;
}

/**
 * Conta da coordenação. Começa em branco (sem pessoa fictícia) e é preenchida
 * em Configurações → Meu perfil.
 */
export interface DemoProfile {
  id: string;
  /** vazio até a coordenação preencher o próprio nome */
  name: string;
  role: Role;
  className: string;
  email: string;
  campus: string;
  coordinatorView: boolean;
}
