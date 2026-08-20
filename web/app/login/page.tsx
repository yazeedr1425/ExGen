'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button, Card, Field, Input, Notice } from '@/components/ui';

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
      // With email confirmation on, signUp returns a user but no session. Say so
      // plainly instead of bouncing to a dashboard that will redirect back here.
      if (!data.session) {
        setInfo('Account created. Check your email to confirm it, then sign in.');
        setMode('signin');
        setBusy(false);
        return;
      }
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setError(signInError.message);
        setBusy(false);
        return;
      }
    }

    // refresh() so Server Components re-render with the new session cookie before
    // navigating; without it the dashboard can render as logged out once.
    router.refresh();
    router.push(next);
  }

  return (
    <main className="shell">
      <div style={{ maxWidth: 420, margin: '0 auto', paddingTop: 'var(--s6)' }}>
        <Card>
          <form className="stack" onSubmit={submit}>
            <div>
              <h1 style={{ fontSize: '1.3rem' }}>
                {mode === 'signin' ? 'Sign in' : 'Create an account'}
              </h1>
              <p className="muted small">Free accounts get 5 generations per day.</p>
            </div>

            <Field label="Email">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                disabled={busy}
              />
            </Field>

            <Field label="Password" hint="At least 6 characters.">
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                required
                minLength={6}
                disabled={busy}
              />
            </Field>

            {error && <Notice tone="err" title={error} />}
            {info && <Notice tone="info" title={info} />}

            <Button type="submit" variant="primary" size="lg" disabled={!canSubmit} loading={busy}>
              {mode === 'signin' ? 'Sign in' : 'Create account'}
            </Button>

            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setMode(mode === 'signin' ? 'signup' : 'signin');
                setError(null);
                setInfo(null);
              }}
              disabled={busy}
            >
              {mode === 'signin' ? 'No account? Create one' : 'Already have an account? Sign in'}
            </button>
          </form>
        </Card>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="shell" />}>
      <LoginForm />
    </Suspense>
  );
}
