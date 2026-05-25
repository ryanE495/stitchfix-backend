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
    ('lost', 'quoted', 'awaiting_dropoff', 'in_shop', 'in_progress',
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
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

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

-- ---------------------------------------------------------------------------
-- PORTFOLIO CMS (standalone table; not linked to jobs)
-- ---------------------------------------------------------------------------
do $$ begin
  create type stitchworks_portfolio_status as enum ('draft', 'published');
exception when duplicate_object then null; end $$;

create table if not exists public.stitchworks_portfolio_items (
  id                    uuid primary key default gen_random_uuid(),
  title                 text not null,
  category              stitchworks_job_category,
  description           text not null,
  materials_techniques  text[] not null default '{}',
  approach              text,
  challenge             text,
  detail_1_label        text,
  detail_1_value        text,
  detail_2_label        text,
  detail_2_value        text,
  detail_3_label        text,
  detail_3_value        text,
  before_image_url      text,
  after_image_url       text,
  before_storage_path   text,
  after_storage_path    text,
  display_order         integer not null default 0,
  status                stitchworks_portfolio_status not null default 'draft',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists stitchworks_portfolio_items_order_idx
  on public.stitchworks_portfolio_items (display_order, created_at desc);

create index if not exists stitchworks_portfolio_items_published_idx
  on public.stitchworks_portfolio_items (display_order)
  where status = 'published';

drop trigger if exists stitchworks_portfolio_items_set_updated_at on public.stitchworks_portfolio_items;
create trigger stitchworks_portfolio_items_set_updated_at
  before update on public.stitchworks_portfolio_items
  for each row execute function public.stitchworks_set_updated_at();

alter table public.stitchworks_portfolio_items enable row level security;
drop policy if exists stitchworks_portfolio_items_open on public.stitchworks_portfolio_items;
create policy stitchworks_portfolio_items_open on public.stitchworks_portfolio_items
  for all to anon, authenticated using (true) with check (true);

insert into storage.buckets (id, name, public)
values ('stitchworks-portfolio-images', 'stitchworks-portfolio-images', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists stitchworks_portfolio_images_read   on storage.objects;
drop policy if exists stitchworks_portfolio_images_insert on storage.objects;
drop policy if exists stitchworks_portfolio_images_update on storage.objects;
drop policy if exists stitchworks_portfolio_images_delete on storage.objects;

create policy stitchworks_portfolio_images_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'stitchworks-portfolio-images');

create policy stitchworks_portfolio_images_insert on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'stitchworks-portfolio-images');

create policy stitchworks_portfolio_images_update on storage.objects
  for update to anon, authenticated
  using (bucket_id = 'stitchworks-portfolio-images');

create policy stitchworks_portfolio_images_delete on storage.objects
  for delete to anon, authenticated
  using (bucket_id = 'stitchworks-portfolio-images');

commit;
