import Link from 'next/link';
import { LandingComposer } from '@/components/LandingComposer';

/** The public marketing page. Rendered by app/page.tsx for signed-out
 *  visitors; kept as its own component so it can be viewed in isolation. */
export function LandingPage() {
  return (
    <div style={{ background: 'var(--surface-page)' }}>
      {/* ── header ── */}
      <header className="landing-nav">
        <Link href="/" className="row" style={{ gap: 9, flexWrap: 'nowrap' }}>
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
              <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" />
              <path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" />
            </svg>
          </span>
          <span className="wordmark">ExtGen</span>
        </Link>

        <span className="spacer" />

        <nav className="row landing-links" style={{ gap: 26, flexWrap: 'nowrap' }}>
          <a href="#how">How it works</a>
          <a href="#features">Features</a>
          <Link href="/login">Log in</Link>
        </nav>

        <Link href="/login" className="btn btn-sm btn-uppercase">
          Get started
        </Link>
      </header>

      {/* ── hero ── */}
      <section className="hero">
        <h1 className="hero-title">Ship a Chrome extension in two minutes.</h1>
        <p className="hero-sub">
          Plain English in. Working extension out. Real code, real validation, ready to load
          unpacked.
        </p>

        <div style={{ width: '100%', maxWidth: 700, marginTop: 8 }}>
          <LandingComposer />
        </div>
      </section>

      {/* ── stats ── */}
      <section className="stat-band">
        <div className="stat-grid">
          {[
            ['2–3', 'prompts to a build people actually install'],
            ['0', 'validation errors allowed past packaging'],
            ['1 zip', 'yours to keep · full source, no lock-in'],
            ['5 / day', 'free to start'],
          ].map(([num, label]) => (
            <div key={label} className="stack-sm" style={{ gap: 6 }}>
              <span className="stat-num">{num}</span>
              <span className="stat-label">{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── how it works (dark) ── */}
      <section id="how" className="section-dark" style={{ padding: '96px 28px' }}>
        <div className="how-grid">
          <div className="stack" style={{ gap: 20 }}>
            <span className="eyebrow" style={{ color: 'var(--text-on-dark)' }}>
              Four agents, one contract
            </span>
            <h2 className="display-md">Not a wireframe. Not a prototype. A working extension.</h2>
            <p
              style={{
                fontSize: 'var(--size-body)',
                lineHeight: 1.62,
                color: 'var(--text-on-dark)',
                maxWidth: 420,
              }}
            >
              The planner owns the manifest. The coder writes one file per turn. Validation is
              code, not a model. If it fails you get the reason — never a broken zip called done.
            </p>
          </div>

          <ol className="steps">
            {[
              ['01', 'Plan', 'The planner authors manifest.json and lists every file the build needs.'],
              ['02', 'Write', 'A coder agent writes one file per turn — no truncated blobs.'],
              ['03', 'Validate', 'A deterministic gate checks the result against the Manifest V3 rules.'],
              ['04', 'Package', 'Text becomes a zip you load unpacked. Nothing locked in.'],
            ].map(([n, title, body]) => (
              <li key={n}>
                <span className="step-num">{n}</span>
                <div className="stack-sm" style={{ gap: 4 }}>
                  <span className="step-title">{title}</span>
                  <span className="step-body">{body}</span>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── features ── */}
      <section id="features" className="features">
        <div className="stack" style={{ alignItems: 'center', textAlign: 'center', gap: 14 }}>
          <span className="eyebrow">What you get</span>
          <h2 className="display-md" style={{ maxWidth: 720 }}>
            Everything a real extension needs, and nothing you have to clean up.
          </h2>
        </div>

        <div className="feature-grid">
          {[
            [
              <ShieldIcon key="i" />,
              'Validation is code, not a model',
              'A deterministic Manifest V3 gate checks the file set — 42 rules, run on every build. A model asked to check its own JSON approves broken JSON.',
            ],
            [
              <FileIcon key="i" />,
              'One file per turn',
              'Each file is written on its own turn, so output limits never truncate the last one and a single bad character cannot invalidate the whole set.',
            ],
            [
              <KeyIcon key="i" />,
              'Only the permissions it uses',
              'The manifest declares what the code actually calls. No blanket host permissions, no leftovers to explain at review time.',
            ],
            [
              <EyeIcon key="i" />,
              'Read every file first',
              'The full source is browsable in the page before you download anything. No black box, no surprise dependencies.',
            ],
            [
              <PulseIcon key="i" />,
              'Live progress, honest errors',
              'Watch it plan, write, validate and package in real time. When something breaks you get the failing rule — not a spinner that never stops.',
            ],
            [
              <BoxIcon key="i" />,
              'A zip you own',
              'Download, unzip, load unpacked. The code is plain HTML, CSS and JavaScript with no build step and no runtime tied to us.',
            ],
          ].map(([icon, title, body]) => (
            <div key={title as string} className="feature-card">
              <span className="feature-icon">{icon}</span>
              <h3 className="feature-title">{title}</h3>
              <p className="feature-body">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── final CTA ── */}
      <section className="cta">
        <h2 className="display-md" style={{ maxWidth: 760 }}>
          Start shipping.
        </h2>
        <p style={{ fontSize: 'var(--size-body)', color: 'var(--text-muted)', maxWidth: 520 }}>
          Five builds a day to start. The code is yours whichever plan you&apos;re on.
        </p>
        <Link href="/login" className="btn btn-lg">
          Build your first extension
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </Link>
      </section>

      <footer className="landing-foot">
        <span className="wordmark">ExtGen</span>
        <span className="spacer" />
        <span className="tiny subtle">Prompt to Manifest V3, validated before you download.</span>
      </footer>
    </div>
  );
}

/* ── icons ── */
function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M12 3l7 3v6c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9V6l7-3z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}
function FileIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5z" />
      <path d="M14 3v5h5M9 13h6M9 17h4" />
    </svg>
  );
}
function KeyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <circle cx="8" cy="12" r="4" />
      <path d="M12 12h9M17 12v4M20 12v3" />
    </svg>
  );
}
function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" />
      <circle cx="12" cy="12" r="2.6" />
    </svg>
  );
}
function PulseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M3 12h4l3-7 4 14 3-7h4" />
    </svg>
  );
}
function BoxIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" />
      <path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" />
    </svg>
  );
}
