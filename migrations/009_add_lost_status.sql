-- 009: Add 'lost' status for jobs that didn't pan out
-- Placed BEFORE 'quoted' so it renders on the far left of the Kanban board.
-- App code excludes 'lost' jobs from "Active jobs" and "Active pipeline"
-- counts on the dashboard summary bar. Already excluded from Numbers tab
-- (that view filters to status='paid_closed').
--
-- Note: ALTER TYPE ADD VALUE cannot run inside an explicit transaction block,
-- so no begin/commit here. Re-running is safe via IF NOT EXISTS.

alter type stitchworks_job_status add value if not exists 'lost' before 'quoted';
