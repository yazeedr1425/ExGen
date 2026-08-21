import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Job } from '@/lib/types';
import { AppHeader } from '@/components/AppHeader';
import { JobList } from '@/components/JobList';

export const dynamic = 'force-dynamic';

export default async function Builds() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/login?next=/builds');

  const { data: jobs } = await supabase
    .from('jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  const list = (jobs ?? []) as Job[];

  return (
    <>
      <AppHeader email={auth.user.email ?? ''} />
      <main className="shell shell-narrow">
        <div className="stack">
          <div className="row">
            <h1 className="heading-lg">My extensions</h1>
            <span className="spacer" />
            <span className="tiny subtle">{list.length} build{list.length === 1 ? '' : 's'}</span>
          </div>

          {list.length === 0 ? (
            <div className="card card-pad stack" style={{ alignItems: 'center', textAlign: 'center' }}>
              <p className="muted small">You have not built anything yet.</p>
              <Link href="/dashboard" className="btn">Describe your first extension</Link>
            </div>
          ) : (
            <JobList jobs={list} />
          )}
        </div>
      </main>
    </>
  );
}
