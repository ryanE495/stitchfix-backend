import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { TopNav } from '../components/TopNav';
import {
  CONTACT_SOURCE_LABELS,
  CONTACT_SOURCES,
  JOB_STATUS_LABELS,
  type ContactSource,
  type Customer,
} from '../lib/types';
import { useCustomer, useCustomerJobs } from '../hooks/useCustomers';
import { useUpdateCustomer } from '../hooks/useCustomerMutations';
import { JobDetailModal } from '../components/JobDetailModal';
import { NewJobModal } from '../components/NewJobModal';
import { PhoneActions } from '../components/PhoneActions';
import { formatCurrency } from '../lib/format';
import { formatShortDate } from '../lib/dates';

export function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: customer, isLoading } = useCustomer(id);
  const { data: jobs = [] } = useCustomerJobs(id);
  const [openJobId, setOpenJobId] = useState<string | null>(null);
  const [newJobOpen, setNewJobOpen] = useState(false);

  return (
    <div className="flex h-full flex-col">
      <TopNav view="customers" />
      <main className="flex-1 overflow-y-auto px-3 py-4 sm:px-5">
        <Link
          to="/customers"
          className="mb-3 inline-flex items-center text-xs text-slate-500 hover:text-slate-700"
        >
          ← All customers
        </Link>
        {isLoading || !customer ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : (
          <div className="space-y-6">
            <CustomerInfoCard customer={customer} />

            <section>
              <div className="mb-2 flex items-center">
                <h3 className="text-sm font-semibold text-slate-700">Jobs</h3>
                <button
                  type="button"
                  onClick={() => setNewJobOpen(true)}
                  className="ml-auto min-h-[40px] rounded-lg bg-brand-700 px-3 py-2 text-sm font-medium text-white hover:bg-brand-800"
                >
                  + New job
                </button>
              </div>
              {jobs.length === 0 ? (
                <p className="text-sm text-slate-500">No jobs for this customer yet.</p>
              ) : (
                <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
                  {jobs.map((j) => (
                    <li key={j.id}>
                      <button
                        type="button"
                        onClick={() => setOpenJobId(j.id)}
                        className="block w-full px-3 py-3 text-left hover:bg-slate-50"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900 line-clamp-2">
                              {j.item_description}
                            </p>
                            <p className="mt-0.5 text-xs text-slate-500">
                              Received {formatShortDate(j.date_received)}
                              {j.date_promised
                                ? ` · Promised ${formatShortDate(j.date_promised)}`
                                : ''}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                              {JOB_STATUS_LABELS[j.status]}
                            </span>
                            <p className="mt-1 text-xs text-slate-500">
                              {formatCurrency(
                                j.actual_charged != null
                                  ? Number(j.actual_charged)
                                  : j.quote_amount != null
                                    ? Number(j.quote_amount)
                                    : null,
                              )}
                            </p>
                          </div>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </main>

      {openJobId && (
        <JobDetailModal jobId={openJobId} onClose={() => setOpenJobId(null)} />
      )}
      {newJobOpen && customer && (
        <NewJobModal
          initialCustomer={customer}
          onClose={() => setNewJobOpen(false)}
        />
      )}
    </div>
  );
}

function CustomerInfoCard({ customer }: { customer: Customer }) {
  const update = useUpdateCustomer();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: customer.name,
    phone: customer.phone ?? '',
    contact_source: customer.contact_source,
    contact_handle: customer.contact_handle ?? '',
    notes: customer.notes ?? '',
  });
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setForm({
      name: customer.name,
      phone: customer.phone ?? '',
      contact_source: customer.contact_source,
      contact_handle: customer.contact_handle ?? '',
      notes: customer.notes ?? '',
    });
  }, [customer]);

  const dirty = useMemo(
    () =>
      form.name !== customer.name ||
      form.phone !== (customer.phone ?? '') ||
      form.contact_source !== customer.contact_source ||
      form.contact_handle !== (customer.contact_handle ?? '') ||
      form.notes !== (customer.notes ?? ''),
    [form, customer],
  );

  const save = async () => {
    if (!form.name.trim()) {
      setErr('Name is required.');
      return;
    }
    setErr(null);
    try {
      await update.mutateAsync({
        id: customer.id,
        patch: {
          name: form.name.trim(),
          phone: form.phone.trim() || null,
          contact_source: form.contact_source,
          contact_handle: form.contact_handle.trim() || null,
          notes: form.notes.trim() || null,
        },
      });
      setEditing(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Save failed.');
    }
  };

  if (!editing) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-slate-900 truncate">{customer.name}</h2>
            {customer.phone ? (
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <span className="text-sm text-slate-700">{customer.phone}</span>
                <PhoneActions phone={customer.phone} />
              </div>
            ) : (
              <p className="mt-1 text-sm text-slate-500">no phone</p>
            )}
            <p className="mt-1.5 text-xs text-slate-500">
              {CONTACT_SOURCE_LABELS[customer.contact_source]}
            </p>
            {customer.contact_handle && (
              <p className="mt-1 text-xs text-slate-500">@ {customer.contact_handle}</p>
            )}
            {customer.notes && (
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                {customer.notes}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="min-h-[40px] rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Edit
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
      <input
        placeholder="Name *"
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
      />
      <input
        placeholder="Phone"
        type="tel"
        inputMode="tel"
        value={form.phone}
        onChange={(e) => setForm({ ...form, phone: e.target.value })}
        className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
      />
      <select
        value={form.contact_source}
        onChange={(e) =>
          setForm({ ...form, contact_source: e.target.value as ContactSource })
        }
        className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
      >
        {CONTACT_SOURCES.map((s) => (
          <option key={s} value={s}>
            {CONTACT_SOURCE_LABELS[s]}
          </option>
        ))}
      </select>
      <input
        placeholder="Facebook / contact handle"
        value={form.contact_handle}
        onChange={(e) => setForm({ ...form, contact_handle: e.target.value })}
        className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
      />
      <textarea
        placeholder="Notes"
        rows={3}
        value={form.notes}
        onChange={(e) => setForm({ ...form, notes: e.target.value })}
        className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
      />
      {err && <p className="text-sm text-rust-700">{err}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="min-h-[44px] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={save}
          disabled={!dirty || update.isPending}
          className="min-h-[44px] flex-1 rounded-lg bg-brand-700 px-3 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50"
        >
          {update.isPending ? 'Saving…' : 'Save'}
        </button>
      </div>
    </section>
  );
}
