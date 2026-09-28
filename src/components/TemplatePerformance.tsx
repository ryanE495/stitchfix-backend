import { useMemo, useState } from 'react';
import {
  useDeleteTemplate,
  useFbGroupPosts,
  usePostTemplates,
  useUpsertTemplate,
} from '../hooks/useOutreach';
import { useJobs } from '../hooks/useJobs';
import { computeTemplateStats } from '../lib/outreachRules';
import { errorMessage } from '../lib/errors';
import {
  TEMPLATE_CATEGORIES,
  TEMPLATE_CATEGORY_LABELS,
  type TemplateCategory,
} from '../lib/types';

const LABEL = 'text-xs font-semibold uppercase tracking-wide text-slate-500';
const FIELD =
  'mt-1 block w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm';

export function TemplatePerformance() {
  const { data: templates = [] } = usePostTemplates();
  const { data: posts = [] } = useFbGroupPosts();
  const { data: jobs = [] } = useJobs();
  const upsert = useUpsertTemplate();
  const remove = useDeleteTemplate();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<TemplateCategory>('general');
  const [error, setError] = useState<string | null>(null);

  const stats = useMemo(
    () => computeTemplateStats(templates, posts, jobs).sort((a, b) => b.posts - a.posts),
    [templates, posts, jobs],
  );

  const add = async () => {
    setError(null);
    if (!name.trim()) return setError('Template needs a name.');
    if (!body.trim()) return setError('Template needs body text.');
    try {
      await upsert.mutateAsync({
        name: name.trim(),
        body: body.trim(),
        category,
        active: true,
      });
      setName('');
      setBody('');
      setOpen(false);
    } catch (e) {
      setError(errorMessage(e, 'Could not save the template.'));
    }
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="mr-auto">
          <h2 className="text-sm font-semibold text-slate-900">Template performance</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Jobs counted when they arrived from a posted-in group within 7 days of a
            post using that template.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="min-h-[40px] rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          {open ? 'Cancel' : '+ New template'}
        </button>
      </div>

      {open && (
        <div className="mt-3 rounded-lg border border-dashed border-slate-300 p-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="block">
              <span className={LABEL}>Name</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Tent season opener"
                className={FIELD}
              />
            </label>
            <label className="block">
              <span className={LABEL}>Category</span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as TemplateCategory)}
                className={FIELD}
              >
                {TEMPLATE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {TEMPLATE_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="mt-2 block">
            <span className={LABEL}>Body</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              placeholder="The post text you'll copy into the group."
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            />
          </label>
          <button
            type="button"
            onClick={add}
            disabled={upsert.isPending}
            className="mt-3 min-h-[44px] w-full rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
          >
            Save template
          </button>
        </div>
      )}

      {error && (
        <p className="mt-3 rounded-lg bg-rust-50 px-3 py-2 text-sm text-rust-700">{error}</p>
      )}

      {stats.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">
          No templates yet. Add one and it becomes pickable in the posting checklist.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-2 py-2">Template</th>
                <th className="px-2 py-2">Category</th>
                <th className="px-2 py-2 text-right">Posts</th>
                <th className="px-2 py-2 text-right">Jobs ≤7d</th>
                <th className="px-2 py-2 text-right">Rate</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stats.map((s) => (
                <tr key={s.template.id} className={s.template.active ? '' : 'opacity-50'}>
                  <td className="px-2 py-2">
                    <p className="font-medium text-slate-900">{s.template.name}</p>
                    <p className="max-w-[360px] truncate text-[11px] text-slate-500" title={s.template.body}>
                      {s.template.body}
                    </p>
                  </td>
                  <td className="px-2 py-2 text-xs text-slate-600">
                    {TEMPLATE_CATEGORY_LABELS[s.template.category]}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-slate-700">
                    {s.posts}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-slate-700">
                    {s.jobsWithin7Days}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-slate-600">
                    {s.posts > 0 ? `${Math.round((s.jobsWithin7Days / s.posts) * 100)}%` : '—'}
                  </td>
                  <td className="px-2 py-2 text-right">
                    <button
                      type="button"
                      onClick={() =>
                        upsert.mutate({ ...s.template, active: !s.template.active })
                      }
                      className="rounded border border-slate-300 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50"
                    >
                      {s.template.active ? 'Pause' : 'Resume'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Delete template "${s.template.name}"?`))
                          remove.mutate(s.template.id);
                      }}
                      className="ml-1 rounded border border-slate-300 px-2 py-1 text-[11px] text-rust-700 hover:bg-rust-50"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
