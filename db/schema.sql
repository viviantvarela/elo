-- ---------------------------------------------------------------------------
-- Elo — esquema relacional (Supabase / PostgreSQL)
--
-- Aplicado automaticamente no projeto Supabase (ou no primeiro acesso via
-- `ensureSchema` em lib/server/store/postgres.ts).
--
-- Inclui:
--   - 16 tabelas relacionais (`elo_*`) com Row Level Security habilitado
--   - Funções transacionais `elo_read_snapshot` e `elo_write_snapshot`
--     usadas pelo store HTTPS do Supabase (`service_role`) com advisory lock
-- ---------------------------------------------------------------------------

create table if not exists public.elo_meta (
  id          integer primary key default 1 check (id = 1),
  created_at  timestamptz not null default now(),
  version     integer not null default 2
);

create table if not exists public.elo_topics (
  id         text primary key,
  name       text not null,
  component  text not null,
  color      text not null
);

create table if not exists public.elo_students (
  id                   text primary key,
  name                 text not null,
  class_name           text not null,
  course               text not null,
  color                text not null,
  guardian_consent     boolean not null default false,
  email                text,
  consent_accepted_at  timestamptz
);

create table if not exists public.elo_monitors (
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
  bio             text not null default '',
  email           text
);

create table if not exists public.elo_monitor_topics (
  monitor_id  text not null references public.elo_monitors(id) on delete cascade,
  topic_id    text not null references public.elo_topics(id) on delete cascade,
  level       integer not null check (level between 1 and 5),
  primary key (monitor_id, topic_id)
);

create table if not exists public.elo_monitor_availability (
  monitor_id  text not null references public.elo_monitors(id) on delete cascade,
  day         integer not null check (day between 0 and 6),
  start_min   integer not null,
  end_min     integer not null,
  primary key (monitor_id, day, start_min)
);

create table if not exists public.elo_requests (
  id           text primary key,
  student_id   text not null references public.elo_students(id) on delete cascade,
  topic_id     text not null references public.elo_topics(id) on delete cascade,
  note         text not null default '',
  urgency      text not null check (urgency in ('low', 'normal', 'high')),
  status       text not null check (status in ('open', 'matched', 'scheduled', 'done', 'cancelled')),
  created_at   timestamptz not null,
  monitor_id   text references public.elo_monitors(id) on delete set null,
  matched_at   timestamptz,
  session_id   text,
  closed_at    timestamptz
);

create table if not exists public.elo_request_preferred (
  request_id  text not null references public.elo_requests(id) on delete cascade,
  day         integer not null check (day between 0 and 6),
  start_min   integer not null,
  end_min     integer not null,
  primary key (request_id, day, start_min)
);

create table if not exists public.elo_sessions (
  id          text primary key,
  request_id  text not null,
  monitor_id  text not null references public.elo_monitors(id) on delete cascade,
  student_id  text not null references public.elo_students(id) on delete cascade,
  topic_id    text not null references public.elo_topics(id) on delete cascade,
  starts_at   timestamptz not null,
  minutes     integer not null check (minutes > 0),
  attendance  text not null check (attendance in ('present', 'absent')),
  rating      integer check (rating between 1 and 5),
  notes       text,
  location    text
);

create table if not exists public.elo_teachers (
  id          text primary key,
  name        text not null,
  class_name  text not null,
  email       text not null default '',
  color       text not null,
  bio         text not null default ''
);

create table if not exists public.elo_teacher_topics (
  teacher_id  text not null references public.elo_teachers(id) on delete cascade,
  topic_id    text not null references public.elo_topics(id) on delete cascade,
  primary key (teacher_id, topic_id)
);

-- Espaço de alinhamento: conversa entre o professor de um componente e os
-- monitores daquele tópico, com reuniões no Google Meet. Fora do alcance de
-- estudantes e coordenação (ver lib/constants.ts → navItems).
create table if not exists public.elo_alignment_messages (
  id            text primary key,
  topic_id      text not null references public.elo_topics(id) on delete cascade,
  author_role   text not null check (author_role in ('teacher', 'monitor')),
  author_id     text not null,
  author_name   text not null,
  author_color  text not null,
  text          text not null,
  created_at    timestamptz not null
);

create table if not exists public.elo_alignment_meetings (
  id                text primary key,
  topic_id          text not null references public.elo_topics(id) on delete cascade,
  title             text not null,
  scheduled_at      timestamptz not null,
  duration_minutes  integer not null,
  meet_link         text not null,
  meet_code         text not null,
  -- 'google-meet-api': criado de verdade pela Google Meet REST API (meet.googleapis.com)
  -- 'demo': sem credenciais do Google configuradas — link de demonstração
  provider          text not null check (provider in ('google-meet-api', 'demo')),
  created_by_role   text not null check (created_by_role in ('teacher', 'monitor')),
  created_by_id     text not null,
  created_by_name   text not null,
  created_at        timestamptz not null,
  status            text not null default 'scheduled' check (status in ('scheduled', 'cancelled'))
);

create table if not exists public.elo_settings (
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

create table if not exists public.elo_profile (
  id               integer primary key default 1 check (id = 1),
  name             text not null,
  role             text not null default 'coordinator',
  class_name       text not null default '',
  email            text not null default '',
  campus           text not null default '',
  coordinator_view boolean not null default true
);

create table if not exists public.elo_accounts (
  email         text primary key,
  auth_user_id  text,
  role          text not null check (role in ('student', 'monitor', 'coordinator', 'teacher')),
  student_id    text references public.elo_students(id) on delete cascade,
  monitor_id    text references public.elo_monitors(id) on delete cascade,
  teacher_id    text references public.elo_teachers(id) on delete cascade,
  created_at    timestamptz not null default now()
);

create index if not exists elo_requests_status_idx on public.elo_requests (status);
create index if not exists elo_requests_created_idx on public.elo_requests (created_at desc);
create index if not exists elo_sessions_starts_idx on public.elo_sessions (starts_at desc);
create index if not exists elo_sessions_monitor_idx on public.elo_sessions (monitor_id);
create index if not exists elo_alignment_messages_topic_idx on public.elo_alignment_messages (topic_id, created_at);
create index if not exists elo_alignment_meetings_topic_idx on public.elo_alignment_meetings (topic_id, scheduled_at);
create index if not exists elo_accounts_auth_uid_idx on public.elo_accounts (auth_user_id);

alter table public.elo_meta enable row level security;
alter table public.elo_topics enable row level security;
alter table public.elo_students enable row level security;
alter table public.elo_monitors enable row level security;
alter table public.elo_monitor_topics enable row level security;
alter table public.elo_monitor_availability enable row level security;
alter table public.elo_requests enable row level security;
alter table public.elo_request_preferred enable row level security;
alter table public.elo_sessions enable row level security;
alter table public.elo_teachers enable row level security;
alter table public.elo_teacher_topics enable row level security;
alter table public.elo_alignment_messages enable row level security;
alter table public.elo_alignment_meetings enable row level security;
alter table public.elo_settings enable row level security;
alter table public.elo_profile enable row level security;
alter table public.elo_accounts enable row level security;
