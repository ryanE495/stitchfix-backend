-- Stitchworks job tracker — schema migration
-- All tables/enums/buckets prefixed with `stitchworks_` (or `stitchworks-` for
-- buckets) because this Supabase project hosts multiple apps and follows a
-- prefix-namespacing convention.
--
-- Access model: NO AUTH. The app ships without a login screen and relies on
-- the obscurity of the deploy URL. RLS stays enabled (Supabase best practice)
-- but the policies allow anon read/write. If you want to gate this behind a
-- login again, swap the `_open` policies for email-gated ones (see git log).
--
-- Safe to re-run: types/tables/indexes/policies are guarded so this is idempotent.

begin;

-- ---------------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------------
do $$ begin
  create type stitchworks_contact_source as enum
    ('facebook', 'phone', 'walk_in', 'referral', 'google', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type stitchworks_job_status as enum
    ('quoted', 'awaiting_dropoff', 'in_shop', 'in_progress',
     'complete_awaiting_pickup', 'paid_closed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type stitchworks_photo_category as enum
    ('intake', 'in_progress', 'finished', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type stitchworks_payment_method as enum ('cash', 'check', 'card', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type stitchworks_job_category as enum
    ('canvas_tent', 'upholstery_seats', 'awning', 'pack_bag_repair',
     'custom_build', 'leather', 'other');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- TABLES
-- ---------------------------------------------------------------------------
create table if not exists public.stitchworks_customers (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  phone           text,
  contact_source  stitchworks_contact_source not null default 'other',
  contact_handle  text,
  notes           text,
  created_at      timestamptz not null default now()
);

create table if not exists public.stitchworks_jobs (
  id                uuid primary key default gen_random_uuid(),
  customer_id       uuid not null references public.stitchworks_customers(id) on delete cascade,
  item_description  text not null,
  status            stitchworks_job_status not null default 'quoted',
  date_received     date,
  date_promised     date,
  date_completed    date,
  date_paid         date,
  quote_amount      numeric(10,2),
  actual_charged    numeric(10,2),
  materials_cost    numeric(10,2),
  hours_worked      numeric(6,2),
  notes             text,
  needs_followup    boolean not null default false,
  followup_by       date,
  review_requested  boolean not null default false,
  review_requested_at timestamptz,
  payment_method    stitchworks_payment_method,
  category          stitchworks_job_category,
  feature_in_portfolio   boolean not null default false,
  portfolio_title        text,
  portfolio_slug         text,
  portfolio_blurb        text,
  portfolio_location     text,
  portfolio_published_at timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create unique index if not exists stitchworks_jobs_portfolio_slug_idx
  on public.stitchworks_jobs (portfolio_slug);

create index if not exists stitchworks_jobs_portfolio_published_idx
  on public.stitchworks_jobs (portfolio_published_at desc)
  where feature_in_portfolio = true;

-- Public portfolio view (anon-safe whitelist)
create or replace view public.stitchworks_public_portfolio as
select
  j.portfolio_title,
  j.portfolio_slug,
  j.portfolio_blurb,
  j.portfolio_location,
  j.portfolio_published_at,
  j.category,
  j.item_description,
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object('photo_url', p.photo_url, 'category', p.category)
        order by
          case p.category
            when 'intake' then 1
            when 'in_progress' then 2
            when 'finished' then 3
            else 4
          end,
          p.created_at
      )
      from public.stitchworks_job_photos p
      where p.job_id = j.id
    ),
    '[]'::jsonb
  ) as photos
from public.stitchworks_jobs j
where j.feature_in_portfolio = true;

grant select on public.stitchworks_public_portfolio to anon, authenticated;

create index if not exists stitchworks_jobs_customer_id_idx
  on public.stitchworks_jobs(customer_id);
create index if not exists stitchworks_jobs_status_idx
  on public.stitchworks_jobs(status);

create table if not exists public.stitchworks_job_photos (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid not null references public.stitchworks_jobs(id) on delete cascade,
  photo_url   text not null,
  storage_path text,
  caption     text,
  category    stitchworks_photo_category not null default 'other',
  created_at  timestamptz not null default now()
);

create index if not exists stitchworks_job_photos_job_id_idx
  on public.stitchworks_job_photos(job_id);

-- updated_at trigger for jobs
create or replace function public.stitchworks_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists stitchworks_jobs_set_updated_at on public.stitchworks_jobs;
create trigger stitchworks_jobs_set_updated_at
  before update on public.stitchworks_jobs
  for each row execute function public.stitchworks_set_updated_at();

-- ---------------------------------------------------------------------------
-- ROW-LEVEL SECURITY (open access, anon allowed)
-- ---------------------------------------------------------------------------
alter table public.stitchworks_customers  enable row level security;
alter table public.stitchworks_jobs       enable row level security;
alter table public.stitchworks_job_photos enable row level security;

drop policy if exists stitchworks_customers_authorized  on public.stitchworks_customers;
drop policy if exists stitchworks_jobs_authorized       on public.stitchworks_jobs;
drop policy if exists stitchworks_job_photos_authorized on public.stitchworks_job_photos;

drop policy if exists stitchworks_customers_open  on public.stitchworks_customers;
drop policy if exists stitchworks_jobs_open       on public.stitchworks_jobs;
drop policy if exists stitchworks_job_photos_open on public.stitchworks_job_photos;

create policy stitchworks_customers_open on public.stitchworks_customers
  for all to anon, authenticated using (true) with check (true);
create policy stitchworks_jobs_open on public.stitchworks_jobs
  for all to anon, authenticated using (true) with check (true);
create policy stitchworks_job_photos_open on public.stitchworks_job_photos
  for all to anon, authenticated using (true) with check (true);

-- ---------------------------------------------------------------------------
-- STORAGE BUCKET + POLICIES (open access)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('stitchworks-job-photos', 'stitchworks-job-photos', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists stitchworks_job_photos_read   on storage.objects;
drop policy if exists stitchworks_job_photos_insert on storage.objects;
drop policy if exists stitchworks_job_photos_update on storage.objects;
drop policy if exists stitchworks_job_photos_delete on storage.objects;

create policy stitchworks_job_photos_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'stitchworks-job-photos');

create policy stitchworks_job_photos_insert on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'stitchworks-job-photos');

create policy stitchworks_job_photos_update on storage.objects
  for update to anon, authenticated
  using (bucket_id = 'stitchworks-job-photos');

create policy stitchworks_job_photos_delete on storage.objects
  for delete to anon, authenticated
  using (bucket_id = 'stitchworks-job-photos');

commit;
