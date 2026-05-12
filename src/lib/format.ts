const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '—';
  return usd.format(value);
}

export function parseDecimal(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9.\-]/g, '');
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}
