import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { TopNav } from '../components/TopNav';
import { Modal } from '../components/Modal';
import { customerRevenue, useCustomers } from '../hooks/useCustomers';
import { useCreateCustomer } from '../hooks/useCustomerMutations';
import { CONTACT_SOURCE_LABELS, CONTACT_SOURCES, type ContactSource } from '../lib/types';
import { formatCurrency } from '../lib/format';

export function CustomersPage() {
  const { data: customers = [], isLoading, error } = useCustomers();
  const [query, setQuery] = useState('');
  const [newOpen, setNewOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone ?? '').toLowerCase().includes(q),
    );
  }, [customers, query]);

  return (
    <div className="flex h-full flex-col">
      <TopNav view="customers" onNewCustomer={() => setNewOpen(true)} />
      <div className="border-b border-slate-200 bg-white px-3 py-2 sm:px-5">
        <input
          type="search"
          placeholder="Search by name or phone"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="block w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        />
      </div>
      <main className="flex-1 overflow-y-auto">
        {error ? (
          <p className="p-4 text-sm text-rust-700">
            Couldn't load customers: {(error as Error).message}
          </p>
        ) : isLoading ? (
          <p className="p-4 text-sm text-slate-500">Loading customers…</p>
        ) : filtered.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">
            {query ? 'No customers match.' : 'No customers yet. Add one to get started.'}
          </p>
        ) : (
          <ul className="divide-y divide-slate-200">
            {filtered.map((c) => {
              const revenue = customerRevenue(c);
              return (
                <li key={c.id}>
                  <Link
                    to={`/customers/${c.id}`}
                    className="flex items-center gap-3 px-3 py-3 hover:bg-slate-50 sm:px-5"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {c.name}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500 truncate">
                        {c.phone ?? 'no phone'} ·{' '}
                        {CONTACT_SOURCE_LABELS[c.contact_source]}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-medium text-slate-600">
                        {c.jobs.length} {c.jobs.length === 1 ? 'job' : 'jobs'}
                      </p>
                      <p className="text-xs text-slate-500">{formatCurrency(revenue)}</p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>

      {newOpen && <NewCustomerModal onClose={() => setNewOpen(false)} />}
    </div>
  );
}

function NewCustomerModal({ onClose }: { onClose: () => void }) {
  const create = useCreateCustomer();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [source, setSource] = useState<ContactSource>('walk_in');
  const [handle, setHandle] = useState('');
  const [notes, setNotes] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim()) {
      setErr('Name is required.');
      return;
    }
    setErr(null);
    try {
      await create.mutateAsync({
        name: name.trim(),
        phone: phone.trim() || null,
        contact_source: source,
        contact_handle: handle.trim() || null,
        notes: notes.trim() || null,
      });
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not save customer.');
    }
  };

  return (
    <Modal open onClose={onClose} title="New customer">
      <div className="space-y-3">
        <input
          placeholder="Name *"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="block w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        />
        <input
          placeholder="Phone"
          type="tel"
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="block w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        />
        <select
          value={source}
          onChange={(e) => setSource(e.target.value as ContactSource)}
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
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            className="mt-1 block w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
          <span className="mt-1 block text-[11px] leading-snug text-slate-500">
            How you found them or how they prefer to be contacted, if different from their real name.
          </span>
        </label>
        <textarea
          placeholder="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="block w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        />
        {err && <p className="text-sm text-rust-700">{err}</p>}
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
            disabled={create.isPending}
            className="min-h-[44px] flex-1 rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50"
          >
            {create.isPending ? 'Saving…' : 'Add customer'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
