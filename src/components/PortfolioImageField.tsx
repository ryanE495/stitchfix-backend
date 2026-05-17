import { useRef, useState } from 'react';
import { deletePortfolioImage, uploadPortfolioImage } from '../hooks/usePortfolioItems';

interface Props {
  label: string;
  url: string | null;
  storagePath: string | null;
  kind: 'before' | 'after';
  onChange: (next: { url: string | null; storagePath: string | null }) => void;
}

export function PortfolioImageField({ label, url, storagePath, kind, onChange }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Pick an image file.');
      return;
    }
    setError(null);
    setUploading(true);
    try {
      // If replacing, delete old file (best-effort).
      const oldPath = storagePath;
      const { url: newUrl, path: newPath } = await uploadPortfolioImage(file, kind);
      onChange({ url: newUrl, storagePath: newPath });
      if (oldPath) {
        deletePortfolioImage(oldPath).catch(() => {});
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const remove = async () => {
    if (!storagePath && !url) return;
    if (!window.confirm(`Remove the ${kind} image?`)) return;
    const oldPath = storagePath;
    onChange({ url: null, storagePath: null });
    if (oldPath) {
      deletePortfolioImage(oldPath).catch(() => {});
    }
  };

  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) handleFile(file);
        }}
        className={`relative overflow-hidden rounded-lg border-2 border-dashed bg-white transition ${
          dragOver ? 'border-brand-500 bg-brand-50' : 'border-slate-300'
        }`}
      >
        {url ? (
          <div className="relative">
            <img src={url} alt={label} className="block aspect-[4/3] w-full object-cover" />
            <div className="absolute inset-x-0 bottom-0 flex gap-2 bg-gradient-to-t from-black/60 to-transparent p-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="min-h-[40px] rounded-lg bg-white px-3 py-2 text-xs font-medium text-slate-800 shadow hover:bg-slate-50 disabled:opacity-60"
              >
                {uploading ? 'Uploading…' : 'Replace'}
              </button>
              <button
                type="button"
                onClick={remove}
                disabled={uploading}
                className="min-h-[40px] rounded-lg bg-white/90 px-3 py-2 text-xs font-medium text-rust-700 shadow hover:bg-white"
              >
                Remove
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 px-4 py-6 text-center hover:bg-slate-50 disabled:opacity-60"
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="9" cy="9" r="2" />
              <path d="m21 15-5-5L5 21" />
            </svg>
            <p className="text-sm font-medium text-slate-700">
              {uploading ? 'Uploading…' : 'Click or drop an image'}
            </p>
            <p className="text-xs text-slate-500">JPG or PNG, auto-compressed</p>
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
      </div>
      {error && <p className="mt-1 text-xs text-rust-700">{error}</p>}
    </div>
  );
}
