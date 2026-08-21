import Link from 'next/link';
import { Logo } from './Logo';

/** The workbench / job-view top bar: wordmark, Manifest v3 badge, builds-today
 *  counter, the signed-in email and an avatar with a sign-out form behind it. */
export function SiteHeader({ email, buildsToday }: { email: string; buildsToday?: number }) {
  const initial = email.trim().charAt(0).toUpperCase() || '·';
  return (
    <header className="topbar">
      <Link href="/dashboard">
        <Logo size={24} />
      </Link>
      <span className="badge">Manifest v3</span>
      <span className="spacer" />
      {typeof buildsToday === 'number' && (
        <>
          <span className="tiny subtle tnum">{buildsToday} of 5 builds today</span>
          <span className="vrule" />
        </>
      )}
      <span className="row" style={{ gap: 7, flexWrap: 'nowrap' }}>
        <span className="tiny muted truncate" style={{ maxWidth: 180 }}>
          {email}
        </span>
        <form action="/auth/signout" method="post" title="Sign out">
          <button
            type="submit"
            className="avatar"
            style={{ border: 'none', cursor: 'pointer' }}
            aria-label="Sign out"
          >
            {initial}
          </button>
        </form>
      </span>
    </header>
  );
}
