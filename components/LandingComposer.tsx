'use client';

import { useEffect, useRef, useState } from 'react';
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

const MAX = 2000;


/** Types each example out, pauses, deletes it, then moves to the next — used as
 *  a live placeholder so the empty box shows what a good prompt looks like.
 *  Stops the moment the visitor types, and never runs under reduced motion. */
function useTypewriter(phrases: string[], active: boolean): string {
  const [text, setText] = useState('');
  const phrasesRef = useRef(phrases);
  phrasesRef.current = phrases;

  useEffect(() => {
    if (!active) return;

    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (still) {
      setText(phrasesRef.current[0] ?? '');
      return;
    }

    let phrase = 0;
    let char = 0;
    let deleting = false;
    let timer: ReturnType<typeof setTimeout>;

    const tick = () => {
      const full = phrasesRef.current[phrase] ?? '';
      char += deleting ? -1 : 1;
      setText(full.slice(0, Math.max(0, char)));

      let delay = deleting ? 18 : 34;
      if (!deleting && char >= full.length) {
        delay = 2000;
        deleting = true;
      } else if (deleting && char <= 0) {
        deleting = false;
        phrase = (phrase + 1) % phrasesRef.current.length;
        delay = 400;
      }
      timer = setTimeout(tick, delay);
    };

    timer = setTimeout(tick, 700);
    return () => clearTimeout(timer);
  }, [active]);

  return text;
}

/** The hero composer on the public landing page. Nothing is submitted here —
 *  the visitor is not signed in yet. The draft is stashed in sessionStorage so
 *  the dashboard composer can pick it up after login, instead of asking them to
 *  type the same sentence twice. */
export function LandingComposer() {
  const router = useRouter();
  const [prompt, setPrompt] = useState('');
  const [surface, setSurface] = useState('popup');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The animated placeholder only runs while the box is untouched.
  const typed = useTypewriter(
    EXAMPLES.map((e) => e.prompt),
    prompt.length === 0,
  );

  /** No sign-up wall: submit builds the extension there and then, on an
   *  anonymous session if the visitor has none. */
  async function start() {
    const text = prompt.trim();
    if (text.length < 10) return;

    setBusy(true);
    setError(null);

    const supabase = createClient();
    try {
      await ensureSession(supabase);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start a session.');
      setBusy(false);
      return;
    }

    const { data, error: fnError } = await supabase.functions.invoke('create-job', {
      body: { prompt: text, targets: [surface] },
    });

    if (fnError) {
      let message = fnError.message;
      const res = (fnError as { context?: Response }).context;
      if (res && typeof res.json === 'function') {
        try {
          const body = await res.json();
          if (body?.error) message = body.error;
        } catch {
          /* keep the wrapper message */
        }
      }
      setError(message);
      setBusy(false);
      return;
    }

    const jobId = (data as { job_id?: string } | null)?.job_id;
    if (!jobId) {
      setError('The server accepted the request but returned no job id.');
      setBusy(false);
      return;
    }
    router.refresh();
    router.push(`/jobs/${jobId}`);
  }

  return (
    <div className="stack" style={{ gap: 14, width: '100%' }}>
      <div className="composer composer-hero">
        <textarea
          className="composer-input"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          maxLength={MAX}
          rows={4}
          placeholder={typed ? `${typed}┃` : 'Describe your extension idea…'}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') start();
          }}
        />

        <div className="composer-bar">
          <label className="chip chip-sm chip-select">
            <WrenchIcon />
            <select value={surface} onChange={(e) => setSurface(e.target.value)} aria-label="Surface">
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

          <span className="tiny subtle tnum">
            {prompt.trim().length} / {MAX}
          </span>

          <span className="spacer" />

          <button
            type="button"
            className="btn btn-sm"
            onClick={start}
            disabled={busy || prompt.trim().length < 10}
          >
            {busy ? (
              <>
                <span className="spinner" /> Starting…
              </>
            ) : (
              <>
                Build it <ArrowRight />
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="notice notice-err" role="alert">
          <strong>{error}</strong>
        </div>
      )}

      <p className="tiny subtle" style={{ textAlign: 'center' }}>
        Need inspiration? Click one to start building
      </p>

      <div className="row" style={{ justifyContent: 'center', gap: 10 }}>
        {EXAMPLES.map((ex) => (
          <button
            key={ex.label}
            type="button"
            className="chip"
            title={ex.prompt}
            onClick={() => {
              setPrompt(ex.prompt);
              setSurface(ex.targets[0]);
            }}
          >
            <ExampleIcon name={ex.icon} tint={ex.tint} />
            {ex.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ArrowRight() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
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
