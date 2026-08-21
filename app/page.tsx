import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function Home() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (data.user) redirect('/dashboard');

  return (
    <div style={{ background: 'var(--surface-page)', minHeight: '100vh' }}>
      {/* header */}
      <header
        className="row"
        style={{
          gap: 18,
          height: 'var(--nav-h)',
          padding: '0 28px',
          borderBottom: '1px solid var(--border-subtle)',
          flexWrap: 'nowrap',
        }}
      >
        <span className="wordmark">ExtGen</span>
        <span className="spacer" />
        <nav className="row" style={{ gap: 26, flexWrap: 'nowrap' }}>
          <Link href="/login" className="btn-uppercase" style={{ color: 'var(--text-muted)' }}>
            How it works
          </Link>
          <Link href="/login" className="btn-uppercase" style={{ color: 'var(--text-muted)' }}>
            Pricing
          </Link>
          <Link href="/login" className="btn-uppercase" style={{ color: 'var(--text-muted)' }}>
            Sign in
          </Link>
        </nav>
        <Link href="/login" className="btn btn-sm btn-uppercase">
          Get started
        </Link>
      </header>

      {/* hero */}
      <section
        style={{
          padding: '96px 28px 80px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 20,
          textAlign: 'center',
        }}
      >
        <h1 className="display-lg" style={{ maxWidth: 900 }}>
          Describe a Chrome extension.
          <br />
          Get one that actually loads.
        </h1>
        <p
          style={{
            maxWidth: 620,
            fontSize: 'var(--size-body-lg)',
            lineHeight: 'var(--lh-body-lg)',
            color: 'var(--text-muted)',
          }}
        >
          A planner writes the manifest. A coder writes each file. A deterministic validator
          checks the result against the Manifest V3 rules before you ever download it.
        </p>

        {/* composer (visual — routes to login) */}
        <div style={{ width: '100%', maxWidth: 760, marginTop: 16 }}>
          <div className="composer" style={{ textAlign: 'left' }}>
            <div style={{ color: 'var(--text-subtle)', fontSize: 16, lineHeight: 1.5, minHeight: 72 }}>
              A popup that counts my open tabs and closes duplicates…
            </div>
            <div className="composer-bar">
              <span className="chip chip-sm on">Popup</span>
              <span className="vrule" style={{ margin: '0 2px' }} />
              <span className="tiny subtle tnum">0 / 2000</span>
              <span className="spacer" />
              <Link href="/login" className="btn btn-sm">
                Build it <ArrowRight />
              </Link>
            </div>
          </div>
        </div>

        <div className="row" style={{ justifyContent: 'center', gap: 10, marginTop: 4 }}>
          <Link href="/login" className="chip">
            <LinkIcon /> Outline every external link
          </Link>
          <Link href="/login" className="chip">
            <Bookmark /> Reading list in the popup
          </Link>
          <Link href="/login" className="chip">
            <Type /> Word count for any selection
          </Link>
        </div>
      </section>

      {/* stats */}
      <section className="stat-band">
        <div className="stat-grid">
          {[
            ['2–3', 'prompts to a build people actually install'],
            ['0', 'validation errors allowed past packaging'],
            ['2.4 MB', 'a zip you own · source ready'],
            ['5 / day', 'free · $9.99/mo for 100'],
          ].map(([num, label]) => (
            <div key={label} className="stack-sm" style={{ gap: 6 }}>
              <span className="stat-num">{num}</span>
              <span className="stat-label">{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* dark section */}
      <section className="section-dark" style={{ padding: '96px 28px' }}>
        <div
          style={{
            maxWidth: 'var(--container-max)',
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)',
            gap: 64,
            alignItems: 'start',
          }}
        >
          <div className="stack" style={{ gap: 20 }}>
            <span className="eyebrow" style={{ color: 'var(--text-on-dark)' }}>
              Four agents, one contract
            </span>
            <h2 className="display-md">Not a wireframe. Not a prototype. A working extension.</h2>
            <p style={{ fontSize: 'var(--size-body)', lineHeight: 1.62, color: 'var(--text-on-dark)', maxWidth: 420 }}>
              The planner owns the manifest. The coder writes one file per turn. Validation is
              code, not a model. If it fails, you get the reason — never a broken zip called done.
            </p>
          </div>
          <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {[
              ['01', 'Plan', 'The planner authors manifest.json and lists every file the build needs.'],
              ['02', 'Write', 'A coder agent writes one file per turn — no truncated blobs.'],
              ['03', 'Validate', 'A deterministic gate checks the result against the MV3 rules.'],
              ['04', 'Package', 'Text becomes a zip you load unpacked. Nothing locked in.'],
            ].map(([n, title, body]) => (
              <li
                key={n}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '44px 1fr',
                  gap: 16,
                  padding: '20px 0',
                  borderTop: '1px solid var(--border-on-dark)',
                }}
              >
                <span
                  className="mono"
                  style={{
                    fontSize: 22,
                    background: 'var(--gradient-text-cool)',
                    WebkitBackgroundClip: 'text',
                    backgroundClip: 'text',
                    color: 'transparent',
                  }}
                >
                  {n}
                </span>
                <div className="stack-sm" style={{ gap: 4 }}>
                  <span style={{ color: '#fff', fontWeight: 500, fontSize: 'var(--size-heading-xs)' }}>{title}</span>
                  <span style={{ color: 'var(--text-on-dark)', fontSize: 14 }}>{body}</span>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* final CTA */}
      <section
        style={{
          padding: '96px 28px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 22,
          textAlign: 'center',
        }}
      >
        <h2 className="display-md" style={{ maxWidth: 760 }}>
          Start shipping.
        </h2>
        <p style={{ fontSize: 'var(--size-body)', color: 'var(--text-muted)', maxWidth: 520 }}>
          Five builds a day on the free plan. The code is yours whichever plan you&apos;re on.
        </p>
        <Link href="/login" className="btn btn-lg">
          Build your first extension <ArrowRight />
        </Link>
      </section>
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
function LinkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1" />
    </svg>
  );
}
function Bookmark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M6 4h12v16l-6-4-6 4V4z" />
    </svg>
  );
}
function Type() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 7V5h16v2M9 19h6M12 5v14" />
    </svg>
  );
}
