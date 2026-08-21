import Link from 'next/link';
import { LandingComposer } from '@/components/LandingComposer';
import { Logo } from '@/components/Logo';

/** The public marketing page. Rendered by app/page.tsx for signed-out
 *  visitors; kept as its own component so it can be viewed in isolation. */
export function LandingPage() {
  return (
    <div style={{ background: 'var(--surface-page)' }}>
      {/* ── header ── */}
      <header className="landing-nav">
        <Link href="/">
          <Logo size={26} />
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
            ['4', 'agents: planner, coder, validator, repair'],
            ['42', 'Manifest V3 rules checked on every build'],
            ['0', 'build steps — plain HTML, CSS and JavaScript'],
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

      {/* ── showcase: what a build actually emits ── */}
      <section className="showcase">
        <h2 className="showcase-title">Describe it. ExtGen builds it.</h2>

        <div className="showcase-grid">
          <div className="logpanel">
            <div className="logpanel-inner">
              <span className="eyebrow">Execution log</span>
              <ul className="loglines">
                <li>
                  <strong>Planning the manifest.</strong> Manifest V3 with{' '}
                  <span className="code-chip">tabs</span> and{' '}
                  <span className="code-chip">storage</span> permissions, a popup action, and six
                  files to write.
                </li>
                <li>
                  <strong>Writing popup/popup.js.</strong> Queries{' '}
                  <span className="code-chip">chrome.tabs.query</span>, groups duplicates by URL and
                  renders the count.
                </li>
                <li>
                  <strong>Validating.</strong> 42 rules checked — no undeclared APIs, no missing
                  icons, no async{' '}
                  <span className="code-chip">onMessage</span> trap.
                </li>
                <li>
                  <strong>Packaging.</strong> Six files zipped, uploaded, ready to load unpacked.
                </li>
              </ul>
            </div>
          </div>

          <ol className="flowsteps">
            <li>
              <ChatIcon />
              <span>Tell it what you want</span>
            </li>
            <li className="on">
              <GearIcon />
              <div className="stack-sm" style={{ gap: 6 }}>
                <span className="flowstep-title">ExtGen builds it</span>
                <span className="flowstep-body">
                  A complete extension: manifest, popup, scripts, every file. Not a wireframe. Not a
                  prototype. A working extension.
                </span>
              </div>
            </li>
            <li>
              <DownloadIcon />
              <span>Download. Install. Done.</span>
            </li>
          </ol>
        </div>
      </section>

      {/* ── prompt showcase ── */}
      <section className="prompts">
        <div className="stack" style={{ alignItems: 'center', textAlign: 'center', gap: 14 }}>
          <h2 className="display-md" style={{ maxWidth: 720 }}>
            See what you can build in minutes.
          </h2>
          <p style={{ fontSize: 'var(--size-body)', color: 'var(--text-muted)', maxWidth: 600 }}>
            Real prompts. Paste any of them into the box above and you get a working extension.
          </p>
        </div>

        <div className="promptcards">
          {[
            {
              n: 'Prompt 01',
              name: 'Tab Deduper',
              grad: 'var(--gradient-warm)',
              quote: 'A popup that counts my open tabs and closes duplicates.',
              title: 'Tidy every window',
              body: 'Reads the full tab list, groups by URL, and closes the extras — one click from the toolbar.',
            },
            {
              n: 'Prompt 02',
              name: 'Link Outliner',
              grad: 'var(--gradient-cool)',
              quote: 'Highlight every external link on a page with a coloured outline.',
              title: 'See where links go',
              body: 'A content script walks the DOM, compares hostnames, and outlines anything leaving the site.',
            },
            {
              n: 'Prompt 03',
              name: 'Reading List',
              grad: 'var(--gradient-violet)',
              quote: 'Save the current page title and URL to a reading list I can view in the popup.',
              title: 'Keep it for later',
              body: 'Stores entries in chrome.storage and renders them back in the popup, newest first.',
            },
          ].map((c) => (
            <div key={c.n} className="promptcard-wrap">
              <div className="promptcard-grad" style={{ background: c.grad }}>
                <div className="promptcard">
                  <div className="promptcard-head">
                    <span className="promptcard-icon">
                      <BoltIcon />
                    </span>
                    <div className="stack-sm" style={{ gap: 2 }}>
                      <span className="promptcard-name">{c.name}</span>
                      <span className="eyebrow">{c.n}</span>
                    </div>
                  </div>
                  <span className="badge" style={{ alignSelf: 'flex-start' }}>
                    <span className="dot" /> Writing…
                  </span>
                  <div className="promptcard-quote">
                    <span className="eyebrow">You</span>
                    <p>&ldquo;{c.quote}&rdquo;</p>
                  </div>
                </div>
              </div>
              <div className="stack-sm" style={{ gap: 6, marginTop: 16 }}>
                <span className="promptcard-title">{c.title}</span>
                <span className="feature-body">{c.body}</span>
              </div>
            </div>
          ))}
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
        <Logo size={22} />
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

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M21 12a8 8 0 0 1-8 8H7l-4 3V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8z" />
    </svg>
  );
}
function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" />
    </svg>
  );
}
function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M12 3v12M7 11l5 5 5-5M4 20h16" />
    </svg>
  );
}
function BoltIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" />
    </svg>
  );
}
