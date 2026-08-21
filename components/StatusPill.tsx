import { Badge } from './ui';
import { isTerminal, type JobStatus } from '@/lib/types';

const TONE: Record<JobStatus, 'neutral' | 'active' | 'ok' | 'warn' | 'err'> = {
  queued: 'neutral',
  planning: 'active',
  generating: 'active',
  validating: 'active',
  repairing: 'warn',
  packaging: 'active',
  ready: 'ok',
  failed: 'err',
  canceled: 'neutral',
};

const LABEL: Record<JobStatus, string> = {
  queued: 'Queued',
  planning: 'Planning',
  generating: 'Writing code',
  validating: 'Validating',
  repairing: 'Repairing',
  packaging: 'Packaging',
  ready: 'Ready',
  failed: 'Not shippable yet',
  canceled: 'Canceled',
};

export function StatusPill({ status }: { status: JobStatus }) {
  const running = !isTerminal(status);
  return (
    <Badge tone={TONE[status]}>
      {running && <span className="spinner" style={{ width: 10, height: 10 }} aria-hidden="true" />}
      {LABEL[status]}
    </Badge>
  );
}
