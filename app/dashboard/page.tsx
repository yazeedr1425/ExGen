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
      <div className="workbench">
        <aside className="sidebar">
          <div
            className="row"
            style={{
              gap: 8,
              padding: '8px 12px',
              borderRadius: 'var(--radius-pill)',
              background: 'var(--surface-card)',
              border: '1px solid var(--border-default)',
              boxShadow: 'var(--shadow-xs)',
              flexWrap: 'nowrap',
            }}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="var(--text-subtle)" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4-4" />
            </svg>
            <span className="tiny subtle">Filter builds</span>
          </div>

          <JobList jobs={list} />

          <span className="spacer" />

          <div
            className="stack-sm"
            style={{ padding: 12, borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-strong)', gap: 6 }}
          >
            <span className="tiny" style={{ color: 'var(--text-secondary)' }}>
              Every build is a zip you own. Nothing is locked in.
            </span>
            <span className="tiny subtle">Free plan · 5 builds a day</span>
          </div>
        </aside>

        <main className="workbench-main">
          <PromptComposer />
        </main>
      </div>
    </>
  );
}
