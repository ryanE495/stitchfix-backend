import { useMemo, useState } from 'react';
import { useDeleteJobPhoto, useJobPhotos } from '../hooks/useJobPhotos';
import {
  PHOTO_CATEGORIES,
  PHOTO_CATEGORY_LABELS,
  type JobPhoto,
} from '../lib/types';
import { PhotoLightbox } from './PhotoLightbox';
import { PhotoUploader } from './PhotoUploader';

export function PhotoStrip({ jobId }: { jobId: string }) {
  const { data: photos = [], isLoading } = useJobPhotos(jobId);
  const del = useDeleteJobPhoto(jobId);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  // Group photos by category; lightbox uses the flat ordered list so prev/next still work.
  const { grouped, flat } = useMemo(() => {
    const g: Record<string, JobPhoto[]> = {
      intake: [],
      in_progress: [],
      finished: [],
      other: [],
    };
    for (const p of photos) {
      (g[p.category] ?? g.other).push(p);
    }
    const f = PHOTO_CATEGORIES.flatMap((c) => g[c]);
    return { grouped: g, flat: f };
  }, [photos]);

  const onDelete = async (p: JobPhoto, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Delete this photo?')) return;
    await del.mutateAsync(p);
  };

  return (
    <div>
      <PhotoUploader jobId={jobId} />
      {isLoading ? (
        <p className="mt-3 text-xs text-slate-500">Loading photos…</p>
      ) : photos.length === 0 ? (
        <p className="mt-3 text-xs text-slate-500">No photos yet.</p>
      ) : (
        <div className="mt-3 space-y-3">
          {PHOTO_CATEGORIES.map((category) => {
            const photosInCat = grouped[category];
            if (!photosInCat || photosInCat.length === 0) return null;
            return (
              <div key={category}>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {PHOTO_CATEGORY_LABELS[category]}
                </p>
                <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                  {photosInCat.map((p) => {
                    const flatIdx = flat.indexOf(p);
                    return (
                      <div key={p.id} className="relative shrink-0">
                        <button
                          type="button"
                          onClick={() => setLightboxIdx(flatIdx)}
                          className="block h-24 w-24 overflow-hidden rounded-lg border border-slate-200 bg-slate-100"
                        >
                          <img
                            src={p.photo_url}
                            alt={p.caption ?? ''}
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => onDelete(p, e)}
                          aria-label="Delete photo"
                          className="absolute right-1 top-1 h-6 w-6 rounded-full bg-black/60 text-xs text-white opacity-90 hover:bg-black/80"
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {lightboxIdx !== null && (
        <PhotoLightbox
          jobId={jobId}
          photos={flat}
          startIndex={lightboxIdx}
          onClose={() => setLightboxIdx(null)}
        />
      )}
    </div>
  );
}
