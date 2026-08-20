'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { isTerminal, type GeneratedFile, type Job, type JobEvent } from '@/lib/types';

/**
 * Owns every live data concern for one job so components stay presentational.
 *
 * Two mechanisms on purpose:
 *   1. Realtime, for instant updates.
 *   2. A slow poll while the job is running, as a fallback.
 *
 * The poll is not redundancy theatre. A dropped websocket, a sleeping laptop, or
 * a missed event while the tab was backgrounded would otherwise leave the UI
 * spinning forever on a job that finished minutes ago. Both stop the moment the
 * status is terminal.
 */
export function useJob(
  jobId: string,
  initial: { job: Job; events: JobEvent[]; files: GeneratedFile[] },
) {
  const [job, setJob] = useState<Job>(initial.job);
  const [events, setEvents] = useState<JobEvent[]>(initial.events);
  const [files, setFiles] = useState<GeneratedFile[]>(initial.files);
  const [live, setLive] = useState(false);

  // Read inside intervals without making them a dependency, which would tear the
  // subscription down and rebuild it on every single status change.
  const statusRef = useRef(job.status);
  statusRef.current = job.status;
  const filesLoadedRef = useRef(initial.files.length > 0);

  const refetch = useCallback(async () => {
    const supabase = createClient();

    const [jobRes, eventRes] = await Promise.all([
      supabase.from('jobs').select('*').eq('id', jobId).maybeSingle(),
      supabase.from('job_events').select('*').eq('job_id', jobId).order('id', { ascending: true }),
    ]);

    if (jobRes.data) setJob(jobRes.data as Job);
    if (eventRes.data) setEvents(eventRes.data as JobEvent[]);

    // Files only exist once the callback delivered them, so fetch them once the
    // job reaches ready rather than polling for rows that cannot be there yet.
    const status = (jobRes.data as Job | null)?.status;
    if (status === 'ready' && !filesLoadedRef.current) {
      const fileRes = await supabase
        .from('generated_files')
        .select('*')
        .eq('job_id', jobId)
        .order('path', { ascending: true });
      if (fileRes.data && fileRes.data.length) {
        setFiles(fileRes.data as GeneratedFile[]);
        filesLoadedRef.current = true;
      }
    }
  }, [jobId]);

  useEffect(() => {
    if (isTerminal(initial.job.status)) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`job:${jobId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'jobs', filter: `id=eq.${jobId}` },
        (payload) => {
          const next = payload.new as Job;
          setJob(next);
          if (next.status === 'ready') void refetch();
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'job_events', filter: `job_id=eq.${jobId}` },
        (payload) => {
          const evt = payload.new as JobEvent;
          setEvents((prev) => (prev.some((e) => e.id === evt.id) ? prev : [...prev, evt]));
        },
      )
      .subscribe((status) => setLive(status === 'SUBSCRIBED'));

    const poll = setInterval(() => {
      if (isTerminal(statusRef.current)) return;
      void refetch();
    }, 5000);

    return () => {
      clearInterval(poll);
      void supabase.removeChannel(channel);
    };
  }, [jobId, initial.job.status, refetch]);

  return { job, events, files, live, refetch };
}
