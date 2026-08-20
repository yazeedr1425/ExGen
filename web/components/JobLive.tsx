'use client';

import { useJob } from '@/hooks/useJob';
import { isTerminal, type GeneratedFile, type Job, type JobEvent } from '@/lib/types';
import { Badge, Card, CardHead, Notice } from './ui';
import { ProgressRail, StatusPill } from './StatusPill';
import { JobTimeline } from './JobTimeline';
import { FileBrowser } from './FileBrowser';
import { DownloadButton } from './DownloadButton';

export function JobLive({
  initial,
}: {
  initial: { job: Job; events: JobEvent[]; files: GeneratedFile[] };
}) {
  const { job, events, files, live } = useJob(initial.job.id, initial);
  const running = !isTerminal(job.status);

  // The "nothing was charged" note is only true when the Policy Gate refused the
  // prompt, because the gate sits before the first model call. Any other failure
  // — an agent error, a validation failure — happened after tokens were spent,
  // so claiming otherwise misreports the bill.
  const rejectedByPolicy = events.some(
    (e) =>
      e.stage === 'failed' &&
      (e.payload as { rejected_by?: string } | null)?.rejected_by === 'policy_gate',
  );

  return (
    <div className="stack">
      <Card>
        <div className="stack">
          <div className="row">
            <h1 style={{ minWidth: 0 }} className="truncate">
              {job.ext_name ?? 'Untitled extension'}
            </h1>
            <span className="spacer" />
            <StatusPill status={job.status} />
          </div>

          <ProgressRail status={job.status} />

          <p className="muted small">{job.prompt}</p>

          {job.progress_note && running && (
            <p className="small">
              <span className="spinner" aria-hidden="true" /> {job.progress_note}
            </p>
          )}

          {(job.permissions.length > 0 || job.host_permissions.length > 0) && (
            <div className="row">
              <span className="tiny faint">Permissions</span>
              {job.permissions.map((p) => (
                <span key={p} className="perm">{p}</span>
              ))}
              {job.host_permissions.map((p) => (
                <span key={p} className="perm">{p}</span>
              ))}
            </div>
          )}

          {running && (
            <p className="tiny faint">
              {live ? 'Live — updates stream in as they happen.' : 'Reconnecting… polling every 5s.'}
            </p>
          )}
        </div>
      </Card>

      {job.status === 'failed' && (
        <Notice tone="err" title={job.error ?? 'This build failed.'}>
          {job.validation_errors && job.validation_errors.length > 0 && (
            <pre>{job.validation_errors.map((e) => `• ${e}`).join('\n')}</pre>
          )}
          {rejectedByPolicy && (
            <div className="small" style={{ marginTop: 8 }}>
              Nothing was charged for a rejected prompt — the policy gate runs before the
              first model call.
            </div>
          )}
        </Notice>
      )}

      {job.status === 'ready' && (
        <Card>
          <div className="stack">
            <h2>Install it</h2>
            <DownloadButton jobId={job.id} slug={job.ext_slug} />
            <ol className="small muted" style={{ margin: 0, paddingLeft: '1.2em' }}>
              <li>Unzip the download.</li>
              <li>
                Open <code>chrome://extensions</code> and turn on <strong>Developer mode</strong>.
              </li>
              <li>
                Click <strong>Load unpacked</strong> and pick the unzipped folder.
              </li>
            </ol>
            <p className="tiny faint">
              The folder you select must contain <code>manifest.json</code> directly.
            </p>
          </div>
        </Card>
      )}

      <div className="grid-2">
        <Card flush>
          <CardHead>
            <h3>Progress</h3>
            <span className="spacer" />
            <span className="tiny faint">{events.length} events</span>
          </CardHead>
          <div style={{ padding: 'var(--s3) var(--s4)' }}>
            <JobTimeline events={events} />
          </div>
        </Card>

        <Card flush>
          <CardHead>
            <h3>Files</h3>
            <span className="spacer" />
            {files.length > 0 && <span className="tiny faint">{files.length} files</span>}
          </CardHead>
          <FileBrowser files={files} />
        </Card>
      </div>

      <Card>
        <div className="row small muted">
          {job.model && (
            <span>
              Model <span className="mono">{job.model}</span>
            </span>
          )}
          {job.repair_attempts > 0 && (
            <Badge tone="warn">
              {job.repair_attempts} repair pass{job.repair_attempts === 1 ? '' : 'es'}
            </Badge>
          )}
          {job.output_tokens != null && <span>{job.output_tokens.toLocaleString()} output tokens</span>}
          {job.n8n_execution_id && (
            <span>
              Execution <span className="mono">{job.n8n_execution_id}</span>
            </span>
          )}
          <span className="spacer" />
          <span className="mono tiny faint">{job.id}</span>
        </div>
      </Card>
    </div>
  );
}
