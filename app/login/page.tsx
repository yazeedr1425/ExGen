'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Logo } from '@/components/Logo';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') ?? '/dashboard';

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const canSubmit = email.includes('@') && password.length >= 6 && !busy;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);

    const supabase = createClient();

    if (mode === 'signup') {
      const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
      if (signUpError) {
        setError(signUpError.message);
        setBusy(false);
        return;
      }
      if (!data.session) {
        setInfo('Account created. Check your email to confirm it, then sign in.');
        setMode('signin');
        setBusy(false);
        return;
      }
      // A brand-new account has nothing to look at yet, so start on the
      // explainer instead of an empty composer.
      router.refresh();
      router.push('/welcome');
      return;
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setError(signInError.message);
        setBusy(false);
        return;
      }
    }

    router.refresh();
    router.push(next);
  }

  return (
    <div style={{ background: 'var(--surface-warm)', minHeight: '100vh' }}>
      <header
        className="row"
        style={{
          height: 56,
          padding: '0 24px',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--surface-page)',
        }}
      >
        <a href="/">
          <Logo size={24} />
        </a>
      </header>

      <div style={{ padding: '80px 28px 96px', display: 'flex', justifyContent: 'center' }}>
        <form
          onSubmit={submit}
          className="card card-pad stack"
          style={{ width: 420, boxShadow: 'var(--shadow-md)' }}
        >
          <div className="stack-sm" style={{ gap: 6 }}>
            <h1 className="heading-md">{mode === 'signin' ? 'Sign in to build.' : 'Create your account.'}</h1>
            <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>Free to use. No card, no sign-up required.</p>
          </div>

          <div className="field">
            <label className="label">Email</label>
            <input
              type="email"
              className="pill-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="you@example.com"
              required
              disabled={busy}
            />
          </div>

          <div className="field">
            <label className="label">Password</label>
            <input
              type="password"
              className="pill-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              required
              minLength={6}
              disabled={busy}
            />
            <span className="field-note">At least 6 characters.</span>
          </div>

          {error && (
            <div className="notice notice-err" role="alert">
              <strong>{error}</strong>
            </div>
          )}
          {info && (
            <div className="notice">
              <strong>{info}</strong>
            </div>
          )}

          <button type="submit" className="btn btn-block" style={{ padding: '13px 20px' }} disabled={!canSubmit}>
            {busy && <span className="spinner" />}
            {mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>

          <div className="row" style={{ justifyContent: 'center', gap: 8, fontSize: 13, color: 'var(--text-muted)' }}>
            {mode === 'signin' ? 'No account?' : 'Already have an account?'}
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'signin' ? 'signup' : 'signin');
                setError(null);
                setInfo(null);
              }}
              disabled={busy}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                color: 'var(--text-link)',
                textDecoration: 'underline',
              }}
            >
              {mode === 'signin' ? 'Create one' : 'Sign in'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--surface-warm)' }} />}>
      <LoginForm />
    </Suspense>
  );
}
