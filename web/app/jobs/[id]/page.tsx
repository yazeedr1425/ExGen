import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { GeneratedFile, Job, JobEvent } from '@/lib/types';
import { JobLive } from '@/components/JobLive';

export const dynamic = 'force-dynamic';

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/login');

  // Server-renders the first paint so there is no loading flash; the client hook
  // takes over from this exact state and only applies deltas.
  const [jobRes, eventsRes, filesRes] = await Promise.all([
    supabase.from('jobs').select('*').eq('id', id).maybeSingle(),
    supabase.from('job_events').select('*').eq('job_id', id).order('id', { ascending: true }),
    supabase.from('generated_files').select('*').eq('job_id', id).order('path', { ascending: true }),
  ]);

  // RLS makes someone else's job indistinguishable from a missing one, which is
  // the behaviour we want: no id enumeration.
  if (!jobRes.data) notFound();

  return (
    <main className="shell shell-wide">
      <div className="stack">
        <Link href="/dashboard" className="small muted">
          ← All builds
        </Link>
        <JobLive
          initial={{
            job: jobRes.data as Job,
            events: (eventsRes.data ?? []) as JobEvent[],
            files: (filesRes.data ?? []) as GeneratedFile[],
          }}
        />
      </div>
    </main>
  );
}
