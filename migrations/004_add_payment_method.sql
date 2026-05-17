-- 004: Payment method on jobs
-- Adds a nullable enum so we can split paid revenue by cash/check/card/other
-- for the Numbers tab. Safe to re-run.

do $$ begin
  create type stitchworks_payment_method as enum ('cash', 'check', 'card', 'other');
exception when duplicate_object then null; end $$;

alter table public.stitchworks_jobs
  add column if not exists payment_method stitchworks_payment_method;
