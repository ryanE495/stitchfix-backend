import { useState } from 'react';
import { Modal } from './Modal';
import { CustomerPicker } from './CustomerPicker';
import { useCreateJob } from '../hooks/useJobMutations';
import { parseDecimal } from '../lib/format';
import type { Customer } from '../lib/types';

interface Props {
  onClose: () => void;
  initialCustomer?: Customer | null;
}

export function NewJobModal({ onClose, initialCustomer = null }: Props) {
  const [customer, setCustomer] = useState<Customer | null>(initialCustomer);
  const [description, setDescription] = useState('');
  const [quote, setQuote] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const create = useCreateJob();

  const submit = async () => {
    setError(null);
    if (!customer) {
      setError('Pick a customer first.');
      return;
    }
    if (!description.trim()) {
      setError('Item description is required.');
      return;
    }
    try {
      await create.mutateAsync({
        customer_id: customer.id,
        item_description: description.trim(),
        quote_amount: parseDecimal(quote),
        notes: notes.trim() || null,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create job.');
    }
  };

  return (
    <Modal open onClose={onClose} title="New job" size="md">
      <div className="space-y-4">
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Customer
          </h3>
          <CustomerPicker
            selected={customer}
            onSelect={setCustomer}
            onClear={() => setCustomer(null)}
          />
        </section>

        <section className="space-y-3">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Item description *
            </span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="e.g. wall tent, 3 tears on rear panel"
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Quote ($)
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={quote}
              onChange={(e) => setQuote(e.target.value)}
              placeholder="0.00"
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Notes
            </span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            />
          </label>
        </section>

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
            disabled={create.isPending}
            className="min-h-[44px] flex-1 rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50"
          >
            {create.isPending ? 'Saving…' : 'Create job'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
