'use client';

import { useJob } from '@/hooks/useJob';
import { isTerminal, type GeneratedFile, type Job, type JobEvent, type JobStatus } from '@/lib/types';
import { StatusPill } from './StatusPill';
import { JobTimeline } from './JobTimeline';
import { FileBrowser } from './FileBrowser';
import { DownloadButton } from './DownloadButton';

// The four visible pipeline stages and which job statuses map onto each.
const STAGES = ['Plan', 'Write', 'Validate', 'Package'] as const;
const STAGE_OF: Record<JobStatus, number> = {
  queued: 0,
  planning: 0,
  generating: 1,
  validating: 2,
  repairing: 2,
  packaging: 3,
  ready: 3,
  failed: -1,
  canceled: -1,
};

function StageStrip({ status }: { status: JobStatus }) {
  const active = STAGE_OF[status];
  const failed = status === 'failed' || status === 'canceled';
  return (
    <div className="stage-grid" style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
      {STAGES.map((name, i) => {
        const done = active > i || status === 'ready';
        const now = active === i && !failed && status !== 'ready';
        const cls = now ? 'now' : done ? '' : 'todo';
        return (
          <div key={name} className={`stage ${cls}`}>
            <span className="eyebrow stage-eyebrow">{`0${i + 1} ${name}`}</span>
            <span className="stage-name">
              {done && !now && <Check />}
              {now && <span className="spinner" style={{ width: 11, height: 11 }} />}
              {name}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function JobLive({
  initial,
}: {
  initial: { job: Job; events: JobEvent[]; files: GeneratedFile[] };
}) {
  const { job, events, files, live } = useJob(initial.job.id, initial);
  const running = !isTerminal(job.status);

  const rejectedByPolicy = events.some(
    (e) => e.stage === 'failed' && (e.payload as { rejected_by?: string } | null)?.rejected_by === 'policy_gate',
  );

  return (
    <div className="stack" style={{ gap: 20 }}>
      {/* headline */}
      <div className="stack" style={{ gap: 12 }}>
        <div className="row" style={{ gap: 12, flexWrap: 'nowrap' }}>
          <h1 className="heading-lg truncate" style={{ minWidth: 0 }}>
            {job.ext_name ?? 'Untitled extension'}
          </h1>
          <span className="spacer" />
          <StatusPill status={job.status} />
        </div>
        <p className="small muted">{job.prompt}</p>

        {(job.permissions.length > 0 || job.host_permissions.length > 0) && (
          <div className="row" style={{ gap: 6 }}>
            <span className="eyebrow">Permissions</span>
            {[...job.permissions, ...job.host_permissions].map((p) => (
              <span key={p} className="perm">
                {p}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* pipeline */}
      <StageStrip status={job.status} />

      {running && job.progress_note && (
        <p className="small row" style={{ gap: 8 }}>
          <span className="status-dot dot-building dot-pulse" style={{ width: 6, height: 6, borderRadius: 999 }} />
          {job.progress_note}
          <span className="tiny subtle">{live ? '· live' : '· reconnecting…'}</span>
        </p>
      )}

      {/* ready — install */}
      {job.status === 'ready' && (
        <div className="gradient-panel">
          <div className="gradient-panel-inner stack" style={{ gap: 16 }}>
            <h2 className="heading-md">Download. Load unpacked. Done.</h2>
            <DownloadButton jobId={job.id} slug={job.ext_slug} />
            <ol className="small muted" style={{ margin: 0, paddingLeft: '1.2em', lineHeight: 1.9 }}>
              <li>Unzip the download.</li>
              <li>
                Open <span className="code-chip">chrome://extensions</span> and turn on{' '}
                <strong>Developer mode</strong>.
              </li>
              <li>
                Click <strong>Load unpacked</strong> and pick the unzipped folder.
              </li>
            </ol>
            <p className="tiny subtle">
              The folder you select must contain <span className="code-chip">manifest.json</span> directly.
            </p>
          </div>
        </div>
      )}

      {/* failed */}
      {job.status === 'failed' && (
        <div className="notice notice-err" role="alert">
          <strong>{job.error ?? 'Validation stopped this build.'}</strong>
          {job.validation_errors && job.validation_errors.length > 0 && (
            <div className="row" style={{ gap: 8, marginTop: 10 }}>
              {job.validation_errors.map((e) => (
                <span key={e} className="code-chip">
                  {e}
                </span>
              ))}
            </div>
          )}
          {rejectedByPolicy && (
            <div className="small" style={{ marginTop: 8, color: 'var(--text-secondary)' }}>
              Nothing was charged — the policy gate runs before the first model call.
            </div>
          )}
        </div>
      )}

      {/* files */}
      {files.length > 0 && (
        <div className="card card-flush">
          <div className="card-head">
            <h3 className="heading-sm">Every file, before you download</h3>
            <span className="spacer" />
            <span className="tiny subtle">{files.length} files</span>
          </div>
          <FileBrowser files={files} />
        </div>
      )}

      {/* progress */}
      <div className="card card-flush">
        <div className="card-head">
          <h3 className="heading-sm">What ran</h3>
          <span className="spacer" />
          <span className="tiny subtle">{events.length} events</span>
        </div>
        <div style={{ padding: '12px 20px' }}>
          <JobTimeline events={events} />
        </div>
      </div>

      {/* meta */}
      <div className="row tiny subtle" style={{ gap: 14 }}>
        {job.model && (
          <span>
            Model <span className="mono">{job.model}</span>
          </span>
        )}
        {job.repair_attempts > 0 && <span>{job.repair_attempts} repair pass{job.repair_attempts === 1 ? '' : 'es'}</span>}
        {job.output_tokens != null && <span>{job.output_tokens.toLocaleString()} output tokens</span>}
        <span className="spacer" />
        <span className="mono">{job.id}</span>
      </div>
    </div>
  );
}

function Check() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="var(--mint-600)" strokeWidth="2.4">
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}
