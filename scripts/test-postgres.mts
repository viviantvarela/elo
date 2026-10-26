/**
 * Testa o store Postgres contra um Postgres real (PGlite/WASM):
 * cria o esquema, semeia, faz round-trip e confere as agregações.
 *
 *   npx tsx --conditions=react-server scripts/test-postgres.ts
 */
import { PGlite } from "@electric-sql/pglite";

import { createPostgresStore, type Queryable } from "../lib/server/store/postgres";
import { LEGACY_PROFILE_EMAIL, LEGACY_PROFILE_NAME, migrate } from "../lib/server/migrate";
import { getDashboard, getReports } from "../lib/server/repository";

const client = new PGlite();

const queryable: Queryable = {
  async query<T>(text: string, values?: unknown[]) {
    // PGlite só aceita múltiplos comandos via exec()
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

console.log("\n1) primeiro acesso cria o esquema e semeia");
const db = await store.readDb();
assert(db.topics.length === 6, `6 tópicos (veio ${db.topics.length})`);
assert(db.monitors.length === 8, `8 monitores (veio ${db.monitors.length})`);
assert(db.requests.length >= 30, `>=30 pedidos (veio ${db.requests.length})`);
assert(db.sessions.length >= 35, `>=35 sessões (veio ${db.sessions.length})`);

const tables = await client.query<{ table_name: string }>(
  "select table_name from information_schema.tables where table_schema='public' order by table_name",
);
console.log("  tabelas:", tables.rows.map((r) => r.table_name).join(", "));
assert(tables.rows.length === 15, `15 tabelas criadas (veio ${tables.rows.length})`);

const monitorTopics = await client.query<{ count: string }>("select count(*)::text as count from elo_monitor_topics");
assert(Number(monitorTopics.rows[0].count) === 15, `15 vínculos monitor↔tópico (veio ${monitorTopics.rows[0].count})`);

console.log("\n2) não duplica a semente numa segunda leitura");
const again = await store.readDb();
assert(again.requests.length === db.requests.length, "mesma quantidade de pedidos");

console.log("\n3) escrita persiste e é relida do banco");
const updated = await store.updateDb((draft) => {
  draft.requests.push({
    id: "r999",
    studentId: "a1",
    topicId: "mat",
    note: "pedido de teste do driver",
    urgency: "high",
    status: "open",
    createdAt: new Date().toISOString(),
    preferred: [{ day: 3, start: 780, end: 840 }],
  });
});
assert(updated.requests.some((r) => r.id === "r999"), "updateDb devolve o pedido novo");

const reloaded = await store.readDb();
const found = reloaded.requests.find((r) => r.id === "r999");
assert(Boolean(found), "pedido novo foi relido do Postgres");
assert(found?.preferred[0]?.start === 780, "janela de horário sobreviveu ao round-trip");
assert(found?.note === "pedido de teste do driver", "texto com acento sobreviveu");

console.log("\n4) dashboard e relatórios rodam sobre os dados lidos");
const dashboard = getDashboard(reloaded);
const reports = getReports(reloaded);
assert(dashboard.stats.total === reloaded.requests.length, `painel conta ${dashboard.stats.total} pedidos`);
assert(reports.indicators.length === 6, "6 indicadores");
assert(reports.hoursByMonitor.reduce((sum, row) => sum + row.minutes, 0) > 0, "relatório de horas tem minutos");

console.log("\n5) reset zera o estado de teste");
const resetted = await store.resetDb();
assert(!resetted.requests.some((r) => r.id === "r999"), "pedido de teste removido");
assert(resetted.requests.length === db.requests.length, "volta ao tamanho da semente");

const count = await client.query<{ count: string }>("select count(*)::text as count from elo_requests");
assert(Number(count.rows[0].count) === resetted.requests.length, "tabela reflete o reset");

console.log("\n6) perfil: semente em branco, base antiga é limpa, nome real é mantido");
assert(resetted.profile.name === "" && resetted.profile.email === "", "semente não traz pessoa fictícia no perfil");

await store.updateDb((draft) => {
  draft.profile.name = LEGACY_PROFILE_NAME.toUpperCase();
  draft.profile.email = LEGACY_PROFILE_EMAIL;
  draft.profile.role = "student";
  draft.profile.coordinatorView = false;
});
const legacy = migrate(await store.readDb());
assert(legacy.profile.name === "" && legacy.profile.email === "", "nome e e-mail da semente antiga são apagados");
assert(legacy.profile.role === "coordinator" && legacy.profile.coordinatorView, "perfil volta a ser a conta da coordenação");

await store.updateDb((draft) => {
  draft.profile.name = "Ana Souza";
  draft.profile.email = "ana.souza@ifrn.edu.br";
});
const kept = migrate(await store.readDb());
assert(kept.profile.name === "Ana Souza" && kept.profile.email === "ana.souza@ifrn.edu.br", "perfil preenchido sobrevive ao round-trip");

await client.close();
console.log("\nTodos os testes do driver Postgres passaram.\n");
