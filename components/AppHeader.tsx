import Link from 'next/link';
import { Logo } from './Logo';

/** The signed-in nav: a floating pill rather than a full-width bar, carrying
 *  the mark, the section links, and an account chip with sign-out behind it. */
export function AppHeader({ email, plan = 'Free' }: { email: string; plan?: string }) {
  const name = email.split('@')[0] || 'account';
  const initial = name.charAt(0).toUpperCase() || '·';

  return (
    <div className="apphead-wrap">
      <header className="apphead">
        <Link href="/dashboard" aria-label="Extgen home">
          <Logo size={22} />
        </Link>

        <span className="spacer" />

        <nav className="apphead-nav">
          <Link href="/builds">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M3 9h18M5 9V6a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9" />
            </svg>
            My extensions
          </Link>
          <Link href="/welcome">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M9.5 9.5a2.5 2.5 0 1 1 3 2.45V14M12 17h.01" />
            </svg>
            How it works
          </Link>
        </nav>

        <form action="/auth/signout" method="post">
          <button type="submit" className="account-chip" title={`${email} — sign out`}>
            <span className="account-avatar">{initial}</span>
            <span className="account-meta">
              <span className="account-name">{name}</span>
              <span className="account-plan">{plan}</span>
            </span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        </form>
      </header>
    </div>
  );
}
