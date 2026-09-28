import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { TopNav } from '../components/TopNav';
import { DayColumn, DAY_ID_PREFIX } from '../components/DayColumn';
import { TaskCardView } from '../components/TaskCard';
import { TaskEditor } from '../components/TaskEditor';
import { GroupPostChecklist } from '../components/GroupPostChecklist';
import { PlannerSettings } from '../components/PlannerSettings';
import { WeekScoreboard } from '../components/WeekScoreboard';
import { useJobs } from '../hooks/useJobs';
import { useIsDesktop } from '../hooks/useIsDesktop';
import { useLocalStorage } from '../hooks/useLocalStorage';
import {
  useBlockedDays,
  useCreateTask,
  useMoveTask,
  useRecurringTasks,
  useTasks,
  useToggleTask,
  useCopyWeekPlan,
  useCarryOverTasks,
} from '../hooks/usePlanner';
import { runPlannerAutomation } from '../lib/plannerAutomation';
import { errorMessage } from '../lib/errors';
import { useFbGroups, useFbGroupPosts } from '../hooks/useOutreach';
import {
  addDays,
  formatShortDate,
  formatWeekRange,
  startOfWeek,
  toIsoDate,
  weekDates,
  weekdayOf,
} from '../lib/dates';
import {
  TASK_TYPES,
  TASK_TYPE_LABELS,
  type TaskType,
  type TaskWithJob,
} from '../lib/types';

const QUICK_ADD_TYPE_KEY = 'stitchworks.planner.quickAddType';

export function PlannerPage() {
  const today = toIsoDate(new Date());
  const [weekStart, setWeekStart] = useState(() => startOfWeek(today));
  const days = useMemo(() => weekDates(weekStart), [weekStart]);

  const rangeFrom = weekStart;
  const rangeTo = days[6];

  const isDesktop = useIsDesktop();
  const { data: tasks = [], isLoading, error } = useTasks(rangeFrom, rangeTo);
  const { data: jobs = [], isLoading: jobsLoading } = useJobs();
  const { data: recurring = [] } = useRecurringTasks();
  const { data: blocked = [] } = useBlockedDays();
  const { data: fbGroups = [] } = useFbGroups();
  const { data: fbPosts = [] } = useFbGroupPosts();

  const createTask = useCreateTask();
  const moveTask = useMoveTask(rangeFrom, rangeTo);
  const toggleTask = useToggleTask(rangeFrom, rangeTo);
  const copyWeek = useCopyWeekPlan();
  const carryOver = useCarryOverTasks();
  // Today's tasks, fetched separately so the carry-over button can show a
  // count even while a later week is on screen.
  const { data: todaysTasks = [] } = useTasks(today, today);
  const leftoverCount = todaysTasks.filter(
    (t) => !t.completed_at && !t.fb_rotation && !t.fb_group_id,
  ).length;
  const [copyNote, setCopyNote] = useState<string | null>(null);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [openTask, setOpenTask] = useState<TaskWithJob | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [quickAddType, setQuickAddType] = useLocalStorage<TaskType>(
    QUICK_ADD_TYPE_KEY,
    'business',
  );
  const [autoError, setAutoError] = useState<string | null>(null);

  // ── Automation ───────────────────────────────────────────────────────
  // Guarded against CONCURRENT runs (StrictMode double-mounts effects) and
  // re-run only when the week changes. The pass itself is idempotent, so a
  // stray extra run is harmless -- this just avoids the wasted round-trips.
  const running = useRef(false);
  const ranFor = useRef<string | null>(null);

  useEffect(() => {
    if (running.current) return;
    if (ranFor.current === weekStart) return;
    // Wait for the real job list. Running against an empty array would create
    // no auto tasks AND mark this week as done, so nothing would fire until
    // the week changed.
    if (jobsLoading) return;

    running.current = true;
    ranFor.current = weekStart;

    runPlannerAutomation({
      jobs,
      recurring,
      blocked,
      fbGroups,
      fbPosts,
      weekDatesIso: days,
      today,
    })
      .then(() => setAutoError(null))
      .catch((e: unknown) => setAutoError(errorMessage(e, 'Automation failed.')))
      .finally(() => {
        running.current = false;
      });
    // `jobs`/`recurring`/`blocked` are read at run time; re-running on every
    // array identity change would loop, since the pass writes tasks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart, jobsLoading]);

  // ── Grouping ─────────────────────────────────────────────────────────
  const byDay = useMemo(() => {
    const map = new Map<string, TaskWithJob[]>();
    days.forEach((d) => map.set(d, []));
    for (const t of tasks) {
      const bucket = map.get(t.scheduled_date);
      if (bucket) bucket.push(t);
    }
    // Open tasks first, then completed, each in insertion order.
    for (const [, list] of map) {
      list.sort((a, b) => Number(Boolean(a.completed_at)) - Number(Boolean(b.completed_at)));
    }
    return map;
  }, [tasks, days]);

  const blockedLabelFor = useMemo(() => {
    const byWeekday = new Map(
      blocked.filter((b) => b.weekday != null).map((b) => [b.weekday as number, b.label]),
    );
    const byDate = new Map(
      blocked.filter((b) => b.date != null).map((b) => [b.date as string, b.label]),
    );
    return (date: string): string | null =>
      byDate.get(date) ?? byWeekday.get(weekdayOf(date)) ?? null;
  }, [blocked]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor),
  );

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) ?? null : null;

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));

  const onDragEnd = (e: DragEndEvent) => {
    const draggedId = activeId ?? String(e.active.id);
    setActiveId(null);

    const { over } = e;
    if (!over) return;
    const overId = String(over.id);

    let targetDate: string | null = null;
    if (overId.startsWith(DAY_ID_PREFIX)) {
      targetDate = overId.slice(DAY_ID_PREFIX.length);
    } else {
      const overTask = tasks.find((t) => t.id === overId);
      if (overTask) targetDate = overTask.scheduled_date;
    }

    const dragged = tasks.find((t) => t.id === draggedId);
    if (!targetDate || !dragged || dragged.scheduled_date === targetDate) return;

    moveTask.mutate({ id: draggedId, scheduled_date: targetDate });
  };

  const onQuickAdd = (date: string, title: string) => {
    createTask.mutate({ title, type: quickAddType, scheduled_date: date });
  };

  const onToggle = (task: TaskWithJob) =>
    toggleTask.mutate({ id: task.id, completed: !task.completed_at });

  const thisWeek = startOfWeek(today);
  const nextWeek = addDays(thisWeek, 7);
  const isWeekend = [0, 6].includes(weekdayOf(today));

  const moveLeftovers = async () => {
    if (
      !window.confirm(
        `Move today's ${leftoverCount} unfinished task${leftoverCount === 1 ? '' : 's'} into this week?\n\n` +
          "They'll go on the week's first unblocked day, and won't get a rollover badge. " +
          "Group-posting tasks stay put, since this week has its own.",
      )
    )
      return;
    setCopyNote(null);
    try {
      const r = await carryOver.mutateAsync({ targetWeekStart: weekStart, blocked, today });
      setCopyNote(
        r.moved === 0
          ? 'Nothing unfinished to move.'
          : `Moved ${r.moved} task${r.moved === 1 ? '' : 's'} to ${formatShortDate(r.date)}.`,
      );
    } catch (e) {
      setCopyNote(errorMessage(e, 'Move failed.'));
    }
  };

  const copyPrevious = async () => {
    const from = addDays(weekStart, -7);
    if (
      !window.confirm(
        `Copy your tasks from ${formatWeekRange(from)} onto the same days of this week?\n\n` +
          'Tasks already here are skipped, and so are days that are over. ' +
          'Auto and recurring tasks are left out; the board makes those itself.',
      )
    )
      return;
    setCopyNote(null);
    try {
      const r = await copyWeek.mutateAsync({ fromWeekStart: from, toWeekStart: weekStart, today });
      const extra = [
        r.skippedExisting ? `${r.skippedExisting} already here` : '',
        r.skippedPast ? `${r.skippedPast} on days that are over` : '',
      ].filter(Boolean).join(', ');
      setCopyNote(
        r.copied === 0
          ? `Nothing new to copy${extra ? ` (${extra})` : ''}.`
          : `Copied ${r.copied} task${r.copied === 1 ? '' : 's'}${extra ? ` · skipped ${extra}` : ''}.`,
      );
    } catch (e) {
      setCopyNote(errorMessage(e, 'Copy failed.'));
    }
  };

  return (
    <div className="flex h-full flex-col">
      <TopNav
        title="Planner"
        extras={
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setWeekStart(addDays(weekStart, -7))}
              aria-label="Previous week"
              className="flex h-10 min-w-10 items-center justify-center gap-1 rounded-lg px-2 text-sm text-slate-600 hover:bg-slate-100"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              <span className="hidden sm:inline">Prev</span>
            </button>
            <button
              type="button"
              onClick={() => setWeekStart(thisWeek)}
              disabled={weekStart === thisWeek}
              className="min-h-[40px] rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setWeekStart(addDays(weekStart, 7))}
              aria-label="Next week"
              className="flex h-10 min-w-10 items-center justify-center gap-1 rounded-lg px-2 text-sm text-slate-600 hover:bg-slate-100"
            >
              <span className="hidden sm:inline">Next week</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        }
        action={
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="min-h-[44px] rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Settings
          </button>
        }
      />

      <main className="flex-1 overflow-y-auto px-3 py-4 sm:px-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-slate-900">
              {formatWeekRange(weekStart)}
            </p>
            <p className="text-xs text-slate-500">
              {weekStart === thisWeek
                ? 'This week'
                : weekStart === nextWeek
                  ? 'Next week'
                  : weekStart < thisWeek
                    ? 'Past week'
                    : 'Future week'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Weekend nudge: the usual time to lay out the coming week. */}
            {weekStart === thisWeek && isWeekend && (
              <button
                type="button"
                onClick={() => setWeekStart(nextWeek)}
                className="min-h-[40px] rounded-lg bg-brand-700 px-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-800"
              >
                Plan next week →
              </button>
            )}
            {/* Leftovers can only move forward, into a week after this one. */}
            {weekStart > thisWeek && leftoverCount > 0 && (
              <button
                type="button"
                onClick={moveLeftovers}
                disabled={carryOver.isPending}
                className="min-h-[40px] rounded-lg bg-brand-700 px-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-800 disabled:opacity-60"
              >
                {carryOver.isPending ? 'Moving…' : `Move today's unfinished here (${leftoverCount})`}
              </button>
            )}
            {/* Copying only makes sense into a week that isn't over. */}
            {days[6] >= today && (
              <button
                type="button"
                onClick={copyPrevious}
                disabled={copyWeek.isPending}
                className="min-h-[40px] rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                {copyWeek.isPending ? 'Copying…' : "Copy previous week's plan"}
              </button>
            )}
          </div>

          <label className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Quick-add type
            </span>
            <select
              value={quickAddType}
              onChange={(e) => setQuickAddType(e.target.value as TaskType)}
              className="min-h-[40px] rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
            >
              {TASK_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TASK_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </label>
        </div>

        {copyNote && (
          <p className="mb-3 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">{copyNote}</p>
        )}

        <div className="mb-4">
          <WeekScoreboard tasks={tasks} jobs={jobs} weekDatesIso={days} />
        </div>

        {autoError && (
          <p className="mb-3 rounded-lg bg-rust-50 px-3 py-2 text-sm text-rust-700">
            Automation didn't run: {autoError}
          </p>
        )}

        {error ? (
          <p className="text-sm text-rust-700">
            Couldn't load tasks: {errorMessage(error)}
          </p>
        ) : isLoading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={pointerWithin}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          >
            <div className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-2 md:grid md:grid-cols-7 md:overflow-visible md:snap-none">
              {days.map((date) => (
                <DayColumn
                  key={date}
                  date={date}
                  tasks={byDay.get(date) ?? []}
                  isToday={date === today}
                  isPast={date < today}
                  blockedLabel={blockedLabelFor(date)}
                  draggable={isDesktop}
                  defaultType={quickAddType}
                  onToggle={onToggle}
                  onOpen={setOpenTask}
                  onQuickAdd={onQuickAdd}
                />
              ))}
            </div>

            <DragOverlay>
              {activeTask && (
                <TaskCardView
                  task={activeTask}
                  onToggle={() => {}}
                  onOpen={() => {}}
                  dragging
                />
              )}
            </DragOverlay>
          </DndContext>
        )}

        {!isDesktop && (
          <p className="mt-3 text-center text-[11px] text-slate-400">
            Drag between days is desktop-only — tap a task to change its date.
          </p>
        )}
      </main>

      {/* Outreach tasks open the posting checklist; everything else opens
          the normal editor. */}
      {openTask &&
        (openTask.fb_rotation || openTask.fb_group_id ? (
          <GroupPostChecklist
            key={openTask.id}
            task={openTask}
            rangeFrom={rangeFrom}
            rangeTo={rangeTo}
            onClose={() => setOpenTask(null)}
          />
        ) : (
          <TaskEditor
            key={openTask.id}
            task={openTask}
            onClose={() => setOpenTask(null)}
          />
        ))}
      {settingsOpen && <PlannerSettings onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
