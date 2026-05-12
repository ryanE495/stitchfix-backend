-- 001: Follow-up flags on jobs
-- Adds two columns to stitchworks_jobs so a job can be flagged for follow-up
-- with an optional target date. Safe to re-run.

alter table public.stitchworks_jobs
  add column if not exists needs_followup boolean not null default false,
  add column if not exists followup_by    date;
