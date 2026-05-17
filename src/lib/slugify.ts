/**
 * Turn a human title into a URL-safe kebab-case slug.
 * Normalizes em/en dashes to "-", strips smart quotes and other punctuation,
 * collapses whitespace, trims trailing/leading dashes, caps at 80 chars.
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[–—]/g, '-') // em/en dash → hyphen
    .replace(/[‘’“”']/g, '') // smart quotes / apostrophes
    .replace(/[^a-z0-9\s-]/g, '') // strip other punctuation
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}
