import { useMemo, useState } from 'react';
import { useCustomers } from '../hooks/useCustomers';
import { useCreateCustomer } from '../hooks/useCustomerMutations';
import {
  CONTACT_SOURCE_LABELS,
  CONTACT_SOURCES,
  type ContactSource,
  type Customer,
} from '../lib/types';

interface Props {
  selected: Customer | null;
  onSelect: (customer: Customer) => void;
  onClear: () => void;
}

export function CustomerPicker({ selected, onSelect, onClear }: Props) {
  const { data: customers = [] } = useCustomers();
  const create = useCreateCustomer();
  const [mode, setMode] = useState<'search' | 'new'>('search');
  const [query, setQuery] = useState('');

  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newSource, setNewSource] = useState<ContactSource>('walk_in');
  const [newHandle, setNewHandle] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState<string | null>(null);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers.slice(0, 8);
    return customers
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.phone ?? '').toLowerCase().includes(q),
      )
      .slice(0, 12);
  }, [customers, query]);

  if (selected) {
    return (
      <div className="rounded-lg border border-brand-200 bg-brand-50 p-3 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900 truncate">{selected.name}</p>
          <p className="text-xs text-slate-600">
            {selected.phone ?? 'no phone'} · {CONTACT_SOURCE_LABELS[selected.contact_source]}
          </p>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="text-xs font-medium text-brand-800 hover:underline"
        >
          Change
        </button>
      </div>
    );
  }

  if (mode === 'new') {
    const submitNew = async () => {
      if (!newName.trim()) {
        setCreateErr('Name is required.');
        return;
      }
      setCreating(true);
      setCreateErr(null);
      try {
        const c = await create.mutateAsync({
          name: newName.trim(),
          phone: newPhone.trim() || null,
          contact_source: newSource,
          contact_handle: newHandle.trim() || null,
          notes: newNotes.trim() || null,
        });
        onSelect(c);
      } catch (e) {
        setCreateErr(e instanceof Error ? e.message : 'Create failed');
      } finally {
        setCreating(false);
      }
    };

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-semibold text-slate-900">New customer</h4>
          <button
            type="button"
            onClick={() => setMode('search')}
            className="ml-auto text-xs text-slate-500 hover:underline"
          >
            ← back to search
          </button>
        </div>
        <input
          placeholder="Name *"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="block w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        />
        <input
          placeholder="Phone"
          type="tel"
          inputMode="tel"
          value={newPhone}
          onChange={(e) => setNewPhone(e.target.value)}
          className="block w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        />
        <select
          value={newSource}
          onChange={(e) => setNewSource(e.target.value as ContactSource)}
          className="block w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          {CONTACT_SOURCES.map((s) => (
            <option key={s} value={s}>
              {CONTACT_SOURCE_LABELS[s]}
            </option>
          ))}
        </select>
        <label className="block">
          <span className="text-xs font-medium text-slate-600">Contact handle (optional)</span>
          <input
            placeholder="e.g. Facebook name, Instagram handle, alternate contact"
            value={newHandle}
            onChange={(e) => setNewHandle(e.target.value)}
            className="mt-1 block w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
          <span className="mt-1 block text-[11px] leading-snug text-slate-500">
            How you found them or how they prefer to be contacted, if different from their real name.
          </span>
        </label>
        <textarea
          placeholder="Notes (optional)"
          value={newNotes}
          onChange={(e) => setNewNotes(e.target.value)}
          rows={2}
          className="block w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        />
        {createErr && <p className="text-xs text-rust-700">{createErr}</p>}
        <button
          type="button"
          onClick={submitNew}
          disabled={creating}
          className="min-h-[44px] w-full rounded-lg bg-brand-700 px-3 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-60"
        >
          {creating ? 'Saving…' : 'Add customer'}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <input
        autoFocus
        placeholder="Search by name or phone"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="block w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
      />
      <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-200">
        {matches.length === 0 ? (
          <p className="px-3 py-2 text-sm text-slate-500">No matches.</p>
        ) : (
          matches.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelect(c)}
              className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50 border-b border-slate-100 last:border-b-0"
            >
              <p className="font-medium text-slate-900">{c.name}</p>
              <p className="text-xs text-slate-500">
                {c.phone ?? 'no phone'} · {CONTACT_SOURCE_LABELS[c.contact_source]}
              </p>
            </button>
          ))
        )}
      </div>
      <button
        type="button"
        onClick={() => setMode('new')}
        className="min-h-[44px] w-full rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        + Add new customer
      </button>
    </div>
  );
}
