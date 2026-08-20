'use client';

import { useMemo, useState, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button, Card, Field, Notice, Textarea } from './ui';

// ── surface catalogue ──────────────────────────────────────────────
// Each surface is a place code can run in an extension. Shown as tiles so the
// choice is tactile and self-explanatory rather than a row of bare checkboxes.
type Surface = { id: string; label: string; hint: string; icon: ReactElement };

const SURFACES: Surface[] = [
  {
    id: 'popup',
    label: 'Popup',
    hint: 'toolbar button UI',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M3 9h18" />
      </svg>
    ),
  },
  {
    id: 'background',
    label: 'Service worker',
    hint: 'background logic',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" />
      </svg>
    ),
  },
  {
    id: 'content_script',
    label: 'Content script',
    hint: 'runs on pages',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M8 6l-5 6 5 6M16 6l5 6-5 6" />
      </svg>
    ),
  },
  {
    id: 'options',
    label: 'Options page',
    hint: 'settings screen',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2 2 2 0 1 1-4 0 1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 4.6 15a2 2 0 1 1 0-4 1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 12 4.6a2 2 0 1 1 4 0 1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9 2 2 0 1 1 0 4z" />
      </svg>
    ),
  },
];

const EXAMPLES = [
  'A popup that counts my open tabs and closes duplicates',
  'Highlight every external link on a page with a coloured outline',
  'Save the current page title and URL to a reading list I can view in the popup',
  'Show a word and character count for the text I select on any page',
  'A dark-mode toggle that forces a dark colour scheme on any website',
  'Block images on the current page to load it faster, toggled from the popup',
];

const CheckIcon = () => (
  <svg className="surface-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
    <path d="M5 13l4 4L19 7" />
  </svg>
);

const SparkIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2 2M16 16l2 2M18 6l-2 2M8 16l-2 2" />
  </svg>
);

const MIN = 10;
const MAX = 2000;

export function PromptComposer() {
  const router = useRouter();
  const [prompt, setPrompt] = useState('');
  const [targets, setTargets] = useState<string[]>(['popup']);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; hint?: string } | null>(null);

  const len = prompt.trim().length;
  const tooShort = len > 0 && len < MIN;
  const canSubmit = len >= MIN && targets.length > 0 && !busy;

  // Counter colour: amber when still too short, accent when approaching the cap,
  // faint otherwise. Purely a legibility cue — the real gate is `canSubmit`.
  const counterClass = useMemo(() => {
    if (tooShort) return 'counter-warn';
    if (len > MAX - 200) return 'counter-near';
    return 'counter-ok';
  }, [len, tooShort]);

  function toggle(id: string) {
    setTargets((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
  }

  function surprise() {
    const pick = EXAMPLES[Math.floor(Math.random() * EXAMPLES.length)];
    setPrompt(pick);
    setError(null);
  }

  async function submit() {
    setBusy(true);
    setError(null);

    const supabase = createClient();
    const { data, error: fnError } = await supabase.functions.invoke('create-job', {
      body: { prompt: prompt.trim(), targets },
    });

    if (fnError) {
      // functions.invoke surfaces a non-2xx as an error whose body holds the real
      // reason, so dig it out rather than showing the generic wrapper message.
      let message = fnError.message;
      let hint: string | undefined;
      const res = (fnError as { context?: Response }).context;

      if (res && typeof res.json === 'function') {
        try {
          const body = await res.json();
          if (body?.error) message = body.error;
          if (res.status === 502 || res.status === 500) {
            hint = 'The build pipeline could not be reached. Try again in a moment.';
          }
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
    <Card>
      <div className="stack">
        <div className="composer-hero">
          <div className="composer-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" />
              <path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" />
            </svg>
          </div>
          <div>
            <h2 style={{ margin: 0 }}>Describe your extension</h2>
            <p className="muted small" style={{ margin: '2px 0 0' }}>
              Plain English — be specific about what it should do. The planner turns this
              straight into a <code>manifest.json</code> and a file list.
            </p>
          </div>
        </div>

        <Field label="What should it do?">
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            maxLength={MAX}
            rows={4}
            placeholder="A popup that counts my open tabs and closes duplicates"
            disabled={busy}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && canSubmit) void submit();
            }}
          />
          <div className="row" style={{ marginTop: 4 }}>
            <button type="button" className="chip" onClick={surprise} disabled={busy}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 13, height: 13, display: 'inline-block' }}>
                  <SparkIcon />
                </span>
                Surprise me
              </span>
            </button>
            {prompt && (
              <button type="button" className="chip" onClick={() => setPrompt('')} disabled={busy}>
                Clear
              </button>
            )}
            <span className="spacer" />
            <span className={`hint counter ${counterClass}`}>
              {len} / {MAX}
              {tooShort ? ` · ${MIN - len} more to go` : ''}
            </span>
          </div>
        </Field>

        <div className="field">
          <label className="label">Or start from an example</label>
          <div className="examples-grid">
            {EXAMPLES.slice(0, 4).map((ex) => (
              <button
                key={ex}
                type="button"
                className="example-card"
                onClick={() => {
                  setPrompt(ex);
                  setError(null);
                }}
                disabled={busy}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M9 18l6-6-6-6" />
                </svg>
                <span className="small">{ex}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label className="label">
            Surfaces to include{' '}
            <span className="faint tiny">— where your code runs</span>
          </label>
          <div className="surface-grid">
            {SURFACES.map((s) => {
              const on = targets.includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  className={`surface-tile ${on ? 'on' : ''}`}
                  aria-pressed={on}
                  onClick={() => toggle(s.id)}
                  disabled={busy}
                >
                  {s.icon}
                  <span className="surface-tile-body">
                    <span className="surface-tile-name">{s.label}</span>
                    <span className="surface-tile-hint">{s.hint}</span>
                  </span>
                  <CheckIcon />
                </button>
              );
            })}
          </div>
          {targets.length === 0 && (
            <p className="hint counter-warn" style={{ marginTop: 4 }}>
              Pick at least one surface.
            </p>
          )}
        </div>

        {tooShort && <p className="hint">A little more detail — at least {MIN} characters.</p>}

        {error && (
          <Notice tone="err" title={error.message}>
            {error.hint && <div className="small" style={{ marginTop: 6 }}>{error.hint}</div>}
          </Notice>
        )}

        <div className="row" style={{ alignItems: 'center' }}>
          <Button variant="primary" size="lg" onClick={submit} disabled={!canSubmit} loading={busy}>
            {busy ? 'Starting…' : 'Generate extension'}
          </Button>
          <span className="hint">⌘ / Ctrl + Enter</span>
          <span className="spacer" />
          <span className="flowstrip">
            <b>Plan</b>
            <span className="arrow">→</span>
            <b>Write</b>
            <span className="arrow">→</span>
            <b>Validate</b>
            <span className="arrow">→</span>
            <b>Package</b>
          </span>
        </div>
      </div>
    </Card>
  );
}
