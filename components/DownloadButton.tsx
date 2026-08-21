'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ensureSession } from '@/lib/supabase/session';
import { Button, Notice } from './ui';

/** Asks job-download for a short-lived signed URL, then navigates to it.
 *  The URL is minted per click and expires in 5 minutes, so it is never stored
 *  in the page or shared in a link. */
export function DownloadButton({ jobId, slug }: { jobId: string; slug: string | null }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setBusy(true);
    setError(null);

    const supabase = createClient();

    // job-download needs a real user JWT, not the anon key. Someone who opened
    // a build link without building anything first has no session yet, and the
    // call comes back "unauthorized"; mint a guest one the same way the
    // composers do. Ownership is not checked, so any session can fetch the zip.
    try {
      await ensureSession(supabase);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start a session.');
      setBusy(false);
      return;
    }

    const { data, error: fnError } = await supabase.functions.invoke('job-download', {
      body: { job_id: jobId },
    });

    if (fnError) {
      let message = fnError.message;
      const res = (fnError as { context?: Response }).context;
      if (res && typeof res.json === 'function') {
        try {
          const body = await res.json();
          if (body?.error) message = body.error;
        } catch {
          /* keep the wrapper message */
        }
      }
      setError(message);
      setBusy(false);
      return;
    }

    const url = (data as { url?: string } | null)?.url;
    if (!url) {
      setError('No download URL was returned.');
      setBusy(false);
      return;
    }

    window.location.href = url;
    setBusy(false);
  }

  return (
    <div className="stack-sm">
      <Button variant="primary" onClick={download} loading={busy}>
        {busy ? 'Preparing…' : `Download ${slug ?? 'extension'}.zip`}
      </Button>
      {error && <Notice tone="err" title={error} />}
    </div>
  );
}
