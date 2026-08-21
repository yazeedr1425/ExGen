'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ensureSession } from '@/lib/supabase/session';
import { EXAMPLES } from '@/lib/examples';
import { ExampleIcon } from './ExampleIcon';

const SURFACES = [
  { id: 'popup', label: 'Popup' },
  { id: 'content_script', label: 'Content script' },
  { id: 'background', label: 'Service worker' },
  { id: 'options', label: 'Options page' },
];

const MIN = 10;
const MAX = 2000;

export function PromptComposer() {
  const router = useRouter();
  const [prompt, setPrompt] = useState('');
  const [targets, setTargets] = useState<string[]>(['popup']);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; hint?: string } | null>(null);

  // A visitor who typed on the landing page arrives here already signed in;
  // restore that draft once rather than making them type the sentence twice.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('extgen:draft');
      if (!raw) return;
      sessionStorage.removeItem('extgen:draft');
      const draft = JSON.parse(raw) as { prompt?: string; targets?: string[] };
      if (draft.prompt) setPrompt(draft.prompt);
      if (draft.targets?.length) setTargets(draft.targets);
    } catch {
      /* a malformed or unavailable draft is not worth surfacing */
    }
  }, []);

  const len = prompt.trim().length;
  const tooShort = len > 0 && len < MIN;
  const canSubmit = len >= MIN && targets.length > 0 && !busy;

  const counterClass = useMemo(() => {
    if (tooShort) return 'text-warn';
    return 'subtle';
  }, [tooShort]);

  function toggle(id: string) {
    setTargets((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
  }

  async function submit() {
    setBusy(true);
    setError(null);

    const supabase = createClient();

    // No account needed: the first submit mints an anonymous user so the job
    // has an owner and the Edge Function sees a real JWT.
    try {
      await ensureSession(supabase);
    } catch (e) {
      setError({ message: e instanceof Error ? e.message : 'Could not start a session.' });
      setBusy(false);
      return;
    }

    const { data, error: fnError } = await supabase.functions.invoke('create-job', {
      body: { prompt: prompt.trim(), targets },
    });

    if (fnError) {
      let message = fnError.message;
      let hint: string | undefined;
      const res = (fnError as { context?: Response }).context;
      if (res && typeof res.json === 'function') {
        try {
          const body = await res.json();
          if (body?.error) message = body.error;
          if (res.status === 429) message = 'Daily limit reached — 5 builds per day. Try again tomorrow.';
          if (res.status === 502 || res.status === 500) hint = 'The build pipeline could not be reached. Try again in a moment.';
        } catch {
          /* keep the wrapper message */
        }
      }
      setError({ message, hint });
      setBusy(false);
      return;
    }

    const jobId = (data as { job_id?: string } | null)?.job_id;
    if (!jobId) {
      setError({ message: 'The server accepted the request but returned no job id.' });
      setBusy(false);
      return;
    }
    router.refresh();
    router.push(`/jobs/${jobId}`);
  }

  return (
    <div className="stack" style={{ gap: 20 }}>
      {/* composer */}
      <div className="composer">
        <textarea
          className="composer-input"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          maxLength={MAX}
          placeholder="Describe a Chrome extension. e.g. a popup that counts my open tabs and closes duplicates…"
          disabled={busy}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && canSubmit) void submit();
          }}
        />
        <div className="composer-bar">
          <label className="chip chip-sm chip-select">
            <WrenchIcon />
            <select
              value={targets[0] ?? 'popup'}
              onChange={(e) => setTargets([e.target.value])}
              disabled={busy}
              aria-label="Surface"
            >
              {SURFACES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            <ChevronDown />
          </label>

          <span className="chip chip-sm" style={{ cursor: 'default' }}>
            Manifest v3
          </span>

          <span className="vrule" style={{ margin: '0 2px' }} />

          <span className={`tiny tnum ${counterClass}`}>
            {len} / {MAX}
          </span>

          <span className="spacer" />

          <button type="button" className="btn btn-sm" onClick={submit} disabled={!canSubmit}>
            {busy ? (
              <>
                <span className="spinner" /> Starting…
              </>
            ) : (
              <>
                Build it
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </>
            )}
          </button>
        </div>
      </div>

      {/* examples — short labels, full prompt lands in the box on click */}
      <div className="stack-sm">
        <span className="eyebrow">Need inspiration? Click one to start building</span>
        <div className="row" style={{ gap: 10 }}>
          {EXAMPLES.map((ex) => (
            <button
              key={ex.label}
              type="button"
              className="chip"
              title={ex.prompt}
              onClick={() => {
                setPrompt(ex.prompt);
                setTargets(ex.targets);
                setError(null);
              }}
              disabled={busy}
            >
              <ExampleIcon name={ex.icon} tint={ex.tint} />
              {ex.label}
            </button>
          ))}
        </div>
      </div>

      {tooShort && <p className="tiny subtle">A little more detail — at least {MIN} characters.</p>}

      {error && (
        <div className="notice notice-err" role="alert">
          <strong>{error.message}</strong>
          {error.hint && <div className="small" style={{ marginTop: 6 }}>{error.hint}</div>}
        </div>
      )}
    </div>
  );
}

function ChevronDown() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 12, height: 12 }}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
function WrenchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M14.7 6.3a4 4 0 0 1 5 5L16 15l-3-3 1.7-5.7zM13 12l-7.5 7.5a1.8 1.8 0 0 1-2.5-2.5L10.5 9.5" />
    </svg>
  );
}
