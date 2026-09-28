-- 012: Weekly time-management board (tasks, recurring tasks, blocked days)
--
-- NAMING: tables are prefixed `stitchworks_` to match the convention set at
-- the top of supabase/migration.sql. Head Water is a shared project that also
-- hosts MWMW, a notary site and a blog; bare `tasks` / `blocked_days` would be
-- a collision waiting to happen.
--
-- WEEKDAY CONVENTION: 0 = Sunday .. 6 = Saturday, matching both JS
-- Date.getDay() and Postgres extract(dow). The board *renders* Mon-Sun, but
-- the stored numbers follow the language/DB convention, not the display order.
--
-- ACCESS: authenticated only, matching migration 011. These tables hold the
-- operator's own schedule and have no public consumer.

begin;

-- ---------------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------------
do $$ begin
  create type stitchworks_task_type as enum ('bench', 'business', 'content', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type stitchworks_task_source as enum ('manual', 'auto', 'recurring');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- RECURRING TASKS  (templates -> one instance per matching day)
-- ---------------------------------------------------------------------------
create table if not exists public.stitchworks_recurring_tasks (
  id                uuid primary key default gen_random_uuid(),
  title             text not null,
  type              stitchworks_task_type not null default 'business',
  weekday           smallint not null check (weekday between 0 and 6),
  estimated_minutes integer check (estimated_minutes is null or estimated_minutes >= 0),
  active            boolean not null default true,
  created_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- BLOCKED DAYS
-- Either a repeating weekday ("every Monday") or a one-off date ("Dec 25"),
-- never both. Blocked days still accept tasks -- they render greyed as a
-- capacity signal, not a hard lock.
-- ---------------------------------------------------------------------------
create table if not exists public.stitchworks_blocked_days (
  id          uuid primary key default gen_random_uuid(),
  weekday     smallint check (weekday is null or weekday between 0 and 6),
  date        date,
  label       text not null default 'Blocked',
  created_at  timestamptz not null default now(),
  constraint stitchworks_blocked_days_one_of
    check ((weekday is null) <> (date is null))
);

-- One rule per weekday / per date.
create unique index if not exists stitchworks_blocked_days_weekday_key
  on public.stitchworks_blocked_days(weekday) where weekday is not null;
create unique index if not exists stitchworks_blocked_days_date_key
  on public.stitchworks_blocked_days(date) where date is not null;

-- ---------------------------------------------------------------------------
-- TASKS
-- ---------------------------------------------------------------------------
create table if not exists public.stitchworks_tasks (
  id                uuid primary key default gen_random_uuid(),
  title             text not null,
  notes             text,
  type              stitchworks_task_type not null default 'business',
  scheduled_date    date not null,
  estimated_minutes integer check (estimated_minutes is null or estimated_minutes >= 0),
  completed_at      timestamptz,
  rollover_count    integer not null default 0 check (rollover_count >= 0),
  source            stitchworks_task_source not null default 'manual',
  job_id            uuid references public.stitchworks_jobs(id) on delete cascade,

  -- Not in the original column list, but required for the "never duplicate an
  -- open task for the same job + rule" guarantee: without a rule identifier
  -- there is no key to dedupe on. Null for anything not machine-generated.
  auto_rule         text,
  recurring_task_id uuid references public.stitchworks_recurring_tasks(id) on delete set null,

  created_at        timestamptz not null default now()
);

create index if not exists stitchworks_tasks_scheduled_date_idx
  on public.stitchworks_tasks(scheduled_date);
create index if not exists stitchworks_tasks_open_idx
  on public.stitchworks_tasks(scheduled_date) where completed_at is null;
create index if not exists stitchworks_tasks_job_id_idx
  on public.stitchworks_tasks(job_id);

-- Dedupe guarantees, enforced by the DB rather than trusted to app logic:
--
-- 1. At most ONE OPEN auto task per (job, rule). Completing one allows the
--    rule to fire again later, which is what you want for a follow-up that
--    recurs if the job sits in the same state again.
create unique index if not exists stitchworks_tasks_open_auto_rule_key
  on public.stitchworks_tasks(job_id, auto_rule)
  where auto_rule is not null and completed_at is null and auto_rule <> 'lost_reengage';

-- 2. `lost_reengage` fires ONCE EVER per job, open or completed -- so the
--    all-time uniqueness is a separate, stricter index.
create unique index if not exists stitchworks_tasks_reengage_once_key
  on public.stitchworks_tasks(job_id)
  where auto_rule = 'lost_reengage';

-- 3. One instance per recurring template per day.
create unique index if not exists stitchworks_tasks_recurring_day_key
  on public.stitchworks_tasks(recurring_task_id, scheduled_date)
  where recurring_task_id is not null;

-- ---------------------------------------------------------------------------
-- RLS -- authenticated only, matching migration 011
-- ---------------------------------------------------------------------------
alter table public.stitchworks_tasks           enable row level security;
alter table public.stitchworks_recurring_tasks enable row level security;
alter table public.stitchworks_blocked_days    enable row level security;

grant select, insert, update, delete on public.stitchworks_tasks           to authenticated;
grant select, insert, update, delete on public.stitchworks_recurring_tasks to authenticated;
grant select, insert, update, delete on public.stitchworks_blocked_days    to authenticated;

revoke all on public.stitchworks_tasks           from anon;
revoke all on public.stitchworks_recurring_tasks from anon;
revoke all on public.stitchworks_blocked_days    from anon;

drop policy if exists stitchworks_tasks_auth on public.stitchworks_tasks;
create policy stitchworks_tasks_auth
  on public.stitchworks_tasks for all
  to authenticated using (true) with check (true);

drop policy if exists stitchworks_recurring_tasks_auth on public.stitchworks_recurring_tasks;
create policy stitchworks_recurring_tasks_auth
  on public.stitchworks_recurring_tasks for all
  to authenticated using (true) with check (true);

drop policy if exists stitchworks_blocked_days_auth on public.stitchworks_blocked_days;
create policy stitchworks_blocked_days_auth
  on public.stitchworks_blocked_days for all
  to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------------
-- SEED: Mon/Tue/Wed are the day job. Editable in the UI afterwards.
-- Only seeds when the table is empty, so it never fights a later edit.
-- ---------------------------------------------------------------------------
insert into public.stitchworks_blocked_days (weekday, label)
select w, 'Day job'
from (values (1), (2), (3)) as t(w)
where not exists (select 1 from public.stitchworks_blocked_days);

commit;
