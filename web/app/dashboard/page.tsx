import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Job } from '@/lib/types';
import { Card, CardHead } from '@/components/ui';
import { PromptComposer } from '@/components/PromptComposer';
import { JobList } from '@/components/JobList';

// Always fresh: a job list cached across navigations would show a stale status
// right after a build finishes.
export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/login');

  // No .eq('owner', ...) needed — RLS restricts this to the caller's own rows,
  // and adding a filter here would imply the policy were optional.
  const { data: jobs } = await supabase
    .from('jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(25);

  const list = (jobs ?? []) as Job[];
  const usedToday = list.filter(
    (j) => Date.now() - new Date(j.created_at).getTime() < 24 * 3600 * 1000,
  ).length;

  return (
    <main className="shell shell-wide">
      <div className="stack">
        <PromptComposer />

        <Card flush>
          <CardHead>
            <h3>Your builds</h3>
            <span className="spacer" />
            <span className="tiny faint">{usedToday} in the last 24h</span>
          </CardHead>
          <JobList jobs={list} />
        </Card>
      </div>
    </main>
  );
}
