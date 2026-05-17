-- 008: Portfolio CMS as standalone table
-- Adds stitchworks_portfolio_items (a CMS-only entity, NOT linked to jobs)
-- plus the stitchworks-portfolio-images storage bucket. Anon read+write
-- matches the wide-open pattern of the rest of this project's tables;
-- the public Astro site filters status='published' itself when querying.
-- Safe to re-run.

begin;

-- Status enum
do $$ begin
  create type stitchworks_portfolio_status as enum ('draft', 'published');
exception when duplicate_object then null; end $$;

-- Table
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

-- Index for list-view ordering (drafts + published, by display_order then newest)
create index if not exists stitchworks_portfolio_items_order_idx
  on public.stitchworks_portfolio_items (display_order, created_at desc);

-- Partial index for the public site's "published only" queries
create index if not exists stitchworks_portfolio_items_published_idx
  on public.stitchworks_portfolio_items (display_order)
  where status = 'published';

-- updated_at trigger (reuses existing function from initial migration)
drop trigger if exists stitchworks_portfolio_items_set_updated_at on public.stitchworks_portfolio_items;
create trigger stitchworks_portfolio_items_set_updated_at
  before update on public.stitchworks_portfolio_items
  for each row execute function public.stitchworks_set_updated_at();

-- RLS: same wide-open pattern as the rest of stitchworks_* tables
alter table public.stitchworks_portfolio_items enable row level security;

drop policy if exists stitchworks_portfolio_items_open on public.stitchworks_portfolio_items;
create policy stitchworks_portfolio_items_open on public.stitchworks_portfolio_items
  for all to anon, authenticated using (true) with check (true);

-- Storage bucket
insert into storage.buckets (id, name, public)
values ('stitchworks-portfolio-images', 'stitchworks-portfolio-images', true)
on conflict (id) do update set public = excluded.public;

-- Storage policies
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
