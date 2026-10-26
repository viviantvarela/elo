/**
 * Sobe um Postgres (PGlite) via socket TCP, aponta DATABASE_URL + ELO_DB_DRIVER=postgres
 * e exercita o caminho ponta a ponta: rotas HTTP (`app/api/*`) → RBAC → LGPD →
 * `pg.Pool` com transação em cliente único + advisory lock (incluindo mutações concorrentes).
 */
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

const pglite = new PGlite();
const server = new PGLiteSocketServer({ db: pglite, port: 55432, host: "127.0.0.1" });
await server.start();
console.log("postgres de teste ouvindo em 127.0.0.1:55432");

process.env.ELO_DB_DRIVER = "postgres";
process.env.DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:55432/postgres";
process.env.PG_POOL_MAX = "1";
process.env.NEXT_PUBLIC_DEMO_MODE = "true";

const { readDb, resetDb } = await import("../lib/server/db");
const healthRoute = await import("../app/api/health/route");
const requestsRoute = await import("../app/api/requests/route");
const sessionsRoute = await import("../app/api/sessions/route");
const topicsRoute = await import("../app/api/topics/route");
const monitorsRoute = await import("../app/api/monitors/route");
const studentsRoute = await import("../app/api/students/route");

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(`FALHOU: ${message}`);
  console.log(`  ok  ${message}`);
}

function jsonReq(url: string, method: string, actor: string, body?: unknown) {
  return new Request(`http://localhost:3000${url}`, {
    method,
    headers: {
      "content-type": "application/json",
      "x-elo-actor": actor,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

const t0 = Date.now();
const first = await readDb();
console.log(`semeou ${first.requests.length} pedidos e ${first.sessions.length} sessões em ${Date.now() - t0} ms`);

const healthRes = await healthRoute.GET();
const health = (await healthRes.json()) as { ok: boolean; driver: string; counts: { topics: number } };
assert(health.ok && health.driver === "postgres" && health.counts.topics === 6, "GET /api/health íntegro via pg.Pool");

console.log("\n1) concorrência: 3 POSTs paralelos em /api/requests sem perder nenhuma escrita");
const parallelRes = await Promise.all([
  requestsRoute.POST(
    jsonReq("/api/requests", "POST", "student:a1", {
      studentId: "a1",
      topicId: "mat",
      note: "Pedido concorrente #1",
      urgency: "low",
      preferred: [{ day: 1, start: 780, end: 840 }],
      acceptConsent: true,
    }),
  ),
  requestsRoute.POST(
    jsonReq("/api/requests", "POST", "student:a3", {
      studentId: "a3",
      topicId: "prog",
      note: "Pedido concorrente #2",
      urgency: "normal",
      preferred: [{ day: 2, start: 780, end: 840 }],
      acceptConsent: true,
    }),
  ),
  requestsRoute.POST(
    jsonReq("/api/requests", "POST", "student:a4", {
      studentId: "a4",
      topicId: "fis",
      note: "Pedido concorrente #3",
      urgency: "high",
      preferred: [{ day: 4, start: 780, end: 840 }],
      acceptConsent: true,
    }),
  ),
]);
for (const res of parallelRes) {
  assert(res.status === 201, `POST concorrente retornou 201 (veio ${res.status})`);
}
const afterConcurrent = await readDb();
assert(afterConcurrent.requests.length === first.requests.length + 3, "todos os 3 pedidos paralelos foram persistidos");

console.log("\n2) RBAC + ciclo completo de agendamento, remarcação, conclusão e avaliação do estudante");
const createdPayload = (await parallelRes[0]!.json()) as { request: { id: string } };
const reqId = createdPayload.request.id;

// Estudante não pode parear manualmente qualquer monitor
const forbiddenMatch = await requestsRoute.PATCH(
  jsonReq("/api/requests", "PATCH", "student:a1", { id: reqId, action: "match", monitorId: "m1" }),
);
assert(forbiddenMatch.status === 403, "RBAC bloqueia pareamento manual por estudante (403)");

// Monitor m1 aceita o pedido na fila e depois agenda com sala presencial
const acceptRes = await requestsRoute.PATCH(
  jsonReq("/api/requests", "PATCH", "monitor:m1", { id: reqId, action: "match", monitorId: "m1" }),
);
assert(acceptRes.status === 200, "monitor aceitou o pedido na fila");

const scheduleRes = await requestsRoute.PATCH(
  jsonReq("/api/requests", "PATCH", "monitor:m1", {
    id: reqId,
    action: "schedule",
    monitorId: "m1",
    startsAt: new Date(Date.now() + 86_400_000).toISOString(),
    minutes: 60,
    location: "Lab 02 · DIATINF",
  }),
);
assert(scheduleRes.status === 200, "monitor agendou atendimento com local");

// Monitor m1 remarca o pedido agendado mudando para link remoto
const reschedRes = await requestsRoute.PATCH(
  jsonReq("/api/requests", "PATCH", "monitor:m1", {
    id: reqId,
    action: "schedule",
    monitorId: "m1",
    startsAt: new Date(Date.now() + 2 * 86_400_000).toISOString(),
    minutes: 75,
    location: "https://meet.google.com/elo-ifrn",
  }),
);
assert(reschedRes.status === 200, "pedido agendado pode ser remarcado com novo link");

// Monitor m1 conclui a sessão
const completeRes = await sessionsRoute.POST(
  jsonReq("/api/sessions", "POST", "monitor:m1", {
    requestId: reqId,
    minutes: 75,
    attendance: "present",
    rating: 4,
    notes: "Resolvemos exercícios da lista.",
  }),
);
assert(completeRes.status === 201, "monitor registrou conclusão da sessão");
const completedBody = (await completeRes.json()) as { session: { id: string } };

// Outro estudante (a3) não pode avaliar sessão de a1
const wrongStudentRate = await sessionsRoute.PATCH(
  jsonReq("/api/sessions", "PATCH", "student:a3", {
    sessionId: completedBody.session.id,
    rating: 1,
  }),
);
assert(wrongStudentRate.status === 403, "RBAC impede outro estudante de avaliar atendimento alheio (403)");

// Estudante atendida (a1) avalia com 5 estrelas
const ownRateRes = await sessionsRoute.PATCH(
  jsonReq("/api/sessions", "PATCH", "student:a1", {
    sessionId: completedBody.session.id,
    rating: 5,
    notes: "Monitoria excelente!",
  }),
);
assert(ownRateRes.status === 200, "estudante atendido avaliou a própria sessão (200)");

console.log("\n3) LGPD e CRUD da coordenação via rotas HTTP");
// Estudante sem guardianConsent (ex.: a6 na semente — vamos garantir via PATCH da coordenação)
await studentsRoute.PATCH(jsonReq("/api/students", "PATCH", "coordinator", { id: "a2", guardianConsent: false }));
const lgpdRes = await requestsRoute.POST(
  jsonReq("/api/requests", "POST", "student:a2", {
    studentId: "a2",
    topicId: "mat",
    note: "Pedido bloqueado por falta de termo do responsável",
    urgency: "normal",
    preferred: [{ day: 2, start: 780, end: 840 }],
    acceptConsent: true,
  }),
);
assert(lgpdRes.status === 403, `LGPD bloqueou estudante sem guardianConsent (${lgpdRes.status})`);

// Coordenação cria tópico e monitor
const topicRes = await topicsRoute.POST(
  jsonReq("/api/topics", "POST", "coordinator", {
    name: "Redes TCP/IP",
    component: "Redes de Computadores",
    color: "blue",
  }),
);
assert(topicRes.status === 201, "coordenação criou novo tópico curricular");
const createdTopic = (await topicRes.json()) as { id: string };

const monRes = await monitorsRoute.POST(
  jsonReq("/api/monitors", "POST", "coordinator", {
    name: "Caio Nogueira",
    email: "caio.nogueira@escolar.ifrn.edu.br",
    className: "3º ano REDES",
    kind: "bolsista",
    capacityHours: 8,
    topics: [{ topicId: createdTopic.id, level: 5 }],
    availability: [{ day: 3, start: 780, end: 900 }],
  }),
);
assert(monRes.status === 201, "coordenação cadastrou novo monitor");
const createdMonitor = (await monRes.json()) as { id: string };

const delMonRes = await monitorsRoute.DELETE(jsonReq(`/api/monitors?id=${createdMonitor.id}`, "DELETE", "coordinator"));
assert(delMonRes.status === 200, "coordenação removeu monitor sem pendências");

const delTopicRes = await topicsRoute.DELETE(jsonReq(`/api/topics?id=${createdTopic.id}`, "DELETE", "coordinator"));
assert(delTopicRes.status === 200, "coordenação removeu tópico sem pendências");

const afterReset = await resetDb();
assert(afterReset.requests.length === first.requests.length, "resetDb restaurou a base inicial");

await server.stop();
await pglite.close();
console.log("\ne2e completo (HTTP + RBAC + LGPD + pg.Pool concorrente): OK\n");
process.exit(0);
