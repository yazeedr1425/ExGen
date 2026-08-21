import Link from 'next/link';
import { isTerminal, type Job, type JobStatus } from '@/lib/types';

function ago(iso: string) {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

type Bucket = 'building' | 'ready' | 'failed';

function bucketOf(status: JobStatus): Bucket {
  if (status === 'ready') return 'ready';
  if (status === 'failed' || status === 'canceled') return 'failed';
  return 'building';
}

const DOT: Record<Bucket, string> = {
  building: 'dot-building',
  ready: 'dot-ready',
  failed: 'dot-failed',
};

const RUNNING_NOTE: Record<string, string> = {
  queued: 'Queued',
  planning: 'Planning',
  generating: 'Writing code',
  validating: 'Validating',
  repairing: 'Repairing',
  packaging: 'Packaging',
};

function meta(job: Job): string {
  const b = bucketOf(job.status);
  if (b === 'building') return `${RUNNING_NOTE[job.status] ?? 'Working'}…`;
  if (b === 'failed') {
    const n = job.validation_errors?.length ?? 0;
    return n ? `${n} validation error${n === 1 ? '' : 's'}` : 'Needs a fix';
  }
  return ago(job.created_at);
}

function Group({ title, jobs }: { title: string; jobs: Job[] }) {
  if (!jobs.length) return null;
  return (
    <div className="sidebar-group">
      <div className="eyebrow" style={{ padding: '6px 8px' }}>
        {title}
      </div>
      {jobs.map((job) => {
        const b = bucketOf(job.status);
        return (
          <Link key={job.id} href={`/jobs/${job.id}`} className={`build-item ${!isTerminal(job.status) ? 'active' : ''}`}>
            <span className={`status-dot ${DOT[b]} ${b === 'building' ? 'dot-pulse' : ''}`} />
            <span style={{ minWidth: 0 }}>
              <span className="build-item-name">{job.ext_name ?? job.prompt}</span>
              <span className="build-item-meta">{meta(job)}</span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}

export function JobList({ jobs }: { jobs: Job[] }) {
  const building = jobs.filter((j) => bucketOf(j.status) === 'building');
  const ready = jobs.filter((j) => bucketOf(j.status) === 'ready');
  const failed = jobs.filter((j) => bucketOf(j.status) === 'failed');

  if (!jobs.length) {
    return (
      <p className="tiny subtle" style={{ padding: '8px 10px' }}>
        No builds yet. Describe an extension to make your first one.
      </p>
    );
  }

  return (
    <div className="stack" style={{ gap: 14 }}>
      <Group title="Building" jobs={building} />
      <Group title="Ready to install" jobs={ready} />
      <Group title="Needs a fix" jobs={failed} />
    </div>
  );
}
