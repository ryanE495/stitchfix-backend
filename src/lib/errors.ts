/**
 * Pull a readable message out of anything thrown.
 *
 * Supabase does NOT throw Error instances -- a PostgrestError is a plain
 * object `{ message, code, details, hint }`. So `e instanceof Error` is false
 * for every database failure, and a bare instanceof check silently swallows
 * the one piece of text that says what actually went wrong.
 */
export function errorMessage(e: unknown, fallback = 'Something went wrong.'): string {
  if (e instanceof Error && e.message) return e.message;

  if (e && typeof e === 'object') {
    const o = e as { message?: unknown; code?: unknown; hint?: unknown };
    if (typeof o.message === 'string' && o.message) {
      // PGRST205 ("table not found in schema cache") almost always means a
      // migration has not been run yet, which is worth saying out loud.
      if (o.code === 'PGRST205') {
        return `${o.message} — a migration probably hasn't been run yet.`;
      }
      return typeof o.hint === 'string' && o.hint
        ? `${o.message} (${o.hint})`
        : o.message;
    }
  }

  if (typeof e === 'string' && e) return e;
  return fallback;
}
