import { useState } from 'react';
import { Modal } from './Modal';
import { useCreateFbGroup, useFbGroups } from '../hooks/useOutreach';
import { canonicalGroupUrl, guessRegion, suggestRotation } from '../lib/fbGroupInput';
import { toIsoDate } from '../lib/dates';
import { errorMessage } from '../lib/errors';
import {
  FB_REGIONS,
  FB_REGION_LABELS,
  FB_ROTATIONS,
  WEEKDAY_LABELS,
  WEEKDAY_LONG,
  type FbRegion,
  type FbRotation,
} from '../lib/types';

const LABEL = 'text-xs font-semibold uppercase tracking-wide text-slate-500';
const FIELD =
  'mt-1 block w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm';
/** Mon-first display order; values stay 0 = Sunday. */
const DISPLAY_WEEKDAYS = [1, 2, 3, 4, 5, 6, 0];
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

export function AddGroupModal({ onClose }: { onClose: () => void }) {
  const { data: groups = [] } = useFbGroups();
  const create = useCreateFbGroup();
  const today = toIsoDate(new Date());

  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  // Region and rotation follow the name until you pick one yourself.
  const [regionPick, setRegionPick] = useState<FbRegion | null>(null);
  const [rotationPick, setRotationPick] = useState<FbRotation | null>(null);
  const [days, setDays] = useState<number[]>(ALL_DAYS);
  const [maxPerWeek, setMaxPerWeek] = useState('');
  const [rules, setRules] = useState('');
  const [lastPosted, setLastPosted] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<string[]>([]);

  const region = regionPick ?? guessRegion(name);
  const rotation = rotationPick ?? suggestRotation(groups, region);
  const canonical = canonicalGroupUrl(url);
  const duplicate = canonical ? groups.find((g) => g.url === canonical) : undefined;

  const toggleDay = (wd: number) =>
    setDays((d) => (d.includes(wd) ? d.filter((x) => x !== wd) : [...d, wd]));

  const reset = () => {
    setName('');
    setUrl('');
    setRegionPick(null);
    setRotationPick(null);
    setDays(ALL_DAYS);
    setMaxPerWeek('');
    setRules('');
    setLastPosted('');
  };

  const submit = async (another: boolean) => {
    setError(null);
    if (!name.trim()) return setError('Give the group a name.');
    if (!canonical) return setError('Paste the group link, e.g. facebook.com/groups/…');
    if (duplicate) return setError(`That group is already in your list as "${duplicate.name}".`);
    if (days.length === 0) return setError('Pick at least one day posting is allowed.');

    let max: number | null = null;
    if (maxPerWeek.trim()) {
      max = Number(maxPerWeek.replace(/[^0-9]/g, ''));
      if (!Number.isInteger(max) || max < 1) return setError('Max posts per week must be 1 or more.');
    }
    if (lastPosted && lastPosted > today) return setError("Last posted can't be in the future.");

    try {
      await create.mutateAsync({
        group: {
          name: name.trim(),
          url: canonical,
          region,
          allowed_weekdays: [...days].sort((a, b) => a - b),
          max_posts_per_week: max,
          rotation,
          rule_notes: rules.trim() || null,
        },
        lastPostedDay: lastPosted || null,
      });
      if (another) {
        setAdded((a) => [...a, name.trim()]);
        reset();
      } else {
        onClose();
      }
    } catch (e) {
      setError(errorMessage(e, 'Could not add the group.'));
    }
  };

  return (
    <Modal open onClose={onClose} title="Add Facebook group" size="lg">
      <div className="space-y-4">
        {added.length > 0 && (
          <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">
            Added {added.length}: {added.join(', ')}
          </p>
        )}

        <label className="block">
          <span className={LABEL}>Group name *</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ridgway-Ouray Connect"
            className={FIELD}
          />
        </label>

        <label className="block">
          <span className={LABEL}>Group link *</span>
          <input
            type="url"
            inputMode="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.facebook.com/groups/…"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className={FIELD}
          />
          {url.trim() && !canonical && (
            <span className="mt-1 block text-[11px] text-rust-700">
              That doesn't look like a facebook.com/groups/ link.
            </span>
          )}
          {duplicate && (
            <span className="mt-1 block text-[11px] text-rust-700">
              Already in your list as "{duplicate.name}".
            </span>
          )}
          {canonical && !duplicate && canonical !== url.trim().replace(/\/+$/, '') && (
            <span className="mt-1 block text-[11px] text-slate-500">Saved as {canonical}</span>
          )}
        </label>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className={LABEL}>Region</span>
            <select
              value={region}
              onChange={(e) => setRegionPick(e.target.value as FbRegion)}
              className={FIELD}
            >
              {FB_REGIONS.map((r) => (
                <option key={r} value={r}>
                  {FB_REGION_LABELS[r]}
                </option>
              ))}
            </select>
            {regionPick == null && name.trim() && (
              <span className="mt-1 block text-[11px] text-slate-500">Guessed from the name</span>
            )}
          </label>

          <label className="block">
            <span className={LABEL}>Rotation</span>
            <select
              value={rotation}
              onChange={(e) => setRotationPick(e.target.value as FbRotation)}
              className={FIELD}
            >
              {FB_ROTATIONS.map((r) => (
                <option key={r} value={r}>
                  {r} — {r === 'A' ? 'Monday' : 'Thursday'}
                </option>
              ))}
            </select>
            {rotationPick == null && (
              <span className="mt-1 block text-[11px] text-slate-500">
                Keeps {FB_REGION_LABELS[region]} balanced
              </span>
            )}
          </label>
        </div>

        <div>
          <p className={LABEL}>Days posting is allowed</p>
          <div className="mt-1 flex flex-wrap gap-1.5" role="group" aria-label="Allowed days">
            {DISPLAY_WEEKDAYS.map((wd) => {
              const on = days.includes(wd);
              return (
                <button
                  key={wd}
                  type="button"
                  onClick={() => toggleDay(wd)}
                  aria-pressed={on}
                  aria-label={WEEKDAY_LONG[wd]}
                  className={`min-h-[36px] min-w-[44px] rounded-lg border px-2 text-xs font-semibold transition ${
                    on
                      ? 'border-brand-600 bg-brand-600 text-white'
                      : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {WEEKDAY_LABELS[wd]}
                </button>
              );
            })}
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            Leave all on unless the group's rules limit which days you can post.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className={LABEL}>Max posts / week</span>
            <input
              type="text"
              inputMode="numeric"
              value={maxPerWeek}
              onChange={(e) => setMaxPerWeek(e.target.value)}
              placeholder="No limit"
              className={FIELD}
            />
          </label>
          <label className="block">
            <span className={LABEL}>Last posted</span>
            <input
              type="date"
              value={lastPosted}
              max={today}
              onChange={(e) => setLastPosted(e.target.value)}
              className={FIELD}
            />
          </label>
        </div>

        <label className="block">
          <span className={LABEL}>Rules / notes</span>
          <textarea
            value={rules}
            onChange={(e) => setRules(e.target.value)}
            rows={2}
            placeholder="e.g. Business posts on Saturday threads only"
            className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
        </label>

        {error && (
          <p className="rounded-lg bg-rust-50 px-3 py-2 text-sm text-rust-700">{error}</p>
        )}

        <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            {added.length > 0 ? 'Done' : 'Cancel'}
          </button>
          <button
            type="button"
            onClick={() => submit(true)}
            disabled={create.isPending}
            className="min-h-[44px] flex-1 rounded-lg border border-brand-600 px-4 py-2 text-sm font-semibold text-brand-800 hover:bg-brand-50 disabled:opacity-60"
          >
            Save &amp; add another
          </button>
          <button
            type="button"
            onClick={() => submit(false)}
            disabled={create.isPending}
            className="min-h-[44px] flex-1 rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-800 disabled:opacity-60"
          >
            {create.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
