import { useEffect, useState } from 'react';
import { Modal } from './Modal';
import { TagInput } from './TagInput';
import { PortfolioImageField } from './PortfolioImageField';
import {
  COMMON_PORTFOLIO_TAGS,
  JOB_CATEGORIES,
  JOB_CATEGORY_LABELS,
  PORTFOLIO_STATUSES,
  PORTFOLIO_STATUS_LABELS,
  type JobCategory,
  type PortfolioItem,
  type PortfolioStatus,
} from '../lib/types';
import {
  useCreatePortfolioItem,
  useUpdatePortfolioItem,
} from '../hooks/usePortfolioItems';

interface Props {
  item: PortfolioItem | null; // null = create mode
  onClose: () => void;
}

type FormState = {
  title: string;
  category: JobCategory | '';
  description: string;
  materials_techniques: string[];
  approach: string;
  challenge: string;
  detail_1_label: string;
  detail_1_value: string;
  detail_2_label: string;
  detail_2_value: string;
  detail_3_label: string;
  detail_3_value: string;
  before_image_url: string | null;
  before_storage_path: string | null;
  after_image_url: string | null;
  after_storage_path: string | null;
  display_order: string; // string input, parsed on save
  status: PortfolioStatus;
};

function blankForm(): FormState {
  return {
    title: '',
    category: '',
    description: '',
    materials_techniques: [],
    approach: '',
    challenge: '',
    detail_1_label: 'Turnaround',
    detail_1_value: '',
    detail_2_label: 'Location',
    detail_2_value: '',
    detail_3_label: 'Job Type',
    detail_3_value: '',
    before_image_url: null,
    before_storage_path: null,
    after_image_url: null,
    after_storage_path: null,
    display_order: '0',
    status: 'draft',
  };
}

function itemToForm(item: PortfolioItem): FormState {
  return {
    title: item.title,
    category: item.category ?? '',
    description: item.description,
    materials_techniques: item.materials_techniques ?? [],
    approach: item.approach ?? '',
    challenge: item.challenge ?? '',
    detail_1_label: item.detail_1_label ?? '',
    detail_1_value: item.detail_1_value ?? '',
    detail_2_label: item.detail_2_label ?? '',
    detail_2_value: item.detail_2_value ?? '',
    detail_3_label: item.detail_3_label ?? '',
    detail_3_value: item.detail_3_value ?? '',
    before_image_url: item.before_image_url,
    before_storage_path: item.before_storage_path,
    after_image_url: item.after_image_url,
    after_storage_path: item.after_storage_path,
    display_order: String(item.display_order),
    status: item.status,
  };
}

export function PortfolioItemEditor({ item, onClose }: Props) {
  const create = useCreatePortfolioItem();
  const update = useUpdatePortfolioItem();
  const [form, setForm] = useState<FormState>(() =>
    item ? itemToForm(item) : blankForm(),
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm(item ? itemToForm(item) : blankForm());
  }, [item]);

  const setField = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setError(null);
    if (!form.title.trim()) return setError('Title is required.');
    if (!form.category) return setError('Category is required.');
    if (!form.description.trim()) return setError('Description is required.');

    const parsedOrder = Number(form.display_order);
    const order = Number.isFinite(parsedOrder) ? Math.trunc(parsedOrder) : 0;

    const payload = {
      title: form.title.trim(),
      category: form.category as JobCategory,
      description: form.description.trim(),
      materials_techniques: form.materials_techniques,
      approach: form.approach.trim() || null,
      challenge: form.challenge.trim() || null,
      detail_1_label: form.detail_1_label.trim() || null,
      detail_1_value: form.detail_1_value.trim() || null,
      detail_2_label: form.detail_2_label.trim() || null,
      detail_2_value: form.detail_2_value.trim() || null,
      detail_3_label: form.detail_3_label.trim() || null,
      detail_3_value: form.detail_3_value.trim() || null,
      before_image_url: form.before_image_url,
      after_image_url: form.after_image_url,
      before_storage_path: form.before_storage_path,
      after_storage_path: form.after_storage_path,
      display_order: order,
      status: form.status,
    };

    try {
      if (item) {
        await update.mutateAsync({ id: item.id, patch: payload });
      } else {
        await create.mutateAsync(payload);
      }
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed.');
    }
  };

  const saving = create.isPending || update.isPending;

  return (
    <Modal
      open
      onClose={onClose}
      title={item ? 'Edit Portfolio Item' : 'New Portfolio Item'}
      size="lg"
    >
      <div className="space-y-5">
        {/* Title */}
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Project Title *
          </span>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setField('title', e.target.value)}
            placeholder="Wall Tent Three-Tear Restoration"
            className="mt-1 block w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
        </label>

        {/* Category */}
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Category *
          </span>
          <select
            value={form.category}
            onChange={(e) => setField('category', e.target.value as JobCategory | '')}
            className="mt-1 block w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">— pick a category —</option>
            {JOB_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {JOB_CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </label>

        {/* Description */}
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Description * <span className="text-slate-400">(2–3 sentences)</span>
          </span>
          <textarea
            value={form.description}
            onChange={(e) => setField('description', e.target.value)}
            rows={3}
            placeholder="What the project was and what the result was."
            className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
        </label>

        {/* Materials & Techniques */}
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Materials &amp; Techniques
          </p>
          <TagInput
            value={form.materials_techniques}
            onChange={(tags) => setField('materials_techniques', tags)}
            suggestions={COMMON_PORTFOLIO_TAGS}
            placeholder="Type and press Enter to add…"
          />
        </div>

        {/* Before / After images */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <PortfolioImageField
            label="Before Image"
            url={form.before_image_url}
            storagePath={form.before_storage_path}
            kind="before"
            onChange={({ url, storagePath }) => {
              setField('before_image_url', url);
              setField('before_storage_path', storagePath);
            }}
          />
          <PortfolioImageField
            label="After Image"
            url={form.after_image_url}
            storagePath={form.after_storage_path}
            kind="after"
            onChange={({ url, storagePath }) => {
              setField('after_image_url', url);
              setField('after_storage_path', storagePath);
            }}
          />
        </div>

        {/* Approach */}
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            How I Approached It
          </span>
          <textarea
            value={form.approach}
            onChange={(e) => setField('approach', e.target.value)}
            rows={4}
            placeholder="Walk through your process and decisions."
            className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
        </label>

        {/* Challenge */}
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            The Challenge
          </span>
          <textarea
            value={form.challenge}
            onChange={(e) => setField('challenge', e.target.value)}
            rows={3}
            placeholder="What was tricky about this one."
            className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
        </label>

        {/* Project Details */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Project Details
          </p>
          <div className="space-y-2">
            {(
              [
                ['detail_1_label', 'detail_1_value'],
                ['detail_2_label', 'detail_2_value'],
                ['detail_3_label', 'detail_3_value'],
              ] as const
            ).map(([labelKey, valueKey], i) => (
              <div key={labelKey} className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  value={form[labelKey]}
                  onChange={(e) => setField(labelKey, e.target.value)}
                  placeholder={`Label ${i + 1}`}
                  className="block w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                />
                <input
                  type="text"
                  value={form[valueKey]}
                  onChange={(e) => setField(valueKey, e.target.value)}
                  placeholder={`Value ${i + 1}`}
                  className="col-span-2 block w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Order + Status */}
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Display Order
            </span>
            <input
              type="number"
              value={form.display_order}
              onChange={(e) => setField('display_order', e.target.value)}
              className="mt-1 block w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Status
            </span>
            <select
              value={form.status}
              onChange={(e) => setField('status', e.target.value as PortfolioStatus)}
              className="mt-1 block w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              {PORTFOLIO_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {PORTFOLIO_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
        </div>

        {error && <p className="text-sm text-rust-700">{error}</p>}

        <div className="sticky bottom-0 -mx-4 -mb-4 flex gap-2 border-t border-slate-200 bg-white px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="min-h-[44px] flex-1 rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-50"
          >
            {saving ? 'Saving…' : item ? 'Save changes' : 'Create item'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
