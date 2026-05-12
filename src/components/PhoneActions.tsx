interface Props {
  phone: string | null | undefined;
}

export function PhoneActions({ phone }: Props) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (!digits) return null;

  return (
    <div className="inline-flex items-center gap-1.5">
      <a
        href={`sms:${digits}`}
        className="inline-flex items-center min-h-[40px] rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 active:scale-[0.99]"
      >
        Text
      </a>
      <a
        href={`tel:${digits}`}
        className="inline-flex items-center min-h-[40px] rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 active:scale-[0.99]"
      >
        Call
      </a>
    </div>
  );
}
