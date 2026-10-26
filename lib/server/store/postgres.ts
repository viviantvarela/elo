import "server-only";

import { buildSeed, type Database } from "../seed";

/**
 * Store Postgres (Neon).
 *
 * Expõe a mesma interface do store em arquivo (`readDb`/`updateDb`/`resetDb`)
 * para que `lib/server/repository.ts` e todas as rotas de API não saibam qual
 * driver está por baixo.
 *
 * Recebe um `Queryable` em vez de criar o pool: assim o mesmo código roda no
 * Neon (via `pg`), em qualquer Postgres e nos testes com PGlite.
 */

export interface QueryResult<T> {
  rows: T[];
}

export interface Queryable {
  query<T = Record<string, unknown>>(text: string, values?: unknown[]): Promise<QueryResult<T>>;
}

/* ------------------------------- DDL -------------------------------------- */

const DDL_STATEMENTS = [
  `create table if not exists elo_meta (
    id integer primary key default 1 check (id = 1),
    created_at timestamptz not null default now(),
    version integer not null default 1
  )`,
  `create table if not exists elo_topics (
    id text primary key, name text not null, component text not null, color text not null
  )`,
  `create table if not exists elo_students (
    id text primary key, name text not null, class_name text not null,
    course text not null, color text not null, guardian_consent boolean not null default false
  )`,
  `create table if not exists elo_monitors (
    id text primary key, name text not null, class_name text not null,
    kind text not null check (kind in ('bolsista','voluntario')),
    rating double precision not null default 0, rating_count integer not null default 0,
    sessions integer not null default 0, weekly_hours double precision not null default 0,
    capacity_hours double precision not null default 0, color text not null,
    online boolean not null default false, bio text not null default ''
  )`,
  `create table if not exists elo_monitor_topics (
    monitor_id text not null references elo_monitors(id) on delete cascade,
    topic_id text not null references elo_topics(id) on delete cascade,
    level integer not null check (level between 1 and 5),
    primary key (monitor_id, topic_id)
  )`,
  `create table if not exists elo_monitor_availability (
    monitor_id text not null references elo_monitors(id) on delete cascade,
    day integer not null check (day between 0 and 6),
    start_min integer not null, end_min integer not null,
    primary key (monitor_id, day, start_min)
  )`,
  `create table if not exists elo_requests (
    id text primary key,
    student_id text not null references elo_students(id) on delete cascade,
    topic_id text not null references elo_topics(id) on delete cascade,
    note text not null default '',
    urgency text not null check (urgency in ('low','normal','high')),
    status text not null check (status in ('open','matched','scheduled','done','cancelled')),
    created_at timestamptz not null,
    monitor_id text references elo_monitors(id) on delete set null,
    matched_at timestamptz, session_id text, closed_at timestamptz
  )`,
  `create table if not exists elo_request_preferred (
    request_id text not null references elo_requests(id) on delete cascade,
    day integer not null check (day between 0 and 6),
    start_min integer not null, end_min integer not null,
    primary key (request_id, day, start_min)
  )`,
  `create table if not exists elo_sessions (
    id text primary key, request_id text not null,
    monitor_id text not null references elo_monitors(id) on delete cascade,
    student_id text not null references elo_students(id) on delete cascade,
    topic_id text not null references elo_topics(id) on delete cascade,
    starts_at timestamptz not null, minutes integer not null check (minutes > 0),
    attendance text not null check (attendance in ('present','absent')),
    rating integer check (rating between 1 and 5), notes text
  )`,
  `create table if not exists elo_settings (
    id integer primary key default 1 check (id = 1),
    weights jsonb not null,
    role text not null default 'coordinator', accent text not null default 'green',
    theme text not null default 'light', consent_required boolean not null default true,
    guardian_consent_required boolean not null default true,
    aggregate_only boolean not null default true, retention_days integer not null default 365
  )`,
  `create table if not exists elo_profile (
    id integer primary key default 1 check (id = 1),
    name text not null, role text not null default 'coordinator',
    class_name text not null default '', email text not null default '',
    campus text not null default '', coordinator_view boolean not null default true
  )`,
  `create table if not exists elo_teachers (
    id text primary key, name text not null, class_name text not null,
    email text not null default '', color text not null, bio text not null default ''
  )`,
  `create table if not exists elo_teacher_topics (
    teacher_id text not null references elo_teachers(id) on delete cascade,
    topic_id text not null references elo_topics(id) on delete cascade,
    primary key (teacher_id, topic_id)
  )`,
  `create table if not exists elo_alignment_messages (
    id text primary key,
    topic_id text not null references elo_topics(id) on delete cascade,
    author_role text not null check (author_role in ('teacher','monitor')),
    author_id text not null, author_name text not null, author_color text not null,
    text text not null, created_at timestamptz not null
  )`,
  `create table if not exists elo_alignment_meetings (
    id text primary key,
    topic_id text not null references elo_topics(id) on delete cascade,
    title text not null, scheduled_at timestamptz not null, duration_minutes integer not null,
    meet_link text not null, meet_code text not null,
    provider text not null check (provider in ('google-meet-api','demo')),
    created_by_role text not null check (created_by_role in ('teacher','monitor')),
    created_by_id text not null, created_by_name text not null, created_at timestamptz not null,
    status text not null default 'scheduled' check (status in ('scheduled','cancelled'))
  )`,
  `create index if not exists elo_requests_status_idx on elo_requests (status)`,
  `create index if not exists elo_requests_created_idx on elo_requests (created_at desc)`,
  `create index if not exists elo_sessions_starts_idx on elo_sessions (starts_at desc)`,
  `create index if not exists elo_sessions_monitor_idx on elo_sessions (monitor_id)`,
  `create index if not exists elo_alignment_messages_topic_idx on elo_alignment_messages (topic_id, created_at)`,
  `create index if not exists elo_alignment_meetings_topic_idx on elo_alignment_meetings (topic_id, scheduled_at)`,
];

/* ------------------------------- leitura ---------------------------------- */

interface TopicRow {
  id: string;
  name: string;
  component: string;
  color: string;
}
interface StudentRow {
  id: string;
  name: string;
  class_name: string;
  course: string;
  color: string;
  guardian_consent: boolean;
}
interface MonitorRow {
  id: string;
  name: string;
  class_name: string;
  kind: "bolsista" | "voluntario";
  rating: number;
  rating_count: number;
  sessions: number;
  weekly_hours: number;
  capacity_hours: number;
  color: string;
  online: boolean;
  bio: string;
}
interface MonitorTopicRow {
  monitor_id: string;
  topic_id: string;
  level: number;
}
interface AvailabilityRow {
  monitor_id: string;
  day: number;
  start_min: number;
  end_min: number;
}
interface RequestRow {
  id: string;
  student_id: string;
  topic_id: string;
  note: string;
  urgency: "low" | "normal" | "high";
  status: "open" | "matched" | "scheduled" | "done" | "cancelled";
  created_at: Date | string;
  monitor_id: string | null;
  matched_at: Date | string | null;
  session_id: string | null;
  closed_at: Date | string | null;
}
interface PreferredRow {
  request_id: string;
  day: number;
  start_min: number;
  end_min: number;
}
interface SessionRow {
  id: string;
  request_id: string;
  monitor_id: string;
  student_id: string;
  topic_id: string;
  starts_at: Date | string;
  minutes: number;
  attendance: "present" | "absent";
  rating: number | null;
  notes: string | null;
}
interface SettingsRow {
  weights: { topic: number; availability: number; rating: number; load: number };
  role: "student" | "monitor" | "coordinator" | "teacher";
  accent: "green" | "ocean" | "plum" | "rose" | "amber";
  theme: "light" | "dark";
  consent_required: boolean;
  guardian_consent_required: boolean;
  aggregate_only: boolean;
  retention_days: number;
}
interface ProfileRow {
  name: string;
  role: "student" | "monitor" | "coordinator" | "teacher";
  class_name: string;
  email: string;
  campus: string;
  coordinator_view: boolean;
}
interface MetaRow {
  created_at: Date | string;
  version: number;
}
interface TeacherRow {
  id: string;
  name: string;
  class_name: string;
  email: string;
  color: string;
  bio: string;
}
interface TeacherTopicRow {
  teacher_id: string;
  topic_id: string;
}
interface AlignmentMessageRow {
  id: string;
  topic_id: string;
  author_role: "teacher" | "monitor";
  author_id: string;
  author_name: string;
  author_color: string;
  text: string;
  created_at: Date | string;
}
interface AlignmentMeetingRow {
  id: string;
  topic_id: string;
  title: string;
  scheduled_at: Date | string;
  duration_minutes: number;
  meet_link: string;
  meet_code: string;
  provider: "google-meet-api" | "demo";
  created_by_role: "teacher" | "monitor";
  created_by_id: string;
  created_by_name: string;
  created_at: Date | string;
  status: "scheduled" | "cancelled";
}

/* -------------------------------- helpers --------------------------------- */

/** timestamptz pode voltar como Date (pg) ou string (PGlite) — normaliza. */
function iso(value: Date | string | null | undefined): string | undefined {
  if (!value) return undefined;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function group<T, K>(rows: T[], key: (row: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const row of rows) {
    const id = key(row);
    const list = map.get(id);
    if (list) list.push(row);
    else map.set(id, [row]);
  }
  return map;
}

export function createPostgresStore(queryable: Queryable) {
  let schemaReady: Promise<void> | null = null;

  async function ensureSchema() {
    if (!schemaReady) {
      schemaReady = (async () => {
        // duas lambdas podem subir juntas no primeiro acesso: serializa o DDL
        await queryable.query("begin");
        try {
          await queryable.query("select pg_advisory_xact_lock(hashtext('elo-schema'))");
          for (const statement of DDL_STATEMENTS) {
            await queryable.query(statement);
          }
          await queryable.query("commit");
        } catch (error) {
          await queryable.query("rollback").catch(() => undefined);
          throw error;
        }
      })().catch((error) => {
        schemaReady = null;
        throw error;
      });
    }
    return schemaReady;
  }

  async function isEmpty() {
    const { rows } = await queryable.query<{ count: string }>("select count(*)::text as count from elo_topics");
    return Number(rows[0]?.count ?? "0") === 0;
  }

  /* ------------------------------ escrita -------------------------------- */

  async function writeSnapshot(database: Database) {
    await queryable.query("begin");
    try {
      // serializa concorrência entre lambdas do Vercel
      await queryable.query("select pg_advisory_xact_lock(hashtext('elo-workspace'))");

      await queryable.query(
        "delete from elo_alignment_meetings; delete from elo_alignment_messages; delete from elo_teacher_topics; delete from elo_teachers; delete from elo_request_preferred; delete from elo_monitor_availability; delete from elo_monitor_topics; delete from elo_sessions; delete from elo_requests; delete from elo_monitors; delete from elo_students; delete from elo_topics;",
      );

      for (const topic of database.topics) {
        await queryable.query("insert into elo_topics (id, name, component, color) values ($1,$2,$3,$4)", [
          topic.id,
          topic.name,
          topic.component,
          topic.color,
        ]);
      }

      for (const student of database.students) {
        await queryable.query(
          "insert into elo_students (id, name, class_name, course, color, guardian_consent) values ($1,$2,$3,$4,$5,$6)",
          [student.id, student.name, student.className, student.course, student.color, student.guardianConsent],
        );
      }

      for (const monitor of database.monitors) {
        await queryable.query(
          `insert into elo_monitors
            (id, name, class_name, kind, rating, rating_count, sessions, weekly_hours, capacity_hours, color, online, bio)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
          [
            monitor.id,
            monitor.name,
            monitor.className,
            monitor.kind,
            monitor.rating,
            monitor.ratingCount,
            monitor.sessions,
            monitor.weeklyHours,
            monitor.capacityHours,
            monitor.color,
            monitor.online,
            monitor.bio,
          ],
        );

        for (const topic of monitor.topics) {
          await queryable.query(
            "insert into elo_monitor_topics (monitor_id, topic_id, level) values ($1,$2,$3)",
            [monitor.id, topic.topicId, topic.level],
          );
        }

        for (const slot of monitor.availability) {
          await queryable.query(
            "insert into elo_monitor_availability (monitor_id, day, start_min, end_min) values ($1,$2,$3,$4)",
            [monitor.id, slot.day, slot.start, slot.end],
          );
        }
      }

      for (const request of database.requests) {
        await queryable.query(
          `insert into elo_requests
            (id, student_id, topic_id, note, urgency, status, created_at, monitor_id, matched_at, session_id, closed_at)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [
            request.id,
            request.studentId,
            request.topicId,
            request.note,
            request.urgency,
            request.status,
            request.createdAt,
            request.monitorId ?? null,
            request.matchedAt ?? null,
            request.sessionId ?? null,
            request.closedAt ?? null,
          ],
        );

        for (const slot of request.preferred) {
          await queryable.query(
            "insert into elo_request_preferred (request_id, day, start_min, end_min) values ($1,$2,$3,$4)",
            [request.id, slot.day, slot.start, slot.end],
          );
        }
      }

      for (const session of database.sessions) {
        await queryable.query(
          `insert into elo_sessions
            (id, request_id, monitor_id, student_id, topic_id, starts_at, minutes, attendance, rating, notes)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [
            session.id,
            session.requestId,
            session.monitorId,
            session.studentId,
            session.topicId,
            session.startsAt,
            session.minutes,
            session.attendance,
            session.rating ?? null,
            session.notes ?? null,
          ],
        );
      }

      for (const teacher of database.teachers) {
        await queryable.query(
          "insert into elo_teachers (id, name, class_name, email, color, bio) values ($1,$2,$3,$4,$5,$6)",
          [teacher.id, teacher.name, teacher.className, teacher.email, teacher.color, teacher.bio],
        );
        for (const topicId of teacher.topics) {
          await queryable.query("insert into elo_teacher_topics (teacher_id, topic_id) values ($1,$2)", [
            teacher.id,
            topicId,
          ]);
        }
      }

      for (const message of database.alignmentMessages) {
        await queryable.query(
          `insert into elo_alignment_messages
            (id, topic_id, author_role, author_id, author_name, author_color, text, created_at)
           values ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [
            message.id,
            message.topicId,
            message.authorRole,
            message.authorId,
            message.authorName,
            message.authorColor,
            message.text,
            message.createdAt,
          ],
        );
      }

      for (const meeting of database.alignmentMeetings) {
        await queryable.query(
          `insert into elo_alignment_meetings
            (id, topic_id, title, scheduled_at, duration_minutes, meet_link, meet_code, provider,
             created_by_role, created_by_id, created_by_name, created_at, status)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
          [
            meeting.id,
            meeting.topicId,
            meeting.title,
            meeting.scheduledAt,
            meeting.durationMinutes,
            meeting.meetLink,
            meeting.meetCode,
            meeting.provider,
            meeting.createdByRole,
            meeting.createdById,
            meeting.createdByName,
            meeting.createdAt,
            meeting.status,
          ],
        );
      }

      const settings = database.settings;
      await queryable.query(
        `insert into elo_settings
          (id, weights, role, accent, theme, consent_required, guardian_consent_required, aggregate_only, retention_days)
         values (1,$1,$2,$3,$4,$5,$6,$7,$8)
         on conflict (id) do update set
           weights = excluded.weights, role = excluded.role, accent = excluded.accent, theme = excluded.theme,
           consent_required = excluded.consent_required,
           guardian_consent_required = excluded.guardian_consent_required,
           aggregate_only = excluded.aggregate_only, retention_days = excluded.retention_days`,
        [
          JSON.stringify(settings.weights),
          settings.role,
          settings.accent,
          settings.theme,
          settings.consentRequired,
          settings.guardianConsentRequired,
          settings.aggregateOnly,
          settings.retentionDays,
        ],
      );

      const profile = database.profile;
      await queryable.query(
        `insert into elo_profile (id, name, role, class_name, email, campus, coordinator_view)
         values (1,$1,$2,$3,$4,$5,$6)
         on conflict (id) do update set
           name = excluded.name, role = excluded.role, class_name = excluded.class_name,
           email = excluded.email, campus = excluded.campus, coordinator_view = excluded.coordinator_view`,
        [profile.name, profile.role, profile.className, profile.email, profile.campus, profile.coordinatorView],
      );

      await queryable.query(
        `insert into elo_meta (id, created_at, version) values (1,$1,$2)
         on conflict (id) do update set created_at = excluded.created_at, version = excluded.version`,
        [database.meta.createdAt, database.meta.version],
      );

      await queryable.query("commit");
    } catch (error) {
      await queryable.query("rollback").catch(() => undefined);
      throw error;
    }
  }

  /* ------------------------------- leitura ------------------------------- */

  async function loadSnapshot(): Promise<Database> {
    const [
      topics,
      students,
      monitors,
      monitorTopics,
      availability,
      teachers,
      teacherTopics,
      requests,
      preferred,
      sessions,
      alignmentMessages,
      alignmentMeetings,
      settingsRows,
      profileRows,
      metaRows,
    ] = await Promise.all([
      queryable.query<TopicRow>("select id, name, component, color from elo_topics order by id"),
      queryable.query<StudentRow>("select id, name, class_name, course, color, guardian_consent from elo_students order by id"),
      queryable.query<MonitorRow>(
        "select id, name, class_name, kind, rating, rating_count, sessions, weekly_hours, capacity_hours, color, online, bio from elo_monitors order by id",
      ),
      queryable.query<MonitorTopicRow>("select monitor_id, topic_id, level from elo_monitor_topics"),
      queryable.query<AvailabilityRow>(
        "select monitor_id, day, start_min, end_min from elo_monitor_availability order by day, start_min",
      ),
      queryable.query<TeacherRow>("select id, name, class_name, email, color, bio from elo_teachers order by id"),
      queryable.query<TeacherTopicRow>("select teacher_id, topic_id from elo_teacher_topics"),
      queryable.query<RequestRow>(
        `select id, student_id, topic_id, note, urgency, status, created_at, monitor_id, matched_at, session_id, closed_at
         from elo_requests order by created_at desc`,
      ),
      queryable.query<PreferredRow>(
        "select request_id, day, start_min, end_min from elo_request_preferred order by day, start_min",
      ),
      queryable.query<SessionRow>(
        `select id, request_id, monitor_id, student_id, topic_id, starts_at, minutes, attendance, rating, notes
         from elo_sessions order by starts_at desc`,
      ),
      queryable.query<AlignmentMessageRow>(
        `select id, topic_id, author_role, author_id, author_name, author_color, text, created_at
         from elo_alignment_messages order by created_at asc`,
      ),
      queryable.query<AlignmentMeetingRow>(
        `select id, topic_id, title, scheduled_at, duration_minutes, meet_link, meet_code, provider,
                created_by_role, created_by_id, created_by_name, created_at, status
         from elo_alignment_meetings order by scheduled_at asc`,
      ),
      queryable.query<SettingsRow>("select * from elo_settings where id = 1"),
      queryable.query<ProfileRow>("select * from elo_profile where id = 1"),
      queryable.query<MetaRow>("select created_at, version from elo_meta where id = 1"),
    ]);

    const topicsByMonitor = group(monitorTopics.rows, (row) => row.monitor_id);
    const slotsByMonitor = group(availability.rows, (row) => row.monitor_id);
    const topicsByTeacher = group(teacherTopics.rows, (row) => row.teacher_id);
    const preferredByRequest = group(preferred.rows, (row) => row.request_id);

    const settingsRow = settingsRows.rows[0];
    const profileRow = profileRows.rows[0];
    if (!settingsRow || !profileRow) throw new Error("Base do Elo sem configurações — rode o reset.");

    return {
      topics: topics.rows.map((row) => ({
        id: row.id,
        name: row.name,
        component: row.component,
        color: row.color as Database["topics"][number]["color"],
      })),
      students: students.rows.map((row) => ({
        id: row.id,
        name: row.name,
        className: row.class_name,
        course: row.course,
        color: row.color as Database["students"][number]["color"],
        guardianConsent: row.guardian_consent,
      })),
      monitors: monitors.rows.map((row) => ({
        id: row.id,
        name: row.name,
        className: row.class_name,
        kind: row.kind,
        topics: (topicsByMonitor.get(row.id) ?? []).map((topic) => ({ topicId: topic.topic_id, level: topic.level })),
        availability: (slotsByMonitor.get(row.id) ?? []).map((slot) => ({
          day: slot.day,
          start: slot.start_min,
          end: slot.end_min,
        })),
        rating: Number(row.rating),
        ratingCount: row.rating_count,
        sessions: row.sessions,
        weeklyHours: Number(row.weekly_hours),
        capacityHours: Number(row.capacity_hours),
        color: row.color as Database["monitors"][number]["color"],
        online: row.online,
        bio: row.bio,
      })),
      requests: requests.rows.map((row) => ({
        id: row.id,
        studentId: row.student_id,
        topicId: row.topic_id,
        note: row.note,
        urgency: row.urgency,
        status: row.status,
        createdAt: iso(row.created_at) as string,
        preferred: (preferredByRequest.get(row.id) ?? []).map((slot) => ({
          day: slot.day,
          start: slot.start_min,
          end: slot.end_min,
        })),
        monitorId: row.monitor_id ?? undefined,
        matchedAt: iso(row.matched_at),
        sessionId: row.session_id ?? undefined,
        closedAt: iso(row.closed_at),
      })),
      sessions: sessions.rows.map((row) => ({
        id: row.id,
        requestId: row.request_id,
        monitorId: row.monitor_id,
        studentId: row.student_id,
        topicId: row.topic_id,
        startsAt: iso(row.starts_at) as string,
        minutes: row.minutes,
        attendance: row.attendance,
        rating: row.rating ?? undefined,
        notes: row.notes ?? undefined,
      })),
      teachers: teachers.rows.map((row) => ({
        id: row.id,
        name: row.name,
        className: row.class_name,
        email: row.email,
        topics: (topicsByTeacher.get(row.id) ?? []).map((topic) => topic.topic_id),
        color: row.color as Database["teachers"][number]["color"],
        bio: row.bio,
      })),
      alignmentMessages: alignmentMessages.rows.map((row) => ({
        id: row.id,
        topicId: row.topic_id,
        authorRole: row.author_role,
        authorId: row.author_id,
        authorName: row.author_name,
        authorColor: row.author_color as Database["alignmentMessages"][number]["authorColor"],
        text: row.text,
        createdAt: iso(row.created_at) as string,
      })),
      alignmentMeetings: alignmentMeetings.rows.map((row) => ({
        id: row.id,
        topicId: row.topic_id,
        title: row.title,
        scheduledAt: iso(row.scheduled_at) as string,
        durationMinutes: row.duration_minutes,
        meetLink: row.meet_link,
        meetCode: row.meet_code,
        provider: row.provider,
        createdByRole: row.created_by_role,
        createdById: row.created_by_id,
        createdByName: row.created_by_name,
        createdAt: iso(row.created_at) as string,
        status: row.status,
      })),
      settings: {
        weights: settingsRow.weights as Database["settings"]["weights"],
        role: settingsRow.role,
        accent: settingsRow.accent,
        theme: settingsRow.theme,
        consentRequired: settingsRow.consent_required,
        guardianConsentRequired: settingsRow.guardian_consent_required,
        aggregateOnly: settingsRow.aggregate_only,
        retentionDays: settingsRow.retention_days,
      },
      profile: {
        id: "u1",
        name: profileRow.name,
        role: profileRow.role,
        className: profileRow.class_name,
        email: profileRow.email,
        campus: profileRow.campus,
        coordinatorView: profileRow.coordinator_view,
      },
      meta: {
        createdAt: iso(metaRows.rows[0]?.created_at) ?? new Date().toISOString(),
        version: metaRows.rows[0]?.version ?? 1,
      },
    };
  }

  /* ------------------------------ interface ------------------------------ */

  async function readDb(): Promise<Database> {
    await ensureSchema();
    if (await isEmpty()) {
      const seeded = buildSeed();
      await writeSnapshot(seeded);
      return seeded;
    }
    return loadSnapshot();
  }

  async function updateDb(mutator: (database: Database) => Database | void): Promise<Database> {
    const current = await readDb();
    const draft = structuredClone(current);
    const next = mutator(draft) ?? draft;
    await ensureSchema();
    await writeSnapshot(next);
    return next;
  }

  async function resetDb(seed: Database = buildSeed()): Promise<Database> {
    await ensureSchema();
    await writeSnapshot(seed);
    return seed;
  }

  return { readDb, updateDb, resetDb };
}
