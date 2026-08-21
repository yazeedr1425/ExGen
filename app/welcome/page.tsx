import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SiteHeader } from '@/components/SiteHeader';
import { FirstRun } from '@/components/FirstRun';

export const dynamic = 'force-dynamic';

/** The first-run explainer, on its own route so it can be linked to and
 *  revisited. New accounts are sent here after sign-up; everyone else can
 *  reach it from the dashboard. */
export default async function Welcome() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/login?next=/welcome');

  return (
    <>
      <SiteHeader email={auth.user.email ?? ''} />

      <main className="welcome-hero">
        <span className="eyebrow">Welcome to Extgen</span>
        <h1 className="welcome-title">
          Describe a Chrome extension.
          <br />
          Get one that actually loads.
        </h1>
        <p className="welcome-sub">
          Here is what happens when you hit Build, and how the result gets into your browser.
          It takes about two minutes end to end.
        </p>
        <Link href="/dashboard" className="btn btn-lg">
          Build your first extension
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </Link>
      </main>

      <FirstRun />

      <section className="welcome-foot">
        <p className="firstrun-step-body">Ready when you are.</p>
        <Link href="/dashboard" className="btn">
          Go to the composer
        </Link>
      </section>
    </>
  );
}
