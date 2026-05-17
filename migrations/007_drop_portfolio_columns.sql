-- 007: Cleanup of migration 006 (portfolio-as-job-columns approach was reverted)
-- Drops the view, indexes, and 6 portfolio_* columns from stitchworks_jobs.
-- Migration 008 replaces this with a standalone stitchworks_portfolio_items table.
-- Safe to re-run.

begin;

drop view if exists public.stitchworks_public_portfolio;

drop index if exists public.stitchworks_jobs_portfolio_published_idx;
drop index if exists public.stitchworks_jobs_portfolio_slug_idx;

alter table public.stitchworks_jobs
  drop column if exists feature_in_portfolio,
  drop column if exists portfolio_title,
  drop column if exists portfolio_slug,
  drop column if exists portfolio_blurb,
  drop column if exists portfolio_location,
  drop column if exists portfolio_published_at;

commit;
