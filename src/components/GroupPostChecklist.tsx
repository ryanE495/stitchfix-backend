import { useMemo, useState } from 'react';
import { Modal } from './Modal';
import {
  useFbGroupPosts,
  useFbGroups,
  useLogFbPost,
  usePostTemplates,
} from '../hooks/useOutreach';
import { useToggleTask } from '../hooks/usePlanner';
import { canPostOn, planRotation } from '../lib/outreachRules';
import { startOfWeek, toIsoDate } from '../lib/dates';
import { errorMessage } from '../lib/errors';
import {
  TEMPLATE_CATEGORY_LABELS,
  type FbGroup,
  type TaskWithJob,
} from '../lib/types';

interface Props {
  task: TaskWithJob;
  rangeFrom: string;
  rangeTo: string;
  onClose: () => void;
}

type RowState = 'pending' | 'posted' | 'skipped';

/**
 * Checklist behind a "Post in Group A/B" task, or a single-group catch-up
 * task. The group list is recomputed live rather than frozen onto the task,
 * so per-week caps and rule edits since the task was created are respected.
 */
export function GroupPostChecklist({ task, rangeFrom, rangeTo, onClose }: Props) {
  const { data: groups = [] } = useFbGroups();
  const { data: posts = [] } = useFbGroupPosts();
  const { data: templates = [] } = usePostTemplates();
  const logPost = useLogFbPost();
  const toggleTask = useToggleTask(rangeFrom, rangeTo);

  // Eligibility is checked for TODAY -- the day you're actually posting --
  // not the task's scheduled day. A Monday task opened on Wednesday must not
  // offer a group whose rules only allow Mondays.
  const today = toIsoDate(new Date());
  const weekStart = startOfWeek(today);

  const targetGroups: FbGroup[] = useMemo(() => {
    if (task.fb_group_id) {
      const g = groups.find((x) => x.id === task.fb_group_id);
      return g && canPostOn(g, today, posts, weekStart) ? [g] : [];
    }
    if (task.fb_rotation) {
      return planRotation(task.fb_rotation, groups, posts, weekStart, today).onDay;
    }
    return [];
  }, [task.fb_group_id, task.fb_rotation, groups, posts, weekStart, today]);

  const [state, setState] = useState<Record<string, RowState>>({});
  const [templateFor, setTemplateFor] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeTemplates = templates.filter((t) => t.active);

  const rowState = (id: string): RowState => state[id] ?? 'pending';
  const allResolved =
    targetGroups.length > 0 && targetGroups.every((g) => rowState(g.id) !== 'pending');

  const copy = async (groupId: string, body: string) => {
    try {
      await navigator.clipboard.writeText(body);
      setCopied(groupId);
      window.setTimeout(() => setCopied((c) => (c === groupId ? null : c)), 1500);
    } catch {
      // Clipboard is blocked outside a secure context or without permission.
      setError('Copy failed — select the text and copy manually.');
    }
  };

  const markPosted = async (group: FbGroup) => {
    setError(null);
    try {
      await logPost.mutateAsync({
        group_id: group.id,
        template_id: templateFor[group.id] || null,
      });
      setState((s) => ({ ...s, [group.id]: 'posted' }));
    } catch (e) {
      setError(errorMessage(e, 'Could not log the post.'));
    }
  };

  const undo = (group: FbGroup) =>
    setState((s) => ({ ...s, [group.id]: 'pending' }));

  const finish = () => {
    if (!task.completed_at) toggleTask.mutate({ id: task.id, completed: true });
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={task.title} size="lg">
      <div className="space-y-4">
        {targetGroups.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center">
            <p className="text-sm font-medium text-slate-700">
              No groups can be posted in today.
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Today may not be one of their allowed days, or they've hit their weekly
              cap or been paused. If you already posted, set the date on the Groups
              page instead.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {targetGroups.map((g) => {
              const st = rowState(g.id);
              return (
                <li
                  key={g.id}
                  className={`rounded-xl border p-3 ${
                    st === 'posted'
                      ? 'border-brand-300 bg-brand-50/60'
                      : st === 'skipped'
                        ? 'border-slate-200 bg-slate-50 opacity-70'
                        : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900">{g.name}</p>
                      {g.rule_notes && (
                        <p className="mt-1 rounded bg-amber-50 px-2 py-1 text-[11px] leading-snug text-amber-900">
                          {g.rule_notes}
                        </p>
                      )}
                    </div>
                    <a
                      href={g.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Open group ↗
                    </a>
                  </div>

                  {st === 'pending' && (
                    <>
                      {activeTemplates.length > 0 && (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <select
                            value={templateFor[g.id] ?? ''}
                            onChange={(e) =>
                              setTemplateFor((t) => ({ ...t, [g.id]: e.target.value }))
                            }
                            aria-label={`Template for ${g.name}`}
                            className="min-h-[38px] flex-1 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
                          >
                            <option value="">— no template —</option>
                            {activeTemplates.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name} ({TEMPLATE_CATEGORY_LABELS[t.category]})
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            disabled={!templateFor[g.id]}
                            onClick={() => {
                              const t = templates.find((x) => x.id === templateFor[g.id]);
                              if (t) copy(g.id, t.body);
                            }}
                            className="min-h-[38px] rounded-lg border border-slate-300 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                          >
                            {copied === g.id ? 'Copied ✓' : 'Copy text'}
                          </button>
                        </div>
                      )}

                      <div className="mt-2 flex gap-2">
                        <label className="flex min-h-[40px] flex-1 cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-3 hover:bg-slate-50">
                          <input
                            type="checkbox"
                            checked={false}
                            onChange={() => markPosted(g)}
                            className="h-4 w-4 rounded border-slate-300"
                          />
                          <span className="text-sm font-medium text-slate-700">Posted</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => setState((s) => ({ ...s, [g.id]: 'skipped' }))}
                          className="min-h-[40px] rounded-lg border border-slate-300 px-3 text-sm text-slate-600 hover:bg-slate-50"
                        >
                          Skip
                        </button>
                      </div>
                    </>
                  )}

                  {st !== 'pending' && (
                    <div className="mt-2 flex items-center gap-2">
                      <span
                        className={`text-xs font-medium ${
                          st === 'posted' ? 'text-brand-800' : 'text-slate-500'
                        }`}
                      >
                        {st === 'posted' ? 'Posted ✓ (logged)' : 'Skipped'}
                      </span>
                      <button
                        type="button"
                        onClick={() => undo(g)}
                        className="ml-auto text-xs text-slate-500 underline hover:text-slate-700"
                      >
                        Undo
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {error && (
          <p className="rounded-lg bg-rust-50 px-3 py-2 text-sm text-rust-700">{error}</p>
        )}

        <div className="flex items-center gap-2 border-t border-slate-200 pt-4">
          <p className="mr-auto text-xs text-slate-500">
            {targetGroups.filter((g) => rowState(g.id) === 'posted').length} posted ·{' '}
            {targetGroups.filter((g) => rowState(g.id) === 'skipped').length} skipped
          </p>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
          <button
            type="button"
            onClick={finish}
            disabled={!allResolved}
            title={allResolved ? undefined : 'Post or skip every group first'}
            className="min-h-[44px] rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-40"
          >
            Done
          </button>
        </div>

        {/* "Undo" only clears the checklist row -- the logged post is real. */}
        {targetGroups.some((g) => rowState(g.id) === 'posted') && (
          <p className="text-[11px] text-slate-400">
            Posts are logged the moment you tick "Posted". Undo here clears the row but
            leaves the log entry — remove it from the group's history if it was a
            mistake.
          </p>
        )}
      </div>
    </Modal>
  );
}
