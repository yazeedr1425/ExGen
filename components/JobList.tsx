import Link from 'next/link';
import type { Job } from '@/lib/types';
import { Empty } from './ui';
import { StatusPill } from './StatusPill';

function ago(iso: string) {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

export function JobList({ jobs }: { jobs: Job[] }) {
  if (!jobs.length) {
    return <Empty>No builds yet. Describe an extension above to make your first one.</Empty>;
  }

  return (
    <ul className="joblist">
      {jobs.map((job) => (
        <li key={job.id}>
          <Link href={`/jobs/${job.id}`} className="joblink">
            <span style={{ minWidth: 0, flex: 1 }}>
              <span className="truncate" style={{ display: 'block', fontWeight: 550 }}>
                {job.ext_name ?? job.prompt}
              </span>
              {job.ext_name && (
                <span className="truncate small muted" style={{ display: 'block' }}>
                  {job.prompt}
                </span>
              )}
            </span>
            <StatusPill status={job.status} />
            <span className="tiny faint" style={{ width: 66, textAlign: 'right' }}>
              {ago(job.created_at)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
