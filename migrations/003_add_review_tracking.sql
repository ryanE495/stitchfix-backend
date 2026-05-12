-- 003: Review request tracking on jobs
-- For tracking whether a Google review has been asked for after a job is paid.
-- Safe to re-run.

alter table public.stitchworks_jobs
  add column if not exists review_requested    boolean not null default false,
  add column if not exists review_requested_at timestamptz;
