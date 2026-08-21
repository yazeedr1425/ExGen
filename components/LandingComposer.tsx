'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { EXAMPLES } from '@/lib/examples';

const SURFACES = [
  { id: 'popup', label: 'Popup' },
  { id: 'content_script', label: 'Content script' },
  { id: 'background', label: 'Service worker' },
  { id: 'options', label: 'Options page' },
];

const MAX = 2000;

/** The hero composer on the public landing page. Nothing is submitted here —
 *  the visitor is not signed in yet. The draft is stashed in sessionStorage so
 *  the dashboard composer can pick it up after login, instead of asking them to
 *  type the same sentence twice. */
export function LandingComposer() {
  const router = useRouter();
  const [prompt, setPrompt] = useState('');
  const [surface, setSurface] = useState('popup');

  function start() {
    const text = prompt.trim();
    if (text) {
      try {
        sessionStorage.setItem('extgen:draft', JSON.stringify({ prompt: text, targets: [surface] }));
      } catch {
        /* private mode — the draft is a convenience, never a requirement */
      }
    }
    router.push('/login?next=/dashboard');
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
          placeholder="Describe your extension idea… (e.g., 'A popup that counts my open tabs and closes duplicates')"
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

          <button type="button" className="btn btn-sm" onClick={start}>
            Build it <ArrowRight />
          </button>
        </div>
      </div>

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
            <SparkIcon />
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
function SparkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 4v5M12 15v5M4 12h5M15 12h5M6.5 6.5l3 3M14.5 14.5l3 3M17.5 6.5l-3 3M9.5 14.5l-3 3" />
    </svg>
  );
}
