import { useEffect, useMemo, useState } from 'react';
import { useJob } from '../hooks/useJobs';
import { useAdvanceStatus, useUpdateJob } from '../hooks/useJobMutations';
import {
  JOB_CATEGORIES,
  JOB_CATEGORY_LABELS,
  JOB_STATUS_LABELS,
  JOB_STATUS_ORDER,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  type Job,
  type JobCategory,
  type JobStatus,
  type PaymentMethod,
} from '../lib/types';
import { parseDecimal } from '../lib/format';
import { formatShortDate, toDateInput } from '../lib/dates';
import { slugify } from '../lib/slugify';
import { Modal } from './Modal';
import { PhotoStrip } from './PhotoStrip';
import { PhoneActions } from './PhoneActions';

interface Props {
  jobId: string;
  onClose: () => void;
}

const NEXT_STATUS: Partial<Record<JobStatus, JobStatus>> = {
  quoted: 'awaiting_dropoff',
  awaiting_dropoff: 'in_shop',
  in_shop: 'in_progress',
  in_progress: 'complete_awaiting_pickup',
  complete_awaiting_pickup: 'paid_closed',
};

type FormState = {
  item_description: string;
  status: JobStatus;
  date_received: string;
  date_promised: string;
  date_completed: string;
  date_paid: string;
  quote_amount: string;
  actual_charged: string;
  materials_cost: string;
  hours_worked: string;
  notes: string;
  needs_followup: boolean;
  followup_by: string;
  review_requested: boolean;
  payment_method: PaymentMethod | '';
  category: JobCategory | '';
  feature_in_portfolio: boolean;
  portfolio_title: string;
  portfolio_slug: string;
  portfolio_blurb: string;
  portfolio_location: string;
};

function jobToForm(job: Job): FormState {
  return {
    item_description: job.item_description ?? '',
    status: job.status,
    date_received: toDateInput(job.date_received),
    date_promised: toDateInput(job.date_promised),
    date_completed: toDateInput(job.date_completed),
    date_paid: toDateInput(job.date_paid),
    quote_amount: job.quote_amount != null ? String(job.quote_amount) : '',
    actual_charged: job.actual_charged != null ? String(job.actual_charged) : '',
    materials_cost: job.materials_cost != null ? String(job.materials_cost) : '',
    hours_worked: job.hours_worked != null ? String(job.hours_worked) : '',
    notes: job.notes ?? '',
    needs_followup: job.needs_followup ?? false,
    followup_by: toDateInput(job.followup_by),
    review_requested: job.review_requested ?? false,
    payment_method: job.payment_method ?? '',
    category: job.category ?? '',
    feature_in_portfolio: job.feature_in_portfolio ?? false,
    portfolio_title: job.portfolio_title ?? '',
    portfolio_slug: job.portfolio_slug ?? '',
    portfolio_blurb: job.portfolio_blurb ?? '',
    portfolio_location: job.portfolio_location ?? '',
  };
}

export function JobDetailModal({ jobId, onClose }: Props) {
  const { data: job, isLoading } = useJob(jobId);
  const update = useUpdateJob();
  const advance = useAdvanceStatus();

  const [form, setForm] = useState<FormState | null>(null);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  useEffect(() => {
    if (job) setForm(jobToForm(job));
  }, [job]);

  const dirty = useMemo(() => {
    if (!job || !form) return false;
    const baseline = jobToForm(job);
    return (Object.keys(baseline) as (keyof FormState)[]).some(
      (k) => baseline[k] !== form[k],
    );
  }, [job, form]);

  const title = job?.customer?.name ?? 'Job';

  const setField = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => (f ? { ...f, [k]: v } : f));

  const save = async () => {
    if (!job || !form) return;
    setSaveErr(null);
    try {
      await update.mutateAsync({
        id: job.id,
        patch: {
          item_description: form.item_description.trim() || job.item_description,
          status: form.status,
          date_received: form.date_received || null,
          date_promised: form.date_promised || null,
          date_completed: form.date_completed || null,
          date_paid: form.date_paid || null,
          quote_amount: parseDecimal(form.quote_amount),
          actual_charged: parseDecimal(form.actual_charged),
          materials_cost: parseDecimal(form.materials_cost),
          hours_worked: parseDecimal(form.hours_worked),
          notes: form.notes.trim() || null,
          needs_followup: form.needs_followup,
          followup_by: form.needs_followup && form.followup_by ? form.followup_by : null,
          review_requested: form.review_requested,
          review_requested_at: form.review_requested
            ? job.review_requested && job.review_requested_at
              ? job.review_requested_at
              : new Date().toISOString()
            : null,
          payment_method: form.payment_method || null,
          category: form.category || null,
          feature_in_portfolio: form.feature_in_portfolio,
          portfolio_title: form.portfolio_title.trim() || null,
          portfolio_slug: form.portfolio_slug.trim() || null,
          portfolio_blurb: form.portfolio_blurb.trim() || null,
          portfolio_location: form.portfolio_location.trim() || null,
          // Stamp first-published time when transitioning to featured;
          // preserve it across toggles otherwise. Don't clear on un-feature.
          portfolio_published_at: form.feature_in_portfolio
            ? job.portfolio_published_at ?? new Date().toISOString()
            : job.portfolio_published_at,
        },
      });
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : 'Save failed');
    }
  };

  const onAdvance = async (next: JobStatus) => {
    if (!job) return;
    try {
      await advance(job, next);
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : 'Status update failed');
    }
  };

  return (
    <Modal open onClose={onClose} title={title} size="lg">
      {isLoading || !job || !form ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <div className="space-y-5">
          {/* Contact (hidden if customer has no phone) */}
          {job.customer?.phone && (
            <section className="flex flex-wrap items-center gap-2 -mt-1">
              <span className="text-sm text-slate-700">{job.customer.phone}</span>
              <PhoneActions phone={job.customer.phone} />
            </section>
          )}

          {/* Photos */}
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Photos
            </h3>
            <PhotoStrip jobId={job.id} />
          </section>

          {/* Status */}
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Status
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-brand-100 px-3 py-1 text-sm font-medium text-brand-800">
                {JOB_STATUS_LABELS[job.status]}
              </span>
              {NEXT_STATUS[job.status] && (
                <button
                  type="button"
                  onClick={() => onAdvance(NEXT_STATUS[job.status] as JobStatus)}
                  className="min-h-[44px] rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800"
                >
                  Move to {JOB_STATUS_LABELS[NEXT_STATUS[job.status] as JobStatus]}
                </button>
              )}
              {job.status !== 'paid_closed' && job.status !== 'complete_awaiting_pickup' && (
                <button
                  type="button"
                  onClick={() => onAdvance('complete_awaiting_pickup')}
                  className="min-h-[44px] rounded-lg border border-brand-700 px-3 py-2 text-sm font-medium text-brand-800 hover:bg-brand-50"
                >
                  Mark complete
                </button>
              )}
              {job.status !== 'paid_closed' && (
                <button
                  type="button"
                  onClick={() => onAdvance('paid_closed')}
                  className="min-h-[44px] rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Mark paid
                </button>
              )}
            </div>
            <div className="mt-2">
              <label className="text-xs text-slate-500">Override status</label>
              <select
                value={form.status}
                onChange={(e) => setField('status', e.target.value as JobStatus)}
                className="mt-1 block w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                {JOB_STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>
                    {JOB_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
          </section>

          {/* Item */}
          <section>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Item
              </span>
              <textarea
                value={form.item_description}
                onChange={(e) => setField('item_description', e.target.value)}
                rows={2}
                className="mt-1 block w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              />
            </label>
            <label className="mt-3 block">
              <span className="text-xs text-slate-500">Category</span>
              <select
                value={form.category}
                onChange={(e) => setField('category', e.target.value as JobCategory | '')}
                className="mt-1 block w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">— not set —</option>
                {JOB_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {JOB_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </label>
          </section>

          {/* Follow-up */}
          <section>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.needs_followup}
                onChange={(e) => setField('needs_followup', e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-600"
              />
              <span className="text-sm font-medium text-slate-700">Needs follow-up</span>
            </label>
            {form.needs_followup && (
              <label className="mt-2 block">
                <span className="text-xs text-slate-500">Follow up by</span>
                <input
                  type="date"
                  value={form.followup_by}
                  onChange={(e) => setField('followup_by', e.target.value)}
                  className="mt-1 block w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                />
              </label>
            )}
          </section>

          {/* Review request — only when staged status is paid_closed */}
          {form.status === 'paid_closed' && (
            <section>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.review_requested}
                  onChange={(e) => setField('review_requested', e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-600"
                />
                <span className="text-sm font-medium text-slate-700">Review requested?</span>
              </label>
              {form.review_requested && job.review_requested && job.review_requested_at && (
                <p className="mt-1 text-xs text-slate-500">
                  Requested {formatShortDate(job.review_requested_at)}
                </p>
              )}
            </section>
          )}

          {/* Dates */}
          <section className="grid grid-cols-2 gap-3">
            {(
              [
                ['date_received', 'Received'],
                ['date_promised', 'Promised'],
                ['date_completed', 'Completed'],
                ['date_paid', 'Paid'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="block">
                <span className="text-xs text-slate-500">{label}</span>
                <input
                  type="date"
                  value={form[key]}
                  onChange={(e) => setField(key, e.target.value)}
                  className="mt-1 block w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                />
              </label>
            ))}
          </section>

          {/* Payment method — only when job is paid or has a paid date */}
          {(form.status === 'paid_closed' || form.date_paid) && (
            <section>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Payment method
                </span>
                <select
                  value={form.payment_method}
                  onChange={(e) =>
                    setField('payment_method', e.target.value as PaymentMethod | '')
                  }
                  className="mt-1 block w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="">— not set —</option>
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {PAYMENT_METHOD_LABELS[m]}
                    </option>
                  ))}
                </select>
              </label>
            </section>
          )}

          {/* Money */}
          <section className="grid grid-cols-2 gap-3">
            {(
              [
                ['quote_amount', 'Quote ($)', '0.00'],
                ['actual_charged', 'Charged ($)', '0.00'],
                ['materials_cost', 'Materials ($)', '0.00'],
                ['hours_worked', 'Hours', '0.0'],
              ] as const
            ).map(([key, label, ph]) => (
              <label key={key} className="block">
                <span className="text-xs text-slate-500">{label}</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={form[key]}
                  placeholder={ph}
                  onChange={(e) => setField(key, e.target.value)}
                  className="mt-1 block w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                />
              </label>
            ))}
          </section>

          {/* Portfolio CMS */}
          <section>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.feature_in_portfolio}
                onChange={(e) => setField('feature_in_portfolio', e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-600"
              />
              <span className="text-sm font-medium text-slate-700">
                Feature in public portfolio
              </span>
            </label>
            {form.feature_in_portfolio && (
              <div className="mt-3 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <label className="block">
                  <span className="text-xs text-slate-500">Portfolio title</span>
                  <input
                    type="text"
                    value={form.portfolio_title}
                    onChange={(e) => setField('portfolio_title', e.target.value)}
                    placeholder="Wall Tent Repair — Three-Tear Restoration"
                    className="mt-1 block w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-slate-500">URL slug</span>
                  <div className="mt-1 flex gap-2">
                    <input
                      type="text"
                      value={form.portfolio_slug}
                      onChange={(e) => setField('portfolio_slug', e.target.value)}
                      placeholder="wall-tent-three-tear-restoration"
                      className="block w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setField('portfolio_slug', slugify(form.portfolio_title))
                      }
                      disabled={!form.portfolio_title.trim()}
                      title="Generate slug from title"
                      className="min-h-[44px] shrink-0 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                    >
                      From title
                    </button>
                  </div>
                  <span className="mt-1 block text-[11px] text-slate-500">
                    Lowercase letters, numbers, and dashes only. Used as the public URL.
                  </span>
                </label>
                <label className="block">
                  <span className="text-xs text-slate-500">Location</span>
                  <input
                    type="text"
                    value={form.portfolio_location}
                    onChange={(e) => setField('portfolio_location', e.target.value)}
                    placeholder="Montrose, CO"
                    className="mt-1 block w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-slate-500">Blurb (2–4 sentences)</span>
                  <textarea
                    value={form.portfolio_blurb}
                    onChange={(e) => setField('portfolio_blurb', e.target.value)}
                    rows={4}
                    placeholder="What was wrong, what you did, how it turned out."
                    className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  />
                </label>
                {job.portfolio_published_at && (
                  <p className="text-xs text-slate-500">
                    First published {formatShortDate(job.portfolio_published_at)}
                  </p>
                )}
              </div>
            )}
          </section>

          {/* Notes */}
          <section>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Notes
              </span>
              <textarea
                value={form.notes}
                onChange={(e) => setField('notes', e.target.value)}
                rows={3}
                className="mt-1 block w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              />
            </label>
          </section>

          {saveErr && <p className="text-sm text-rust-700">{saveErr}</p>}

          <div className="sticky bottom-0 -mx-4 -mb-4 flex gap-2 border-t border-slate-200 bg-white px-4 py-3">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Close
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!dirty || update.isPending}
              className="min-h-[44px] flex-1 rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50"
            >
              {update.isPending ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
