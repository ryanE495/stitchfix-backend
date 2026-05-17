import { useEffect, useState } from 'react';
import {
  PHOTO_CATEGORIES,
  PHOTO_CATEGORY_LABELS,
  type JobPhoto,
  type PhotoCategory,
} from '../lib/types';
import { useUpdatePhotoCategory } from '../hooks/useJobPhotos';

interface Props {
  jobId: string;
  photos: JobPhoto[];
  startIndex: number;
  onClose: () => void;
}

export function PhotoLightbox({ jobId, photos, startIndex, onClose }: Props) {
  const [idx, setIdx] = useState(startIndex);
  const updateCategory = useUpdatePhotoCategory(jobId);

  // Clamp idx if photo list shrinks under us (e.g., delete from outside).
  const safeIdx = Math.min(idx, Math.max(0, photos.length - 1));
  const photo = photos[safeIdx];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') setIdx((i) => Math.max(0, i - 1));
      if (e.key === 'ArrowRight') setIdx((i) => Math.min(photos.length - 1, i + 1));
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose, photos.length]);

  if (!photo) return null;

  const onChangeCategory = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateCategory.mutate({ id: photo.id, category: e.target.value as PhotoCategory });
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black">
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <span className="text-sm opacity-75">
          {safeIdx + 1} / {photos.length}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="min-h-[44px] min-w-[44px] rounded-lg hover:bg-white/10"
        >
          ✕
        </button>
      </div>
      <div
        className="relative flex-1 select-none"
        onClick={(e) => {
          const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
          const x = e.clientX - rect.left;
          if (x < rect.width / 2) setIdx((i) => Math.max(0, i - 1));
          else setIdx((i) => Math.min(photos.length - 1, i + 1));
        }}
      >
        <img
          src={photo.photo_url}
          alt={photo.caption ?? ''}
          className="absolute inset-0 m-auto max-h-full max-w-full object-contain"
        />
      </div>
      <div className="border-t border-white/10 bg-black px-4 py-3 text-white">
        <label className="flex items-center gap-3">
          <span className="text-xs uppercase tracking-wider opacity-70">Category</span>
          <select
            value={photo.category}
            onChange={onChangeCategory}
            className="ml-auto min-h-[44px] rounded-lg border border-white/30 bg-black/60 px-3 py-2 text-sm text-white"
          >
            {PHOTO_CATEGORIES.map((c) => (
              <option key={c} value={c} className="bg-black text-white">
                {PHOTO_CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </label>
        {photo.caption && (
          <p className="mt-2 text-center text-sm text-white/80">{photo.caption}</p>
        )}
      </div>
    </div>
  );
}
