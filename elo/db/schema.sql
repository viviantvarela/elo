-- ---------------------------------------------------------------------------
-- Elo — esquema relacional (Postgres / Neon)
--
-- Aplicado automaticamente no primeiro acesso (`ensureSchema` em
-- lib/server/store/postgres.ts). Este arquivo é a referência legível: o mesmo
-- DDL roda em `db-init` ou no SQL Editor do Neon.
--
-- Volume do piloto: ~35 KB de dados (22 estudantes, 8 monitores, 35 pedidos,
-- ~50 sessões). Cada mutação grava um snapshot completo dentro de uma
-- transação com advisory lock — simples e seguro nessa escala. Quando o
-- piloto crescer para vários campi, o próximo passo é trocar as mutações por
-- updates incrementais (o contrato de lib/server/repository.ts não muda).
-- ---------------------------------------------------------------------------

create table if not exists elo_meta (
  id          integer primary key default 1 check (id = 1),
  created_at  timestamptz not null default now(),
  version     integer not null default 1
);

create table if not exists elo_topics (
  id         text primary key,
  name       text not null,
  component  text not null,
  color      text not null
);

create table if not exists elo_students (
  id                text primary key,
  name              text not null,
  class_name        text not null,
  course            text not null,
  color             text not null,
  guardian_consent  boolean not null default false
);

create table if not exists elo_monitors (
  id              text primary key,
  name            text not null,
  class_name      text not null,
  kind            text not null check (kind in ('bolsista', 'voluntario')),
  rating          double precision not null default 0,
  rating_count    integer not null default 0,
  sessions        integer not null default 0,
  weekly_hours    double precision not null default 0,
  capacity_hours  double precision not null default 0,
  color           text not null,
  online          boolean not null default false,
  bio             text not null default ''
);

create table if not exists elo_monitor_topics (
  monitor_id  text not null references elo_monitors(id) on delete cascade,
  topic_id    text not null references elo_topics(id) on delete cascade,
  level       integer not null check (level between 1 and 5),
  primary key (monitor_id, topic_id)
);

create table if not exists elo_monitor_availability (
  monitor_id  text not null references elo_monitors(id) on delete cascade,
  day         integer not null check (day between 0 and 6),
  start_min   integer not null,
  end_min     integer not null,
  primary key (monitor_id, day, start_min)
);

create table if not exists elo_requests (
  id           text primary key,
  student_id   text not null references elo_students(id) on delete cascade,
  topic_id     text not null references elo_topics(id) on delete cascade,
  note         text not null default '',
  urgency      text not null check (urgency in ('low', 'normal', 'high')),
  status       text not null check (status in ('open', 'matched', 'scheduled', 'done', 'cancelled')),
  created_at   timestamptz not null,
  monitor_id   text references elo_monitors(id) on delete set null,
  matched_at   timestamptz,
  session_id   text,
  closed_at    timestamptz
);

create table if not exists elo_request_preferred (
  request_id  text not null references elo_requests(id) on delete cascade,
  day         integer not null check (day between 0 and 6),
  start_min   integer not null,
  end_min     integer not null,
  primary key (request_id, day, start_min)
);

create table if not exists elo_sessions (
  id          text primary key,
  request_id  text not null,
  monitor_id  text not null references elo_monitors(id) on delete cascade,
  student_id  text not null references elo_students(id) on delete cascade,
  topic_id    text not null references elo_topics(id) on delete cascade,
  starts_at   timestamptz not null,
  minutes     integer not null check (minutes > 0),
  attendance  text not null check (attendance in ('present', 'absent')),
  rating      integer check (rating between 1 and 5),
  notes       text
);

create table if not exists elo_settings (
  id                        integer primary key default 1 check (id = 1),
  weights                   jsonb not null,
  role                      text not null default 'coordinator',
  accent                    text not null default 'green',
  theme                     text not null default 'light',
  consent_required          boolean not null default true,
  guardian_consent_required boolean not null default true,
  aggregate_only            boolean not null default true,
  retention_days            integer not null default 365
);

create table if not exists elo_profile (
  id          integer primary key default 1 check (id = 1),
  name        text not null,
  role        text not null default 'coordinator',
  class_name  text not null default '',
  email       text not null default '',
  campus      text not null default '',
  coordinator_view boolean not null default true
);

create index if not exists elo_requests_status_idx on elo_requests (status);
create index if not exists elo_requests_created_idx on elo_requests (created_at desc);
create index if not exists elo_sessions_starts_idx on elo_sessions (starts_at desc);
create index if not exists elo_sessions_monitor_idx on elo_sessions (monitor_id);
