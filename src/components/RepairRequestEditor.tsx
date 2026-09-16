import { useState } from 'react';
import { Modal } from './Modal';
import { TagInput } from './TagInput';
import { RepairPhotoStrip } from './RepairPhotoStrip';
import {
  COMMON_DAMAGE_TYPES,
  ESTIMATE_SOURCES,
  ESTIMATE_SOURCE_LABELS,
  IF_UNREPAIRABLE_LABELS,
  IF_UNREPAIRABLE_OPTIONS,
  REPAIR_CATEGORIES,
  REPAIR_CATEGORY_LABELS,
  REPAIR_CONTACT_METHODS,
  REPAIR_CONTACT_METHOD_LABELS,
  REPAIR_STATUS_LABELS,
  REPAIR_STATUS_ORDER,
  type EstimateSource,
  type IfUnrepairable,
  type RepairCategory,
  type RepairContactMethod,
  type RepairRequest,
  type RepairStatus,
} from '../lib/types';
import {
  useCreateRepairRequest,
  useUpdateRepairRequest,
} from '../hooks/useRepairRequests';

interface Props {
  request: RepairRequest | null; // null = create mode
  onClose: () => void;
}

type FormState = {
  status: RepairStatus;
  category: RepairCategory | '';
  damage_types: string[];
  damage_notes: string;
  item_details: string; // edited as raw JSON text
  replacement_value: string;
  spend_ceiling: string;
  if_unrepairable: IfUnrepairable | '';
  clean_dry_confirmed: boolean;
  ship_zip: string;
  ship_residential: boolean;
  box_length: string;
  box_width: string;
  box_height: string;
  box_weight: string;
  billable_weight: string;
  repair_estimate_low: string;
  repair_estimate_high: string;
  shipping_estimate_low: string;
  shipping_estimate_high: string;
  estimate_source: EstimateSource | '';
  timing_preference: string;
  contact_name: string;
  contact_phone: string;
  contact_email: string;
  contact_method: RepairContactMethod | '';
  contact_best_time: string;
  referral_source: string;
  referral_detail: string;
  internal_notes: string;
};

const num = (v: number | null) => (v == null ? '' : String(v));

function blankForm(): FormState {
  return {
    status: 'new',
    category: '',
    damage_types: [],
    damage_notes: '',
    item_details: '',
    replacement_value: '',
    spend_ceiling: '',
    if_unrepairable: '',
    clean_dry_confirmed: false,
    ship_zip: '',
    ship_residential: false,
    box_length: '',
    box_width: '',
    box_height: '',
    box_weight: '',
    billable_weight: '',
    repair_estimate_low: '',
    repair_estimate_high: '',
    shipping_estimate_low: '',
    shipping_estimate_high: '',
    estimate_source: '',
    timing_preference: '',
    contact_name: '',
    contact_phone: '',
    contact_email: '',
    contact_method: '',
    contact_best_time: '',
    referral_source: '',
    referral_detail: '',
    internal_notes: '',
  };
}

function toForm(r: RepairRequest): FormState {
  return {
    status: r.status,
    category: r.category ?? '',
    damage_types: r.damage_types ?? [],
    damage_notes: r.damage_notes ?? '',
    item_details: r.item_details ? JSON.stringify(r.item_details, null, 2) : '',
    replacement_value: num(r.replacement_value),
    spend_ceiling: num(r.spend_ceiling),
    if_unrepairable: r.if_unrepairable ?? '',
    clean_dry_confirmed: r.clean_dry_confirmed ?? false,
    ship_zip: r.ship_zip ?? '',
    ship_residential: r.ship_residential ?? false,
    box_length: num(r.box_length),
    box_width: num(r.box_width),
    box_height: num(r.box_height),
    box_weight: num(r.box_weight),
    billable_weight: num(r.billable_weight),
    repair_estimate_low: num(r.repair_estimate_low),
    repair_estimate_high: num(r.repair_estimate_high),
    shipping_estimate_low: num(r.shipping_estimate_low),
    shipping_estimate_high: num(r.shipping_estimate_high),
    estimate_source: r.estimate_source ?? '',
    timing_preference: r.timing_preference ?? '',
    contact_name: r.contact_name,
    contact_phone: r.contact_phone,
    contact_email: r.contact_email,
    contact_method: r.contact_method ?? '',
    contact_best_time: r.contact_best_time ?? '',
    referral_source: r.referral_source ?? '',
    referral_detail: r.referral_detail ?? '',
    internal_notes: r.internal_notes ?? '',
  };
}

/** Integer or null. Every numeric column on this table is `integer`. */
function toInt(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9-]/g, '');
  if (cleaned === '' || cleaned === '-') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

const LABEL = 'text-xs font-semibold uppercase tracking-wide text-slate-500';
const FIELD =
  'mt-1 block w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm';
const AREA =
  'mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm';
const SECTION = 'text-xs font-semibold uppercase tracking-wider text-slate-400';

const JSON_PLACEHOLDER = '{\n  "make": "Kodiak",\n  "model": "Flex-Bow 6"\n}';

export function RepairRequestEditor({ request, onClose }: Props) {
  const create = useCreateRepairRequest();
  const update = useUpdateRepairRequest();
  const [form, setForm] = useState<FormState>(() =>
    request ? toForm(request) : blankForm(),
  );
  const [error, setError] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  // No sync-from-props effect here: callers mount this with
  // key={request?.id ?? 'new'}, so switching rows remounts and the useState
  // initializer above re-seeds the form.

  const setField = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setError(null);

    // Mirror the NOT NULL columns so the user gets a real message instead of
    // a raw Postgres constraint error.
    if (!form.contact_name.trim()) return setError('Contact name is required.');
    if (!form.contact_phone.trim()) return setError('Contact phone is required.');
    if (!form.contact_email.trim()) return setError('Contact email is required.');

    // Mirror the DB CHECK on ship_zip so a bad ZIP fails here, not there.
    if (form.ship_zip.trim() && !/^[0-9]{5}$/.test(form.ship_zip.trim())) {
      return setError('Ship ZIP must be exactly 5 digits.');
    }

    let itemDetails: Record<string, unknown> | null = null;
    if (form.item_details.trim()) {
      try {
        const parsed = JSON.parse(form.item_details);
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          return setError('Item details must be a JSON object.');
        }
        itemDetails = parsed as Record<string, unknown>;
      } catch {
        return setError('Item details is not valid JSON.');
      }
    }

    const replacement = toInt(form.replacement_value);
    const ceiling = toInt(form.spend_ceiling);
    if (replacement != null && replacement < 0)
      return setError('Replacement value cannot be negative.');
    if (ceiling != null && ceiling < 0)
      return setError('Spend ceiling cannot be negative.');

    const payload = {
      status: form.status,
      category: (form.category || null) as RepairCategory | null,
      damage_types: form.damage_types.length > 0 ? form.damage_types : null,
      damage_notes: form.damage_notes.trim() || null,
      item_details: itemDetails,
      replacement_value: replacement,
      spend_ceiling: ceiling,
      if_unrepairable: (form.if_unrepairable || null) as IfUnrepairable | null,
      clean_dry_confirmed: form.clean_dry_confirmed,
      ship_zip: form.ship_zip.trim() || null,
      ship_residential: form.ship_residential,
      box_length: toInt(form.box_length),
      box_width: toInt(form.box_width),
      box_height: toInt(form.box_height),
      box_weight: toInt(form.box_weight),
      billable_weight: toInt(form.billable_weight),
      repair_estimate_low: toInt(form.repair_estimate_low),
      repair_estimate_high: toInt(form.repair_estimate_high),
      shipping_estimate_low: toInt(form.shipping_estimate_low),
      shipping_estimate_high: toInt(form.shipping_estimate_high),
      estimate_source: (form.estimate_source || null) as EstimateSource | null,
      timing_preference: form.timing_preference.trim() || null,
      contact_name: form.contact_name.trim(),
      contact_phone: form.contact_phone.trim(),
      contact_email: form.contact_email.trim(),
      contact_method: (form.contact_method || null) as RepairContactMethod | null,
      contact_best_time: form.contact_best_time.trim() || null,
      referral_source: form.referral_source.trim() || null,
      referral_detail: form.referral_detail.trim() || null,
      internal_notes: form.internal_notes.trim() || null,
    };

    try {
      if (request) {
        await update.mutateAsync({ id: request.id, patch: payload });
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
      title={request ? `Request ${request.request_number}` : 'New Repair Request'}
      size="lg"
    >
      <div className="space-y-6">
        {/* Status & category */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className={LABEL}>Status</span>
            <select
              value={form.status}
              onChange={(e) => setField('status', e.target.value as RepairStatus)}
              className={FIELD}
            >
              {REPAIR_STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {REPAIR_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className={LABEL}>Category</span>
            <select
              value={form.category}
              onChange={(e) =>
                setField('category', e.target.value as RepairCategory | '')
              }
              className={FIELD}
            >
              <option value="">— none —</option>
              {REPAIR_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {REPAIR_CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Damage */}
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Damage Types
          </p>
          <TagInput
            value={form.damage_types}
            onChange={(tags) => setField('damage_types', tags)}
            suggestions={COMMON_DAMAGE_TYPES}
            placeholder="Type and press Enter to add…"
          />
        </div>

        <label className="block">
          <span className={LABEL}>Damage Notes</span>
          <textarea
            value={form.damage_notes}
            onChange={(e) => setField('damage_notes', e.target.value)}
            rows={3}
            placeholder="What is wrong with it, in the customer's words or yours."
            className={AREA}
          />
        </label>

        <label className="block">
          <span className={LABEL}>
            Item Details{' '}
            <span className="normal-case text-slate-400">(JSON object)</span>
          </span>
          <textarea
            value={form.item_details}
            onChange={(e) => setField('item_details', e.target.value)}
            rows={4}
            spellCheck={false}
            placeholder={JSON_PLACEHOLDER}
            className={`${AREA} font-mono text-xs`}
          />
        </label>

        {/* Photos — existing requests only, since they key off request_id */}
        {request && (
          <div>
            <p className={`${SECTION} mb-2`}>Photos</p>
            <RepairPhotoStrip requestId={request.id} />
          </div>
        )}

        {/* Value & limits */}
        <div>
          <p className={`${SECTION} mb-2`}>Value &amp; Limits</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={LABEL}>Replacement Value ($)</span>
              <input
                type="text"
                inputMode="numeric"
                value={form.replacement_value}
                onChange={(e) => setField('replacement_value', e.target.value)}
                className={FIELD}
              />
            </label>
            <label className="block">
              <span className={LABEL}>Spend Ceiling ($)</span>
              <input
                type="text"
                inputMode="numeric"
                value={form.spend_ceiling}
                onChange={(e) => setField('spend_ceiling', e.target.value)}
                className={FIELD}
              />
            </label>
          </div>

          <label className="mt-3 block">
            <span className={LABEL}>If Unrepairable</span>
            <select
              value={form.if_unrepairable}
              onChange={(e) =>
                setField('if_unrepairable', e.target.value as IfUnrepairable | '')
              }
              className={FIELD}
            >
              <option value="">— not specified —</option>
              {IF_UNREPAIRABLE_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {IF_UNREPAIRABLE_LABELS[o]}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Estimates */}
        <div>
          <p className={`${SECTION} mb-2`}>Estimates</p>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={LABEL}>Repair Low ($)</span>
              <input
                type="text"
                inputMode="numeric"
                value={form.repair_estimate_low}
                onChange={(e) => setField('repair_estimate_low', e.target.value)}
                className={FIELD}
              />
            </label>
            <label className="block">
              <span className={LABEL}>Repair High ($)</span>
              <input
                type="text"
                inputMode="numeric"
                value={form.repair_estimate_high}
                onChange={(e) => setField('repair_estimate_high', e.target.value)}
                className={FIELD}
              />
            </label>
            <label className="block">
              <span className={LABEL}>Shipping Low ($)</span>
              <input
                type="text"
                inputMode="numeric"
                value={form.shipping_estimate_low}
                onChange={(e) => setField('shipping_estimate_low', e.target.value)}
                className={FIELD}
              />
            </label>
            <label className="block">
              <span className={LABEL}>Shipping High ($)</span>
              <input
                type="text"
                inputMode="numeric"
                value={form.shipping_estimate_high}
                onChange={(e) => setField('shipping_estimate_high', e.target.value)}
                className={FIELD}
              />
            </label>
          </div>

          <label className="mt-3 block">
            <span className={LABEL}>Estimate Source</span>
            <select
              value={form.estimate_source}
              onChange={(e) =>
                setField('estimate_source', e.target.value as EstimateSource | '')
              }
              className={FIELD}
            >
              <option value="">— none —</option>
              {ESTIMATE_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {ESTIMATE_SOURCE_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Shipping */}
        <div>
          <p className={`${SECTION} mb-2`}>Shipping</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={LABEL}>Ship ZIP</span>
              <input
                type="text"
                inputMode="numeric"
                maxLength={5}
                value={form.ship_zip}
                onChange={(e) => setField('ship_zip', e.target.value)}
                placeholder="81401"
                className={FIELD}
              />
            </label>
            <label className="block">
              <span className={LABEL}>Timing Preference</span>
              <input
                type="text"
                value={form.timing_preference}
                onChange={(e) => setField('timing_preference', e.target.value)}
                placeholder="Rush / no hurry / before Oct 1"
                className={FIELD}
              />
            </label>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <label className="block">
              <span className={LABEL}>Length (in)</span>
              <input
                type="text"
                inputMode="numeric"
                value={form.box_length}
                onChange={(e) => setField('box_length', e.target.value)}
                className={FIELD}
              />
            </label>
            <label className="block">
              <span className={LABEL}>Width (in)</span>
              <input
                type="text"
                inputMode="numeric"
                value={form.box_width}
                onChange={(e) => setField('box_width', e.target.value)}
                className={FIELD}
              />
            </label>
            <label className="block">
              <span className={LABEL}>Height (in)</span>
              <input
                type="text"
                inputMode="numeric"
                value={form.box_height}
                onChange={(e) => setField('box_height', e.target.value)}
                className={FIELD}
              />
            </label>
            <label className="block">
              <span className={LABEL}>Weight (lb)</span>
              <input
                type="text"
                inputMode="numeric"
                value={form.box_weight}
                onChange={(e) => setField('box_weight', e.target.value)}
                className={FIELD}
              />
            </label>
          </div>

          <label className="mt-3 block">
            <span className={LABEL}>Billable Weight (lb)</span>
            <input
              type="text"
              inputMode="numeric"
              value={form.billable_weight}
              onChange={(e) => setField('billable_weight', e.target.value)}
              className={FIELD}
            />
          </label>

          <div className="mt-3 space-y-1">
            <label className="flex min-h-[44px] items-center gap-2">
              <input
                type="checkbox"
                checked={form.ship_residential}
                onChange={(e) => setField('ship_residential', e.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              <span className="text-sm text-slate-700">Residential address</span>
            </label>
            <label className="flex min-h-[44px] items-center gap-2">
              <input
                type="checkbox"
                checked={form.clean_dry_confirmed}
                onChange={(e) => setField('clean_dry_confirmed', e.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              <span className="text-sm text-slate-700">
                Customer confirmed item is clean &amp; dry
              </span>
            </label>
          </div>
        </div>

        {/* Contact */}
        <div>
          <p className={`${SECTION} mb-2`}>Contact</p>
          <label className="block">
            <span className={LABEL}>Name *</span>
            <input
              type="text"
              value={form.contact_name}
              onChange={(e) => setField('contact_name', e.target.value)}
              className={FIELD}
            />
          </label>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={LABEL}>Phone *</span>
              <input
                type="tel"
                value={form.contact_phone}
                onChange={(e) => setField('contact_phone', e.target.value)}
                className={FIELD}
              />
            </label>
            <label className="block">
              <span className={LABEL}>Email *</span>
              <input
                type="email"
                value={form.contact_email}
                onChange={(e) => setField('contact_email', e.target.value)}
                className={FIELD}
              />
            </label>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={LABEL}>Preferred Method</span>
              <select
                value={form.contact_method}
                onChange={(e) =>
                  setField(
                    'contact_method',
                    e.target.value as RepairContactMethod | '',
                  )
                }
                className={FIELD}
              >
                <option value="">— no preference —</option>
                {REPAIR_CONTACT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {REPAIR_CONTACT_METHOD_LABELS[m]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={LABEL}>Best Time</span>
              <input
                type="text"
                value={form.contact_best_time}
                onChange={(e) => setField('contact_best_time', e.target.value)}
                placeholder="Evenings after 6"
                className={FIELD}
              />
            </label>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={LABEL}>Referral Source</span>
              <input
                type="text"
                value={form.referral_source}
                onChange={(e) => setField('referral_source', e.target.value)}
                className={FIELD}
              />
            </label>
            <label className="block">
              <span className={LABEL}>Referral Detail</span>
              <input
                type="text"
                value={form.referral_detail}
                onChange={(e) => setField('referral_detail', e.target.value)}
                className={FIELD}
              />
            </label>
          </div>
        </div>

        {/* Internal */}
        <label className="block">
          <span className={LABEL}>Internal Notes</span>
          <textarea
            value={form.internal_notes}
            onChange={(e) => setField('internal_notes', e.target.value)}
            rows={3}
            placeholder="Only you see this."
            className={AREA}
          />
        </label>

        {/* Original submission, read-only — raw_payload is never rewritten */}
        {request && (
          <div>
            <button
              type="button"
              onClick={() => setShowRaw(!showRaw)}
              className="text-xs font-medium text-slate-500 underline hover:text-slate-700"
            >
              {showRaw ? 'Hide' : 'Show'} original submission
            </button>
            {showRaw && (
              <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-600">
                {JSON.stringify(request.raw_payload, null, 2)}
              </pre>
            )}
          </div>
        )}

        {error && (
          <p className="rounded-lg bg-rust-50 px-3 py-2 text-sm text-rust-700">
            {error}
          </p>
        )}

        <div className="flex gap-2 border-t border-slate-200 pt-4">
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
            className="min-h-[44px] flex-1 rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-800 active:scale-[0.99] disabled:opacity-60"
          >
            {saving ? 'Saving…' : request ? 'Save Changes' : 'Create Request'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
