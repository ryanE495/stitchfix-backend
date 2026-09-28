import { useMemo, useState } from 'react';
import { TopNav } from '../components/TopNav';
import { TemplatePerformance } from '../components/TemplatePerformance';
import { useJobs } from '../hooks/useJobs';
import {
  useFbGroupPosts,
  useFbGroups,
  useSetLastPosted,
  useSetRotations,
  useUpdateFbGroup,
} from '../hooks/useOutreach';
import { autoBalanceRotations, computeGroupStats } from '../lib/outreachRules';
import { localDayOf, startOfWeek, toIsoDate } from '../lib/dates';
import { formatCurrency } from '../lib/format';
import { errorMessage } from '../lib/errors';
import {
  FB_GROUP_STATUSES,
  FB_GROUP_STATUS_LABELS,
  FB_REGIONS,
  FB_REGION_LABELS,
  FB_ROTATIONS,
  STALE_GROUP_DAYS,
  WEEKDAY_LABELS,
  type FbGroupStatus,
  type FbGroupStats,
  type FbRegion,
  type FbRotation,
} from '../lib/types';

type SortKey = 'revenue' | 'name' | 'daysSince' | 'jobs';
type RegionFilter = FbRegion | 'all';

/** "All days" / "Mon, Thu" */
function allowedDaysLabel(days: number[]): string {
  if (days.length >= 7) return 'All days';
  return [...days]
    .sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)) // Mon-first display order
    .map((d) => WEEKDAY_LABELS[d])
    .join(', ');
}

export function GroupsPage() {
  const { data: groups = [], isLoading, error } = useFbGroups();
  const { data: posts = [] } = useFbGroupPosts();
  const { data: jobs = [] } = useJobs();
  const updateGroup = useUpdateFbGroup();
  const setRotations = useSetRotations();
  const setLastPosted = useSetLastPosted();

  const [sort, setSort] = useState<SortKey>('revenue');
  const [region, setRegion] = useState<RegionFilter>('all');
  const [showRemoved, setShowRemoved] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  const today = toIsoDate(new Date());
  const weekStart = startOfWeek(today);

  const stats = useMemo(
    () => computeGroupStats(groups, posts, jobs, today, weekStart),
    [groups, posts, jobs, today, weekStart],
  );

  const visible = useMemo(() => {
    let rows = stats;
    if (!showRemoved) rows = rows.filter((s) => s.group.status !== 'removed');
    if (region !== 'all') rows = rows.filter((s) => s.group.region === region);

    const sorted = [...rows];
    sorted.sort((a, b) => {
      switch (sort) {
        case 'name':
          return a.group.name.localeCompare(b.group.name);
        case 'jobs':
          return b.jobsSourced - a.jobsSourced;
        case 'daysSince':
          // Never-posted sorts as most stale.
          return (b.daysSince ?? Number.MAX_SAFE_INTEGER) -
            (a.daysSince ?? Number.MAX_SAFE_INTEGER);
        case 'revenue':
        default:
          return b.revenueSourced - a.revenueSourced;
      }
    });
    return sorted;
  }, [stats, sort, region, showRemoved]);

  const totals = useMemo(
    () => ({
      revenue: stats.reduce((s, r) => s + r.revenueSourced, 0),
      jobs: stats.reduce((s, r) => s + r.jobsSourced, 0),
      active: stats.filter((r) => r.group.status === 'active').length,
      stale: stats.filter(
        (r) => r.group.status === 'active' && (r.daysSince ?? 999) > STALE_GROUP_DAYS,
      ).length,
    }),
    [stats],
  );

  const changeLastPosted = async (groupId: string, day: string) => {
    // Browsers fire onChange for half-typed dates (year "0002" on the way to
    // "2026"), so only commit a complete, plausible, non-future day.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day < '2020-01-01' || day > today) return;
    setPageError(null);
    try {
      await setLastPosted.mutateAsync({
        groupId,
        day,
        groupPosts: posts.filter((p) => p.group_id === groupId),
      });
    } catch (e) {
      setPageError(errorMessage(e, 'Could not update the last posted date.'));
    }
  };

  const patch = async (id: string, p: Parameters<typeof updateGroup.mutateAsync>[0]['patch']) => {
    setPageError(null);
    try {
      await updateGroup.mutateAsync({ id, patch: p });
    } catch (e) {
      setPageError(errorMessage(e, 'Could not save.'));
    }
  };

  const balance = async () => {
    const changes = autoBalanceRotations(groups);
    if (changes.length === 0) {
      setPageError('Rotations are already balanced by region — nothing to change.');
      return;
    }
    if (
      !window.confirm(
        `Reassign rotation for ${changes.length} group${changes.length === 1 ? '' : 's'} so each region is split evenly between A and B?`,
      )
    )
      return;
    setPageError(null);
    try {
      await setRotations.mutateAsync(changes);
    } catch (e) {
      setPageError(errorMessage(e, 'Could not rebalance.'));
    }
  };

  const CELL = 'px-2 py-2 align-middle';

  return (
    <div className="flex h-full flex-col">
      <TopNav
        title="Groups"
        extras={
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value as RegionFilter)}
              aria-label="Filter by region"
              className="min-h-[40px] rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
            >
              <option value="all">All regions</option>
              {FB_REGIONS.map((r) => (
                <option key={r} value={r}>
                  {FB_REGION_LABELS[r]}
                </option>
              ))}
            </select>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              aria-label="Sort by"
              className="min-h-[40px] rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
            >
              <option value="revenue">Sort: Revenue</option>
              <option value="jobs">Sort: Jobs</option>
              <option value="daysSince">Sort: Days since</option>
              <option value="name">Sort: Name</option>
            </select>
          </div>
        }
        action={
          <button
            type="button"
            onClick={balance}
            disabled={setRotations.isPending}
            className="min-h-[44px] rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {setRotations.isPending ? 'Balancing…' : 'Auto-balance A/B'}
          </button>
        }
      />

      <main className="flex-1 overflow-y-auto px-3 py-4 sm:px-5">
        {/* Summary */}
        <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
          {[
            { label: 'Active groups', value: String(totals.active) },
            { label: 'Jobs sourced', value: String(totals.jobs) },
            { label: 'Revenue sourced', value: formatCurrency(totals.revenue) },
            {
              label: `Stale > ${STALE_GROUP_DAYS}d`,
              value: String(totals.stale),
              warn: totals.stale > 0,
            },
          ].map((t) => (
            <div key={t.label} className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                {t.label}
              </p>
              <p
                className={`mt-1 text-xl font-semibold tabular-nums ${
                  t.warn ? 'text-rust-700' : 'text-slate-900'
                }`}
              >
                {t.value}
              </p>
            </div>
          ))}
        </div>

        <label className="mb-3 flex min-h-[36px] items-center gap-2">
          <input
            type="checkbox"
            checked={showRemoved}
            onChange={(e) => setShowRemoved(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          <span className="text-xs text-slate-600">Show removed groups</span>
        </label>

        {pageError && (
          <p className="mb-3 rounded-lg bg-rust-50 px-3 py-2 text-sm text-rust-700">
            {pageError}
          </p>
        )}

        {error ? (
          <p className="text-sm text-rust-700">
            Couldn't load groups: {errorMessage(error)}
          </p>
        ) : isLoading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : visible.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
            <p className="text-sm font-medium text-slate-700">No groups yet.</p>
            <p className="mt-1 text-xs text-slate-500">
              Run the CSV import script to bring in your sheet.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full min-w-[920px] text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-[11px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className={CELL}>Group</th>
                  <th className={CELL}>Region</th>
                  <th className={CELL}>Rot</th>
                  <th className={CELL}>Allowed days</th>
                  <th className={CELL}>Last posted</th>
                  <th className={`${CELL} text-right`}>Days</th>
                  <th className={`${CELL} text-right`}>Jobs</th>
                  <th className={`${CELL} text-right`}>Revenue</th>
                  <th className={CELL}>Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visible.map((s: FbGroupStats) => {
                  const stale =
                    s.group.status === 'active' &&
                    (s.daysSince == null || s.daysSince > STALE_GROUP_DAYS);
                  return (
                    <tr key={s.group.id} className="hover:bg-slate-50/60">
                      <td className={CELL}>
                        <a
                          href={s.group.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-slate-900 hover:text-brand-700 hover:underline"
                        >
                          {s.group.name}
                        </a>
                        {s.group.max_posts_per_week != null && (
                          <span className="ml-1.5 text-[10px] text-slate-400">
                            max {s.group.max_posts_per_week}/wk · {s.postsThisWeek} used
                          </span>
                        )}
                        {/* Inline rule editing: commits on blur, not per keystroke. */}
                        <input
                          type="text"
                          defaultValue={s.group.rule_notes ?? ''}
                          onBlur={(e) => {
                            const v = e.target.value.trim();
                            if (v !== (s.group.rule_notes ?? '')) {
                              patch(s.group.id, { rule_notes: v || null });
                            }
                          }}
                          placeholder="rules / notes…"
                          aria-label={`Rules for ${s.group.name}`}
                          className="mt-0.5 block w-[320px] max-w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-[11px] text-slate-500 hover:border-slate-200 focus:border-brand-400 focus:bg-white focus:text-slate-700 focus:outline-none"
                        />
                      </td>

                      <td className={`${CELL} text-xs text-slate-600`}>
                        {FB_REGION_LABELS[s.group.region]}
                      </td>

                      <td className={CELL}>
                        <select
                          value={s.group.rotation}
                          onChange={(e) =>
                            patch(s.group.id, { rotation: e.target.value as FbRotation })
                          }
                          aria-label={`Rotation for ${s.group.name}`}
                          className="min-h-[32px] rounded border border-slate-300 bg-white px-1 py-0.5 text-xs"
                        >
                          {FB_ROTATIONS.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className={`${CELL} text-xs text-slate-600`}>
                        {allowedDaysLabel(s.group.allowed_weekdays)}
                      </td>

                      <td className={CELL}>
                        {/* Later date = log a new post; earlier = correct the latest. */}
                        <input
                          type="date"
                          value={s.lastPostedAt ? localDayOf(s.lastPostedAt) : ''}
                          max={today}
                          onChange={(e) => changeLastPosted(s.group.id, e.target.value)}
                          aria-label={`Last posted in ${s.group.name}`}
                          title={s.lastPostedAt ? undefined : 'Never posted'}
                          className={`min-h-[32px] rounded border border-slate-300 bg-white px-1 py-0.5 text-xs ${
                            s.lastPostedAt ? 'text-slate-700' : 'text-slate-400'
                          }`}
                        />
                      </td>

                      <td
                        className={`${CELL} text-right tabular-nums ${
                          stale ? 'font-semibold text-rust-700' : 'text-slate-600'
                        }`}
                      >
                        {s.daysSince == null ? '—' : s.daysSince}
                      </td>

                      <td className={`${CELL} text-right tabular-nums text-slate-700`}>
                        {s.jobsSourced || '—'}
                      </td>

                      <td className={`${CELL} text-right tabular-nums font-medium text-slate-900`}>
                        {s.revenueSourced > 0 ? formatCurrency(s.revenueSourced) : '—'}
                      </td>

                      <td className={CELL}>
                        <select
                          value={s.group.status}
                          onChange={(e) =>
                            patch(s.group.id, { status: e.target.value as FbGroupStatus })
                          }
                          aria-label={`Status for ${s.group.name}`}
                          className="min-h-[32px] rounded border border-slate-300 bg-white px-1 py-0.5 text-xs"
                        >
                          {FB_GROUP_STATUSES.map((st) => (
                            <option key={st} value={st}>
                              {FB_GROUP_STATUS_LABELS[st]}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-6">
          <TemplatePerformance />
        </div>
      </main>
    </div>
  );
}
