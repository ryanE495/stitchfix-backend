-- 005: Job category for profitability analysis
-- Adds a nullable enum so the Numbers tab can group revenue/margin by work type.
-- Safe to re-run.

do $$ begin
  create type stitchworks_job_category as enum
    ('canvas_tent', 'upholstery_seats', 'awning', 'pack_bag_repair',
     'custom_build', 'leather', 'other');
exception when duplicate_object then null; end $$;

alter table public.stitchworks_jobs
  add column if not exists category stitchworks_job_category;
