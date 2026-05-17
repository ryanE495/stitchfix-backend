-- 006: Portfolio CMS fields + public-safe view
-- Adds portfolio columns to the EXISTING stitchworks_jobs table (no new tables)
-- and creates a view exposing only portfolio-safe fields for a public Astro
-- site to read. Photos are sourced from the existing stitchworks_job_photos
-- table (also not duplicated). Safe to re-run.

begin;

-- Columns on stitchworks_jobs
alter table public.stitchworks_jobs
  add column if not exists feature_in_portfolio    boolean not null default false,
  add column if not exists portfolio_title         text,
  add column if not exists portfolio_slug          text,
  add column if not exists portfolio_blurb         text,
  add column if not exists portfolio_location      text,
  add column if not exists portfolio_published_at  timestamptz;

-- Slugs must be unique across portfolio jobs. Nullable + unique index means
-- multiple NULLs are fine (Postgres allows that); only non-NULL slugs must
-- be distinct.
create unique index if not exists stitchworks_jobs_portfolio_slug_idx
  on public.stitchworks_jobs (portfolio_slug);

-- Partial index for the public site's "newest portfolio entries" listings.
create index if not exists stitchworks_jobs_portfolio_published_idx
  on public.stitchworks_jobs (portfolio_published_at desc)
  where feature_in_portfolio = true;

-- Public view: anon-safe whitelist of portfolio fields + joined photos array.
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
        jsonb_build_object(
          'photo_url', p.photo_url,
          'category',  p.category
        )
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

-- Grant explicit SELECT to anon so the public Astro site can read the view
-- via Supabase REST without needing access to the underlying tables.
grant select on public.stitchworks_public_portfolio to anon, authenticated;

commit;
