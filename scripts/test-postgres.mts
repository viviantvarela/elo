/**
 * Testa o store Postgres contra um Postgres real (PGlite/WASM):
 * cria o esquema (12 tabelas), semeia, faz round-trip e confere regras de negócio.
 */
import { PGlite } from "@electric-sql/pglite";

import { LEGACY_PROFILE_EMAIL, LEGACY_PROFILE_NAME, migrate } from "../lib/server/migrate";
import {
  applyCompletedSessionToMonitor,
  applySessionRatingToMonitor,
  getDashboard,
  getReports,
  nextId,
  revertCompletedSessionFromMonitor,
} from "../lib/server/repository";
import { createPostgresStore, type Queryable } from "../lib/server/store/postgres";

const client = new PGlite();

const queryable: Queryable = {
  async query<T>(text: string, values?: unknown[]) {
    if (!values && text.includes(";") && text.trim().split(";").filter(Boolean).length > 1) {
      await client.exec(text);
      return { rows: [] as T[] };
    }
    const result = await client.query(text, values as unknown[] | undefined);
    return { rows: result.rows as T[] };
  },
};

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(`FALHOU: ${message}`);
  console.log(`  ok  ${message}`);
}

const store = createPostgresStore(queryable);

console.log("\n1) primeiro acesso cria o esquema (16 tabelas) e semeia");
const db = await store.readDb();
assert(db.topics.length === 6, `6 tópicos (veio ${db.topics.length})`);
assert(db.monitors.length === 8, `8 monitores (veio ${db.monitors.length})`);
assert(db.teachers.length === 4, `4 professores (veio ${db.teachers.length})`);
assert(db.requests.length === 33, `33 pedidos (veio ${db.requests.length})`);
assert(db.sessions.length === 37, `37 sessões (veio ${db.sessions.length})`);
assert(db.alignmentMessages.length > 0, `mensagens de alinhamento semeadas (${db.alignmentMessages.length})`);
assert(db.alignmentMeetings.length === 1, `1 reunião de alinhamento semeada (${db.alignmentMeetings.length})`);

const tables = await client.query<{ table_name: string }>(
  "select table_name from information_schema.tables where table_schema='public' order by table_name",
);
console.log("  tabelas:", tables.rows.map((r) => r.table_name).join(", "));
assert(tables.rows.length === 16, `16 tabelas criadas (veio ${tables.rows.length})`);

const monitorTopics = await client.query<{ count: string }>("select count(*)::text as count from elo_monitor_topics");
assert(Number(monitorTopics.rows[0].count) === 15, `15 vínculos monitor↔tópico (veio ${monitorTopics.rows[0].count})`);

console.log("\n2) não duplica a semente numa segunda leitura");
const again = await store.readDb();
assert(again.requests.length === db.requests.length, "mesma quantidade de pedidos");

console.log("\n3) relatórios não contabilizam sessões futuras ainda não concluídas");
const initialReports = getReports(db);
const initialMinutes = initialReports.hoursByMonitor.reduce((sum, row) => sum + row.minutes, 0);

const afterSchedule = await store.updateDb((draft) => {
  const reqId = nextId("r", draft.requests);
  const sessId = nextId("s", draft.sessions);
  draft.requests.unshift({
    id: reqId,
    studentId: "a1",
    topicId: "mat",
    note: "Dúvida em funções quadráticas",
    urgency: "high",
    status: "scheduled",
    createdAt: new Date().toISOString(),
    matchedAt: new Date().toISOString(),
    monitorId: "m1",
    sessionId: sessId,
    preferred: [{ day: 3, start: 780, end: 840 }],
  });
  draft.sessions.push({
    id: sessId,
    requestId: reqId,
    monitorId: "m1",
    studentId: "a1",
    topicId: "mat",
    startsAt: new Date(Date.now() + 3 * 86_400_000).toISOString(),
    minutes: 90,
    attendance: "present",
    location: "Lab 02 · DIATINF",
  });
  draft.accounts.push({
    email: "ana.lima@escolar.ifrn.edu.br",
    authUserId: "uid-test-1",
    role: "student",
    studentId: "a1",
    createdAt: new Date().toISOString(),
  });
});

const reportsWithFuture = getReports(afterSchedule);
const minutesWithFuture = reportsWithFuture.hoursByMonitor.reduce((sum, row) => sum + row.minutes, 0);
assert(minutesWithFuture === initialMinutes, "sessão futura agendada não inflou horas realizadas no relatório");
assert(afterSchedule.accounts.length === 1, "vínculo elo_accounts persistido e relido");
assert(
  afterSchedule.sessions.some((s) => s.location === "Lab 02 · DIATINF"),
  "campo location da sessão persistido e relido",
);

console.log("\n4) contabilidade do monitor: concluir, reavaliar pelo estudante e estornar ao reabrir");
const targetReq = afterSchedule.requests[0]!;
const m1Before = afterSchedule.monitors.find((m) => m.id === "m1")!;

const afterDone = await store.updateDb((draft) => {
  const r = draft.requests.find((item) => item.id === targetReq.id)!;
  const s = draft.sessions.find((item) => item.id === r.sessionId)!;
  const m = draft.monitors.find((item) => item.id === "m1")!;
  r.status = "done";
  r.closedAt = new Date().toISOString();
  s.rating = 4;
  applyCompletedSessionToMonitor(m, s.minutes, 4);
});
const m1AfterDone = afterDone.monitors.find((m) => m.id === "m1")!;
assert(m1AfterDone.sessions === m1Before.sessions + 1, "sessões incrementadas");
assert(Math.abs(m1AfterDone.weeklyHours - (m1Before.weeklyHours + 1.5)) < 0.01, "weeklyHours incrementado em 1.5h");

const afterRate = await store.updateDb((draft) => {
  const s = draft.sessions.find((item) => item.requestId === targetReq.id)!;
  const m = draft.monitors.find((item) => item.id === "m1")!;
  const prev = s.rating;
  s.rating = 5;
  applySessionRatingToMonitor(m, prev, 5);
});
const m1AfterRate = afterRate.monitors.find((m) => m.id === "m1")!;
assert(m1AfterRate.ratingCount === m1AfterDone.ratingCount, "reavaliação não duplicou ratingCount");
assert(m1AfterRate.rating >= m1AfterDone.rating, "nota 5 elevou ou manteve a média");

const afterRollback = await store.updateDb((draft) => {
  const r = draft.requests.find((item) => item.id === targetReq.id)!;
  const s = draft.sessions.find((item) => item.id === r.sessionId)!;
  const m = draft.monitors.find((item) => item.id === "m1")!;
  revertCompletedSessionFromMonitor(m, s);
  draft.sessions = draft.sessions.filter((item) => item.id !== s.id);
  r.status = "open";
  r.monitorId = undefined;
  r.sessionId = undefined;
});
const m1AfterRollback = afterRollback.monitors.find((m) => m.id === "m1")!;
assert(m1AfterRollback.sessions === m1Before.sessions, "estorno reverteu contagem de sessões");
assert(Math.abs(m1AfterRollback.weeklyHours - m1Before.weeklyHours) < 0.01, "estorno reverteu weeklyHours");
assert(Math.abs(m1AfterRollback.rating - m1Before.rating) < 0.02, "estorno reverteu rating médio");

console.log("\n5) dashboard, reset e migração de perfil");
const dashboard = getDashboard(afterRollback);
assert(dashboard.stats.total === afterRollback.requests.length, `painel conta ${dashboard.stats.total} pedidos`);

const resetted = await store.resetDb();
assert(resetted.requests.length === db.requests.length, "reset volta ao tamanho da semente");
assert(resetted.profile.name === "" && resetted.profile.email === "", "semente não traz pessoa fictícia no perfil");

await store.updateDb((draft) => {
  draft.profile.name = LEGACY_PROFILE_NAME.toUpperCase();
  draft.profile.email = LEGACY_PROFILE_EMAIL;
  draft.profile.role = "student";
  draft.profile.coordinatorView = false;
});
const legacy = migrate(await store.readDb());
assert(legacy.profile.name === "" && legacy.profile.email === "", "perfil legado limpo");
assert(legacy.profile.role === "coordinator" && legacy.profile.coordinatorView, "perfil volta a ser coordenação");

await client.close();
console.log("\nTodos os testes do driver Postgres passaram.\n");
