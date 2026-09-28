-- 013: Facebook group outreach tracking, wired into the weekly planner.
--
-- Naming follows the stitchworks_ prefix convention (Head Water is shared).
-- Access is authenticated-only, matching 011/012.
--
-- WEEKDAY CONVENTION: 0 = Sunday .. 6 = Saturday, same as migration 012.

begin;

-- ---------------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------------
do $$ begin
  create type stitchworks_fb_region as enum
    ('ouray_montrose_san_miguel', 'grand_junction', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type stitchworks_fb_rotation as enum ('A', 'B');
exception when duplicate_object then null; end $$;

do $$ begin
  create type stitchworks_fb_group_status as enum ('active', 'paused', 'removed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type stitchworks_template_category as enum
    ('tent', 'awning', 'mail_in', 'general');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- POST TEMPLATES
-- ---------------------------------------------------------------------------
create table if not exists public.stitchworks_post_templates (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  body        text not null,
  category    stitchworks_template_category not null default 'general',
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- FB GROUPS
-- ---------------------------------------------------------------------------
create table if not exists public.stitchworks_fb_groups (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  url                text not null unique,
  region             stitchworks_fb_region not null default 'other',

  -- Days the group's own rules permit posting. Default = every day.
  -- Constrained to 0..6 and non-empty so "allowed nowhere" is unrepresentable.
  allowed_weekdays   smallint[] not null default '{0,1,2,3,4,5,6}',

  max_posts_per_week integer check (max_posts_per_week is null or max_posts_per_week > 0),
  rotation           stitchworks_fb_rotation not null default 'A',
  status             stitchworks_fb_group_status not null default 'active',
  rule_notes         text,
  created_at         timestamptz not null default now(),

  constraint stitchworks_fb_groups_weekdays_valid check (
    array_length(allowed_weekdays, 1) between 1 and 7
    and allowed_weekdays <@ array[0,1,2,3,4,5,6]::smallint[]
  )
);

create index if not exists stitchworks_fb_groups_status_idx
  on public.stitchworks_fb_groups(status);
create index if not exists stitchworks_fb_groups_rotation_idx
  on public.stitchworks_fb_groups(rotation);

-- ---------------------------------------------------------------------------
-- FB GROUP POSTS  (the log of what was actually posted, and when)
-- ---------------------------------------------------------------------------
create table if not exists public.stitchworks_fb_group_posts (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.stitchworks_fb_groups(id) on delete cascade,
  posted_at   timestamptz not null default now(),
  template_id uuid references public.stitchworks_post_templates(id) on delete set null,
  notes       text,
  created_at  timestamptz not null default now()
);

create index if not exists stitchworks_fb_group_posts_group_id_idx
  on public.stitchworks_fb_group_posts(group_id, posted_at desc);
create index if not exists stitchworks_fb_group_posts_posted_at_idx
  on public.stitchworks_fb_group_posts(posted_at);
create index if not exists stitchworks_fb_group_posts_template_id_idx
  on public.stitchworks_fb_group_posts(template_id);

-- ---------------------------------------------------------------------------
-- JOB ATTRIBUTION
-- ---------------------------------------------------------------------------
alter table public.stitchworks_jobs
  add column if not exists fb_group_id uuid
    references public.stitchworks_fb_groups(id) on delete set null;

create index if not exists stitchworks_jobs_fb_group_id_idx
  on public.stitchworks_jobs(fb_group_id);

-- ---------------------------------------------------------------------------
-- PLANNER WIRING
-- A rotation task is one-per-rotation-day; an off-day task is one per group
-- per day. Neither can dedupe through the existing (job_id, auto_rule) index,
-- because job_id is NULL for these and Postgres treats NULLs as distinct.
-- ---------------------------------------------------------------------------
alter table public.stitchworks_tasks
  add column if not exists fb_rotation stitchworks_fb_rotation,
  add column if not exists fb_group_id uuid
    references public.stitchworks_fb_groups(id) on delete cascade;

-- One "Post in Group A/B" task per rotation per date.
create unique index if not exists stitchworks_tasks_fb_rotation_day_key
  on public.stitchworks_tasks(fb_rotation, scheduled_date)
  where fb_rotation is not null;

-- One off-day catch-up task per group per date.
create unique index if not exists stitchworks_tasks_fb_group_day_key
  on public.stitchworks_tasks(fb_group_id, scheduled_date)
  where fb_group_id is not null;

-- ---------------------------------------------------------------------------
-- RLS -- authenticated only, matching 011/012
-- ---------------------------------------------------------------------------
alter table public.stitchworks_fb_groups      enable row level security;
alter table public.stitchworks_fb_group_posts enable row level security;
alter table public.stitchworks_post_templates enable row level security;

grant select, insert, update, delete on public.stitchworks_fb_groups      to authenticated;
grant select, insert, update, delete on public.stitchworks_fb_group_posts to authenticated;
grant select, insert, update, delete on public.stitchworks_post_templates to authenticated;

revoke all on public.stitchworks_fb_groups      from anon;
revoke all on public.stitchworks_fb_group_posts from anon;
revoke all on public.stitchworks_post_templates from anon;

drop policy if exists stitchworks_fb_groups_auth on public.stitchworks_fb_groups;
create policy stitchworks_fb_groups_auth
  on public.stitchworks_fb_groups for all
  to authenticated using (true) with check (true);

drop policy if exists stitchworks_fb_group_posts_auth on public.stitchworks_fb_group_posts;
create policy stitchworks_fb_group_posts_auth
  on public.stitchworks_fb_group_posts for all
  to authenticated using (true) with check (true);

drop policy if exists stitchworks_post_templates_auth on public.stitchworks_post_templates;
create policy stitchworks_post_templates_auth
  on public.stitchworks_post_templates for all
  to authenticated using (true) with check (true);

commit;
