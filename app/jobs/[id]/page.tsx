import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { GeneratedFile, Job, JobEvent } from '@/lib/types';
import { JobLive } from '@/components/JobLive';
import { SiteHeader } from '@/components/SiteHeader';

export const dynamic = 'force-dynamic';

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();

  const [jobRes, eventsRes, filesRes] = await Promise.all([
    supabase.from('jobs').select('*').eq('id', id).maybeSingle(),
    supabase.from('job_events').select('*').eq('job_id', id).order('id', { ascending: true }),
    supabase.from('generated_files').select('*').eq('job_id', id).order('path', { ascending: true }),
  ]);

  if (!jobRes.data) notFound();

  return (
    <>
      <SiteHeader email={auth.user?.email ?? ''} />
      <main className="shell shell-narrow">
        <div className="stack">
          <Link href="/dashboard" className="tiny muted">
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
    </>
  );
}
