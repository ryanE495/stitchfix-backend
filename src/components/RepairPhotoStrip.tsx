import { useEffect, useState } from 'react';
import { useDeleteRepairPhoto, useRepairPhotos } from '../hooks/useRepairRequests';
import {
  REPAIR_PHOTO_SLOTS,
  REPAIR_PHOTO_SLOT_LABELS,
  type RepairPhoto,
} from '../lib/types';

interface Props {
  requestId: string;
}

/**
 * Minimal full-screen viewer. The existing PhotoLightbox is bound to
 * JobPhoto + the job-photo category mutation, so it does not fit here.
 */
function RepairLightbox({ url, onClose }: { url: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/90 p-4"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close photo"
        className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-lg text-white/80 hover:bg-white/10 hover:text-white"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
      <img
        src={url}
        alt=""
        className="max-h-full max-w-full rounded-lg object-contain"
      />
    </div>
  );
}

/**
 * Read-and-delete view of the three intake photos. There is deliberately no
 * uploader: photos are captured by the public intake form at submission time
 * (the `repair-photos` bucket has an anon INSERT policy for exactly that),
 * and the slot column is UNIQUE per request, so adding one here would mean
 * inventing a slot that the customer never photographed.
 */
export function RepairPhotoStrip({ requestId }: Props) {
  const { data: photos = [], isLoading, error } = useRepairPhotos(requestId);
  const del = useDeleteRepairPhoto(requestId);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const onDelete = async (photo: RepairPhoto) => {
    if (!window.confirm('Delete this photo? This cannot be undone.')) return;
    try {
      await del.mutateAsync(photo);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Delete failed.');
    }
  };

  if (isLoading) {
    return <p className="text-sm text-slate-500">Loading photos…</p>;
  }

  if (error) {
    return (
      <p className="text-sm text-rust-700">
        Couldn't load photos: {(error as Error).message}
      </p>
    );
  }

  const bySlot = new Map(photos.map((p) => [p.slot, p]));

  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        {REPAIR_PHOTO_SLOTS.map((slot) => {
          const photo = bySlot.get(slot);
          return (
            <div key={slot}>
              <div className="relative aspect-square overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                {photo?.signedUrl ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setLightbox(photo.signedUrl)}
                      className="h-full w-full"
                      aria-label={`View ${REPAIR_PHOTO_SLOT_LABELS[slot]} photo`}
                    >
                      <img
                        src={photo.signedUrl}
                        alt={REPAIR_PHOTO_SLOT_LABELS[slot]}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(photo)}
                      aria-label={`Delete ${REPAIR_PHOTO_SLOT_LABELS[slot]} photo`}
                      className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-slate-500 shadow-sm hover:bg-rust-50 hover:text-rust-700"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </>
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-slate-300">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <circle cx="9" cy="9" r="2" />
                      <path d="m21 15-5-5L5 21" />
                    </svg>
                  </div>
                )}
              </div>
              <p className="mt-1 text-center text-[11px] text-slate-500">
                {REPAIR_PHOTO_SLOT_LABELS[slot]}
              </p>
            </div>
          );
        })}
      </div>

      {lightbox && (
        <RepairLightbox url={lightbox} onClose={() => setLightbox(null)} />
      )}
    </>
  );
}
