import { Badge } from './ui';
import { isTerminal, STAGE_ORDER, type JobStatus } from '@/lib/types';

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
  failed: 'Failed',
  canceled: 'Canceled',
};

export function StatusPill({ status }: { status: JobStatus }) {
  const running = !isTerminal(status);
  return (
    <Badge tone={TONE[status]}>
      {running && <span className="spinner" aria-hidden="true" />}
      {LABEL[status]}
    </Badge>
  );
}

/** Coarse progress rail. `repairing` deliberately maps back onto `validating`
 *  rather than adding a step, because a repair is a retry of validation, not
 *  forward progress — showing it as advancement would be a lie. */
export function ProgressRail({ status }: { status: JobStatus }) {
  const failed = status === 'failed' || status === 'canceled';
  const effective: JobStatus = status === 'repairing' ? 'validating' : status;
  const idx = STAGE_ORDER.indexOf(effective);

  return (
    <div className="rail" aria-hidden="true">
      {STAGE_ORDER.map((stage, i) => {
        let cls = 'rail-step';
        if (failed && i <= Math.max(idx, 0)) cls += ' bad';
        else if (idx > i) cls += ' done';
        else if (idx === i) cls += status === 'ready' ? ' done' : ' now';
        return <div key={stage} className={cls} />;
      })}
    </div>
  );
}
