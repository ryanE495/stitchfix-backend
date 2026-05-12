import { Modal } from './Modal';
import { PHOTO_CATEGORIES, PHOTO_CATEGORY_LABELS, type PhotoCategory } from '../lib/types';

interface Props {
  count: number;
  onPick: (category: PhotoCategory) => void;
  onCancel: () => void;
}

export function PhotoCategoryPicker({ count, onPick, onCancel }: Props) {
  const title = count > 1 ? `Categorize ${count} photos` : 'Categorize photo';
  return (
    <Modal open onClose={onCancel} title={title}>
      <div className="grid grid-cols-2 gap-2">
        {PHOTO_CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onPick(c)}
            className="min-h-[56px] rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-800 hover:border-brand-600 hover:bg-brand-50 active:scale-[0.99]"
          >
            {PHOTO_CATEGORY_LABELS[c]}
          </button>
        ))}
      </div>
      <p className="mt-3 text-xs text-slate-500">
        You can change the category later by tapping the photo.
      </p>
    </Modal>
  );
}
