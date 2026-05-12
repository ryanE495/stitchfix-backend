-- 002: Photo categories
-- Adds a `category` enum + column to stitchworks_job_photos. Existing rows
-- are backfilled to 'other' via the NOT NULL DEFAULT. Safe to re-run.

do $$ begin
  create type stitchworks_photo_category as enum
    ('intake', 'in_progress', 'finished', 'other');
exception when duplicate_object then null; end $$;

alter table public.stitchworks_job_photos
  add column if not exists category stitchworks_photo_category not null default 'other';
