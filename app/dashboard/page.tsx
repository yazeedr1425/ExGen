import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Job } from '@/lib/types';
import { SiteHeader } from '@/components/SiteHeader';
import { PromptComposer } from '@/components/PromptComposer';
import { JobList } from '@/components/JobList';

// Always fresh: a job list cached across navigations would show a stale status
// right after a build finishes.
export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/login');

  const { data: jobs } = await supabase
    .from('jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(30);

  const list = (jobs ?? []) as Job[];
  const usedToday = list.filter(
    (j) => Date.now() - new Date(j.created_at).getTime() < 24 * 3600 * 1000,
  ).length;

  return (
    <>
      <SiteHeader email={auth.user.email ?? ''} buildsToday={usedToday} />

      <main className="workspace">
        <h1 className="workspace-title">What should we build?</h1>
        <PromptComposer />
      </main>

      {list.length > 0 ? (
        <section className="workspace-builds">
          <div className="workspace-builds-inner">
            <JobList jobs={list} />
          </div>
        </section>
      ) : (
        <section className="workspace-builds">
          <div className="workspace-builds-inner row" style={{ justifyContent: 'center', gap: 8 }}>
            <span className="tiny subtle">New here?</span>
            <Link href="/welcome" className="tiny" style={{ textDecoration: 'underline' }}>
              See how a build works
            </Link>
          </div>
        </section>
      )}
    </>
  );
}
