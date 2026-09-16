import { useState } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Single-operator sign-in. There is no sign-up link and no password-reset
 * link by design: the one account is created in the Supabase dashboard, and
 * adding a self-serve reset would re-introduce an email dependency that
 * email+password was chosen to avoid.
 */
export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }

    setBusy(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);

    if (signInError) {
      // Supabase returns a deliberately vague message here; keep it vague
      // rather than revealing whether the address exists.
      setError(
        signInError.message === 'Invalid login credentials'
          ? 'Wrong email or password.'
          : signInError.message,
      );
      return;
    }
    // On success AuthGate's onAuthStateChange swaps this screen out.
  };

  return (
    <div className="flex min-h-full items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Western Slope
          </p>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">
            Stitchworks
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Industrial sewing &amp; gear repair
          </p>
        </div>

        <form
          onSubmit={submit}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Email
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="mt-1 block w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            />
          </label>

          <label className="mt-4 block">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Password
            </span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="mt-1 block w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            />
          </label>

          {error && (
            <p className="mt-4 rounded-lg bg-rust-50 px-3 py-2 text-sm text-rust-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="mt-5 min-h-[44px] w-full rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-800 active:scale-[0.99] disabled:opacity-60"
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
