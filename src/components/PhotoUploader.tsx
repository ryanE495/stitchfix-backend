import { useRef, useState } from 'react';
import { useUploadJobPhoto } from '../hooks/useJobPhotos';
import { PhotoCategoryPicker } from './PhotoCategoryPicker';
import type { PhotoCategory } from '../lib/types';

export function PhotoUploader({ jobId }: { jobId: string }) {
  const camRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const upload = useUploadJobPhoto(jobId);
  const [pendingFiles, setPendingFiles] = useState<File[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setPendingFiles(Array.from(files));
    setError(null);
    // Clear inputs so picking the same file again still fires `onChange`.
    if (camRef.current) camRef.current.value = '';
    if (fileRef.current) fileRef.current.value = '';
  };

  const applyCategory = async (category: PhotoCategory) => {
    if (!pendingFiles || pendingFiles.length === 0) return;
    const files = pendingFiles;
    setPendingFiles(null);
    setError(null);
    try {
      for (const f of files) {
        await upload.mutateAsync({ file: f, category });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    }
  };

  const cancel = () => setPendingFiles(null);

  const busy = !!pendingFiles || upload.isPending;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => camRef.current?.click()}
          disabled={busy}
          className="min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
        >
          {upload.isPending ? 'Uploading…' : 'Take photo'}
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
        >
          Choose photo
        </button>
      </div>
      <input
        ref={camRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      {error && <p className="text-xs text-rust-700">{error}</p>}
      {pendingFiles && (
        <PhotoCategoryPicker
          count={pendingFiles.length}
          onPick={applyCategory}
          onCancel={cancel}
        />
      )}
    </div>
  );
}
