-- 014: Outreach tasks are one-per-WEEK, not one-per-day.
--
-- Migration 013 deduped rotation tasks on (fb_rotation, scheduled_date) and
-- off-day tasks on (fb_group_id, scheduled_date). That broke as soon as a
-- task's date could change: once a Monday "Post in Group A" had been moved to
-- Sunday, the Monday slot looked empty and the board created a second one.
-- The app now schedules outreach on today when the rotation's day has already
-- passed, so dates legitimately vary -- the key has to be the week.
--
-- date_trunc('week', ...) truncates to Monday, matching the board's Mon-first
-- weeks. The ::timestamp cast keeps the expression immutable (indexable).
--
-- Safe to re-run.

begin;

-- Clear same-week duplicates before the unique indexes are built, keeping the
-- best row: a completed one, else the latest-scheduled, else the newest.
-- Only INCOMPLETE rows are ever deleted; if two completed rows collide, the
-- index build below fails loudly instead of throwing away finished work.
delete from public.stitchworks_tasks t
using public.stitchworks_tasks keep
where t.fb_rotation is not null
  and keep.fb_rotation = t.fb_rotation
  and date_trunc('week', keep.scheduled_date::timestamp)
      = date_trunc('week', t.scheduled_date::timestamp)
  and keep.id <> t.id
  and t.completed_at is null
  and (keep.completed_at is not null
       or keep.scheduled_date > t.scheduled_date
       or (keep.scheduled_date = t.scheduled_date and keep.created_at > t.created_at));

delete from public.stitchworks_tasks t
using public.stitchworks_tasks keep
where t.fb_group_id is not null
  and keep.fb_group_id = t.fb_group_id
  and date_trunc('week', keep.scheduled_date::timestamp)
      = date_trunc('week', t.scheduled_date::timestamp)
  and keep.id <> t.id
  and t.completed_at is null
  and (keep.completed_at is not null
       or keep.scheduled_date > t.scheduled_date
       or (keep.scheduled_date = t.scheduled_date and keep.created_at > t.created_at));

drop index if exists public.stitchworks_tasks_fb_rotation_day_key;
drop index if exists public.stitchworks_tasks_fb_group_day_key;

create unique index if not exists stitchworks_tasks_fb_rotation_week_key
  on public.stitchworks_tasks (fb_rotation, (date_trunc('week', scheduled_date::timestamp)))
  where fb_rotation is not null;

create unique index if not exists stitchworks_tasks_fb_group_week_key
  on public.stitchworks_tasks (fb_group_id, (date_trunc('week', scheduled_date::timestamp)))
  where fb_group_id is not null;

commit;
