'use client';

import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type Surface = { id: string; label: string; icon: ReactElement };

const SURFACES: Surface[] = [
  {
    id: 'popup',
    label: 'Popup',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M3 9h18" />
      </svg>
    ),
  },
  {
    id: 'content_script',
    label: 'Content script',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M8 6l-5 6 5 6M16 6l5 6-5 6" />
      </svg>
    ),
  },
  {
    id: 'background',
    label: 'Service worker',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" />
      </svg>
    ),
  },
  {
    id: 'options',
    label: 'Options page',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="3" />
        <path d="M4 12h3M17 12h3M12 4v3M12 17v3" />
      </svg>
    ),
  },
];

const EXAMPLES = [
  'A popup that counts my open tabs and closes duplicates',
  'Highlight every external link on a page with a coloured outline',
  'Save the current page title and URL to a reading list in the popup',
  'Show a word and character count for the text I select on any page',
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
        {/* Surfaces get their own row so the action row below never wraps and
            leaves the primary button stranded on a line of its own. */}
        <div className="composer-surfaces">
          {SURFACES.map((s) => {
            const on = targets.includes(s.id);
            return (
              <button
                key={s.id}
                type="button"
                className={`chip chip-sm ${on ? 'on' : ''}`}
                aria-pressed={on}
                onClick={() => toggle(s.id)}
                disabled={busy}
              >
                {s.icon}
                {s.label}
              </button>
            );
          })}
        </div>

        <div className="composer-bar">
          <span className={`tiny tnum ${counterClass}`}>
            {len} / {MAX}
          </span>
          <span className="spacer" />
          <span className="tiny subtle">⌘⏎</span>
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

      {/* examples */}
      <div className="stack-sm">
        <span className="eyebrow">Or start from an example</span>
        <div className="row" style={{ gap: 10 }}>
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              className="chip"
              onClick={() => {
                setPrompt(ex);
                setError(null);
              }}
              disabled={busy}
            >
              {ex}
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
